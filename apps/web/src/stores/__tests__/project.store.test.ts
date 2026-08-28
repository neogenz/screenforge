import { beforeEach, describe, expect, it } from 'vitest'
import { runEditorTransaction } from '@/lib/editor-transaction'
import {
  isProject,
  MAX_LISTING_NAME_LENGTH,
  MAX_LISTING_PITCH_LENGTH,
} from '@/lib/project-validation'
import { useHistoryStore } from '@/stores/history.store'
import { useProjectStore } from '@/stores/project.store'

function listing() {
  return useProjectStore.getState().project?.listing
}

describe('project store listing', () => {
  beforeEach(() => {
    useHistoryStore.getState().clear()
    useProjectStore.getState().createProject('Projet')
  })

  it('pose les défauts et tronque un correctif hors borne, sans invalider le projet', () => {
    useProjectStore.getState().updateListing({
      appName: 'a'.repeat(MAX_LISTING_NAME_LENGTH + 20),
      pitch: 'p'.repeat(500),
    })
    expect(listing()).toEqual({
      appName: 'a'.repeat(MAX_LISTING_NAME_LENGTH),
      pitch: 'p'.repeat(MAX_LISTING_PITCH_LENGTH),
      direction: 'sobre',
      language: expect.stringMatching(/^[a-z]{2}(-[A-Za-z]{2,4})?$/),
    })
    expect(isProject(useProjectStore.getState().project)).toBe(true)

    // La transaction suivante constate un projet valide et s'engage.
    const outcome = runEditorTransaction((draft) => {
      draft.name = 'Renommé'
    })
    expect(outcome.committed).toBe(true)
    expect(useProjectStore.getState().project?.name).toBe('Renommé')
  })

  it('fusionne sur le brief courant et omet un champ facultatif vidé', () => {
    const { updateListing } = useProjectStore.getState()
    updateListing({ appName: 'Pulpe', productContext: 'Budget mensuel', landingUrl: '' })
    updateListing({ language: 'en-US' })
    expect(listing()).toEqual({
      appName: 'Pulpe',
      pitch: '',
      direction: 'sobre',
      language: 'en-US',
      productContext: 'Budget mensuel',
    })

    updateListing({ productContext: undefined })
    expect(listing()).not.toHaveProperty('productContext')
    expect(listing()?.appName).toBe('Pulpe')
  })
})
