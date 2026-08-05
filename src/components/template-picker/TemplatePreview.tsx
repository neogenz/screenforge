import { generateDeviceFrameSVG, getDeviceFrame } from '@/assets/device-frames'
import { resolveAsset } from '@/lib/assets'
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '@/lib/canvas/canvas-utils'
import type { Background, GradientFill, Layer, TemplateDefinition, TextLayer } from '@/types'

const WIDTH = SCREEN_WIDTH
const HEIGHT = SCREEN_HEIGHT

interface TemplatePreviewProps {
  template: TemplateDefinition
}

export function TemplatePreview({ template }: TemplatePreviewProps) {
  const backgroundId = `${template.id}-background`
  const sortedLayers = [...template.layers].sort((first, second) => first.zIndex - second.zIndex)

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="block h-full w-full"
      role="img"
      aria-label={`Aperçu du modèle ${template.name}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        {/* `meet` centre le viewBox dans une boîte plus large : sans découpe, un
            texte plus large que la planche déborde sur la vignette et l'aperçu
            passe pour cassé. */}
        <clipPath id={`${template.id}-clip`}>
          <rect width={WIDTH} height={HEIGHT} />
        </clipPath>
        {gradientDefinition(backgroundId, backgroundGradient(template.background))}
        {sortedLayers.map((layer) =>
          layer.type === 'shape' && typeof layer.fill !== 'string'
            ? gradientDefinition(`${template.id}-${layer.id}`, layer.fill)
            : null,
        )}
      </defs>
      <g clipPath={`url(#${template.id}-clip)`}>
        <rect
          width={WIDTH}
          height={HEIGHT}
          fill={paintForBackground(template.background, backgroundId)}
        />
        {sortedLayers.map((layer) => (
          <TemplateLayer key={layer.id} templateId={template.id} layer={layer} />
        ))}
      </g>
    </svg>
  )
}

function TemplateLayer({ templateId, layer }: { templateId: string; layer: Layer }) {
  if (!layer.visible) return null
  const centerX = layer.x + layer.width / 2
  const centerY = layer.y + layer.height / 2
  const transform = layer.rotation ? `rotate(${layer.rotation} ${centerX} ${centerY})` : undefined

  if (layer.type === 'text') {
    // `<text>` ne revient jamais à la ligne : un titre plus large que sa boîte
    // sortait de la planche. Le contenu est une Textbox sur le canevas, donc
    // l'aperçu doit replier au même endroit — seul un bloc HTML le fait.
    return (
      <foreignObject
        transform={transform}
        x={layer.x}
        y={layer.y}
        width={layer.width}
        height={HEIGHT - layer.y}
      >
        <div
          style={{
            color: layer.color,
            opacity: layer.opacity,
            fontFamily: `${layer.fontFamily}, system-ui, sans-serif`,
            fontSize: layer.fontSize,
            fontWeight: layer.fontWeight,
            letterSpacing: layer.letterSpacing,
            lineHeight: layer.lineHeight,
            textAlign: layer.textAlign,
            whiteSpace: 'pre-wrap',
            overflowWrap: 'break-word',
          }}
        >
          {transformText(layer)}
        </div>
      </foreignObject>
    )
  }

  if (layer.type === 'shape') {
    const fill = typeof layer.fill === 'string' ? layer.fill : `url(#${templateId}-${layer.id})`
    if (layer.shapeType === 'circle') {
      return (
        <ellipse
          transform={transform}
          cx={centerX}
          cy={centerY}
          rx={layer.width / 2}
          ry={layer.height / 2}
          fill={fill}
          stroke={layer.stroke}
          strokeWidth={layer.strokeWidth}
          opacity={layer.opacity}
        />
      )
    }
    return (
      <rect
        transform={transform}
        x={layer.x}
        y={layer.y}
        width={layer.width}
        height={layer.height}
        rx={layer.shapeType === 'rounded-rect' ? (layer.borderRadius ?? 8) : 0}
        fill={fill}
        stroke={layer.stroke}
        strokeWidth={layer.strokeWidth}
        opacity={layer.opacity}
      />
    )
  }

  if (layer.type === 'device-frame') {
    const config = getDeviceFrame(layer.deviceModel)
    const svg = generateDeviceFrameSVG(
      config,
      layer.deviceColor,
      resolveAsset(layer.screenshotAssetId),
    )
    return (
      <image
        transform={transform}
        href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
        x={layer.x}
        y={layer.y}
        width={layer.width}
        height={layer.height}
        opacity={layer.opacity}
        preserveAspectRatio="none"
      />
    )
  }

  const imageSrc = resolveAsset(layer.assetId)
  if (!imageSrc) return null
  return (
    <image
      transform={transform}
      href={imageSrc}
      x={layer.x}
      y={layer.y}
      width={layer.width}
      height={layer.height}
      opacity={layer.opacity}
      preserveAspectRatio="none"
    />
  )
}

function backgroundGradient(background: Background): GradientFill | null {
  if (background.type === 'solid') return null
  return {
    type: background.type === 'linear-gradient' ? 'linear' : 'radial',
    angle: background.type === 'linear-gradient' ? background.angle : undefined,
    centerX: background.type === 'radial-gradient' ? background.centerX : undefined,
    centerY: background.type === 'radial-gradient' ? background.centerY : undefined,
    stops: background.stops,
  }
}

function paintForBackground(background: Background, gradientId: string): string {
  return background.type === 'solid' ? background.color : `url(#${gradientId})`
}

function gradientDefinition(id: string, gradient: GradientFill | null) {
  if (!gradient) return null
  if (gradient.type === 'radial') {
    return (
      <radialGradient
        key={id}
        id={id}
        cx={`${gradient.centerX ?? 50}%`}
        cy={`${gradient.centerY ?? 50}%`}
        r="70%"
      >
        {gradient.stops.map((stop) => (
          <stop key={`${stop.offset}-${stop.color}`} offset={stop.offset} stopColor={stop.color} />
        ))}
      </radialGradient>
    )
  }

  const radians = ((gradient.angle ?? 90) * Math.PI) / 180
  const dx = Math.sin(radians) * 50
  const dy = -Math.cos(radians) * 50
  return (
    <linearGradient
      key={id}
      id={id}
      x1={`${50 - dx}%`}
      y1={`${50 - dy}%`}
      x2={`${50 + dx}%`}
      y2={`${50 + dy}%`}
    >
      {gradient.stops.map((stop) => (
        <stop key={`${stop.offset}-${stop.color}`} offset={stop.offset} stopColor={stop.color} />
      ))}
    </linearGradient>
  )
}

function transformText(layer: TextLayer): string {
  if (layer.textTransform === 'uppercase') return layer.content.toUpperCase()
  if (layer.textTransform === 'lowercase') return layer.content.toLowerCase()
  if (layer.textTransform === 'capitalize') {
    return layer.content.replace(/(^|\s)\p{L}/gu, (letter) => letter.toUpperCase())
  }
  return layer.content
}
