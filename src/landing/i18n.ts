import { useSyncExternalStore } from 'react'
import { copy, type Copy } from './copy'

export type Lang = keyof typeof copy

const STORAGE_KEY = 'sf-landing-lang'

function isLang(value: unknown): value is Lang {
  return value === 'en' || value === 'fr'
}

/*
 * Ordre de priorité : la langue du document servi (le prerender a raison),
 * puis le choix mémorisé, puis le navigateur. Sans cette priorité, un visiteur
 * dont le localStorage dit « en » verrait la page FR se réhydrater en anglais.
 */
function detect(): Lang {
  if (typeof document !== 'undefined' && isLang(document.documentElement.lang)) {
    return document.documentElement.lang
  }
  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (isLang(stored)) return stored
    } catch {
      /* storage indisponible : la détection navigateur prend le relais */
    }
  }
  if (typeof navigator !== 'undefined') {
    return navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en'
  }
  return 'en'
}

let current: Lang = 'en'
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function apply(lang: Lang) {
  if (typeof document === 'undefined') return
  const t = copy[lang]
  document.documentElement.lang = lang
  document.title = t.meta.title
  document.querySelector('meta[name="description"]')?.setAttribute('content', t.meta.description)
}

export function setLang(lang: Lang) {
  if (lang === current) return
  current = lang
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    /* la persistance est un confort, jamais un blocage */
  }
  apply(lang)
  listeners.forEach((listener) => listener())
}

/* Langue explicite au prerender, détection au runtime. Appelé avant tout rendu. */
export function initLang(lang?: Lang) {
  current = lang ?? detect()
  apply(current)
}

/* Le document statique de chaque langue (produit par scripts/prerender-landing.mjs). */
export function langHref(lang: Lang): string {
  return lang === 'fr' ? '/landing-fr.html' : '/landing.html'
}

export function useLang(): { lang: Lang; t: Copy; setLang: typeof setLang } {
  const lang = useSyncExternalStore(
    subscribe,
    () => current,
    () => current,
  )
  return { lang, t: copy[lang], setLang }
}
