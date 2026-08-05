import { beforeEach, describe, expect, it } from 'vitest'
import { useUIStore } from '@/stores/ui.store'

/**
 * L'ouverture exclusive des tiroirs.
 *
 * Mesuré avant la règle : à 375px les deux tiroirs se recouvraient de 249px et
 * le panneau Calques disparaissait entièrement sous Propriétés, sans que rien
 * ne l'annonce. C'est la fenêtre qui décide du mode, jamais le store.
 */
describe('ui store — tiroirs', () => {
  beforeEach(() => {
    useUIStore.setState({ layersOpen: true, propsOpen: true, exclusiveDrawers: false })
  })

  it('laisse les deux tiroirs ouverts tant que la fenêtre les porte', () => {
    useUIStore.getState().toggleLayers()
    useUIStore.getState().toggleLayers()
    expect(useUIStore.getState()).toMatchObject({ layersOpen: true, propsOpen: true })
  })

  it('ferme Calques en passant en mode exclusif, et garde la surface d’édition', () => {
    useUIStore.getState().setExclusiveDrawers(true)
    expect(useUIStore.getState()).toMatchObject({ layersOpen: false, propsOpen: true })
  })

  it('ne rouvre rien quand les deux tiroirs sont déjà fermés', () => {
    useUIStore.setState({ layersOpen: false, propsOpen: false })
    useUIStore.getState().setExclusiveDrawers(true)
    expect(useUIStore.getState()).toMatchObject({ layersOpen: false, propsOpen: false })
  })

  it('chasse l’autre tiroir à l’ouverture en mode exclusif', () => {
    useUIStore.setState({ layersOpen: false, propsOpen: true, exclusiveDrawers: true })
    useUIStore.getState().toggleLayers()
    expect(useUIStore.getState()).toMatchObject({ layersOpen: true, propsOpen: false })

    useUIStore.getState().toggleProps()
    expect(useUIStore.getState()).toMatchObject({ layersOpen: false, propsOpen: true })
  })

  it('fermer ne rouvre jamais le voisin', () => {
    useUIStore.setState({ layersOpen: true, propsOpen: false, exclusiveDrawers: true })
    useUIStore.getState().toggleLayers()
    expect(useUIStore.getState()).toMatchObject({ layersOpen: false, propsOpen: false })
  })
})
