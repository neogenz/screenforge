import { generateDeviceFrameSVG, getDeviceFrame } from '@/assets/device-frames'
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '@/lib/canvas/canvas-utils'
import { planScreenLayout, type CampaignBrief, type CampaignPlan } from '@/lib/ai/plan'
import type { PlanAccent, PlanBox } from '@/lib/ai/archetypes'
import { backgroundToCss } from '@/lib/background-css'
import { resolveAsset } from '@/lib/assets'
import { drawnBox, shapeEntry, SHAPE_BOX } from '@/lib/vector-catalog'
import { cn } from '@/lib/utils'

/**
 * Le visuel tel qu'il sera posé, avant qu'il ne le soit.
 *
 * Dessiné en CSS et SVG, sans instancier dix `StaticCanvas` à chaque frappe.
 * L'appareil, lui, passe par `generateDeviceFrameSVG` : c'est le même châssis,
 * la même dalle et le même cadrage que le calque posé ensuite sur le canvas.
 *
 * Les coordonnées viennent de `planScreenLayout`, la même fonction que le
 * constructeur consomme. C'est ce qui rend l'aperçu opposable : il ne peut pas
 * montrer une composition que la pose ne produirait pas, puisqu'il lit les mêmes
 * nombres. Le jour où le générateur a cessé de poser dix fois la même planche,
 * ce composant a cessé de compiler — et c'est le comportement voulu : une
 * composition que l'aperçu ne sait pas dessiner ne doit pas pouvoir être posée
 * en silence.
 *
 * **La rotation tourne autour du centre**, et donc rien n'est déclaré ici : le
 * défaut de CSS et ce que fait Fabric sont la même chose.
 * `FabricObject.ownDefaults` pose bien `left/top` en tête de `canvas-utils`,
 * mais `applyLayerToFabricObject` repasse chaque objet en `center/center` et le
 * place à `layer.x + largeur/2` — la boîte non pivotée reste au même endroit,
 * la rotation seule diffère. Un `transform-origin: 0 0` écrit sur la foi du
 * premier réglage décalait l'appareil incliné de `bord-coupe` de 38 px sur une
 * planche large de 440, soit 8,7 % : un aperçu faux, ce qui est pire qu'un
 * aperçu absent.
 *
 * L'accroche reste lisible à l'échelle de la planche ; les mots se corrigent
 * dans le champ à côté.
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

function box(rect: PlanBox, rotation = 0): React.CSSProperties {
  return {
    position: 'absolute',
    left: percent(rect.x, SCREEN_WIDTH),
    top: percent(rect.y, SCREEN_HEIGHT),
    width: percent(rect.width, SCREEN_WIDTH),
    height: percent(rect.height, SCREEN_HEIGHT),
    ...(rotation ? { transform: `rotate(${rotation}deg)` } : {}),
  }
}

/**
 * Une forme du catalogue, à l'échelle de sa boîte englobante.
 *
 * De **sa** boîte, et non de celle du catalogue : Fabric met un `Path` à
 * l'échelle de son propre `width`/`height`, pas des cent unités où il est
 * tracé. « Ligne » est un bandeau de 100 × 12, donc l'accent de `bas-ancre`
 * — 88 × 40 — sort en pavé plein sur la planche, quand un `viewBox` de 100 le
 * dessinait ici en filet de cinq pixels. Deux formes sur trois de celles que
 * les archétypes emploient étaient dans ce cas. `drawn` porte la mesure, et le
 * `viewBox` la recopie : la mise à l'échelle est alors la même des deux côtés.
 * Les trois primitives n'ont pas de tracé — elles sont des primitives
 * justement — et sont redites ici.
 */
function AccentShape({ accent }: { accent: PlanAccent }) {
  const entry = shapeEntry(accent.shape)
  const [x, y, width, height] = entry ? drawnBox(entry) : [0, 0, SHAPE_BOX, SHAPE_BOX]
  return (
    <svg
      aria-hidden
      viewBox={`${x} ${y} ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ ...box(accent, accent.rotation), opacity: accent.opacity }}
    >
      {entry?.path ? (
        <path d={entry.path} fill={accent.color} />
      ) : accent.shape === 'circle' ? (
        <ellipse
          cx={SHAPE_BOX / 2}
          cy={SHAPE_BOX / 2}
          rx={SHAPE_BOX / 2}
          ry={SHAPE_BOX / 2}
          fill={accent.color}
        />
      ) : (
        <rect
          width={SHAPE_BOX}
          height={SHAPE_BOX}
          rx={accent.shape === 'rounded-rect' ? 12 : 0}
          fill={accent.color}
        />
      )}
    </svg>
  )
}

export function PlanPreview({ plan, brief, index, size, className }: PlanPreviewProps) {
  const layout = planScreenLayout(plan, brief, index)
  if (!layout) return null

  const config = getDeviceFrame(plan.deviceModel)
  const deviceSvg = layout.device
    ? generateDeviceFrameSVG(
        config,
        config.colors[0].name,
        resolveAsset(layout.device.assetId),
        undefined,
        layout.device.screenshotSize,
      )
    : null
  const deviceFrame = deviceSvg
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(deviceSvg)}`
    : undefined
  const logo = resolveAsset(layout.logo?.assetId)
  const width = size === 'thumb' ? 40 : 132
  const scale = width / SCREEN_WIDTH

  return (
    <div
      aria-hidden
      className={cn('relative shrink-0 overflow-hidden rounded-sm border border-border', className)}
      style={{
        width,
        aspectRatio: `${SCREEN_WIDTH} / ${SCREEN_HEIGHT}`,
        background: backgroundToCss(layout.background),
      }}
    >
      {layout.accentsBehind.map((accent, at) => (
        <AccentShape key={`behind-${at}`} accent={accent} />
      ))}

      {layout.device && (
        <img
          src={deviceFrame}
          alt=""
          data-device-frame={plan.deviceModel}
          className="object-fill drop-shadow-sm"
          style={box(layout.device, layout.device.rotation)}
        />
      )}

      {layout.accentsFront.map((accent, at) => (
        <AccentShape key={`front-${at}`} accent={accent} />
      ))}

      {logo && layout.logo && (
        <img src={logo} alt="" className="object-contain" style={box(layout.logo)} />
      )}

      {/* Sans `overflow-hidden` et sans hauteur imposée : une accroche trop
          longue déborde ici comme elle débordera sur la planche. Fabric fait
          grandir un `Textbox` au-delà de la boîte dessinée pour lui et rien ne
          l'y coupe, donc un aperçu qui coupait rendait tidy une accroche que la
          pose faisait descendre sur l'appareil. C'est précisément ce que la
          revue existe pour montrer. */}
      <div
        className="flex items-start"
        style={{
          ...box(layout.headline),
          height: undefined,
          minHeight: percent(layout.headline.height, SCREEN_HEIGHT),
          color: layout.headline.color,
          fontWeight: layout.headline.fontWeight,
          textAlign: layout.headline.align,
          justifyContent:
            layout.headline.align === 'center'
              ? 'center'
              : layout.headline.align === 'right'
                ? 'flex-end'
                : 'flex-start',
          // La police suit l'échelle de la planche : c'est ce qui fait que deux
          // lignes ici sont deux lignes sur l'export, et non un effet du cadre.
          fontSize: Math.max(1, layout.headline.fontSize * scale),
          lineHeight: 1.2,
        }}
      >
        {layout.headline.text}
      </div>
    </div>
  )
}
