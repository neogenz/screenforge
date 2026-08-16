import 'fake-indexeddb/auto'
import { openDB } from 'idb'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  forgetOnDisk,
  forgetStoredSecret,
  recallFromDisk,
  rememberOnDisk,
} from '@/lib/ai/key-store'

/**
 * Ce que ce fichier vérifie n'est pas « ça chiffre » — `crypto.subtle` s'en
 * charge — mais les trois règles que le module ajoute par-dessus : rien de
 * lisible sur le disque, rien de retenu pour un jeton de pont, et un chemin de
 * sortie qui efface vraiment.
 */

const ANTHROPIC_KEY = 'sk-ant-[REDACTED]-round-trip'

interface RawVault {
  wrap?: CryptoKey
  secrets?: Record<string, { iv: Uint8Array; data: ArrayBuffer }>
}

/** L'enregistrement tel qu'un lecteur du profil du navigateur le verrait. */
async function rawVault(): Promise<RawVault> {
  const db = await openDB('screenforge-keys', 1)
  const record = (await db.get('vault', 'assistant')) as RawVault
  db.close()
  return record
}

beforeEach(async () => {
  await forgetOnDisk()
})

describe('key-store', () => {
  it('rend la clé et le modèle retenus', async () => {
    await rememberOnDisk({ providerId: 'anthropic', model: 'claude-x', secret: ANTHROPIC_KEY })

    expect(await recallFromDisk()).toEqual({
      providerId: 'anthropic',
      model: 'claude-x',
      secret: ANTHROPIC_KEY,
    })
  })

  it('n’écrit la clé nulle part en clair, et sa clé de scellement ne sort pas', async () => {
    await rememberOnDisk({ providerId: 'anthropic', model: 'claude-x', secret: ANTHROPIC_KEY })
    const vault = await rawVault()

    const sealed = vault.secrets?.anthropic
    expect(sealed).toBeDefined()
    const bytes = new Uint8Array(sealed?.data ?? new ArrayBuffer(0))
    expect(String.fromCharCode(...bytes)).not.toContain('sk-ant')

    /* La clé de scellement est bien là, et refuse de se laisser lire : c'est
       tout ce qui sépare ce fichier d'un secret posé en clair. */
    expect(vault.wrap?.extractable).toBe(false)
    await expect(crypto.subtle.exportKey('raw', vault.wrap as CryptoKey)).rejects.toThrow()
  })

  it('ne retient pas le jeton du pont, qui meurt avec son processus', async () => {
    await rememberOnDisk({ providerId: 'claude-bridge', model: 'sonnet', secret: 'jeton-vivant' })

    const stored = await recallFromDisk()
    expect(stored?.providerId).toBe('claude-bridge')
    expect(stored?.secret).toBe('')
  })

  it('oublier une clé ne touche pas celle de l’autre fournisseur', async () => {
    await rememberOnDisk({ providerId: 'anthropic', model: 'a', secret: 'cle-anthropic' })
    await rememberOnDisk({ providerId: 'openrouter', model: 'o', secret: 'cle-openrouter' })

    await forgetStoredSecret('openrouter')

    const secrets = (await rawVault()).secrets ?? {}
    expect(Object.keys(secrets)).toEqual(['anthropic'])
  })

  it('efface la clé sans perdre le fournisseur choisi', async () => {
    await rememberOnDisk({ providerId: 'anthropic', model: 'claude-x', secret: ANTHROPIC_KEY })

    await forgetStoredSecret('anthropic')

    expect(await recallFromDisk()).toEqual({
      providerId: 'anthropic',
      model: 'claude-x',
      secret: '',
    })
  })

  it('oublie tout quand on le lui demande', async () => {
    await rememberOnDisk({ providerId: 'anthropic', model: 'claude-x', secret: ANTHROPIC_KEY })

    await forgetOnDisk()

    expect(await recallFromDisk()).toBeNull()
  })

  it('vider le champ retire la clé du disque', async () => {
    await rememberOnDisk({ providerId: 'anthropic', model: 'claude-x', secret: ANTHROPIC_KEY })

    await rememberOnDisk({ providerId: 'anthropic', model: 'claude-x', secret: '  ' })

    expect((await recallFromDisk())?.secret).toBe('')
  })
})
