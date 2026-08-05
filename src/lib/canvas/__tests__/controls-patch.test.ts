import { describe, expect, it, vi } from 'vitest'
import {
  installControlsPatch,
  type ControlHost,
  type ControlRenderer,
} from '@/lib/canvas/controls-patch'

describe('installControlsPatch', () => {
  it('installs the two-pass renderer only once', () => {
    const original = vi.fn<ControlRenderer>()
    const target = { _renderControls: original } as unknown as Partial<ControlHost>

    expect(installControlsPatch(target)).toBe(true)
    const patched = target._renderControls
    expect(
      (patched as ControlRenderer & Record<symbol, unknown>)[
        Symbol.for('screenforge.controls-patch')
      ],
    ).toBe(original)
    expect(installControlsPatch(target)).toBe(true)
    expect(target._renderControls).toBe(patched)

    patched?.call({ borderScaleFactor: 1 } as ControlHost, {} as CanvasRenderingContext2D)

    expect(original).toHaveBeenCalledTimes(2)
    expect(original.mock.calls[0][1]).toMatchObject({
      hasControls: false,
      borderColor: 'rgba(0,0,0,0.6)',
    })
    expect(original.mock.calls[1][1]).toMatchObject({ borderColor: '#ffffff' })
  })

  it('warns and leaves a missing private API untouched', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const target = {} as Partial<ControlHost>

    expect(installControlsPatch(target)).toBe(false)
    expect(target._renderControls).toBeUndefined()
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('_renderControls indisponible'))
    warning.mockRestore()
  })
})
