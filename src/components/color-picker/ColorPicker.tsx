import { useId, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  showOpacity?: boolean
}

// Module-level recent colors (persists across re-renders, resets on page reload)
const recentColors: string[] = []

function addRecentColor(color: string) {
  const idx = recentColors.indexOf(color)
  if (idx !== -1) recentColors.splice(idx, 1)
  recentColors.unshift(color)
  if (recentColors.length > 8) recentColors.pop()
}

function hexToRgba(hex: string): { r: number; g: number; b: number; a: number } {
  const clean = hex.replace('#', '')
  const full = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean
  const r = parseInt(full.slice(0, 2), 16) || 0
  const g = parseInt(full.slice(2, 4), 16) || 0
  const b = parseInt(full.slice(4, 6), 16) || 0
  const a = full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1
  return { r, g, b, a }
}


function extractOpacity(color: string): number {
  if (color.startsWith('rgba')) {
    const m = color.match(/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/)
    return m ? parseFloat(m[1]) : 1
  }
  if (color.startsWith('#') && color.length === 9) {
    return parseInt(color.slice(7, 9), 16) / 255
  }
  return 1
}

function colorToHex6(color: string): string {
  if (color.startsWith('#')) {
    const c = color.replace('#', '')
    if (c.length === 3) return '#' + c.split('').map(x => x + x).join('')
    return '#' + c.slice(0, 6)
  }
  const rgb = color.match(/rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/i)
  if (rgb) {
    const channels = rgb.slice(1, 4).map((channel) =>
      Math.min(255, Math.max(0, Math.round(Number(channel)))).toString(16).padStart(2, '0'),
    )
    return `#${channels.join('')}`
  }
  return '#000000'
}

function isValidHex(hex: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(hex)
}

export function ColorPicker({ value, onChange, showOpacity = false }: ColorPickerProps) {
  const hex6 = colorToHex6(value)
  const opacity = extractOpacity(value)

  const [hexInput, setHexInput] = useState(hex6)
  const [opacityInput, setOpacityInput] = useState(Math.round(opacity * 100))
  const [colorError, setColorError] = useState<string | null>(null)
  const nativeRef = useRef<HTMLInputElement>(null)
  const errorId = useId()

  // Sync hex6 from parent value if it changes externally
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    setHexInput(colorToHex6(value))
    setOpacityInput(Math.round(extractOpacity(value) * 100))
    setColorError(null)
  }

  function emitColor(hex: string, alpha: number) {
    let result: string
    if (showOpacity && alpha < 1) {
      const { r, g, b } = hexToRgba(hex)
      result = `rgba(${r}, ${g}, ${b}, ${Math.round(alpha * 100) / 100})`
    } else {
      result = hex
    }
    addRecentColor(result)
    onChange(result)
  }

  function handleNativeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const h = e.target.value
    setHexInput(h)
    setColorError(null)
    emitColor(h, opacityInput / 100)
  }

  function handleHexInput(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    setHexInput(raw)
    const normalized = raw.startsWith('#') ? raw : '#' + raw
    if (isValidHex(normalized)) {
      setColorError(null)
      emitColor(normalized, opacityInput / 100)
    }
  }

  function handleHexBlur() {
    const normalized = hexInput.startsWith('#') ? hexInput : '#' + hexInput
    if (isValidHex(normalized)) {
      setHexInput(normalized)
      setColorError(null)
      emitColor(normalized, opacityInput / 100)
    } else {
      setColorError('Couleur hexadécimale à six chiffres attendue, ex. #141413.')
    }
  }

  function handleOpacityChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = parseInt(e.target.value, 10)
    setOpacityInput(v)
    emitColor(hex6, v / 100)
  }

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col gap-2">
      {/* Swatch + hex input */}
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          className={cn(
            'h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-sm border border-border',
            'transition-colors duration-100 ease-out hover:border-foreground',
          )}
          style={{ backgroundColor: hex6 }}
          onClick={() => nativeRef.current?.click()}
          aria-label="Ouvrir le sélecteur de couleur"
        />
        <input
          ref={nativeRef}
          type="color"
          value={hex6}
          onChange={handleNativeChange}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
        <input
          type="text"
          value={hexInput}
          onChange={handleHexInput}
          onBlur={handleHexBlur}
          maxLength={7}
          placeholder="#000000"
          className="input"
          aria-label="Valeur hexadécimale"
          aria-invalid={Boolean(colorError)}
          aria-describedby={colorError ? errorId : undefined}
        />
      </div>
      {colorError && (
        <p id={errorId} role="alert" className="text-[11px] leading-relaxed text-danger">
          {colorError}
        </p>
      )}

      {/* Opacity slider */}
      {showOpacity && (
        <div className="flex w-full min-w-0 items-center gap-2">
          <span className="mono-label w-10 shrink-0">Alpha</span>
          <input
            type="range"
            min={0}
            max={100}
            value={opacityInput}
            onChange={handleOpacityChange}
            className="min-w-0 flex-1 cursor-pointer"
            aria-label="Opacité"
          />
          <span className="mono-value w-8 shrink-0 text-right text-[10px] text-foreground-muted">
            {opacityInput}
          </span>
        </div>
      )}

      {/* Recent colors */}
      {recentColors.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="mono-label">Récents</span>
          <div className="flex flex-wrap gap-1">
            {recentColors.map((color) => (
              <button
                key={color}
                type="button"
                className="h-4 w-4 rounded-sm border border-border cursor-pointer hover:border-foreground transition-colors"
                style={{ backgroundColor: color }}
                onClick={() => {
                  addRecentColor(color)
                  onChange(color)
                }}
                aria-label={`Couleur récente ${color}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
