import { useState, useRef } from 'react'
import { ChevronDown, X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DEVICE_FRAMES, getDeviceFrame } from '@/assets/device-frames'
import { inputCls, Field } from '@/components/properties-panel/TransformSection'
import { Toggle } from '@/components/text-editor/TextEditor'
import type { DeviceFrameLayer, DeviceModel, DeviceColor, Orientation } from '@/types'

interface DevicePickerProps {
  deviceModel: DeviceModel
  deviceColor: DeviceColor
  orientation: Orientation
  screenshotUrl?: string
  shadowEnabled: boolean
  shadowBlur: number
  shadowColor: string
  shadowOffsetX: number
  shadowOffsetY: number
  onUpdate: (updates: Partial<DeviceFrameLayer>) => void
}

export function DevicePicker({
  deviceModel,
  deviceColor,
  orientation,
  screenshotUrl,
  shadowEnabled,
  shadowBlur,
  shadowColor,
  shadowOffsetX,
  shadowOffsetY,
  onUpdate,
}: DevicePickerProps) {
  const [shadowOpen, setShadowOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const config = getDeviceFrame(deviceModel)

  function handleScreenshotChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => onUpdate({ screenshotUrl: reader.result as string })
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Model */}
      <Field label="Model">
        <select
          value={deviceModel}
          onChange={(e) => {
            const m = e.target.value as DeviceModel
            const c = getDeviceFrame(m).colors[0].name
            onUpdate({ deviceModel: m, deviceColor: c })
          }}
          className={inputCls}
        >
          {DEVICE_FRAMES.map((f) => (
            <option key={f.model} value={f.model}>{f.modelName}</option>
          ))}
        </select>
      </Field>

      {/* Color */}
      <Field label="Color">
        <div className="flex flex-wrap gap-1.5">
          {config.colors.map((c) => (
            <button
              key={c.name}
              onClick={() => onUpdate({ deviceColor: c.name })}
              title={c.label}
              aria-label={c.label}
              aria-pressed={deviceColor === c.name}
              className={cn(
                'relative h-6 w-6 rounded-full border transition-[border-color,transform] duration-100 ease-out',
                deviceColor === c.name
                  ? 'border-foreground scale-110'
                  : 'border-border hover:border-border-strong',
              )}
              style={{ backgroundColor: c.frame }}
            >
              {deviceColor === c.name && (
                <Check
                  size={10}
                  className="absolute inset-0 m-auto"
                  style={{ color: isLightColor(c.frame) ? '#000' : '#fff' }}
                  strokeWidth={2.5}
                />
              )}
            </button>
          ))}
        </div>
      </Field>

      {/* Orientation — flat segmented, monochrome */}
      <Field label="Orient">
        <div className="seg w-full" role="group" aria-label="Orientation">
          {(['portrait', 'landscape'] as const).map((v) => (
            <button
              key={v}
              onClick={() => onUpdate({ orientation: v })}
              data-active={orientation === v}
              className="seg-btn flex-1"
              aria-pressed={orientation === v}
            >
              {v}
            </button>
          ))}
        </div>
      </Field>

      {/* Screenshot */}
      <Field label="Screenshot">
        {screenshotUrl ? (
          <div className="flex items-center gap-2 rounded-md border border-border bg-panel p-1.5">
            <img
              src={screenshotUrl}
              alt="Screenshot"
              className="h-8 w-8 shrink-0 rounded-sm border border-border object-cover"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mono-label-strong flex-1 text-left hover:text-foreground transition-colors"
            >
              Replace
            </button>
            <button
              onClick={() => onUpdate({ screenshotUrl: undefined })}
              className="flex h-6 w-6 items-center justify-center rounded-sm text-foreground-muted hover:bg-surface-hover hover:text-danger transition-colors"
              aria-label="Remove screenshot"
            >
              <X size={11} strokeWidth={1.5} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'flex h-8 items-center justify-center gap-2 rounded-md border border-dashed border-border',
              'mono-label transition-colors duration-100 ease-out',
              'hover:border-border-strong hover:text-foreground',
            )}
          >
            Upload image
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg"
          className="hidden"
          onChange={handleScreenshotChange}
        />
      </Field>

      {/* Shadow */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="mono-label-strong">Shadow</span>
          <div className="flex items-center gap-1">
            <Toggle active={shadowEnabled} onToggle={() => onUpdate({ shadowEnabled: !shadowEnabled })} />
            <button
              onClick={() => setShadowOpen((v) => !v)}
              className="flex h-6 w-6 items-center justify-center rounded-sm text-foreground-muted hover:bg-surface-hover hover:text-foreground transition-colors"
              aria-label={shadowOpen ? 'Collapse shadow' : 'Expand shadow'}
              aria-expanded={shadowOpen}
            >
              <ChevronDown size={12} strokeWidth={1.75} className={cn('transition-transform duration-150', shadowOpen && 'rotate-180')} />
            </button>
          </div>
        </div>

        {shadowOpen && shadowEnabled && (
          <div className="flex flex-col gap-2 pl-3">
            <div className="flex items-center gap-2">
              <span className="mono-label w-8">Blur</span>
              <input
                type="range" min={0} max={60} value={shadowBlur}
                onChange={(e) => onUpdate({ shadowBlur: Number(e.target.value) })}
                className="flex-1 cursor-pointer"
                aria-label="Shadow blur"
              />
              <span className="mono-value w-6 text-right text-[10px] text-foreground-muted">{shadowBlur}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="mono-label w-8">Color</span>
              <input
                type="color" value={shadowColor}
                onChange={(e) => onUpdate({ shadowColor: e.target.value })}
                className="h-6 w-8 cursor-pointer rounded-sm border border-border bg-transparent p-0.5"
                aria-label="Shadow color"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="X">
                <input type="number" value={shadowOffsetX}
                  onChange={(e) => onUpdate({ shadowOffsetX: Number(e.target.value) })}
                  className={inputCls}
                />
              </Field>
              <Field label="Y">
                <input type="number" value={shadowOffsetY}
                  onChange={(e) => onUpdate({ shadowOffsetY: Number(e.target.value) })}
                  className={inputCls}
                />
              </Field>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 155
}
