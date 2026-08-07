import { cn } from '@/lib/utils'
import type { MouseEvent } from 'react'
import { langHref, useLang, type Lang } from '../i18n'

/*
 * Bascule de langue. En production les deux langues sont des documents
 * statiques : le lien navigue. En dev (CSR, un seul document) le clic
 * bascule le store sans recharger.
 *
 * Le nom accessible est la langue écrite en toutes lettres : un lecteur
 * d'écran épelle « eff air » sur `fr`, et le libellé visible est de toute
 * façon le code, pas le mot.
 */
const LANG_NAMES: Record<Lang, string> = { en: 'English', fr: 'Français' }

export function LangLink({ code, className }: { code: Lang; className?: string }) {
  const { lang, setLang } = useLang()
  const active = lang === code

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (import.meta.env.DEV && !active) {
      event.preventDefault()
      setLang(code)
    }
  }

  return (
    <a
      href={langHref(code)}
      hrefLang={code}
      aria-label={LANG_NAMES[code]}
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'flex h-11 min-w-9 items-center justify-center font-mono text-2xs uppercase transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
        className,
      )}
    >
      {code}
    </a>
  )
}
