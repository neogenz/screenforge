import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cacheEntitlements,
  exportsLeft,
  exportsUsed,
  readCachedEntitlements,
  recordExport,
  rightsOf,
  FREE_EXPORTS_PER_PROJECT,
  type Entitlements,
} from '@/lib/entitlements'
import { useAuthStore } from '@/stores/auth.store'

const GRANTED = '2026-03-12T09:00:00Z'

describe('rightsOf', () => {
  const entitlements = (partial: Partial<Entitlements>): Entitlements => ({
    userId: 'u1',
    licence: false,
    licenceGrantedAt: null,
    cloud: false,
    cloudStatus: null,
    cloudPeriodEnd: null,
    ...partial,
  })

  it('au lancement du billing, sans droits connus tout est fermé', () => {
    expect(rightsOf(null, true)).toEqual({ cleanExport: false, zip: false, sync: false })
  })

  it('avant le billing, garde les exports historiques mais jamais la sync', () => {
    expect(rightsOf(null, false)).toEqual({ cleanExport: true, zip: true, sync: false })
    expect(rightsOf(entitlements({ licence: true, cloud: true }), false)).toEqual({
      cleanExport: true,
      zip: true,
      sync: false,
    })
  })

  it('la Licence ouvre l’export propre et le ZIP, jamais la sync', () => {
    expect(rightsOf(entitlements({ licence: true }), true)).toEqual({
      cleanExport: true,
      zip: true,
      sync: false,
    })
  })

  it('le Cloud ouvre la sync par-dessus la Licence', () => {
    expect(rightsOf(entitlements({ licence: true, cloud: true }), true).sync).toBe(true)
  })
})

describe('cache de droits par compte', () => {
  const entries = new Map<string, string>()
  const entitlement = (userId: string, licence: boolean, cloud = false): Entitlements => ({
    userId,
    licence,
    licenceGrantedAt: licence ? GRANTED : null,
    cloud,
    cloudStatus: cloud ? 'active' : null,
    cloudPeriodEnd: cloud ? '2099-01-01T00:00:00Z' : null,
  })

  beforeEach(() => {
    entries.clear()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => void entries.set(key, value),
    })
    useAuthStore.setState({ status: 'signed-out', user: null, entitlements: null })
  })

  it('restaure la Licence hors ligne pour le même utilisateur seulement', () => {
    cacheEntitlements(entitlement('u1', true))

    expect(readCachedEntitlements('u1')?.licence).toBe(true)
    expect(readCachedEntitlements('u2')).toBeNull()
  })

  it('remplace les droits dès le changement de compte et ignore une ancienne réponse', () => {
    const first = entitlement('u1', true)
    const second = entitlement('u2', false)
    cacheEntitlements(second)
    useAuthStore.setState({
      status: 'signed-in',
      user: { id: 'u1', email: null },
      entitlements: first,
    })

    useAuthStore.getState().setUser({ id: 'u2', email: null })
    expect(useAuthStore.getState().entitlements).toEqual(second)

    useAuthStore.getState().setEntitlements(first)
    expect(useAuthStore.getState().entitlements).toEqual(second)
  })
})

describe('le compteur d’exports du palier gratuit', () => {
  const gratuit = rightsOf(null, true)
  const licencié = rightsOf(
    {
      userId: 'u1',
      licence: true,
      licenceGrantedAt: GRANTED,
      cloud: false,
      cloudStatus: null,
      cloudPeriodEnd: null,
    },
    true,
  )

  /* La suite tourne en environnement Node : pas de `localStorage`. Un faux de
     six lignes coûte moins qu'un jsdom pour toute la suite, et le compteur
     n'utilise du stockage que `getItem`/`setItem`. */
  beforeEach(() => {
    const entries = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => void entries.set(key, value),
    })
  })

  it('part du quota plein et décompte projet par projet', () => {
    expect(exportsLeft('projet-a', gratuit)).toBe(FREE_EXPORTS_PER_PROJECT)

    recordExport('projet-a')
    recordExport('projet-a')
    expect(exportsUsed('projet-a')).toBe(2)
    expect(exportsLeft('projet-a', gratuit)).toBe(1)

    /* Critère 2 : un autre projet repart à trois. Le compteur est indexé par
       identifiant de projet, jamais global — sinon trois essais videraient le
       palier gratuit pour toujours. */
    expect(exportsLeft('projet-b', gratuit)).toBe(FREE_EXPORTS_PER_PROJECT)
  })

  it('ne descend jamais sous zéro', () => {
    for (let i = 0; i < FREE_EXPORTS_PER_PROJECT + 2; i += 1) recordExport('projet-a')
    expect(exportsLeft('projet-a', gratuit)).toBe(0)
  })

  it('la Licence ne compte pas', () => {
    recordExport('projet-a')
    expect(exportsLeft('projet-a', licencié)).toBe(Infinity)
  })

  it('un stockage illisible se lit comme zéro export consommé', () => {
    /* On ne bloque personne pour une panne de navigateur : le filigrane est une
       politesse, pas un verrou. */
    localStorage.setItem('screenforge-exports', 'pas du JSON')
    expect(exportsUsed('projet-a')).toBe(0)
    expect(exportsLeft('projet-a', gratuit)).toBe(FREE_EXPORTS_PER_PROJECT)
  })
})
