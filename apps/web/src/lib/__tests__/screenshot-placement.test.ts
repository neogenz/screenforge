import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SCREENSHOT_PLACEMENT,
  MAX_SCREENSHOT_ZOOM,
  MIN_SCREENSHOT_ZOOM,
  normalizeScreenshotPlacement,
  placeScreenshot,
  placementSurvivesRatioChange,
  screenshotFrame,
  type Rect,
} from '@/lib/screenshot-placement'

/** Une dalle 6.9" au rapport réel, et une capture plus large qu'elle. */
const opening: Rect = { x: 10, y: 20, width: 400, height: 860 }
const wide = { width: 1200, height: 1200 }
const tall = { width: 600, height: 2400 }

describe('placeScreenshot', () => {
  it('couvre exactement l’ouverture et centre le débordement', () => {
    const rect = placeScreenshot(wide, opening, DEFAULT_SCREENSHOT_PLACEMENT)

    // Échelle imposée par la hauteur : 860 / 1200.
    expect(rect.height).toBeCloseTo(860, 6)
    expect(rect.width).toBeCloseTo(860, 6)
    // Débordement horizontal réparti de part et d'autre.
    expect(rect.x).toBeCloseTo(10 + (400 - 860) / 2, 6)
    expect(rect.y).toBeCloseTo(20, 6)
    expect(rect.width).toBeGreaterThanOrEqual(opening.width)
    expect(rect.height).toBeGreaterThanOrEqual(opening.height)
  })

  it('reproduit `xMidYMid slice` — le rendu de toutes les versions précédentes', () => {
    for (const natural of [wide, tall, { width: 400, height: 860 }]) {
      const rect = placeScreenshot(natural, opening, DEFAULT_SCREENSHOT_PLACEMENT)
      const scale = Math.max(opening.width / natural.width, opening.height / natural.height)

      expect(rect.width).toBeCloseTo(natural.width * scale, 6)
      expect(rect.height).toBeCloseTo(natural.height * scale, 6)
      expect(rect.x + rect.width / 2).toBeCloseTo(opening.x + opening.width / 2, 6)
      expect(rect.y + rect.height / 2).toBeCloseTo(opening.y + opening.height / 2, 6)
    }
  })

  it('tient dans l’ouverture en `contain`', () => {
    const rect = placeScreenshot(tall, opening, {
      ...DEFAULT_SCREENSHOT_PLACEMENT,
      mode: 'contain',
    })

    expect(rect.width).toBeLessThanOrEqual(opening.width + 1e-9)
    expect(rect.height).toBeLessThanOrEqual(opening.height + 1e-9)
    expect(rect.height).toBeCloseTo(860, 6)
    expect(rect.width).toBeCloseTo(215, 6)
  })

  it('épouse l’ouverture en `fill`, quel que soit le rapport', () => {
    expect(
      placeScreenshot(tall, opening, { ...DEFAULT_SCREENSHOT_PLACEMENT, mode: 'fill' }),
    ).toEqual(opening)
  })

  it('colle la capture au bord visé par le point focal', () => {
    const left = placeScreenshot(wide, opening, { ...DEFAULT_SCREENSHOT_PLACEMENT, focusX: 0 })
    const right = placeScreenshot(wide, opening, { ...DEFAULT_SCREENSHOT_PLACEMENT, focusX: 1 })

    expect(left.x).toBeCloseTo(opening.x, 6)
    expect(right.x + right.width).toBeCloseTo(opening.x + opening.width, 6)
  })

  it('agrandit autour du point focal sans le déplacer', () => {
    const placement = { ...DEFAULT_SCREENSHOT_PLACEMENT, focusX: 0, focusY: 0, zoom: 2 }
    const rect = placeScreenshot(wide, opening, placement)

    expect(rect.width).toBeCloseTo(860 * 2, 6)
    expect(rect.x).toBeCloseTo(opening.x, 6)
    expect(rect.y).toBeCloseTo(opening.y, 6)
  })

  it('ne divise jamais par une dimension nulle', () => {
    const rect = placeScreenshot({ width: 0, height: 0 }, opening, DEFAULT_SCREENSHOT_PLACEMENT)
    expect(Number.isFinite(rect.width) && Number.isFinite(rect.height)).toBe(true)
  })
})

describe('normalizeScreenshotPlacement', () => {
  it('rend le défaut pour une valeur absente', () => {
    expect(normalizeScreenshotPlacement(undefined)).toEqual(DEFAULT_SCREENSHOT_PLACEMENT)
  })

  it('ramène le point focal et le zoom dans leurs bornes', () => {
    expect(
      normalizeScreenshotPlacement({ mode: 'cover', focusX: -3, focusY: 9, zoom: 1000 }),
    ).toEqual({ mode: 'cover', focusX: 0, focusY: 1, zoom: MAX_SCREENSHOT_ZOOM })
    expect(normalizeScreenshotPlacement({ zoom: 0 }).zoom).toBe(1)
    expect(normalizeScreenshotPlacement({ zoom: 0.01 }).zoom).toBe(MIN_SCREENSHOT_ZOOM)
  })

  it('retombe sur `cover` pour un mode inconnu', () => {
    expect(normalizeScreenshotPlacement({ mode: 'contour' as never }).mode).toBe('cover')
  })

  it('survit à des nombres invalides', () => {
    const placement = normalizeScreenshotPlacement({
      focusX: NaN,
      focusY: Infinity,
      zoom: NaN,
    } as never)
    expect(
      Object.values(placement).every((value) => value === 'cover' || Number.isFinite(value)),
    ).toBe(true)
  })
})

describe('screenshotFrame', () => {
  it('laisse le navigateur cadrer tant que la capture n’a pas été mesurée', () => {
    expect(screenshotFrame(opening, undefined, undefined)).toEqual({
      ...opening,
      preserveAspectRatio: 'xMidYMid slice',
    })
    expect(
      screenshotFrame(opening, { ...DEFAULT_SCREENSHOT_PLACEMENT, mode: 'contain' }, undefined)
        .preserveAspectRatio,
    ).toBe('xMidYMid meet')
    expect(
      screenshotFrame(opening, { ...DEFAULT_SCREENSHOT_PLACEMENT, mode: 'fill' }, undefined)
        .preserveAspectRatio,
    ).toBe('none')
  })

  it('ignore un point focal qu’aucune mesure ne permet d’appliquer', () => {
    const frame = screenshotFrame(
      opening,
      { ...DEFAULT_SCREENSHOT_PLACEMENT, focusX: 0 },
      undefined,
    )
    expect(frame).toEqual({ ...opening, preserveAspectRatio: 'xMidYMid slice' })
  })

  it('calcule le rectangle dès que la mesure existe', () => {
    const frame = screenshotFrame(opening, DEFAULT_SCREENSHOT_PLACEMENT, wide)
    expect(frame.preserveAspectRatio).toBe('none')
    expect(frame.width).toBeCloseTo(860, 6)
  })
})

describe('placementSurvivesRatioChange', () => {
  it('accepte une capture de même rapport, même redimensionnée', () => {
    expect(
      placementSurvivesRatioChange({ width: 1320, height: 2868 }, { width: 660, height: 1434 }),
    ).toBe(true)
  })

  it('signale un rapport différent', () => {
    expect(
      placementSurvivesRatioChange({ width: 1320, height: 2868 }, { width: 1200, height: 1200 }),
    ).toBe(false)
  })

  it('n’a rien à signaler quand aucune capture n’était mesurée', () => {
    expect(placementSurvivesRatioChange(undefined, wide)).toBe(true)
  })
})
