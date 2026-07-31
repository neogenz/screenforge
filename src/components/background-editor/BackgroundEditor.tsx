import { useState } from 'react'
import type { Background, ColorStop, GradientFill } from '@/types'
import { cn } from '@/lib/utils'
import { ColorPicker } from '@/components/color-picker/ColorPicker'
import { GradientEditor } from '@/components/gradient-editor/GradientEditor'
import { Segmented } from '@/components/ui/segmented'
import type { SegmentedOption } from '@/components/ui/segmented'
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

const TAB_OPTIONS: SegmentedOption<Tab>[] = [
  { value: 'solid', label: 'Uni' },
  { value: 'gradient', label: 'Dégradé' },
  { value: 'presets', label: 'Préréglages' },
]

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
    return {
      background: `radial-gradient(circle at ${bg.centerX ?? 50}% ${bg.centerY ?? 50}%, ${stops})`,
    }
  }
  return { background: `linear-gradient(${bg.angle}deg, ${stops})` }
}

function tabFromBackground(bg: Background): Tab {
  if (bg.type === 'solid') return 'solid'
  return 'gradient'
}

function stopsEqual(a: ColorStop[], b: ColorStop[]): boolean {
  return a.length === b.length
    && a.every((stop, index) => stop.offset === b[index].offset && stop.color === b[index].color)
}

function isPresetActive(preset: Background, current: Background): boolean {
  if (preset.type === 'linear-gradient' && current.type === 'linear-gradient') {
    return preset.angle === current.angle && stopsEqual(preset.stops, current.stops)
  }
  if (preset.type === 'radial-gradient' && current.type === 'radial-gradient') {
    return stopsEqual(preset.stops, current.stops)
  }
  return false
}

export function BackgroundEditor({ background, onChange }: BackgroundEditorProps) {
  const [showPresets, setShowPresets] = useState(false)
  const activeTab: Tab = showPresets ? 'presets' : tabFromBackground(background)

  function handleSolidColor(color: string) {
    onChange({ type: 'solid', color })
  }

  function handleGradientChange(fill: GradientFill) {
    onChange(gradientFillToBackground(fill))
  }

  function handlePresetClick(preset: Background) {
    onChange(preset)
  }

  function handleTabChange(tab: Tab) {
    if (tab === 'presets') {
      setShowPresets(true)
      return
    }
    setShowPresets(false)
    if (tab === 'solid' && background.type !== 'solid') {
      onChange({ type: 'solid', color: '#6366f1' })
    }
    if (tab === 'gradient' && background.type === 'solid') {
      onChange(gradientFillToBackground(DEFAULT_GRADIENT))
    }
  }

  const solidColor = background.type === 'solid' ? background.color : '#6366f1'
  const gradientFill = backgroundToGradientFill(background)

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col gap-3">
      <Segmented
        options={TAB_OPTIONS}
        value={activeTab}
        onChange={handleTabChange}
        ariaLabel="Type d’arrière-plan"
        className="w-full"
      />

      {activeTab === 'solid' && (
        <div className="flex flex-col gap-1.5">
          <span className="caps-label">Couleur</span>
          <ColorPicker value={solidColor} onChange={handleSolidColor} />
        </div>
      )}

      {activeTab === 'gradient' && <GradientEditor value={gradientFill} onChange={handleGradientChange} />}

      {activeTab === 'presets' && (
        <div className="grid grid-cols-4 gap-1.5">
          {PRESET_GRADIENTS.map((preset) => {
            const selected = isPresetActive(preset.background, background)
            return (
              <button
                key={preset.name}
                type="button"
                onClick={() => handlePresetClick(preset.background)}
                aria-label={`Appliquer le dégradé ${preset.name}`}
                aria-pressed={selected}
                title={preset.name}
                style={buildPreviewStyle(preset.background)}
                className={cn(
                  'h-9 rounded-md border transition-[border-color] duration-150 ease-out',
                  selected
                    ? 'border-export ring-1 ring-export'
                    : 'border-border hover:border-border-strong',
                )}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
