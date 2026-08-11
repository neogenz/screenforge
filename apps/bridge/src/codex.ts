import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createInterface } from 'node:readline'

/**
 * Le client `codex app-server`, réduit à ce dont le pont a besoin.
 *
 * Le protocole est du JSON-RPC en lignes : un objet JSON par ligne sur stdin,
 * un par ligne sur stdout, les réponses portant l'`id` de la requête et les
 * notifications n'en portant pas. Les formes utilisées ici ont été relevées sur
 * `codex app-server generate-json-schema` (0.147.0), puis vérifiées en direct
 * pour `initialize`, `model/list` et `thread/start`.
 *
 * **Codex garde son authentification.** Le pont ne lit jamais `~/.codex`, ne
 * copie aucun jeton, n'inspecte aucune variable d'environnement de connexion :
 * il lance le binaire que l'utilisateur a déjà installé et connecté, et lui
 * parle. Un pont qui manipulerait ces jetons serait un voleur d'identifiants
 * avec de bonnes intentions.
 */

interface Pending {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
}

export class CodexUnavailableError extends Error {}

export interface CodexModel {
  id: string
  displayName: string
  reasoningEfforts: string[]
}

export interface TurnRequest {
  prompt: string
  outputSchema: unknown
  model?: string
  signal?: AbortSignal
}

export class CodexClient {
  private child: ChildProcessWithoutNullStreams | null = null
  private nextId = 1
  private readonly pending = new Map<number, Pending>()
  /** Le texte final de chaque tour, agrégé depuis `item/completed`. */
  private messages: string[] = []

  constructor(
    private readonly command = process.env.SCREENFORGE_CODEX_BIN ?? 'codex',
    private readonly cwd = process.cwd(),
  ) {}

  private start(): ChildProcessWithoutNullStreams {
    if (this.child) return this.child
    let child: ChildProcessWithoutNullStreams
    try {
      child = spawn(this.command, ['app-server'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: this.cwd,
      })
    } catch (cause) {
      throw new CodexUnavailableError(String(cause))
    }
    child.on('error', () => this.fail(new CodexUnavailableError('codex introuvable')))
    child.on('exit', () => this.fail(new CodexUnavailableError('codex s’est arrêté')))

    createInterface({ input: child.stdout }).on('line', (line) => this.receive(line))
    // stderr est lu et jeté : le laisser se remplir bloquerait le processus.
    child.stderr.resume()

    this.child = child
    return child
  }

  private fail(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error)
    this.pending.clear()
    this.child = null
  }

  private receive(line: string): void {
    let parsed: {
      id?: number
      result?: unknown
      error?: { message?: string }
      method?: string
      params?: unknown
    }
    try {
      parsed = JSON.parse(line)
    } catch {
      return
    }
    if (typeof parsed.id === 'number') {
      const pending = this.pending.get(parsed.id)
      if (!pending) return
      this.pending.delete(parsed.id)
      if (parsed.error) pending.reject(new Error(parsed.error.message ?? 'Erreur Codex'))
      else pending.resolve(parsed.result)
      return
    }
    if (parsed.method === 'item/completed') {
      const item = (parsed.params as { item?: { type?: string; text?: string } } | undefined)?.item
      if (item?.type === 'agentMessage' && typeof item.text === 'string') {
        this.messages.push(item.text)
      }
    }
  }

  private request(method: string, params: unknown): Promise<unknown> {
    const child = this.start()
    const id = this.nextId++
    const payload = `${JSON.stringify({ id, method, params })}\n`
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      child.stdin.write(payload, (error) => {
        if (error) {
          this.pending.delete(id)
          reject(new CodexUnavailableError(error.message))
        }
      })
    })
  }

  async initialize(): Promise<void> {
    await this.request('initialize', {
      clientInfo: { name: 'screenforge-bridge', version: '0.1.0' },
    })
  }

  async listModels(): Promise<CodexModel[]> {
    const result = (await this.request('model/list', {})) as {
      data?: {
        id: string
        displayName?: string
        hidden?: boolean
        supportedReasoningEfforts?: { reasoningEffort: string }[]
      }[]
    }
    return (result.data ?? [])
      .filter((model) => !model.hidden)
      .map((model) => ({
        id: model.id,
        displayName: model.displayName ?? model.id,
        reasoningEfforts: (model.supportedReasoningEfforts ?? []).map(
          (entry) => entry.reasoningEffort,
        ),
      }))
  }

  /**
   * Un tour, dans un fil éphémère, en lecture seule et sans approbation.
   *
   * `ephemeral` pour que la campagne d'un utilisateur ne s'accumule pas dans son
   * historique Codex ; `read-only` et `never` pour qu'aucune commande ni écriture
   * ne soit ni demandée ni possible — le pont n'a pas de main à lever pour
   * approuver, et un tour qui attendrait une approbation resterait suspendu.
   */
  async runTurn({ prompt, outputSchema, model, signal }: TurnRequest): Promise<string> {
    const thread = (await this.request('thread/start', {
      ephemeral: true,
      sandbox: 'read-only',
      approvalPolicy: 'never',
      cwd: this.cwd,
      ...(model ? { model } : {}),
    })) as { thread?: { id?: string } }
    const threadId = thread.thread?.id
    if (!threadId) throw new Error('Codex n’a pas ouvert de fil.')

    this.messages = []
    const turn = this.request('turn/start', {
      threadId,
      input: [{ type: 'text', text: prompt }],
      outputSchema,
      ...(model ? { model } : {}),
    })

    if (signal) {
      signal.addEventListener(
        'abort',
        () => void this.request('turn/interrupt', { threadId }).catch(() => undefined),
        { once: true },
      )
    }

    await turn
    const last = this.messages[this.messages.length - 1]
    if (!last) throw new Error('Codex n’a rien répondu.')
    return last
  }

  dispose(): void {
    this.child?.kill()
    this.child = null
  }
}

/** Vérifie la présence du binaire sans rien lui demander d'autre. */
export async function codexVersion(
  command = process.env.SCREENFORGE_CODEX_BIN ?? 'codex',
): Promise<string | undefined> {
  return new Promise((resolve) => {
    let output = ''
    let child: ReturnType<typeof spawn>
    try {
      child = spawn(command, ['--version'], { stdio: ['ignore', 'pipe', 'ignore'] })
    } catch {
      resolve(undefined)
      return
    }
    child.stdout?.on('data', (chunk) => {
      output += String(chunk)
    })
    child.on('error', () => resolve(undefined))
    child.on('exit', (code) => resolve(code === 0 ? output.trim() : undefined))
  })
}
