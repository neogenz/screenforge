import { Smartphone } from 'lucide-react'
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '@/lib/canvas/canvas-utils'
import { planScreenLayout, type CampaignBrief, type CampaignPlan } from '@/lib/ai/plan'
import { resolveAsset } from '@/lib/assets'
import { cn } from '@/lib/utils'

/**
 * Le visuel tel qu'il sera posé, avant qu'il ne le soit.
 *
 * Dessiné en CSS et non rendu par Fabric : les quatre choses qu'un plan pose —
 * un fond uni, un logo, un texte centré, un appareil qui porte une capture —
 * sont exactement ce qu'une boîte, une image et un bloc de texte savent
 * montrer. Instancier un `StaticCanvas` par visuel pour dix visuels, à chaque
 * frappe dans le champ d'accroche, coûterait dix rendus de 1320×2868 pour un
 * aperçu large de cent pixels.
 *
 * Les coordonnées viennent de `planScreenLayout`, la même fonction que le
 * constructeur consomme, exprimées ici en pourcentages de la planche. C'est ce
 * qui rend l'aperçu opposable : il ne peut pas montrer une composition que la
 * pose ne produirait pas, puisqu'il lit les mêmes nombres.
 *
 * Ce que l'aperçu ne montre pas, et l'assume : le cadre de l'iPhone, dont le
 * SVG n'a rien à dire à cette échelle, et l'accroche lisible — 48px de police
 * sur une planche de 1320 rendue en 132 font deux pixels de haut. La forme du
 * bloc de texte est l'information ; les mots se relisent dans le champ à côté.
 */

interface PlanPreviewProps {
  plan: CampaignPlan
  brief: CampaignBrief
  index: number
  /** Vignette de la bande de sélection, ou aperçu principal. */
  size: 'thumb' | 'full'
  className?: string
}

function percent(value: number, total: number): string {
  return `${(value / total) * 100}%`
}

export function PlanPreview({ plan, brief, index, size, className }: PlanPreviewProps) {
  const layout = planScreenLayout(plan, brief, index)
  if (!layout) return null

  const screenshot = resolveAsset(layout.device.assetId)
  const logo = resolveAsset(layout.logo?.assetId)
  const width = size === 'thumb' ? 40 : 132
  const scale = width / SCREEN_WIDTH

  const box = (rect: { x: number; y: number; width: number; height: number }) => ({
    position: 'absolute' as const,
    left: percent(rect.x, SCREEN_WIDTH),
    top: percent(rect.y, SCREEN_HEIGHT),
    width: percent(rect.width, SCREEN_WIDTH),
    height: percent(rect.height, SCREEN_HEIGHT),
  })

  return (
    <div
      aria-hidden
      className={cn('relative shrink-0 overflow-hidden rounded-sm border border-border', className)}
      style={{
        width,
        aspectRatio: `${SCREEN_WIDTH} / ${SCREEN_HEIGHT}`,
        background: layout.background,
      }}
    >
      {logo && layout.logo && (
        <img src={logo} alt="" className="object-contain" style={box(layout.logo)} />
      )}

      <div
        className="flex items-start justify-center overflow-hidden text-center font-semibold"
        style={{
          ...box(layout.headline),
          color: layout.headline.color,
          // La police suit l'échelle de la planche : c'est ce qui fait que deux
          // lignes ici sont deux lignes sur l'export, et non un effet du cadre.
          fontSize: Math.max(1, layout.headline.fontSize * scale),
          lineHeight: 1.2,
        }}
      >
        {layout.headline.text}
      </div>

      <div
        className="overflow-hidden rounded-[12%] border border-black/25 bg-black/85"
        style={box(layout.device)}
      >
        {screenshot ? (
          <img src={screenshot} alt="" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center text-white/40">
            <Smartphone size={size === 'thumb' ? 10 : 22} strokeWidth={1.5} />
          </span>
        )}
      </div>
    </div>
  )
}
