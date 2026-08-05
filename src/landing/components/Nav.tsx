import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { Menu } from 'lucide-react'
import { useLang } from '../i18n'
import { LINKS } from '../links'
import { CtaPrimary } from './cta'
import { LangLink } from './LangLink'

const anchorClass = 'text-muted-foreground transition-colors duration-150 hover:text-foreground'

export function Nav() {
  const { t } = useLang()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setScrolled(window.scrollY > 8))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  const anchors = (
    <>
      <a className={anchorClass} href="#features">
        {t.nav.features}
      </a>
      <a className={anchorClass} href="#pricing">
        {t.nav.pricing}
      </a>
      <a className={anchorClass} href="#faq">
        {t.nav.faq}
      </a>
    </>
  )

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-(--z-chrome) transition-colors duration-200',
        scrolled ? 'border-b border-border bg-background/95' : 'border-b border-transparent',
      )}
    >
      <nav
        aria-label="Principal"
        className="mx-auto flex h-12 max-w-6xl items-center gap-6 px-5 text-sm"
      >
        <a href="#hero" className="font-semibold tracking-tight">
          ScreenForge
        </a>
        <div className="hidden items-center gap-6 md:flex">{anchors}</div>
        <div className="ml-auto flex items-center gap-3">
          <div
            role="group"
            aria-label={t.nav.langSwitchLabel}
            className="flex items-center gap-1 text-xs"
          >
            <LangLink code="en" />
            <LangLink code="fr" />
          </div>
          <CtaPrimary href={LINKS.app} size="sm">
            {t.nav.cta}
          </CtaPrimary>
          <details className="group relative md:hidden">
            <summary
              aria-label={t.nav.menuLabel}
              className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-sm text-muted-foreground transition-colors duration-150 hover:text-foreground [&::-webkit-details-marker]:hidden"
            >
              <Menu className="size-4" aria-hidden />
            </summary>
            <div className="absolute right-0 top-full mt-2 flex min-w-44 flex-col gap-1 rounded-md border border-border bg-popover p-2 shadow-lg">
              {anchors}
            </div>
          </details>
        </div>
      </nav>
    </header>
  )
}
