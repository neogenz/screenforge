import { APP_STORE_TARGET, MAX_PROJECT_SCREENS } from '@/lib/dimensions'
import { INTERNAL_PNG_SIZE_TARGET } from '@/lib/export'
import { sha256OfText } from '@/lib/hash'
import type { Release, ReleaseFile } from '@/types'

/**
 * Le lot, tel qu'App Store Connect l'attend — et ce qui l'empêche de partir.
 *
 * Publier n'est pas exporter. Un export descend un ZIP que l'utilisateur range
 * où il veut ; une publication vise une **destination** — une application, une
 * version, une langue, une taille d'écran — et ces quatre-là se trompent en
 * silence. Une locale `de` au lieu de `de-DE`, une planche de 1290×2796 dans un
 * jeu 6,9", un numéro de version qui n'existe pas : Apple refuse après le
 * téléversement, ou pire, accepte au mauvais endroit.
 *
 * Ce fichier fait donc trois choses, toutes locales : il **range** le lot dans
 * l'arborescence que `asc` sait lire, il **décrit** ce lot dans un manifeste
 * déterministe, et il **refuse** avant l'envoi ce qu'il sait déjà faux. Rien ici
 * ne parle au réseau, et c'est ce qui rend le preflight utilisable sans compte,
 * sans jeton et sans pont : le ZIP et la commande à coller suffisent.
 *
 * Aucun identifiant Apple ne le traverse. `asc` résout les siens dans le
 * trousseau du système ; ScreenForge n'en demande aucun, n'en stocke aucun et
 * n'en affiche aucun.
 */

/**
 * La taille d'écran visée, dite dans le vocabulaire d'Apple.
 *
 * `APP_IPHONE_69` et `APP_IPHONE_67` acceptent tous deux 1320×2868 ; c'est le
 * premier qui nomme le matériel que ScreenForge cible. Relevé sur le binaire,
 * pas supposé : `asc screenshots sizes --all`.
 */
export const ASC_DISPLAY_TYPE = 'APP_IPHONE_69'

/** Les dimensions qu'Apple accepte dans ce jeu, portrait et paysage. */
export const ASC_ACCEPTED_SIZES: readonly (readonly [number, number])[] = [
  [1260, 2736],
  [1290, 2796],
  [1320, 2868],
  [2736, 1260],
  [2796, 1290],
  [2868, 1320],
]

/**
 * Les langues qu'App Store Connect connaît.
 *
 * Une liste fermée plutôt qu'une expression régulière : `de` a la bonne forme
 * et n'existe pas côté Apple, `de-DE` oui. C'est exactement l'erreur qu'un
 * projet localisé produit — les codes de ScreenForge sont ceux de l'utilisateur,
 * pas ceux du magasin — et la seule façon de l'attraper avant l'envoi est de
 * comparer à la liste.
 */
export const APP_STORE_LOCALES: readonly string[] = [
  'ar-SA',
  'ca',
  'cs',
  'da',
  'de-DE',
  'el',
  'en-AU',
  'en-CA',
  'en-GB',
  'en-US',
  'es-ES',
  'es-MX',
  'fi',
  'fr-CA',
  'fr-FR',
  'he',
  'hi',
  'hr',
  'hu',
  'id',
  'it',
  'ja',
  'ko',
  'ms',
  'nl-NL',
  'no',
  'pl',
  'pt-BR',
  'pt-PT',
  'ro',
  'ru',
  'sk',
  'sv',
  'th',
  'tr',
  'uk',
  'vi',
  'zh-Hans',
  'zh-Hant',
]

/**
 * La langue App Store la plus proche d'un code de projet.
 *
 * `de` → `de-DE`, `pt` → `pt-BR` (le premier de la liste), `en` → `en-US`. La
 * correspondance est proposée, jamais appliquée d'office : c'est une décision
 * de publication, et deviner `pt-PT` quand l'utilisateur visait le Brésil
 * coûterait une campagne entière.
 */
export function ascLocaleFor(code: string): string | undefined {
  const wanted = code.trim()
  if (!wanted) return undefined
  const exact = APP_STORE_LOCALES.find((known) => known.toLowerCase() === wanted.toLowerCase())
  if (exact) return exact
  const base = wanted.split('-')[0]?.toLowerCase() ?? ''
  if (base === 'en') return 'en-US'
  return APP_STORE_LOCALES.find((known) => known.toLowerCase().split('-')[0] === base)
}

export interface AscTarget {
  /** Purement informatif : le manifeste le porte, la commande jamais. */
  bundleId: string
  appVersion: string
  locale: string
  /** L'identifiant de la localisation de version, rendu par `asc localizations list`. */
  versionLocalization: string
}

export const EMPTY_TARGET: AscTarget = {
  bundleId: '',
  appVersion: '',
  locale: '',
  versionLocalization: '',
}

/* ------------------------------------------------------------ arborescence */

/**
 * Un nom plat, en minuscules, sans séparateur.
 *
 * `asc screenshots upload --path` prend un dossier et téléverse ce qu'il y
 * trouve : l'ordre d'affichage chez Apple suit le nom, d'où le rang en tête. Le
 * jeu de caractères est celui que le pont accepte, et il est restreint pour que
 * la traversée de répertoire soit impossible par construction plutôt que
 * rattrapée après coup.
 */
export function bundleFileName(file: ReleaseFile): string {
  const base = file.path.split('/').pop() ?? 'planche.png'
  const cleaned = base
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '_')
    .replace(/\.png$/, '')
  return `${cleaned.slice(0, 60) || 'planche'}.png`
}

/**
 * Le dossier d'une destination : une langue, une taille d'écran.
 *
 * Deux niveaux et pas un de plus, parce que c'est exactement ce que la commande
 * demande : `--path <dir>` pointe une feuille, et un jeu de captures est
 * l'intersection d'une localisation et d'un type d'appareil.
 */
export function bundleDirectory(locale: string): string {
  return `${locale || 'unknown'}/${ASC_DISPLAY_TYPE}`
}

/**
 * L'empreinte du lot : la liste, pas les octets concaténés.
 *
 * Chaque planche a déjà la sienne, calculée au figement. Hacher
 * `nom empreinte` trié rend un identifiant stable qui ne dépend ni de l'ordre
 * de rendu, ni du temps de calcul, et qui change dès qu'une planche change. Ce
 * hachage est la moitié de l'idempotence côté pont : même lot, même
 * destination, aucune seconde publication.
 */
export function bundleDigest(files: readonly { name: string; sha256: string }[]): Promise<string> {
  const lines = files
    .map((file) => `${file.name} ${file.sha256}`)
    .sort()
    .join('\n')
  return sha256OfText(lines)
}

/* ---------------------------------------------------------------- manifeste */

export interface AscManifestFile {
  name: string
  sha256: string
  byteLength: number
  width: number
  height: number
}

export interface AscManifest {
  /** Version du format de ce fichier, pas celle du projet. */
  manifest: number
  release: { id: string; name: string; createdAt: number }
  target: AscTarget & { deviceType: string }
  directory: string
  bundleHash: string
  files: AscManifestFile[]
  /** La commande à lancer, argument par argument. */
  command: string[]
}

export const ASC_MANIFEST_VERSION = 1

/**
 * Le manifeste, écrit dans un ordre qui ne dépend de rien.
 *
 * Deux figements du même lot doivent produire deux fichiers identiques à
 * l'octet près, sinon « vérifiable » ne veut rien dire : les clés sont posées
 * dans l'ordre du type, les planches sont triées par nom, et rien d'horodaté
 * n'entre à part la date de la release, qui appartient à la release.
 */
export function buildManifest(
  release: Release,
  target: AscTarget,
  files: readonly AscManifestFile[],
  bundleHash: string,
): AscManifest {
  const directory = bundleDirectory(target.locale)
  return {
    manifest: ASC_MANIFEST_VERSION,
    release: { id: release.id, name: release.name, createdAt: release.createdAt },
    target: { ...target, deviceType: ASC_DISPLAY_TYPE },
    directory,
    bundleHash,
    files: [...files].sort((left, right) => (left.name < right.name ? -1 : 1)),
    /* Sans drapeau, et figée avec le lot : c'est le chemin sans pont, celui
       qu'on lance à la main depuis l'archive décompressée. Les deux cases de la
       boîte ne s'y appliquent pas — elles n'existent pas encore au figement. */
    command: uploadCommand(target, `./${directory}`),
  }
}

/* ----------------------------------------------------------------- commande */

/**
 * La commande, en tableau — jamais une chaîne.
 *
 * Ce tableau est ce que la page affiche, et il doit décrire exactement ce que
 * le pont passera à `execFile` : une commande montrée à l'utilisateur qui
 * différerait de celle exécutée serait pire qu'aucune commande du tout. C'est
 * arrivé — les deux cases de la boîte n'entraient pas dans l'affichage, et
 * cocher « supprimer les captures déjà en ligne » laissait le bloc « Commande à
 * lancer » montrer une commande sans `--replace` pendant que le pont lançait la
 * version avec. Le drapeau destructeur ne se lisait nulle part.
 *
 * Les deux drapeaux sont absents du tableau plutôt que présents à faux, dans le
 * même ordre que `uploadArgs` du pont — `asc.test.ts` tient les deux appariés,
 * puisqu'aucun paquet partagé ne les réunit.
 */
export function uploadCommand(
  target: AscTarget,
  path: string,
  options: { replaceExisting?: boolean; dryRun?: boolean } = {},
): string[] {
  return [
    'asc',
    'screenshots',
    'upload',
    '--version-localization',
    target.versionLocalization || '<LOCALIZATION_ID>',
    '--device-type',
    ASC_DISPLAY_TYPE,
    '--path',
    path,
    '--output',
    'json',
    ...(options.replaceExisting ? ['--replace'] : []),
    ...(options.dryRun ? ['--dry-run'] : []),
  ]
}

/** La même commande, lisible et copiable. Les guillemets sont pour l'œil. */
export function commandLine(args: readonly string[]): string {
  return args.map((arg) => (/[^A-Za-z0-9_./=-]/.test(arg) ? `"${arg}"` : arg)).join(' ')
}

/** De quoi trouver l'identifiant de localisation, qu'on ne peut pas deviner. */
export const LOCALIZATION_HINT = [
  'asc',
  'localizations',
  'list',
  '--version',
  '<VERSION_ID>',
  '--output',
  'table',
]

/* ---------------------------------------------------------------- archive */

/**
 * Le ZIP : l'arborescence, le manifeste, et rien d'autre.
 *
 * Il se décompresse à côté du dépôt de l'application et la commande du
 * manifeste se lance depuis là — c'est tout le contrat. Pas de script à
 * exécuter, pas d'installateur : ce qui est livré est ce que `asc` sait lire.
 */
export async function bundleZip(
  manifest: AscManifest,
  files: readonly { name: string; blob: Blob }[],
): Promise<Blob> {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  zip.file('manifest.json', `${JSON.stringify(manifest, null, 2)}\n`)
  for (const file of files) zip.file(`${manifest.directory}/${file.name}`, file.blob)
  return zip.generateAsync({ type: 'blob', mimeType: 'application/zip' })
}

/* ---------------------------------------------------------------- preflight */

export type AscFindingLevel = 'error' | 'warning'

export interface AscFinding {
  level: AscFindingLevel
  /** Ce qui ne va pas, en une phrase, avec le geste qui corrige. */
  message: string
}

const BUNDLE_ID = /^[A-Za-z0-9][A-Za-z0-9-]*(\.[A-Za-z0-9][A-Za-z0-9-]*)+$/
const APP_VERSION = /^\d+(\.\d+){0,2}$/
const LOCALIZATION_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/

/**
 * Ce qui empêche un lot de partir, dit avant l'envoi.
 *
 * Les erreurs bloquent, les avertissements informent. La distinction n'est pas
 * cosmétique : bloquer sur un poids de fichier ferait échouer une publication
 * qu'Apple aurait acceptée, et laisser passer une planche hors dimensions ferait
 * échouer un téléversement de dix planches pour une seule.
 *
 * Le filigrane est la seule règle qui vienne de ScreenForge et non d'Apple : un
 * lot rendu en offre gratuite porte une marque, et personne ne publie ça. Le
 * refuser ici évite de le découvrir sur la fiche du magasin.
 */
export function preflight(
  release: Release,
  target: AscTarget,
  files: readonly AscManifestFile[],
): AscFinding[] {
  const findings: AscFinding[] = []
  const error = (message: string) => findings.push({ level: 'error', message })
  const warn = (message: string) => findings.push({ level: 'warning', message })

  if (release.watermarked) {
    error(
      'Ce lot a été figé avec le filigrane de l’offre gratuite : il ne peut pas être publié. Passez à la Licence, puis figez une nouvelle release.',
    )
  }

  if (!BUNDLE_ID.test(target.bundleId)) {
    error('L’identifiant de l’application doit ressembler à « com.exemple.monapp ».')
  }
  if (!APP_VERSION.test(target.appVersion)) {
    error('Le numéro de version doit être de la forme « 1.4 » ou « 1.4.2 ».')
  }
  if (!APP_STORE_LOCALES.includes(target.locale)) {
    const suggestion = ascLocaleFor(target.locale)
    error(
      suggestion
        ? `App Store Connect ne connaît pas la langue « ${target.locale} ». La plus proche est « ${suggestion} ».`
        : 'Choisissez une langue parmi celles qu’App Store Connect accepte.',
    )
  }
  if (!LOCALIZATION_ID.test(target.versionLocalization)) {
    error(
      'L’identifiant de localisation de version manque. Il se lit avec « asc localizations list --version <VERSION_ID> ».',
    )
  }

  if (files.length === 0) {
    error('Ce lot ne contient aucune planche.')
  } else if (files.length > MAX_PROJECT_SCREENS) {
    error(`App Store Connect accepte au plus ${MAX_PROJECT_SCREENS} captures par jeu.`)
  }

  for (const file of files) {
    const accepted = ASC_ACCEPTED_SIZES.some(
      ([width, height]) => file.width === width && file.height === height,
    )
    if (!accepted) {
      error(
        `« ${file.name} » fait ${file.width}×${file.height}, que le jeu ${ASC_DISPLAY_TYPE} n’accepte pas.`,
      )
    }
    if (file.byteLength > INTERNAL_PNG_SIZE_TARGET) {
      warn(
        `« ${file.name} » pèse ${Math.round(file.byteLength / 1024 / 1024)} Mo, au-dessus de la cible interne de ${INTERNAL_PNG_SIZE_TARGET / 1024 / 1024} Mo.`,
      )
    }
  }

  return findings
}

export function blocking(findings: readonly AscFinding[]): boolean {
  return findings.some((finding) => finding.level === 'error')
}

/** Le préambule du manifeste : le même que celui de la page, pour la vérité. */
export function targetSummary(target: AscTarget): string {
  return `${target.bundleId || '<app>'} ${target.appVersion || '<version>'} · ${target.locale || '<langue>'} · ${ASC_DISPLAY_TYPE}`
}

/**
 * Le nom du dernier écran d'une release, pour l'aperçu du contenu du ZIP.
 *
 * `APP_STORE_TARGET` est lu ici pour que le libellé de taille affiché soit celui
 * des dimensions réellement rendues, et non une constante recopiée.
 */
export const ASC_SIZE_LABEL = `${APP_STORE_TARGET.size} — ${APP_STORE_TARGET.portrait.width}×${APP_STORE_TARGET.portrait.height}`
