import type { ScriptId } from '@/types'

/**
 * Les langues qu'App Store Connect accepte, nommées et rattachées à leur écriture.
 *
 * Une liste fermée plutôt qu'un code à taper : la boîte des langues demandait
 * un code et un nom libres, donc « de » pour l'un, « de-DE » pour l'autre, et
 * la publication devait deviner ensuite. Le code du projet est désormais le
 * code du magasin, et l'écriture — qui décide de la police — n'est plus une
 * question posée à l'utilisateur.
 */
export interface LocaleEntry {
  code: string
  /** Nom français, celui que l'interface et les fichiers affichent. */
  name: string
  script: ScriptId
}

export const LOCALE_CATALOG: readonly LocaleEntry[] = [
  { code: 'ar-SA', name: 'Arabe', script: 'arabic' },
  { code: 'ca', name: 'Catalan', script: 'latin' },
  { code: 'cs', name: 'Tchèque', script: 'latin' },
  { code: 'da', name: 'Danois', script: 'latin' },
  { code: 'de-DE', name: 'Allemand', script: 'latin' },
  { code: 'el', name: 'Grec', script: 'greek' },
  { code: 'en-AU', name: 'Anglais (Australie)', script: 'latin' },
  { code: 'en-CA', name: 'Anglais (Canada)', script: 'latin' },
  { code: 'en-GB', name: 'Anglais (Royaume-Uni)', script: 'latin' },
  { code: 'en-US', name: 'Anglais (États-Unis)', script: 'latin' },
  { code: 'es-ES', name: 'Espagnol (Espagne)', script: 'latin' },
  { code: 'es-MX', name: 'Espagnol (Mexique)', script: 'latin' },
  { code: 'fi', name: 'Finnois', script: 'latin' },
  { code: 'fr-CA', name: 'Français (Canada)', script: 'latin' },
  { code: 'fr-FR', name: 'Français', script: 'latin' },
  { code: 'he', name: 'Hébreu', script: 'hebrew' },
  { code: 'hi', name: 'Hindi', script: 'devanagari' },
  { code: 'hr', name: 'Croate', script: 'latin' },
  { code: 'hu', name: 'Hongrois', script: 'latin' },
  { code: 'id', name: 'Indonésien', script: 'latin' },
  { code: 'it', name: 'Italien', script: 'latin' },
  { code: 'ja', name: 'Japonais', script: 'japanese' },
  { code: 'ko', name: 'Coréen', script: 'korean' },
  { code: 'ms', name: 'Malais', script: 'latin' },
  { code: 'nl-NL', name: 'Néerlandais', script: 'latin' },
  { code: 'no', name: 'Norvégien', script: 'latin' },
  { code: 'pl', name: 'Polonais', script: 'latin' },
  { code: 'pt-BR', name: 'Portugais (Brésil)', script: 'latin' },
  { code: 'pt-PT', name: 'Portugais (Portugal)', script: 'latin' },
  { code: 'ro', name: 'Roumain', script: 'latin' },
  { code: 'ru', name: 'Russe', script: 'cyrillic' },
  { code: 'sk', name: 'Slovaque', script: 'latin' },
  { code: 'sv', name: 'Suédois', script: 'latin' },
  { code: 'th', name: 'Thaï', script: 'thai' },
  { code: 'tr', name: 'Turc', script: 'latin' },
  { code: 'uk', name: 'Ukrainien', script: 'cyrillic' },
  { code: 'vi', name: 'Vietnamien', script: 'latin' },
  // ponytail: le chinois traditionnel emprunte les polices du simplifié — Noto
  // Sans SC couvre les deux jeux ; une famille TC dédiée si un glyphe manque.
  { code: 'zh-Hans', name: 'Chinois simplifié', script: 'simplified-chinese' },
  { code: 'zh-Hant', name: 'Chinois traditionnel', script: 'simplified-chinese' },
]

export function localeEntry(code: string): LocaleEntry | undefined {
  const wanted = code.trim().toLowerCase()
  return LOCALE_CATALOG.find((entry) => entry.code.toLowerCase() === wanted)
}

/** Le nom à afficher pour un code, du catalogue ou du projet ; le code sinon. */
export function localeName(
  code: string,
  locales: readonly { code: string; name: string }[] = [],
): string {
  return locales.find((entry) => entry.code === code)?.name ?? localeEntry(code)?.name ?? code
}

/**
 * La langue d'origine par défaut : celle du navigateur si le magasin la
 * connaît, l'anglais américain sinon. Un défaut, jamais une décision — le
 * brief la montre et la laisse changer.
 */
export function defaultSourceLanguage(): string {
  const wanted = typeof navigator === 'undefined' ? '' : navigator.language
  const exact = localeEntry(wanted)
  if (exact) return exact.code
  const base = wanted.split('-')[0]?.toLowerCase()
  if (base === 'en') return 'en-US'
  return LOCALE_CATALOG.find((entry) => entry.code.split('-')[0] === base)?.code ?? 'en-US'
}
