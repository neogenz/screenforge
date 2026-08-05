import { useSyncExternalStore } from 'react'
import { copy, type Copy } from './copy'

export type Lang = keyof typeof copy

const STORAGE_KEY = 'sf-landing-lang'

function detect(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'en' || stored === 'fr') return stored
  } catch {
    /* storage indisponible : la détection navigateur prend le relais */
  }
  return navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en'
}

let current: Lang = detect()
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function apply(lang: Lang) {
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

export function initLang() {
  apply(current)
}

export function useLang(): { lang: Lang; t: Copy; setLang: typeof setLang } {
  const lang = useSyncExternalStore(subscribe, () => current)
  return { lang, t: copy[lang], setLang }
}
