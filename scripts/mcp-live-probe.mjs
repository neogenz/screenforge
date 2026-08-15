import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Le démon MCP, de bout en bout, sans navigateur.
 *
 * Ce que les tests unitaires ne peuvent pas dire : que le processus démarre
 * vraiment. `node` lit ces sources en dépouillant les types à la volée, et la
 * moindre syntaxe qui demande une réécriture — une propriété déclarée dans les
 * paramètres du constructeur, par exemple — le fait mourir au lancement sans
 * qu'aucune suite compilée par Vitest ne s'en aperçoive. La sonde lance donc le
 * binaire, lui parle le vrai JSON-RPC sur stdio, et joue l'éditeur en face.
 *
 * Elle vérifie aussi la règle qui n'a pas de second filet : **rien sur
 * stdout** hors trames JSON-RPC. Un `console.log` égaré y coupe une trame en
 * deux, et l'agent perd la connexion sans pouvoir dire pourquoi.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DAEMON = fileURLToPath(new URL('../apps/mcp/src/main.ts', import.meta.url))
const ORIGIN = 'http://localhost:5173'
const READY_TIMEOUT_MS = 15_000

/**
 * Un PNG d'un pixel, rendu par le faux éditeur.
 *
 * Ce qui se vérifie ici est le transport — que la demande de rendu parte, que
 * l'image revienne en bloc `image` et non en URL. La peinture, elle, est
 * vérifiée dans un vrai navigateur par `e2e/mcp-assets.spec.ts`.
 */
const ONE_PIXEL_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

/**
 * Assez de PNG pour que le lecteur d'en-tête du démon y lise une taille.
 *
 * Le coffre ne décode pas : il lit l'IHDR et sert les octets tels quels. Un
 * fichier plus complet n'ajouterait rien à ce que la sonde observe, et cacherait
 * derrière `sharp` la seule chose qu'elle regarde — que le chemin local reste
 * sur cette machine.
 *
 * @param {number} width
 * @param {number} height
 */
function pngHeader(width, height) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const head = Buffer.alloc(8)
  head.writeUInt32BE(13, 0)
  head.write('IHDR', 4, 'ascii')
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    head,
    ihdr,
    Buffer.alloc(4),
  ])
}

/* Le contrat est importé par chemin, pas par nom : le paquet n'est une
   dépendance que des applications, et la sonde vit à la racine. */
const contract = await import('../packages/project-format/src/index.ts')

async function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()
      if (address === null || typeof address === 'string')
        return reject(new Error('port introuvable'))
      probe.close(() => resolve(address.port))
    })
  })
}

/**
 * Le démon lancé, avec ses trois flux garantis par `stdio: ['pipe','pipe','pipe']`.
 *
 * @typedef {import('node:child_process').ChildProcessByStdio<
 *   import('node:stream').Writable,
 *   import('node:stream').Readable,
 *   import('node:stream').Readable
 * >} Daemon
 */

/**
 * Un client MCP minimal : une trame JSON par ligne, sur stdio.
 *
 * Les réponses sont typées `any` et c'est délibéré : décrire ici la forme de
 * chaque résultat MCP recopierait un schéma que le SDK possède déjà, pour une
 * sonde dont le rôle est justement de vérifier ce qui arrive sur le fil.
 */
class StdioClient {
  /** @type {Daemon} */ #child
  /** @type {Map<number, (message: any) => void>} */ #pending = new Map()
  #nextId = 1
  #buffer = ''
  stdout = ''
  stderr = ''

  /** @param {Daemon} child */
  constructor(child) {
    this.#child = child
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      this.stdout += chunk
      this.#buffer += chunk
      let newline = this.#buffer.indexOf('\n')
      while (newline >= 0) {
        const line = this.#buffer.slice(0, newline).trim()
        this.#buffer = this.#buffer.slice(newline + 1)
        if (line) this.#deliver(line)
        newline = this.#buffer.indexOf('\n')
      }
    })
    child.stderr.on('data', (chunk) => {
      this.stderr += chunk
    })
  }

  /** @param {string} line */
  #deliver(line) {
    let message
    try {
      message = JSON.parse(line)
    } catch {
      throw new Error(`stdout pollué par du texte hors JSON-RPC : ${line.slice(0, 200)}`)
    }
    const pending = this.#pending.get(message.id)
    if (!pending) return
    this.#pending.delete(message.id)
    pending(message)
  }

  /**
   * @param {string} method
   * @param {unknown} params
   * @returns {Promise<any>}
   */
  send(method, params) {
    const id = this.#nextId++
    this.#child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${method} sans réponse`)), READY_TIMEOUT_MS)
      this.#pending.set(id, (message) => {
        clearTimeout(timer)
        if (message.error) reject(new Error(`${method} : ${message.error.message}`))
        else resolve(message.result)
      })
    })
  }

  /**
   * @param {string} method
   * @param {unknown} params
   */
  notify(method, params) {
    this.#child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`)
  }
}

/**
 * @typedef {{ tool: string; args: Record<string, unknown> }} ProbeCall
 * @typedef {{ screenId?: string; maxWidth?: number }} RelayRender
 * @typedef {{ name: string; description?: string; screenId?: string }} RelayTemplateSave
 * @typedef {{ id: string; calls?: ProbeCall[]; render?: RelayRender; saveTemplate?: RelayTemplateSave; listTemplates?: true }} RelayRequest
 * @typedef {{ id: string; mediaType: string; bytes: number }} ProbeClaim
 * @typedef {(request: RelayRequest) => unknown} Answer
 * @typedef {{ content: { type: string; text?: string; data?: string; mimeType?: string }[]; isError?: boolean }} CallToolResult
 */

/**
 * L'éditeur, réduit à ce que le relais attend de lui.
 *
 * Le flux est lu avec `fetch` plutôt qu'avec `EventSource`, qui n'est pas un
 * global de Node ici — et le navigateur, lui, en a un. Le découpage des trames
 * SSE tient en dix lignes ; une dépendance pour ça n'en vaut pas le prix.
 */
class FakeEditor {
  /** @type {string} */ #base
  /** @type {string} */ #token = ''
  #controller = new AbortController()
  /** @type {ProbeCall[]} */ #applied = []
  /** @type {RelayRender[]} */ #rendered = []
  /** @type {ProbeClaim[]} */ #claimed = []
  /** @type {RelayTemplateSave[]} */ #templates = []
  #listed = 0

  /** @param {string} base */
  constructor(base) {
    this.#base = base
  }

  get applied() {
    return this.#applied
  }

  get rendered() {
    return this.#rendered
  }

  get claimed() {
    return this.#claimed
  }

  get token() {
    return this.#token
  }

  get templates() {
    return this.#templates
  }

  get listed() {
    return this.#listed
  }

  /** @param {string} id */
  async #claim(id) {
    const response = await fetch(`${this.#base}/asset/${id}`, {
      headers: { Origin: ORIGIN, Authorization: `Bearer ${this.#token}` },
    })
    assert.equal(response.status, 200, `le coffre refuse l’asset ${id}`)
    this.#claimed.push({
      id,
      mediaType: response.headers.get('content-type') ?? '',
      bytes: (await response.arrayBuffer()).byteLength,
    })
  }

  /** @param {Answer} answer */
  async connect(answer) {
    const paired = await fetch(`${this.#base}/pair`, {
      method: 'POST',
      headers: { Origin: ORIGIN },
    })
    assert.equal(paired.status, 200, 'appairage refusé à une origine admise')
    this.#token = (await paired.json()).token

    const stream = await fetch(`${this.#base}/events?token=${this.#token}`, {
      headers: { Origin: ORIGIN, Accept: 'text/event-stream' },
      signal: this.#controller.signal,
    })
    assert.equal(stream.status, 200, 'le flux SSE ne s’est pas ouvert')
    void this.#read(stream.body, answer)
    await this.push({ name: 'Sonde', screens: [{ id: 'ecran-1', name: 'Accueil', layers: [] }] })
  }

  /**
   * @param {ReadableStream<Uint8Array> | null} body
   * @param {Answer} answer
   */
  async #read(body, answer) {
    if (!body) throw new Error('flux SSE sans corps')
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) return
        buffer += decoder.decode(value, { stream: true })
        let boundary = buffer.indexOf('\n\n')
        while (boundary >= 0) {
          const frame = buffer.slice(0, boundary)
          buffer = buffer.slice(boundary + 2)
          if (/^event:\s*calls$/m.test(frame)) {
            /** @type {RelayRequest} */
            const request = JSON.parse(/^data:\s*(.*)$/m.exec(frame)?.[1] ?? 'null')
            if (request.saveTemplate) {
              this.#templates.push(request.saveTemplate)
              await this.#respond(request, { id: 'gabarit-1', name: request.saveTemplate.name })
            } else if (request.listTemplates) {
              this.#listed += 1
              await this.#respond(request, { templates: this.#templates })
            } else if (request.render) {
              this.#rendered.push(request.render)
              // Un PNG d'un pixel : ce qui se vérifie ici est le transport, pas
              // la peinture — le vrai rendu est celui de `e2e/mcp-assets`.
              await this.#respond(request, {
                screenId: request.render.screenId ?? 'ecran-1',
                width: request.render.maxWidth ?? 640,
                height: 1,
                data: ONE_PIXEL_PNG,
              })
            } else {
              this.#applied.push(...(request.calls ?? []))
              // La page va chercher chez le démon les images qu'elle ne connaît
              // pas : c'est cet aller-retour qui prouve que le chemin local est
              // resté sur la machine et que seul l'identifiant a voyagé.
              for (const call of request.calls ?? []) {
                const id = call.args?.assetId
                if (typeof id === 'string') await this.#claim(id)
              }
              await this.#respond(request, answer(request))
            }
          }
          boundary = buffer.indexOf('\n\n')
        }
      }
    } catch (error) {
      if (!(error instanceof Error) || error.name !== 'AbortError') throw error
    }
  }

  /** @param {unknown} state */
  async push(state) {
    await fetch(`${this.#base}/state`, {
      method: 'POST',
      headers: {
        Origin: ORIGIN,
        Authorization: `Bearer ${this.#token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ state }),
    })
  }

  /**
   * @param {RelayRequest} request
   * @param {unknown} result
   */
  async #respond(request, result) {
    await fetch(`${this.#base}/result`, {
      method: 'POST',
      headers: {
        Origin: ORIGIN,
        Authorization: `Bearer ${this.#token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: request.id, ok: true, result }),
    })
  }

  close() {
    this.#controller.abort()
  }
}

/** @param {CallToolResult} result */
function textOf(result) {
  return result.content.map((block) => block.text ?? '').join('\n')
}

async function main() {
  const port = await freePort()
  const child = spawn(process.execPath, [DAEMON], {
    cwd: ROOT,
    env: { ...process.env, SCREENFORGE_MCP_PORT: String(port) },
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  child.on('error', (error) => {
    throw error
  })

  const client = new StdioClient(child)
  const editor = new FakeEditor(`http://127.0.0.1:${port}`)

  try {
    const initialized = await client.send('initialize', {
      protocolVersion: '2026-07-28',
      capabilities: {},
      clientInfo: { name: 'mcp-live-probe', version: '0.1.0' },
    })
    assert.equal(initialized.serverInfo.name, 'screenforge')
    client.notify('notifications/initialized', {})

    // 0. Le catalogue publié est exactement le contrat partagé, plus le lot.
    const { AI_TOOLS } = contract.createAiTools({
      deviceModels: contract.DEVICE_MODEL_IDS,
      shapeIds: contract.SHAPE_IDS,
      iconIds: contract.ICON_IDS,
      fonts: contract.CONTENT_FONTS,
    })
    /** @type {{ name: string; inputSchema: any }[]} */
    const tools = (await client.send('tools/list', {})).tools
    assert.deepEqual(
      tools.map((tool) => tool.name).sort(),
      [
        ...AI_TOOLS.map((tool) => `screenforge_${tool.name}`),
        'screenforge_apply',
        /* `add_image` n'apparaît pas deux fois : la version qui prend un chemin
           local remplace celle du contrat sous le même nom, elle ne s'y ajoute
           pas. Les trois autres sont des noms de plus. */
        'screenforge_get_thumbnail',
        'screenforge_save_template',
        'screenforge_list_templates',
      ].sort(),
      'tools/list ne publie pas exactement le contrat partagé',
    )
    const addIcon = tools.find((tool) => tool.name === 'screenforge_add_icon')
    assert.ok(addIcon, 'screenforge_add_icon absent de tools/list')
    assert.deepEqual(
      addIcon.inputSchema.properties.iconId.enum,
      [...contract.ICON_IDS],
      'le schéma publié ne porte pas le catalogue d’icônes',
    )

    // 1. Aucun éditeur : l'erreur dit quoi faire, elle ne dit pas « échec ».
    const orphan = await client.send('tools/call', {
      name: 'screenforge_add_screen',
      arguments: { name: 'Accueil' },
    })
    assert.equal(orphan.isError, true, 'un appel sans éditeur devrait échouer')
    assert.match(textOf(orphan), /Connexion MCP/, 'l’erreur ne dit pas comment brancher l’éditeur')

    // 2. Un identifiant hors catalogue est refusé ici, avec les valeurs admises.
    const offCatalog = await client.send('tools/call', {
      name: 'screenforge_add_icon',
      arguments: { iconId: 'licorne' },
    })
    assert.equal(offCatalog.isError, true, 'un identifiant inconnu devrait être refusé')
    const refusal = textOf(offCatalog)
    assert.match(refusal, /hors catalogue/, 'le refus ne nomme pas la cause')
    assert.match(refusal, /"enum"/, 'le refus ne liste pas les valeurs admises')

    // 3. Éditeur branché : l'aller-retour aboutit, et la lecture voit son état.
    await editor.connect((request) => ({ applied: request.calls?.length ?? 0 }))

    const round = await client.send('tools/call', {
      name: 'screenforge_add_screen',
      arguments: { name: 'Budget' },
    })
    assert.equal(round.isError, undefined, `aller-retour refusé : ${textOf(round)}`)
    assert.deepEqual(JSON.parse(textOf(round)), { applied: 1 })
    assert.deepEqual(editor.applied, [{ tool: 'add_screen', args: { name: 'Budget' } }])

    const state = await client.send('tools/call', {
      name: 'screenforge_get_project_state',
      arguments: {},
    })
    assert.equal(JSON.parse(textOf(state)).name, 'Sonde', 'l’état poussé n’est pas relu')

    // 4. Un lot part en une seule livraison, et non appel par appel.
    const batch = await client.send('tools/call', {
      name: 'screenforge_apply',
      arguments: {
        calls: [
          { tool: 'add_screen', args: { name: 'Partage' } },
          { tool: 'add_text', args: { content: 'Vos dépenses, enfin lisibles' } },
        ],
      },
    })
    assert.deepEqual(JSON.parse(textOf(batch)), { applied: 2 }, 'le lot n’est pas arrivé entier')

    // 5. La vignette revient en image, pas en URL vers une boucle locale.
    const thumbnail = await client.send('tools/call', {
      name: 'screenforge_get_thumbnail',
      arguments: { screenId: 'ecran-1', maxWidth: 480 },
    })
    assert.equal(thumbnail.isError, undefined, `vignette refusée : ${textOf(thumbnail)}`)
    assert.deepEqual(editor.rendered, [{ screenId: 'ecran-1', maxWidth: 480 }])
    /** @type {CallToolResult} */
    const rendered = thumbnail
    const image = rendered.content.find((block) => block.type === 'image')
    assert.ok(image, 'la vignette ne rapporte aucun bloc image')
    assert.equal(image.mimeType, 'image/png')
    assert.equal(image.data, ONE_PIXEL_PNG, 'le PNG rendu par la page n’a pas traversé intact')

    // 6. Une image locale entre par son chemin, et n'en ressort que par son
    //    identifiant : c'est le coffre qui la sert, sur jeton.
    const dir = await mkdtemp(join(tmpdir(), 'screenforge-probe-'))
    const capture = join(dir, 'accueil.png')
    await writeFile(capture, pngHeader(1290, 2796))

    const posed = await client.send('tools/call', {
      name: 'screenforge_add_image',
      arguments: { path: capture, role: 'screenshot', slot: 'ecran-1' },
    })
    assert.equal(posed.isError, undefined, `image refusée : ${textOf(posed)}`)
    /* Annoté : `assert.deepEqual` porte une signature d'assertion, et l'appel
       de l'étape 3 a rétréci `editor.applied` au lot qu'il comparait. */
    /** @type {ProbeCall | undefined} */
    const device = editor.applied.at(-1)
    assert.ok(device, 'aucun appel n’est parti vers la page')
    assert.equal(device.tool, 'add_device', 'une capture doit poser un cadre iPhone')
    assert.deepEqual(
      [device.args.screenshotWidth, device.args.screenshotHeight],
      [1290, 2796],
      'les dimensions ne sont pas celles lues dans l’en-tête',
    )
    assert.ok(
      !JSON.stringify(device).includes(dir),
      'le chemin local a voyagé jusqu’à la page — seul l’identifiant doit sortir',
    )
    assert.equal(editor.claimed.length, 1, 'la page n’est pas allée chercher l’image au coffre')
    assert.equal(editor.claimed[0].mediaType, 'image/png')
    assert.equal(editor.claimed[0].id, device.args.assetId)

    // Le coffre ne sert que ce qu'un appel d'outil y a fait entrer.
    const stray = await fetch(`http://127.0.0.1:${port}/asset/jamais-offert`, {
      headers: { Origin: ORIGIN, Authorization: `Bearer ${editor.token}` },
    })
    assert.equal(stray.status, 404, 'le coffre sert un identifiant que personne n’a offert')

    // 7. Les gabarits passent par la page et n'écrivent rien dans le projet.
    const kept = await client.send('tools/call', {
      name: 'screenforge_save_template',
      arguments: { name: 'Ouverture', screenId: 'ecran-1' },
    })
    assert.equal(kept.isError, undefined, `gabarit refusé : ${textOf(kept)}`)
    assert.deepEqual(editor.templates, [{ name: 'Ouverture', screenId: 'ecran-1' }])

    const library = await client.send('tools/call', {
      name: 'screenforge_list_templates',
      arguments: {},
    })
    assert.equal(library.isError, undefined, `liste refusée : ${textOf(library)}`)
    assert.equal(editor.listed, 1, 'la liste n’a pas été demandée à la page')

    // 8. Le canal JSON-RPC est resté propre.
    for (const line of client.stdout.split('\n').filter((entry) => entry.trim())) {
      JSON.parse(line)
    }
    assert.match(client.stderr, /Relais ScreenForge/, 'les journaux ne partent pas sur stderr')

    console.log(
      `Sonde MCP : ${tools.length} outils, aller-retour, lot, vignette, image locale et gabarits vérifiés.`,
    )
  } finally {
    editor.close()
    child.kill('SIGTERM')
  }
}

await main()
