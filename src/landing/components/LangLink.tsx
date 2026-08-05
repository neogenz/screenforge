import { cn } from '@/lib/utils'
import type { MouseEvent } from 'react'
import { langHref, useLang, type Lang } from '../i18n'

/*
 * Bascule de langue. En production les deux langues sont des documents
 * statiques : le lien navigue. En dev (CSR, un seul document) le clic
 * bascule le store sans recharger.
 */
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
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'rounded-xs px-1.5 py-1 uppercase transition-colors duration-150',
        active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80',
        className,
      )}
    >
      {code}
    </a>
  )
}
