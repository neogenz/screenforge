import { beforeEach, describe, expect, it, vi } from 'vitest'
import { templateFromScreen, type CustomTemplate } from '@/lib/custom-templates'
import { listRelayTemplates, saveRelayTemplate } from '@/lib/mcp/session'
import { useProjectStore } from '@/stores/project.store'
import { useTemplatesStore } from '@/stores/templates.store'

const storage = vi.hoisted(() => ({
  read: vi.fn<() => Promise<CustomTemplate[]>>(),
  write: vi.fn<() => Promise<void>>(),
  remove: vi.fn<() => Promise<void>>(),
}))

vi.mock('@/lib/custom-templates', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/custom-templates')>()),
  readCustomTemplates: storage.read,
  writeCustomTemplate: storage.write,
  deleteCustomTemplate: storage.remove,
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function existingTemplate(name = 'Existant'): CustomTemplate {
  const project = useProjectStore.getState().project
  if (!project) throw new Error('Projet de test absent.')
  return templateFromScreen(project.screens[0], { name, source: 'user' })
}

beforeEach(() => {
  storage.read.mockReset()
  storage.write.mockReset().mockResolvedValue(undefined)
  storage.remove.mockReset().mockResolvedValue(undefined)
  useTemplatesStore.setState({ templates: [], hydrated: false })
  useProjectStore.getState().createProject('Test')
})

describe('hydratation de la bibliothèque de gabarits', () => {
  it('partage la lecture et rend une sauvegarde visible à la liste immédiate', async () => {
    const reading = deferred<CustomTemplate[]>()
    storage.read.mockReturnValue(reading.promise)

    const hydration = useTemplatesStore.getState().hydrate()
    const saving = saveRelayTemplate({ name: 'Nouveau' })
    const listing = listRelayTemplates()

    expect(storage.read).toHaveBeenCalledTimes(1)
    reading.resolve([])

    const [saved, listed] = await Promise.all([saving, listing, hydration])
    expect(saved.committed).toBe(true)
    expect(listed.result).toMatchObject({ templates: [{ name: 'Nouveau' }] })
    expect(useTemplatesStore.getState().templates.map((template) => template.name)).toEqual([
      'Nouveau',
    ])
    expect(storage.write).toHaveBeenCalledTimes(1)
  })

  it('attend la lecture avant une suppression', async () => {
    const reading = deferred<CustomTemplate[]>()
    const template = existingTemplate()
    storage.read.mockReturnValue(reading.promise)

    const hydration = useTemplatesStore.getState().hydrate()
    const removing = useTemplatesStore.getState().remove(template.id)
    expect(storage.read).toHaveBeenCalledTimes(1)

    reading.resolve([template])
    await Promise.all([hydration, removing])

    expect(storage.remove).toHaveBeenCalledWith(template.id)
    expect(useTemplatesStore.getState().templates).toEqual([])
  })

  it('refuse une collision découverte pendant la lecture', async () => {
    const reading = deferred<CustomTemplate[]>()
    const template = existingTemplate()
    storage.read.mockReturnValue(reading.promise)

    const saving = saveRelayTemplate({ name: template.name })
    reading.resolve([template])

    await expect(saving).resolves.toMatchObject({
      committed: false,
      error: expect.stringMatching(/s’appelle déjà/),
    })
    expect(storage.write).not.toHaveBeenCalled()
    expect(useTemplatesStore.getState().templates).toEqual([template])
  })

  it('retire une sauvegarde terminée après la coupure du cycle MCP', async () => {
    const writing = deferred<void>()
    storage.write.mockReturnValue(writing.promise)
    useTemplatesStore.setState({ templates: [], hydrated: true })
    let current = true

    const saving = saveRelayTemplate({ name: 'Trop tard' }, () => current)
    await vi.waitFor(() => expect(storage.write).toHaveBeenCalledTimes(1))
    current = false
    writing.resolve()

    await expect(saving).resolves.toEqual({
      committed: false,
      error: 'L’enregistrement a été annulé.',
    })
    expect(storage.remove).toHaveBeenCalledOnce()
    expect(useTemplatesStore.getState().templates).toEqual([])
  })
})
