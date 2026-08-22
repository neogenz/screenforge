import { ColorPicker } from '@/components/color-picker/ColorPicker'
import { PanelSection } from '@/components/patterns/panel-section'
import { PropertyRow } from '@/components/patterns/property-row'
import { UnitField, UnitFieldPair } from '@/components/patterns/unit-field'
import { Switch } from '@/components/ui/switch'
import { DEFAULT_SHADOW_COLOR } from '@/lib/content-defaults'
import type { TextShadow } from '@/types'

const DEFAULT_SHADOW: TextShadow = { offsetX: 4, offsetY: 4, blur: 8, color: DEFAULT_SHADOW_COLOR }

export interface ShadowEditorProps {
  shadow: TextShadow | undefined
  onChange: (shadow: TextShadow | undefined, options?: { coalesceKey?: string }) => void
  /** Switch accessible name, e.g. "Activer l’ombre". */
  ariaLabel: string
  /** Burst key forwarded on every continuous edit. */
  coalesceKey: string
  title?: string
}

/** Unified shadow editor (was copy-pasted across four feature editors). */
export function ShadowEditor({
  shadow,
  onChange,
  ariaLabel,
  coalesceKey,
  title = 'Ombre',
}: ShadowEditorProps) {
  function patch(updates: Partial<TextShadow>) {
    if (!shadow) return
    onChange({ ...shadow, ...updates }, { coalesceKey })
  }

  return (
    <PanelSection
      title={title}
      headerExtra={
        <Switch
          aria-label={ariaLabel}
          checked={!!shadow}
          onCheckedChange={(checked) => onChange(checked ? { ...DEFAULT_SHADOW } : undefined)}
        />
      }
    >
      {shadow && (
        <div className="flex flex-col gap-2">
          <UnitFieldPair
            fields={[
              {
                label: 'X',
                ariaLabel: 'Décalage X de l’ombre',
                value: shadow.offsetX,
                onChange: (offsetX) => patch({ offsetX }),
                min: -500,
                max: 500,
              },
              {
                label: 'Y',
                ariaLabel: 'Décalage Y de l’ombre',
                value: shadow.offsetY,
                onChange: (offsetY) => patch({ offsetY }),
                min: -500,
                max: 500,
              },
            ]}
          />
          <UnitField
            label="Flou"
            ariaLabel="Flou de l’ombre"
            value={shadow.blur}
            onChange={(blur) => patch({ blur })}
            min={0}
            max={500}
          />
          <PropertyRow label="Couleur" stacked>
            <ColorPicker value={shadow.color} onChange={(color) => patch({ color })} showOpacity />
          </PropertyRow>
        </div>
      )}
    </PanelSection>
  )
}
