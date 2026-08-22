import { useId, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group'
import { SliderField } from '@/components/patterns/slider-field'
import { Button } from '@/components/ui/button'
import { formatPercent } from '@/lib/number'

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  showOpacity?: boolean
}

// Module-level recent colors (persists across re-renders, resets on page reload)
const recentColors: string[] = []
const MAX_RECENT_COLORS = 7

function addRecentColor(color: string) {
  const idx = recentColors.indexOf(color)
  if (idx !== -1) recentColors.splice(idx, 1)
  recentColors.unshift(color)
  if (recentColors.length > MAX_RECENT_COLORS) recentColors.pop()
}

function hexToRgba(hex: string): { r: number; g: number; b: number; a: number } {
  const clean = hex.replace('#', '')
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
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
    if (c.length === 3)
      return (
        '#' +
        c
          .split('')
          .map((x) => x + x)
          .join('')
      )
    return '#' + c.slice(0, 6)
  }
  const rgb = color.match(/rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/i)
  if (rgb) {
    const channels = rgb.slice(1, 4).map((channel) =>
      Math.min(255, Math.max(0, Math.round(Number(channel))))
        .toString(16)
        .padStart(2, '0'),
    )
    return `#${channels.join('')}`
  }
  return '#000000'
}

function isValidHex(hex: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(hex)
}

/** Functional alpha cue: neutral checkerboard painted under translucent swatches. */
const CHECKER_COLOR = 'color-mix(in oklch, var(--color-muted-foreground) 55%, transparent)'
const CHECKER_IMAGE = [
  `linear-gradient(45deg, ${CHECKER_COLOR} 25%, transparent 25%, transparent 75%, ${CHECKER_COLOR} 75%)`,
  `linear-gradient(45deg, ${CHECKER_COLOR} 25%, transparent 25%, transparent 75%, ${CHECKER_COLOR} 75%)`,
].join(', ')

export function ColorPicker({ value, onChange, showOpacity = false }: ColorPickerProps) {
  const hex6 = colorToHex6(value)
  const opacity = extractOpacity(value)

  const [hexInput, setHexInput] = useState(hex6)
  const [opacityInput, setOpacityInput] = useState(Math.round(opacity * 100))
  const [colorError, setColorError] = useState<string | null>(null)
  const nativeRef = useRef<HTMLInputElement>(null)
  const errorId = useId()

  // Sync local drafts when the value changes externally
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

  function handleNativeChange(e: ChangeEvent<HTMLInputElement>) {
    const h = e.target.value
    setHexInput(h)
    setColorError(null)
    emitColor(h, opacityInput / 100)
  }

  // ponytail: le « # » est l'addon de l'InputGroup — le champ ne porte que les
  // chiffres, on retire un éventuel # tapé quand même (ex. un `fill('#ff0000')` de test).
  function handleHexInput(e: ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/^#+/, '')
    const normalized = '#' + digits
    setHexInput(normalized)
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

  function handleOpacityChange(v: number) {
    setOpacityInput(v)
    emitColor(hex6, v / 100)
  }

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col gap-2">
      {/* Swatch + hex + opacity */}
      <div className="flex min-w-0 items-center gap-2">
        <Button
          variant="ghost"
          className="relative h-8 w-10 shrink-0 overflow-hidden rounded-md border border-border px-0 transition-[border-color] duration-150 ease-out hover:border-input hover:bg-transparent focus-visible:border-muted-foreground"
          onClick={() => nativeRef.current?.click()}
          aria-label="Ouvrir le sélecteur de couleur"
        >
          {showOpacity && (
            <span
              aria-hidden="true"
              className="absolute inset-0"
              style={{
                backgroundColor: 'var(--color-card)',
                backgroundImage: CHECKER_IMAGE,
                backgroundSize: '8px 8px',
                backgroundPosition: '0 0, 4px 4px',
              }}
            />
          )}
          <span
            aria-hidden="true"
            className="absolute inset-0"
            style={{ backgroundColor: showOpacity ? value : hex6 }}
          />
        </Button>
        <Input
          unstyled
          nativeInput
          ref={nativeRef}
          type="color"
          value={hex6}
          onChange={handleNativeChange}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
        {/* `nativeInput` : hors du câblage du `Field` parent, dont le libellé
            (« Couleur », « Ombre »…) écraserait le nom propre de ce champ. */}
        {/* Six chiffres, largeur connue : le curseur d'opacité prend le reste. */}
        <InputGroup className="w-24 shrink-0">
          <InputGroupAddon className="text-muted-foreground">
            <InputGroupText>#</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput
            nativeInput
            value={hexInput.replace(/^#/, '')}
            onChange={handleHexInput}
            onBlur={handleHexBlur}
            placeholder="000000"
            spellCheck={false}
            autoComplete="off"
            aria-label="Couleur hexadécimale"
            aria-invalid={Boolean(colorError)}
            aria-describedby={colorError ? errorId : undefined}
            className="tabular-nums"
          />
        </InputGroup>
        {showOpacity && (
          <SliderField
            ariaLabel="Opacité de la couleur"
            min={0}
            max={100}
            value={opacityInput}
            onChange={handleOpacityChange}
            formatValue={formatPercent}
            className="min-w-0 flex-1"
          />
        )}
      </div>
      {colorError && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {colorError}
        </p>
      )}

      {/* Recent colors */}
      {recentColors.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Récents</span>
          <div className="flex flex-wrap gap-1">
            {recentColors.map((color) => (
              <Button
                key={color}
                variant="ghost"
                size="icon-xs"
                className="p-[3px] ring-inset ring-1 ring-transparent hover:bg-transparent hover:ring-input"
                onClick={() => {
                  addRecentColor(color)
                  onChange(color)
                }}
                aria-label={`Couleur récente ${color}`}
              >
                <span aria-hidden className="checkerboard block size-full rounded-sm">
                  <span
                    className="block size-full rounded-sm ring-1 ring-inset ring-input"
                    style={{ backgroundColor: color }}
                  />
                </span>
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
