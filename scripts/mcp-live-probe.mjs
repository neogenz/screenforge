import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
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
 * @typedef {{ id: string; calls: ProbeCall[] }} RelayRequest
 * @typedef {(request: RelayRequest) => unknown} Answer
 * @typedef {{ content: { type: string; text?: string }[]; isError?: boolean }} CallToolResult
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

  /** @param {string} base */
  constructor(base) {
    this.#base = base
  }

  get applied() {
    return this.#applied
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
            this.#applied.push(...request.calls)
            await this.#respond(request, answer(request))
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
      [...AI_TOOLS.map((tool) => `screenforge_${tool.name}`), 'screenforge_apply'].sort(),
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
    await editor.connect((request) => ({ applied: request.calls.length }))

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

    // 5. Le canal JSON-RPC est resté propre.
    for (const line of client.stdout.split('\n').filter((entry) => entry.trim())) {
      JSON.parse(line)
    }
    assert.match(client.stderr, /Relais ScreenForge/, 'les journaux ne partent pas sur stderr')

    console.log(`Sonde MCP : ${tools.length} outils, aller-retour et lot vérifiés.`)
  } finally {
    editor.close()
    child.kill('SIGTERM')
  }
}

await main()
