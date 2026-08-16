import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AssetVault } from './relay/assets.ts'
import { planRefreshRequest } from './tools/refresh-screenshots.ts'

/**
 * Le coffre est ce qui empêche l'onglet de lire ce disque.
 *
 * Un identifiant que personne n'a offert n'existe pas pour la page. Ce test
 * vérifie donc moins l'appariement — il vit dans l'onglet, avec la boîte
 * « Rafraîchir » — que la largeur de la porte : ce qui entre, ce qui est refusé,
 * et à quel moment le plafond mord.
 */

/** Le plus petit PNG que `AssetVault` sait mesurer : un IHDR complet suffit. */
function png(width: number, height: number): Buffer {
  const head = Buffer.alloc(24)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(head, 0)
  head.writeUInt32BE(13, 8)
  head.write('IHDR', 12, 'ascii')
  head.writeUInt32BE(width, 16)
  head.writeUInt32BE(height, 20)
  return head
}

async function directory(files: Record<string, Buffer | string>): Promise<string> {
  const base = await mkdtemp(join(tmpdir(), 'screenforge-refresh-'))
  for (const [name, body] of Object.entries(files)) {
    await writeFile(join(base, name), body)
  }
  return base
}

const vault = () => new AssetVault()

describe('la livraison de captures', () => {
  it('offre chaque image du répertoire, dans un ordre stable', async () => {
    const base = await directory({
      'reglages.png': png(1320, 2868),
      'budget.png': png(1290, 2796),
      'accueil.png': png(1320, 2868),
    })

    const request = await planRefreshRequest(vault(), { directory: base })
    expect(request.files.map((file) => file.name)).toEqual([
      'accueil.png',
      'budget.png',
      'reglages.png',
    ])
    // Les dimensions viennent de l'en-tête, comme pour `add_image`.
    expect(request.files[1]).toMatchObject({ width: 1290, height: 2796 })
    expect(new Set(request.files.map((file) => file.assetId)).size).toBe(3)
  })

  it('ne fait entrer dans le coffre que ce qu’une capture peut être', async () => {
    const base = await directory({
      'accueil.png': png(1320, 2868),
      'notes.txt': 'pas une capture',
      'logo.svg': '<svg viewBox="0 0 10 10"></svg>',
    })

    const request = await planRefreshRequest(vault(), { directory: base })
    // Le SVG est un logo, jamais une capture : `add_image` le pose, pas celui-ci.
    expect(request.files.map((file) => file.name)).toEqual(['accueil.png'])
  })

  it('nomme la cause de chaque refus', async () => {
    await expect(planRefreshRequest(vault(), { directory: 'captures' })).rejects.toThrow(/relatif/)

    const base = await directory({ 'accueil.png': png(10, 10) })
    await expect(
      planRefreshRequest(vault(), { directory: join(base, 'accueil.png') }),
    ).rejects.toThrow(/fichier, pas un répertoire/)
    await expect(
      planRefreshRequest(vault(), { directory: join(base, 'nulle-part') }),
    ).rejects.toThrow(/introuvable/)

    const empty = await directory({ 'notes.txt': 'rien' })
    await expect(planRefreshRequest(vault(), { directory: empty })).rejects.toThrow(
      /Aucune capture/,
    )
  })

  it('borne avant d’ouvrir le moindre fichier', async () => {
    const files: Record<string, Buffer> = {}
    for (let index = 0; index < 41; index += 1) {
      // Un octet, donc illisible : si la borne mordait après la lecture, le
      // refus parlerait de dimensions plutôt que de plafond.
      files[`capture-${index}.png`] = Buffer.from([0x89])
    }
    const base = await directory(files)

    await expect(planRefreshRequest(vault(), { directory: base })).rejects.toThrow(/40 au plus/)
  })

  it('transporte le manifeste sans l’interpréter', async () => {
    const base = await directory({ '20260816-0930.png': png(1320, 2868) })
    const manifest = { budget: '20260816-0930.png' }

    const request = await planRefreshRequest(vault(), { directory: base, manifest })
    // L'appariement vit dans l'onglet, avec la règle de la boîte « Rafraîchir ».
    expect(request.manifest).toEqual(manifest)
  })
})
