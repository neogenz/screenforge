import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { redactDiagnostic } from './redaction.ts'

/**
 * Le seul moteur du pont : Claude Code, tel qu'il est déjà installé.
 *
 * `claude -p` lit un prompt, écrit une réponse et s'arrête. Un
 * processus par tour est donc la bonne forme ici, et non un manque : rien à
 * garder vivant entre deux campagnes, rien à redémarrer quand l'utilisateur met
 * à jour son binaire.
 *
 * **Claude Code garde son authentification.** Le pont ne lit ni `~/.claude`, ni
 * trousseau, ni `ANTHROPIC_API_KEY` : il lance le binaire que l'utilisateur a
 * déjà connecté. C'est ce qui distingue ce moteur des
 * fournisseurs à clé — ici, aucun secret ne traverse la page.
 */

export class ClaudeUnavailableError extends Error {}

export interface ClaudeTurnRequest {
  prompt: string
  /** Le schéma attendu, inséré dans le prompt : `claude -p` n'a pas d'`outputSchema`. */
  outputSchema: unknown
  /** Un alias (`opus`, `sonnet`, `haiku`) ou un nom complet. Vide = celui de l'utilisateur. */
  model?: string
  signal?: AbortSignal
}

/**
 * Les alias annoncés par `claude --help`, et le défaut de l'utilisateur.
 *
 * La liste n'est pas devinée : le binaire ne rend aucun catalogue de modèles,
 * et ce sont les alias que son aide nomme. Le premier choix est volontairement
 * l'absence de choix — celui qui a configuré Claude Code a déjà décidé.
 */
export const CLAUDE_MODELS = [
  { id: '', displayName: 'Le modèle configuré dans Claude Code' },
  { id: 'opus', displayName: 'Opus' },
  { id: 'sonnet', displayName: 'Sonnet' },
  { id: 'haiku', displayName: 'Haiku' },
] as const

/**
 * Un tour prend au plus trois minutes.
 *
 * Un `claude -p` bloqué ne dit rien du tout, et la requête HTTP de la page
 * resterait ouverte indéfiniment derrière lui. Le plafond est haut parce qu'un
 * plan de dix visuels est un vrai tour de modèle, pas un ping.
 */
const TURN_TIMEOUT_MS = 180_000
const PROBE_TIMEOUT_MS = 3_000
const TURN_OUTPUT_BYTES = 2 * 1024 * 1024
const PROBE_OUTPUT_BYTES = 4 * 1024

/**
 * Les outils refusés, nommément.
 *
 * Le prompt du pont demande du texte, pas une action, et un modèle n'a aucune
 * raison d'ouvrir un shell pour écrire une accroche. Mais « aucune raison » est
 * une prédiction, pas une barrière : le pont tourne sur la machine de
 * l'utilisateur, et laisser un moteur agentique y garder Bash et Write parce
 * qu'on suppose qu'il ne s'en servira pas est exactement le raisonnement que le
 * contrat du pont refuse ailleurs. La liste est fermée côté binaire, en plus du
 * prompt.
 */
const DENIED_TOOLS = [
  'Bash',
  'Edit',
  'Write',
  'Read',
  'Glob',
  'Grep',
  'WebFetch',
  'WebSearch',
  'Task',
  'NotebookEdit',
]

/**
 * Le prompt système : un rédacteur, pas un agent de code.
 *
 * `--system-prompt` remplace celui de Claude Code au lieu de s'y ajouter. C'est
 * voulu : le prompt par défaut décrit un agent qui lit des dépôts et modifie des
 * fichiers, ce qui n'est ni utile ni souhaitable pour rendre un objet JSON —
 * mesuré, il coûtait aussi 18 000 jetons de contexte de plus par tour.
 */
const SYSTEM_PROMPT =
  'Tu rends exclusivement un objet JSON conforme au schéma demandé. ' +
  'Aucun texte avant, aucun texte après, aucun bloc de code, aucune explication.'

interface Spawned {
  stdout: string
  stderr: string
  code: number | null
}

function run(
  command: string,
  args: string[],
  options: { signal?: AbortSignal; timeoutMs: number; maxOutputBytes: number },
): Promise<Spawned> {
  return new Promise((resolve, reject) => {
    let child: ReturnType<typeof spawn>
    try {
      /* `cwd` neutre et non celui du pont : Claude Code découvre les `CLAUDE.md`
         du dossier courant, et faire lire au modèle les instructions du dépôt de
         l'utilisateur avant d'écrire une accroche App Store serait payer un
         contexte qui n'a rien à dire du sujet. */
      child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], cwd: tmpdir() })
    } catch (cause) {
      reject(new ClaudeUnavailableError(redactDiagnostic(cause)))
      return
    }

    let stdout = ''
    let stderr = ''
    let outputBytes = 0
    let settled = false
    const finish = (result: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      options.signal?.removeEventListener('abort', abort)
      result()
    }
    const stop = (reason: Error) => {
      child.kill('SIGKILL')
      finish(() => reject(reason))
    }
    const timer = setTimeout(
      () => stop(new Error('Claude Code n’a pas répondu dans le délai imparti.')),
      options.timeoutMs,
    )
    const abort = () => stop(new Error('Génération annulée.'))
    options.signal?.addEventListener('abort', abort, { once: true })
    if (options.signal?.aborted) abort()

    const append = (target: 'stdout' | 'stderr', chunk: Buffer) => {
      const remaining = Math.max(0, options.maxOutputBytes - outputBytes)
      const kept = chunk.subarray(0, remaining).toString()
      if (target === 'stdout') stdout += kept
      else stderr += kept
      outputBytes += chunk.byteLength
      if (outputBytes > options.maxOutputBytes) {
        stop(new Error('Claude Code a produit une sortie trop volumineuse.'))
      }
    }

    child.stdout?.on('data', (chunk) => {
      append('stdout', Buffer.from(chunk))
    })
    child.stderr?.on('data', (chunk) => {
      append('stderr', Buffer.from(chunk))
    })
    child.on('error', () => {
      finish(() => reject(new ClaudeUnavailableError('claude introuvable')))
    })
    child.on('close', (code) => {
      finish(() => resolve({ stdout, stderr, code }))
    })
  })
}

/**
 * Extrait l'objet JSON d'une réponse qui n'a pas promis d'en être une.
 *
 * Le schéma est envoyé à Claude Code puis revalidé par le pont. Un modèle qui
 * encadre son JSON de trois mots ou d'une clôture Markdown a répondu juste, et
 * refuser la réponse pour cette raison serait perdre un tour payé. Le contenu,
 * lui, est revalidé par `planSchema` comme celui de n'importe quel moteur.
 */
export function extractJson(text: string): string {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) {
    throw new Error('Claude Code n’a pas rendu de JSON.')
  }
  return text.slice(start, end + 1)
}

export async function runClaudeTurn(
  { prompt, outputSchema, model, signal }: ClaudeTurnRequest,
  command = process.env.SCREENFORGE_CLAUDE_BIN ?? 'claude',
): Promise<string> {
  const args = [
    '--print',
    prompt,
    '--output-format',
    'json',
    '--json-schema',
    JSON.stringify(outputSchema),
    '--system-prompt',
    SYSTEM_PROMPT,
    '--safe-mode',
    '--disable-slash-commands',
    '--no-chrome',
    '--no-session-persistence',
    '--permission-mode',
    'dontAsk',
    '--max-turns',
    '1',
    '--tools',
    '',
    '--strict-mcp-config',
    '--mcp-config',
    '{"mcpServers":{}}',
    '--disallowed-tools',
    ...DENIED_TOOLS,
  ]
  if (model) args.push('--model', model)

  const { stdout, stderr, code } = await run(command, args, {
    signal,
    timeoutMs: TURN_TIMEOUT_MS,
    maxOutputBytes: TURN_OUTPUT_BYTES,
  })
  if (code !== 0) {
    throw new ClaudeUnavailableError(redactDiagnostic(stderr, 400) || `claude a quitté (${code}).`)
  }

  let envelope: { is_error?: boolean; result?: unknown; structured_output?: unknown }
  try {
    envelope = JSON.parse(stdout) as typeof envelope
  } catch {
    throw new Error('Claude Code a répondu hors format.')
  }
  if (envelope.is_error) {
    throw new Error('Claude Code a signalé une erreur pendant le tour.')
  }
  if (envelope.structured_output !== undefined) return JSON.stringify(envelope.structured_output)
  if (typeof envelope.result !== 'string') {
    throw new Error('Claude Code a signalé une erreur pendant le tour.')
  }
  return extractJson(envelope.result)
}

/** Vérifie la présence du binaire sans rien lui demander d'autre. */
export async function claudeVersion(
  command = process.env.SCREENFORGE_CLAUDE_BIN ?? 'claude',
): Promise<string | undefined> {
  try {
    const { stdout, code } = await run(command, ['--version'], {
      timeoutMs: PROBE_TIMEOUT_MS,
      maxOutputBytes: PROBE_OUTPUT_BYTES,
    })
    return code === 0 ? redactDiagnostic(stdout.split('\n')[0] ?? '', 200) : undefined
  } catch {
    return undefined
  }
}
