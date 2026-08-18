import { Check } from 'lucide-react'
import { useRef, useState, type KeyboardEvent, type ReactElement } from 'react'
import { useLang } from '../i18n'
import { ExportSpec } from './ExportSpec'
import { RefreshTree } from './RefreshTree'
import { SectionHeading } from './SectionHeading'
import { SpreadDiagram } from './SpreadDiagram'

const KEYS = ['editor', 'refresh', 'export'] as const

type FeatureKey = (typeof KEYS)[number]

/* Trois schémas dessinés, zéro illustration d'ambiance. Les onglets Compose et
   Export portaient des images générées (« dix écrans gravitent autour d'une
   forge de pixels citron ») qui ne montraient rien du produit, à côté d'un
   schéma qui montre ce que le produit manipule — un dossier. Le schéma « un
   écran appliqué aux dix » et la fiche du ZIP existaient déjà et disaient la
   même chose que les images en vrai : ils reprennent leur place, et la section
   parle d'une seule voix. L'agent a sa propre section (`AgentSection`) : en
   quatrième onglet, la moitié IA du produit se lisait comme un détail. */
const VISUALS: Record<FeatureKey, () => ReactElement> = {
  editor: SpreadDiagram,
  refresh: RefreshTree,
  export: ExportSpec,
}

const PANEL_ID = 'features-panel'

/*
 * Onglets, au sens APG. Les trois boutons portaient `aria-pressed`, ce qui
 * décrit trois interrupteurs indépendants dont il se trouve qu'un seul est
 * enfoncé — pas un choix parmi trois. Un lecteur d'écran annonçait donc « non
 * enfoncé » sur les deux autres, sans jamais dire qu'ils appartiennent au même
 * groupe ni qu'ils commandent le panneau qui suit. `tablist` le dit, et les
 * flèches deviennent la navigation attendue : un `tabindex` glissant garde une
 * seule tabulation pour le groupe entier.
 *
 * Un seul panneau, à identifiant fixe. Un identifiant qui suit l'onglet actif
 * laisse les deux `aria-controls` inactifs pointer sur un élément absent du
 * document.
 */
export function Features() {
  const { t } = useLang()
  const [active, setActive] = useState<FeatureKey>('editor')
  const tablist = useRef<HTMLDivElement>(null)
  const feature = t.features[active]
  const Visual = VISUALS[active]

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const next = KEYS[(KEYS.indexOf(active) + step + KEYS.length) % KEYS.length]
    setActive(next)
    tablist.current?.querySelector<HTMLButtonElement>(`#tab-${next}`)?.focus()
  }

  return (
    <section
      id="features"
      aria-labelledby="features-title"
      className="scroll-mt-20 border-b border-border/60 bg-stage px-5 py-20 md:px-14 md:py-28"
    >
      <div className="mx-auto max-w-7xl">
        <SectionHeading id="features-title">{t.features.heading}</SectionHeading>

        <div
          ref={tablist}
          role="tablist"
          aria-labelledby="features-title"
          onKeyDown={onKeyDown}
          className="mt-14 grid grid-cols-3 border-b border-border/60"
        >
          {KEYS.map((key) => (
            <button
              key={key}
              id={`tab-${key}`}
              type="button"
              role="tab"
              aria-selected={active === key}
              aria-controls={PANEL_ID}
              tabIndex={active === key ? 0 : -1}
              onClick={() => setActive(key)}
              className="relative min-h-16 px-3 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-ring aria-selected:text-foreground md:min-h-20 md:text-lg"
            >
              {t.features[key].tab}
              <span
                aria-hidden
                className="absolute inset-x-0 -bottom-px h-0.5 origin-left bg-marker transition-transform duration-200 ease-out motion-reduce:transition-none"
                style={{ transform: active === key ? 'scaleX(1)' : 'scaleX(0)' }}
              />
            </button>
          ))}
        </div>

        {/* Le panneau ne contient aucun élément focusable : APG demande alors
            qu'il le soit lui-même, sinon le contenu que les onglets commandent
            reste hors du parcours clavier. */}
        <div
          id={PANEL_ID}
          role="tabpanel"
          aria-labelledby={`tab-${active}`}
          tabIndex={0}
          className="grid gap-10 pt-12 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring md:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-center lg:gap-16"
        >
          <div>
            <h3 className="text-2xl font-medium md:text-3xl">{feature.title}</h3>
            <p className="mt-5 max-w-[62ch] text-[15px] leading-6 text-muted-foreground">
              {feature.body}
            </p>
            <ul className="mt-7 flex flex-col gap-3 text-sm">
              {feature.points.map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-marker" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <Visual key={active} />
        </div>
      </div>
    </section>
  )
}
