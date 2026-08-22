import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'
import type { ReactElement } from 'react'
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

/*
 * Trois blocs empilés, et plus d'onglets. Les onglets étaient corrects au sens
 * APG — `tablist`, `tabindex` glissant, un panneau à identifiant fixe — et
 * cachaient quand même deux tiers de la section derrière un clic, dans une page
 * dont le travail entier est de montrer. Une section marketing n'a rien à
 * cacher, et le prérendu porte alors les trois schémas dans la source : un
 * lecteur sans JS, un crawler et un visiteur qui défile voient la même chose.
 *
 * Le texte et le schéma changent de côté d'un bloc à l'autre. Trois blocs
 * identiques se lisent comme une liste à trois entrées ; alternés, ils se
 * lisent comme trois fonctions distinctes, ce qu'ils sont.
 */
export function Features() {
  const { t } = useLang()

  return (
    <section
      id="features"
      aria-labelledby="features-title"
      className="scroll-mt-20 border-b border-border/60 bg-stage px-5 py-20 md:px-14 md:py-28"
    >
      <div className="mx-auto max-w-7xl">
        <SectionHeading id="features-title">{t.features.heading}</SectionHeading>

        <div className="mt-14 flex flex-col divide-y divide-border/60">
          {KEYS.map((key, index) => {
            const feature = t.features[key]
            const Visual = VISUALS[key]
            const visualFirst = index % 2 === 1
            return (
              <article
                key={key}
                className="grid gap-10 py-12 first:pt-0 last:pb-0 md:py-16 lg:grid-cols-2 lg:items-center lg:gap-16"
              >
                <div className={cn('min-w-0', visualFirst && 'lg:order-2')}>
                  <p className="font-mono text-2xs text-marker uppercase">
                    0{index + 1} {feature.eyebrow}
                  </p>
                  <h3 className="mt-3 text-2xl font-medium md:text-3xl">{feature.title}</h3>
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
                <div className={cn('min-w-0', visualFirst && 'lg:order-1')}>
                  <Visual />
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
