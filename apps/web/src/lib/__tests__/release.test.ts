import { beforeEach, describe, expect, it } from 'vitest'
import {
  addRelease,
  countChanges,
  diffSnapshots,
  freezeRelease,
  removeRelease,
  snapshotOf,
} from '@/lib/release'
import { isProject, MAX_PROJECT_RELEASES } from '@/lib/project-validation'
import { collectAssetIds } from '@/lib/asset-refs'
import { useHistoryStore } from '@/stores/history.store'
import { DEFAULT_GLOBALS, useProjectStore } from '@/stores/project.store'
import type { ImageLayer, Layer, Project, ReleaseFile, Screen, TextLayer } from '@/types'

function textLayer(id: string, text: string, x = 0): TextLayer {
  return {
    id,
    type: 'text',
    name: text,
    x,
    y: 0,
    width: 100,
    height: 20,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    zIndex: 0,
    content: text,
    fontFamily: 'Inter',
    fontSize: 24,
    fontWeight: 600,
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 1.2,
    letterSpacing: 0,
    textTransform: 'none',
  }
}

function imageLayer(id: string, assetId: string): ImageLayer {
  return {
    id,
    type: 'image',
    name: id,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    zIndex: 1,
    assetId,
    originalWidth: 10,
    originalHeight: 10,
  }
}

function screen(id: string, layers: Layer[] = [], name = `Écran ${id}`): Screen {
  return { id, name, layers, background: { type: 'solid', color: '#000000' } }
}

function project(screens: Screen[] = [screen('a')], layoutLayers: Layer[] = []): Project {
  return {
    id: 'p1',
    name: 'Projet',
    screens,
    activeScreenId: screens[0].id,
    globals: structuredClone(DEFAULT_GLOBALS),
    layoutLayers,
    createdAt: 1,
    updatedAt: 1,
  }
}

const file = (path: string, sha: string): ReleaseFile => ({
  path,
  screenId: 'a',
  width: 1320,
  height: 2868,
  byteLength: 1024,
  sha256: sha.repeat(64).slice(0, 64),
})

beforeEach(() => {
  useProjectStore.setState({ project: null })
  useHistoryStore.setState({ past: [], future: [] })
})

describe('l’instantané', () => {
  it('ne garde que ce qui se rend', () => {
    const snapshot = snapshotOf(project())
    expect(Object.keys(snapshot).sort()).toEqual(['globals', 'layoutLayers', 'name', 'screens'])
  })

  it('laisse l’aperçu dehors : il change à chaque coup de pinceau', () => {
    const withThumbnail = project([{ ...screen('a'), thumbnail: 'data:image/png;base64,AAAA' }])
    expect(snapshotOf(withThumbnail).screens[0]).not.toHaveProperty('thumbnail')
  })

  it('est détaché du projet vivant', () => {
    const source = project([screen('a', [textLayer('l1', 'Avant')])])
    const snapshot = snapshotOf(source)
    ;(source.screens[0].layers[0] as TextLayer).content = 'Après'
    expect((snapshot.screens[0].layers[0] as TextLayer).content).toBe('Avant')
  })
})

describe('le figement', () => {
  it('clone une seconde fois : rien ne traverse après coup', () => {
    const snapshot = snapshotOf(project([screen('a', [textLayer('l1', 'Avant')])]))
    const release = freezeRelease('r1', ' 1.4.0 ', snapshot, [file('6.9/01.png', 'a')], 10)
    ;(snapshot.screens[0].layers[0] as TextLayer).content = 'Après'
    expect((release.snapshot.screens[0].layers[0] as TextLayer).content).toBe('Avant')
    expect(release.name).toBe('1.4.0')
  })

  it('entre dans le projet en un pas d’annulation, et en ressort de même', () => {
    const before = project()
    useProjectStore.setState({ project: before })
    const release = freezeRelease('r1', '1.4.0', snapshotOf(before), [], 10)

    expect(addRelease(release)).toMatchObject({ committed: true, value: 1 })
    const after = useProjectStore.getState().project as Project
    expect(after.releases).toHaveLength(1)
    expect(isProject(after)).toBe(true)
    expect(useHistoryStore.getState().past).toHaveLength(1)

    expect(removeRelease('r1')).toMatchObject({ committed: true, value: 0 })
    expect(useProjectStore.getState().project?.releases).toEqual([])
    expect(removeRelease('inconnue')).toMatchObject({ committed: false, reason: 'aborted' })
  })

  it('refuse au-delà du plafond, sans rien écrire', () => {
    const full = project()
    full.releases = Array.from({ length: MAX_PROJECT_RELEASES }, (_, index) =>
      freezeRelease(`r${index}`, `${index}`, snapshotOf(full), [], index),
    )
    useProjectStore.setState({ project: full })
    expect(addRelease(freezeRelease('rx', 'x', snapshotOf(full), [], 99))).toMatchObject({
      committed: false,
      reason: 'aborted',
    })
    expect(useProjectStore.getState().project).toBe(full)
  })

  it('retient les assets que seul son instantané référence encore', () => {
    const withImage = project([screen('a', [imageLayer('l1', 'asset-1')])])
    const release = freezeRelease('r1', '1.0', snapshotOf(withImage), [], 10)
    // La capture a été remplacée depuis : le projet vivant ne la cite plus.
    const later: Project = {
      ...project([screen('a', [imageLayer('l1', 'asset-2')])]),
      releases: [release],
    }
    expect([...collectAssetIds(later)].sort()).toEqual(['asset-1', 'asset-2'])
  })

  it('est rejetée par la validation si son empreinte n’en est pas une', () => {
    const base = project()
    const release = freezeRelease('r1', '1.0', snapshotOf(base), [], 10)
    const broken = {
      ...base,
      releases: [{ ...release, files: [{ ...file('6.9/01.png', 'a'), sha256: 'court' }] }],
    }
    expect(isProject(broken)).toBe(false)
    expect(isProject({ ...base, releases: [release] })).toBe(true)
  })
})

describe('le diff structurel', () => {
  const base = snapshotOf(
    project(
      [screen('a', [textLayer('l1', 'Titre')]), screen('b', [textLayer('l2', 'Autre')])],
      [imageLayer('shared', 'asset-1')],
    ),
  )

  it('ne dit rien quand rien n’a changé', () => {
    const diff = diffSnapshots(base, structuredClone(base))
    expect(diff.identical).toBe(true)
    expect(countChanges(diff)).toBe(0)
  })

  it('ne dépend pas de l’ordre des clés', () => {
    const reordered = structuredClone(base)
    const layer = reordered.screens[0].layers[0]
    reordered.screens[0].layers[0] = Object.fromEntries(
      Object.entries(layer).reverse(),
    ) as unknown as Layer
    expect(diffSnapshots(base, reordered).identical).toBe(true)
  })

  it('nomme les propriétés modifiées, triées', () => {
    const after = structuredClone(base)
    const layer = after.screens[0].layers[0] as TextLayer
    layer.content = 'Nouveau'
    layer.x = 40
    layer.fontSize = 30
    const diff = diffSnapshots(base, after)
    expect(diff.identical).toBe(false)
    expect(diff.screens).toHaveLength(1)
    expect(diff.screens[0].layers[0]).toMatchObject({
      layerId: 'l1',
      kind: 'changed',
      props: ['content', 'fontSize', 'x'],
    })
  })

  it('rend les écrans du projet d’abord, les disparus ensuite', () => {
    const after = structuredClone(base)
    after.screens = [
      { ...after.screens[1], name: 'Renommé' },
      screen('c', [textLayer('l3', 'Neuf')]),
    ]
    const diff = diffSnapshots(base, after)
    expect(diff.screens.map((entry) => [entry.screenId, entry.added, entry.removed])).toEqual([
      ['b', false, false],
      ['c', true, false],
      ['a', false, true],
    ])
    expect(diff.screens[0].renamedFrom).toBe('Écran b')
  })

  it('voit les calques ajoutés, retirés, le fond, les globaux et le nom', () => {
    const after = structuredClone(base)
    after.name = 'Projet v2'
    after.screens[0].layers.push(textLayer('l9', 'Ajout'))
    after.screens[0].background = { type: 'solid', color: '#ffffff' }
    after.layoutLayers = []
    after.globals.fontSize = 99

    const diff = diffSnapshots(base, after)
    expect(diff.projectRenamed).toEqual({ from: 'Projet', to: 'Projet v2' })
    expect(diff.screens[0].backgroundChanged).toBe(true)
    expect(diff.screens[0].layers).toEqual([
      { layerId: 'l9', name: 'Ajout', kind: 'added', props: [] },
    ])
    expect(diff.layoutLayers).toEqual([
      { layerId: 'shared', name: 'shared', kind: 'removed', props: [] },
    ])
    expect(diff.globals).toEqual(['fontSize'])
    expect(countChanges(diff)).toBe(5)
  })

  it('rend deux fois le même résultat pour les mêmes entrées', () => {
    const after = structuredClone(base)
    ;(after.screens[0].layers[0] as TextLayer).content = 'Changé'
    after.screens.push(screen('z', [textLayer('l4', 'Zed')]))
    expect(JSON.stringify(diffSnapshots(base, after))).toBe(
      JSON.stringify(diffSnapshots(base, after)),
    )
  })
})
