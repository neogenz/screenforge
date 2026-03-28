import { useState } from 'react'
import type { Background, GradientFill, ColorStop } from '@/types'
import { cn } from '@/lib/utils'
import { ColorPicker } from '@/components/color-picker/ColorPicker'
import { GradientEditor } from '@/components/gradient-editor/GradientEditor'
import { PRESET_GRADIENTS } from '@/assets/gradients'

interface BackgroundEditorProps {
  background: Background
  onChange: (bg: Background) => void
}

type Tab = 'solid' | 'gradient' | 'presets'

const DEFAULT_GRADIENT: GradientFill = {
  type: 'linear',
  angle: 135,
  stops: [
    { offset: 0, color: '#6366f1' },
    { offset: 1, color: '#a855f7' },
  ],
}

function backgroundToGradientFill(bg: Background): GradientFill {
  if (bg.type === 'linear-gradient') {
    return { type: 'linear', angle: bg.angle, stops: bg.stops }
  }
  if (bg.type === 'radial-gradient') {
    return { type: 'radial', centerX: bg.centerX, centerY: bg.centerY, stops: bg.stops }
  }
  return DEFAULT_GRADIENT
}

function gradientFillToBackground(fill: GradientFill): Background {
  if (fill.type === 'radial') {
    return { type: 'radial-gradient', centerX: fill.centerX, centerY: fill.centerY, stops: fill.stops }
  }
  return { type: 'linear-gradient', angle: fill.angle ?? 135, stops: fill.stops }
}

function buildPreviewStyle(bg: Background): React.CSSProperties {
  if (bg.type === 'solid') {
    return { background: bg.color }
  }
  const stops = bg.stops
    .slice()
    .sort((a: ColorStop, b: ColorStop) => a.offset - b.offset)
    .map((s: ColorStop) => `${s.color} ${Math.round(s.offset * 100)}%`)
    .join(', ')

  if (bg.type === 'radial-gradient') {
    return { background: `radial-gradient(circle, ${stops})` }
  }
  return { background: `linear-gradient(${bg.angle}deg, ${stops})` }
}

function tabFromBackground(bg: Background): Tab {
  if (bg.type === 'solid') return 'solid'
  return 'gradient'
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'solid', label: 'Uni' },
  { id: 'gradient', label: 'Dégradé' },
  { id: 'presets', label: 'Préréglages' },
]

export function BackgroundEditor({ background, onChange }: BackgroundEditorProps) {
  const [activeTab, setActiveTab] = useState<Tab>(tabFromBackground(background))

  function handleSolidColor(color: string) {
    onChange({ type: 'solid', color })
  }

  function handleGradientChange(fill: GradientFill) {
    onChange(gradientFillToBackground(fill))
  }

  function handlePresetClick(preset: Background) {
    onChange(preset)
    setActiveTab('gradient')
  }

  const solidColor = background.type === 'solid' ? background.color : '#6366f1'
  const gradientFill = backgroundToGradientFill(background)

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Type</span>
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'min-h-10 flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors sm:flex-none sm:px-5',
                activeTab === tab.id
                  ? 'border-primary bg-primary text-white shadow-sm'
                  : 'border-border bg-surface text-foreground hover:border-muted hover:bg-surface-hover',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'solid' && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Couleur</span>
          <ColorPicker value={solidColor} onChange={handleSolidColor} />
        </div>
      )}

      {activeTab === 'gradient' && <GradientEditor value={gradientFill} onChange={handleGradientChange} />}

      {activeTab === 'presets' && (
        <div className="flex flex-col gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Galerie</span>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {PRESET_GRADIENTS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => handlePresetClick(preset.background)}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-xl border border-border bg-surface p-3',
                  'transition-colors hover:border-primary hover:shadow-sm',
                )}
                aria-label={`Appliquer le dégradé ${preset.name}`}
              >
                <div
                  className="aspect-square w-full max-w-[4.5rem] rounded-lg border border-border/80 shadow-inner"
                  style={buildPreviewStyle(preset.background)}
                />
                <span className="w-full truncate text-center text-[11px] font-medium text-muted">
                  {preset.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
