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
    <div className="flex flex-col gap-2.5">
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
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-medium text-muted shrink-0">Color</span>
        <div className="flex gap-1">
          {config.colors.map((c) => (
            <button
              key={c.name}
              onClick={() => onUpdate({ deviceColor: c.name })}
              title={c.label}
              aria-label={c.label}
              className={cn(
                'relative w-6 h-6 rounded-full border-[1.5px] transition-all',
                deviceColor === c.name
                  ? 'border-primary scale-110'
                  : 'border-border/60 hover:border-border',
              )}
              style={{ backgroundColor: c.frame }}
            >
              {deviceColor === c.name && (
                <Check
                  size={10}
                  className="absolute inset-0 m-auto"
                  style={{ color: isLightColor(c.frame) ? '#000' : '#fff' }}
                  strokeWidth={3}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Orientation */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-medium text-muted shrink-0">Orient.</span>
        <div className="flex flex-1 rounded-md bg-surface border border-border p-[2px] gap-[2px]">
          {(['portrait', 'landscape'] as const).map((v) => (
            <button
              key={v}
              onClick={() => onUpdate({ orientation: v })}
              className={cn(
                'flex-1 h-7 text-xs font-medium capitalize rounded transition-all',
                orientation === v
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted hover:text-foreground',
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Screenshot */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-medium text-muted">Screenshot</span>
        {screenshotUrl ? (
          <div className="flex items-center gap-2 rounded-md bg-surface border border-border p-1.5 group">
            <img
              src={screenshotUrl}
              alt="Screenshot"
              className="w-8 h-8 rounded object-cover shrink-0"
            />
            <div className="flex-1 min-w-0">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-[10px] text-muted hover:text-primary transition-colors"
              >
                Replace
              </button>
            </div>
            <button
              onClick={() => onUpdate({ screenshotUrl: undefined })}
              className="w-5 h-5 flex items-center justify-center rounded text-muted/40 hover:text-danger hover:bg-danger/10 transition-colors"
              aria-label="Remove screenshot"
            >
              <X size={10} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="h-7 flex items-center justify-center gap-1.5 rounded-md border border-dashed border-border text-xs text-muted transition-colors hover:border-primary hover:text-primary"
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
      </div>

      {/* Shadow */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-foreground">Shadow</span>
          <div className="flex items-center gap-1.5">
            <Toggle active={shadowEnabled} onToggle={() => onUpdate({ shadowEnabled: !shadowEnabled })} />
            <button
              onClick={() => setShadowOpen((v) => !v)}
              className="text-muted/40 hover:text-muted transition-colors"
            >
              <ChevronDown size={11} className={cn('transition-transform', shadowOpen && 'rotate-180')} />
            </button>
          </div>
        </div>

        {shadowOpen && shadowEnabled && (
          <div className="ml-0.5 flex flex-col gap-2 border-l-2 border-border/60 pl-3 animate-fade-in">
            <div className="flex items-center gap-1.5">
              <span className="w-8 text-[10px] text-muted">Blur</span>
              <input
                type="range" min={0} max={60} value={shadowBlur}
                onChange={(e) => onUpdate({ shadowBlur: Number(e.target.value) })}
                className="flex-1 cursor-pointer"
              />
              <span className="w-5 text-right text-[10px] text-muted tabular-nums">{shadowBlur}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-8 text-[10px] text-muted">Color</span>
              <input
                type="color" value={shadowColor}
                onChange={(e) => onUpdate({ shadowColor: e.target.value })}
                className="h-5 w-7 cursor-pointer rounded border border-border bg-transparent p-0.5"
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
