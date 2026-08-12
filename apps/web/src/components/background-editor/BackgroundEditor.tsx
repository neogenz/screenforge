import { useState } from 'react'
import type { Background, ColorStop, GradientFill } from '@/types'
import { cn } from '@/lib/utils'
import { backgroundToCss } from '@/lib/background-css'
import { ColorPicker } from '@/components/color-picker/ColorPicker'
import { GradientEditor } from '@/components/gradient-editor/GradientEditor'
import { Field } from '@/components/ui/field'
import { Segmented } from '@/components/ui/segmented'
import type { SegmentedOption } from '@/components/ui/segmented'
import { PRESET_GRADIENTS } from '@/assets/gradients'
import {
  DEFAULT_BACKGROUND_FROM,
  DEFAULT_BACKGROUND_TO,
  DEFAULT_SOLID_COLOR,
} from '@/lib/content-defaults'

interface BackgroundEditorProps {
  background: Background
  onChange: (bg: Background, coalesceKey?: string) => void
}

type Tab = 'solid' | 'gradient' | 'presets'

const DEFAULT_GRADIENT: GradientFill = {
  type: 'linear',
  angle: 135,
  stops: [
    { offset: 0, color: DEFAULT_BACKGROUND_FROM },
    { offset: 1, color: DEFAULT_BACKGROUND_TO },
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
    return {
      type: 'radial-gradient',
      centerX: fill.centerX,
      centerY: fill.centerY,
      stops: fill.stops,
    }
  }
  return { type: 'linear-gradient', angle: fill.angle ?? 135, stops: fill.stops }
}

function tabFromBackground(bg: Background): Tab {
  if (bg.type === 'solid') return 'solid'
  return 'gradient'
}

function stopsEqual(a: ColorStop[], b: ColorStop[]): boolean {
  return (
    a.length === b.length &&
    a.every((stop, index) => stop.offset === b[index].offset && stop.color === b[index].color)
  )
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
    onChange({ type: 'solid', color }, 'color')
  }

  function handleGradientChange(fill: GradientFill, coalesceKey?: string) {
    onChange(gradientFillToBackground(fill), coalesceKey)
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
      onChange({ type: 'solid', color: DEFAULT_SOLID_COLOR })
    }
    if (tab === 'gradient' && background.type === 'solid') {
      onChange(gradientFillToBackground(DEFAULT_GRADIENT))
    }
  }

  const solidColor = background.type === 'solid' ? background.color : DEFAULT_SOLID_COLOR
  const gradientFill = backgroundToGradientFill(background)

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col gap-3">
      <Segmented
        options={TAB_OPTIONS}
        value={activeTab}
        onChange={handleTabChange}
        ariaLabel="Type d’arrière-plan"
        className="w-full [&>button]:min-w-0 [&>button]:flex-1"
      />

      {activeTab === 'solid' && (
        <Field label="Couleur">
          <ColorPicker value={solidColor} onChange={handleSolidColor} />
        </Field>
      )}

      {activeTab === 'gradient' && (
        <GradientEditor value={gradientFill} onChange={handleGradientChange} />
      )}

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
                style={{ background: backgroundToCss(preset.background) }}
                className={cn(
                  'h-9 rounded-md border transition-[border-color] duration-150 ease-out',
                  selected ? 'border-muted-foreground' : 'border-border hover:border-input',
                )}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
