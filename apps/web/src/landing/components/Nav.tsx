import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { Menu } from 'lucide-react'
import { useLang } from '../i18n'
import { LINKS } from '../links'
import { CtaPrimary } from './cta'
import { BrandWordmark } from './BrandWordmark'
import { LangLink } from './LangLink'

const MENU_ID = 'nav-menu'

/* Une ancre de nav est une cible tactile : 44px de haut, pas 20. La hauteur
   vient du padding vertical et non d'une hauteur fixe, pour que le libellé
   reste centré s'il passe sur deux lignes.

   La teinte est passée par l'appelant : dans le popover l'ancre est sur
   `bg-stage`, dans la barre non défilée elle est sur le citron. C'est le même
   conditionnement que `LangLink` reçoit déjà juste en dessous. */
const anchorClass =
  'flex items-center px-1 py-3 text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

const anchorOnMarker = 'text-marker-ink hover:text-marker-ink/60 focus-visible:outline-marker-ink'

function closeMenu() {
  const menu = document.getElementById(MENU_ID)
  if (menu instanceof HTMLElement && menu.matches(':popover-open')) menu.hidePopover()
}

/*
 * Le menu étroit est un `popover` natif, pas un `<details>` : le navigateur
 * fournit la fermeture par Échap et par clic à l'extérieur, que l'ancienne
 * version n'avait ni l'une ni l'autre — le panneau restait ouvert derrière le
 * doigt jusqu'à ce qu'on retrouve le bouton. Il est posé en `fixed` sous la
 * barre plutôt qu'ancré : un élément du top layer ne se positionne pas par
 * rapport à un ancêtre, et `anchor()` n'est pas encore partout.
 *
 * Aucune utilitaire `display` sur l'élément popover lui-même : une règle
 * auteur, même de faible spécificité, l'emporte sur le `display: none` de la
 * feuille du navigateur, et le menu resterait ouvert en permanence. La mise en
 * colonne vit donc sur un enfant.
 */
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

  const anchors = (tone?: string, onNavigate?: () => void) => (
    <>
      <a className={cn(anchorClass, tone)} href="#features" onClick={onNavigate}>
        {t.nav.features}
      </a>
      <a className={cn(anchorClass, tone)} href="#agent" onClick={onNavigate}>
        {t.nav.agent}
      </a>
      <a className={cn(anchorClass, tone)} href="#pricing" onClick={onNavigate}>
        {t.nav.pricing}
      </a>
      <a className={cn(anchorClass, tone)} href="#faq" onClick={onNavigate}>
        {t.nav.faq}
      </a>
    </>
  )

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-(--z-chrome) border-b transition-colors duration-200',
        scrolled
          ? 'border-border/60 bg-stage text-foreground'
          : 'border-marker-ink/20 bg-marker/90 text-marker-ink',
      )}
    >
      <a
        href="#content"
        className="sr-only bg-marker px-3 font-mono text-2xs font-semibold text-marker-ink uppercase focus:not-sr-only focus:absolute focus:top-2 focus:left-5 focus:z-10 focus:flex focus:h-9 focus:items-center focus:px-3"
      >
        {t.nav.skipToContent}
      </a>
      <nav
        aria-label={t.nav.navLabel}
        className="flex h-[72px] items-center gap-6 px-5 text-sm md:px-14"
      >
        <a
          href="#hero"
          className="flex py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          <BrandWordmark className="h-8" />
        </a>
        {/* Les ancres sortent du menu dès que la barre a la place : la décision
            est celle de `2026_08_13_landing-quality`, qui ne l'avait appliquée
            qu'au CTA. Une landing à 1440 px qui range « Tarifs » derrière un
            hamburger perd la visite venue comparer. Sous `md` elles restent
            dans le popover, qui les porte déjà. */}
        <div className="hidden items-center gap-6 md:flex">
          {anchors(scrolled ? undefined : anchorOnMarker)}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div
            role="group"
            aria-label={t.nav.langSwitchLabel}
            className="flex items-center gap-0.5 text-xs"
          >
            <LangLink
              code="en"
              className={
                scrolled
                  ? undefined
                  : 'text-marker-ink hover:text-marker-ink/60 focus-visible:outline-marker-ink'
              }
            />
            <LangLink
              code="fr"
              className={
                scrolled
                  ? undefined
                  : 'text-marker-ink hover:text-marker-ink/60 focus-visible:outline-marker-ink'
              }
            />
          </div>
          {/* L'action reste visible hors du menu dès qu'il y a la place : elle
              était descendue entièrement dans le popover, donc la seule action
              de la barre demandait un clic pour apparaître. Sur le citron, le
              remplissage `marker` du CTA disparaît — l'encre prend sa place,
              exactement comme dans le hero. */}
          <CtaPrimary
            href={LINKS.app}
            size="sm"
            className={cn(
              'ml-1 hidden md:inline-flex',
              scrolled
                ? undefined
                : 'border-marker-ink bg-marker-ink text-marker hover:border-marker-ink hover:bg-transparent hover:text-marker-ink focus-visible:outline-marker-ink',
            )}
          >
            {t.nav.cta}
          </CtaPrimary>
          <button
            type="button"
            popoverTarget={MENU_ID}
            aria-label={t.nav.menuLabel}
            className="flex size-11 items-center justify-center transition-colors duration-150 hover:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current md:hidden"
          >
            <Menu className="size-7" strokeWidth={1.5} aria-hidden />
          </button>
        </div>
      </nav>
      <div
        id={MENU_ID}
        popover="auto"
        className="fixed top-[72px] right-5 left-auto m-0 w-[min(22rem,calc(100vw-2.5rem))] border border-border bg-stage px-5 py-4 text-sm text-foreground md:right-14"
      >
        <div className="flex flex-col">
          {anchors(undefined, closeMenu)}
          <CtaPrimary href={LINKS.app} className="mt-4 mb-1 md:hidden">
            {t.nav.cta}
          </CtaPrimary>
        </div>
      </div>
    </header>
  )
}
