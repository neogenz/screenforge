import { execFile } from 'node:child_process'
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type {
  AscPublishRequest,
  AscPublishResult,
  AscStepName,
  AscStepStatus,
  AscTarget,
} from './protocol.ts'
import { redactDiagnostic } from './redaction.ts'

/**
 * La publication, et les quatre choses qu'elle refuse de faire.
 *
 * **Elle ne voit aucun identifiant.** `asc` résout les siens dans le trousseau
 * du système. Le pont ne lit pas `~/.asc`, ne reçoit aucun `.p8`, n'accepte
 * aucun `issuer-id`, et n'ajoute aucune variable d'environnement à l'enfant.
 * Un pont qui transporterait ces clés serait un voleur d'identifiants avec de
 * bonnes intentions — et ScreenForge n'aurait alors plus rien de local-first.
 *
 * **Elle ne construit aucune ligne de commande.** `execFile` prend un tableau
 * d'arguments, jamais une chaîne : il n'y a pas de shell, donc pas d'expansion,
 * pas de `;`, pas de substitution. Le nom des fichiers est validé par le schéma
 * avant d'arriver ici, et le dossier est un `mkdtemp` que le pont vient de
 * créer.
 *
 * **Elle ne réessaie jamais toute seule.** Un téléversement qui dépasse son
 * délai a peut-être abouti : les octets sont partis, la réponse non. Rejouer
 * doublerait les captures chez Apple. Le pont dit que le sort est inconnu et
 * s'arrête là ; c'est à l'utilisateur de regarder l'état réel avant de refaire.
 *
 * **Elle ne republie pas deux fois le même lot.** La clé est
 * `release + destination + empreinte du lot + drapeaux` : la même demande vers
 * la même localisation rend le résultat déjà obtenu au lieu d'un second
 * téléversement, mais changer un drapeau change la demande. `ponytail:` cette
 * mémoire est celle du processus — le pont redémarré republie. Une trace sur
 * disque relèverait de l'état persistant, que ce pont n'a pas.
 */

export const ASC_TIMEOUT_MS = 180_000

export class AscUnavailableError extends Error {}
export class AscFailedError extends Error {}
export class AscAmbiguousError extends Error {}

/**
 * Les étapes déjà franchies voyagent avec l'échec.
 *
 * Savoir *où* ça s'est arrêté est ce qui distingue « asc introuvable » de
 * « Apple a refusé le lot » : sans cela, l'utilisateur reçoit une phrase et
 * aucune idée du geste à faire. La liste est attachée à l'erreur au moment de
 * la remonter, puis rendue telle quelle par la route.
 */
export function stepsOf(error: unknown): AscStep[] {
  return (error as { steps?: AscStep[] })?.steps ?? []
}

export interface AscStep {
  name: AscStepName
  status: AscStepStatus
  detail: string
  ms: number
}

export interface AscRun {
  code: number
  stdout: string
  stderr: string
  timedOut: boolean
}

/** Ce que le pont lance. Injecté dans les tests : aucun processus n'y démarre. */
export type AscRunner = (args: string[], timeoutMs: number) => Promise<AscRun>

export interface AscProbe {
  version: string
  /** Les drapeaux que ce binaire accepte pour `screenshots upload`. */
  flags: string[]
}

export interface AscState {
  probe?: AscProbe
  published: Map<string, AscPublishResult>
}

export function createAscState(): AscState {
  return { published: new Map() }
}

const BIN = process.env.SCREENFORGE_ASC_BIN ?? 'asc'

export const execRunner: AscRunner = (args, timeoutMs) =>
  new Promise((resolve) => {
    execFile(
      BIN,
      args,
      { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024, windowsHide: true },
      (error, stdout, stderr) => {
        const failure = error as (Error & { code?: number; killed?: boolean }) | null
        resolve({
          code: failure ? (typeof failure.code === 'number' ? failure.code : 1) : 0,
          stdout: String(stdout),
          stderr: String(stderr),
          timedOut: Boolean(failure?.killed),
        })
      },
    )
  })

/**
 * Ce qui sort du pont est relu avant d'être rendu.
 *
 * `asc` n'imprime pas de secret aujourd'hui, mais sa sortie traverse une requête
 * HTTP, s'affiche dans une page et finit dans une capture d'écran de rapport de
 * bug. Un JWT, une clé privée ou un chemin de dossier personnel n'ont rien à y
 * faire, et le jour où une version de `asc` en imprimerait un, le nettoyage est
 * déjà là.
 */
/**
 * Les arguments, dans un ordre fixe.
 *
 * `--replace` n'apparaît que si l'appelant l'a demandé explicitement : c'est le
 * drapeau qui supprime les captures déjà en ligne, et un défaut à vrai aurait
 * effacé le travail d'une autre release au premier essai. Il est absent du
 * tableau, pas présent avec une valeur fausse — un drapeau qu'on ne peut pas
 * lire dans la commande affichée est un drapeau qu'on ne peut pas relire.
 */
export function uploadArgs(
  target: AscTarget,
  options: { path: string; replaceExisting: boolean; dryRun: boolean },
): string[] {
  return [
    'screenshots',
    'upload',
    '--version-localization',
    target.versionLocalization,
    '--device-type',
    target.deviceType,
    '--path',
    options.path,
    '--output',
    'json',
    ...(options.replaceExisting ? ['--replace'] : []),
    ...(options.dryRun ? ['--dry-run'] : []),
  ]
}

/**
 * Release, destination, empreinte du lot — **et les drapeaux**.
 *
 * `replaceExisting` répare un défaut constaté : remplacer n'est pas ajouter, et
 * sans lui dans la clé, un premier envoi rendait son résultat à la demande
 * suivante. La case « supprimer les captures déjà en ligne » était avalée par le
 * cache et rapportée en succès, avec un `replaceExisting: false` dans la réponse
 * que personne ne relit — prudent dans son effet, rien n'était supprimé chez
 * Apple, et faux dans ce qu'il disait.
 *
 * `dryRun` ne joue que dans un sens, et c'est voulu : un essai à blanc n'est
 * jamais mémorisé, donc aucune clé en `dry` n'existe et le segment n'y sert à
 * rien. Ce qu'il empêche, c'est l'inverse — qu'une répétition demandée après une
 * vraie publication soit servie depuis le cache et rende `dryRun: false` : une
 * réponse « publié » à qui demandait « qu'est-ce que ça ferait ».
 */
export function idempotenceKey(request: {
  releaseId: string
  bundleHash: string
  target: AscTarget
  replaceExisting: boolean
  dryRun: boolean
}): string {
  return [
    request.releaseId,
    request.target.versionLocalization,
    request.target.deviceType,
    request.bundleHash,
    request.replaceExisting ? 'replace' : 'add',
    request.dryRun ? 'dry' : 'live',
  ].join(':')
}

/** Sonde le binaire au lieu de supposer ce qu'il sait faire. */
export async function probeAsc(state: AscState, run: AscRunner = execRunner): Promise<AscProbe> {
  if (state.probe) return state.probe
  const version = await run(['--version'], 15_000)
  if (version.code !== 0 || !version.stdout.trim()) {
    throw new AscUnavailableError(
      'La commande « asc » est introuvable. Installez-la puis connectez-la avec « asc auth login ».',
    )
  }
  const help = await run(['screenshots', 'upload', '--help'], 15_000)
  const text = `${help.stdout}${help.stderr}`
  const flags = ['--replace', '--dry-run', '--skip-existing', '--output'].filter((flag) =>
    text.includes(flag),
  )
  const line = version.stdout.trim().split('\n')[0] ?? ''
  state.probe = { version: line.slice(0, 64), flags }
  return state.probe
}

/**
 * Publie un lot déjà rendu, en quatre étapes qui se racontent.
 *
 * L'utilisateur voit laquelle a échoué, ce qui n'est pas la même information
 * qu'un « échec de publication » : un `asc` absent se corrige en l'installant,
 * un dossier temporaire refusé en libérant du disque, un téléversement refusé
 * en regardant la version ciblée.
 */
export async function runPublish(
  state: AscState,
  request: AscPublishRequest,
  run: AscRunner = execRunner,
): Promise<AscPublishResult> {
  const key = idempotenceKey(request)
  const already = state.published.get(key)
  if (already) return { ...already, idempotent: true }

  const steps: AscStep[] = []
  const step = async <T>(name: AscStepName, work: () => Promise<[T, string]>): Promise<T> => {
    const started = Date.now()
    try {
      const [value, detail] = await work()
      steps.push({ name, status: 'ok', detail, ms: Date.now() - started })
      return value
    } catch (error) {
      const detail = error instanceof Error ? redactDiagnostic(error) : 'Échec.'
      const status: AscStepStatus = error instanceof AscAmbiguousError ? 'ambiguous' : 'failed'
      steps.push({ name, status, detail, ms: Date.now() - started })
      Object.assign(error as object, { steps })
      throw error
    }
  }

  await step('verify-cli', async () => {
    const found = await probeAsc(state, run)
    if (request.replaceExisting && !found.flags.includes('--replace')) {
      throw new AscUnavailableError(
        'Ce binaire « asc » ne connaît pas --replace : mettez-le à jour ou décochez le remplacement.',
      )
    }
    if (request.dryRun && !found.flags.includes('--dry-run')) {
      throw new AscUnavailableError(
        'Ce binaire « asc » ne connaît pas --dry-run : mettez-le à jour pour lancer un essai à blanc.',
      )
    }
    return [found, `asc ${found.version}`]
  })

  let directory: string | undefined
  const command: string[] = []
  try {
    directory = await step('write-temp', async () => {
      const created = await mkdtemp(join(tmpdir(), 'screenforge-asc-'))
      // Le lot d'un utilisateur n'a pas à être lisible par les autres comptes.
      await chmod(created, 0o700)
      for (const file of request.files) {
        await writeFile(join(created, file.name), Buffer.from(file.base64, 'base64'))
      }
      return [created, `${request.files.length} planche(s) écrite(s) dans un dossier privé`]
    })

    const args = uploadArgs(request.target, {
      path: directory,
      replaceExisting: request.replaceExisting,
      dryRun: request.dryRun,
    })
    command.push(
      'asc',
      ...uploadArgs(request.target, {
        path: '[PRIVATE_TEMP_DIR]',
        replaceExisting: request.replaceExisting,
        dryRun: request.dryRun,
      }),
    )

    const output = await step('upload', async () => {
      const result = await run(args, ASC_TIMEOUT_MS)
      if (result.timedOut) {
        throw new AscAmbiguousError(
          'Le téléversement n’a pas rendu la main dans le délai imparti. Il a peut-être abouti : vérifiez la version ciblée avant de refaire.',
        )
      }
      if (result.code !== 0) {
        throw new AscFailedError(
          redactDiagnostic(result.stderr || result.stdout) || 'asc a échoué.',
        )
      }
      return [
        redactDiagnostic(result.stdout),
        request.dryRun ? 'Essai à blanc terminé' : 'Lot téléversé',
      ]
    })

    const done: AscPublishResult = {
      steps,
      command,
      idempotent: false,
      dryRun: request.dryRun,
      replaceExisting: request.replaceExisting,
      output,
    }
    /* Un essai à blanc n'a rien publié : le mémoriser ferait passer la vraie
       publication suivante pour un doublon. */
    if (!request.dryRun) state.published.set(key, done)
    return done
  } finally {
    if (directory) {
      const started = Date.now()
      // Le lot ne survit pas à la requête, même si le téléversement a échoué.
      await rm(directory, { recursive: true, force: true }).catch(() => undefined)
      steps.push({
        name: 'cleanup',
        status: 'ok',
        detail: 'Dossier temporaire supprimé',
        ms: Date.now() - started,
      })
    }
  }
}

/** Version affichée par `hello` : absente quand `asc` n'est pas installé. */
export async function ascProbeOrUndefined(
  state: AscState,
  run: AscRunner = execRunner,
): Promise<AscProbe | undefined> {
  try {
    return await probeAsc(state, run)
  } catch {
    return undefined
  }
}
