import { describe, expect, it } from 'vitest'
import { defaultScreenName, screenHasCustomName } from '@/lib/screens'
import type { Screen } from '@/types'

const screen = (name: string): Screen => ({
  id: 'x',
  name,
  layers: [],
  background: { type: 'solid', color: '#fff' },
})

describe('screenHasCustomName', () => {
  it('ne compte pas le nom d’usine comme un nom', () => {
    expect(screenHasCustomName(screen(defaultScreenName(2)), 2)).toBe(false)
  })

  it('reconnaît un écran renommé', () => {
    expect(screenHasCustomName(screen('Accroche'), 2)).toBe(true)
  })

  it('redevient anonyme si on le renomme vers son nom d’usine', () => {
    expect(screenHasCustomName(screen('Écran 3'), 2)).toBe(false)
  })

  it('compte le nom d’usine d’un autre rang comme un nom choisi', () => {
    // Un écran déplacé garde son nom : « Écran 1 » en troisième position n'est
    // plus son rang, c'est une étiquette, et elle mérite d'être lue.
    expect(screenHasCustomName(screen(defaultScreenName(0)), 2)).toBe(true)
  })
})
