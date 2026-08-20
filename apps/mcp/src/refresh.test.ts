import { mkdtemp, symlink, writeFile } from 'node:fs/promises'
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

/** PNG structurel minimal : IHDR, IDAT non vide puis IEND. */
function png(width: number, height: number): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const head = Buffer.alloc(8)
    head.writeUInt32BE(data.length)
    head.write(type, 4, 'ascii')
    return Buffer.concat([head, data, Buffer.alloc(4)])
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width)
  header.writeUInt32BE(height, 4)
  header.set([8, 6, 0, 0, 0], 8)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', Buffer.from([1])),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

async function directory(files: Record<string, Buffer | string>): Promise<string> {
  const base = await mkdtemp(join(tmpdir(), 'screenforge-refresh-'))
  for (const [name, body] of Object.entries(files)) {
    await writeFile(join(base, name), body)
  }
  return base
}

const vault = (root: string) => new AssetVault(() => Promise.resolve([root]))

describe('la livraison de captures', () => {
  it('offre chaque image du répertoire, dans un ordre stable', async () => {
    const base = await directory({
      'reglages.png': png(1320, 2868),
      'budget.png': png(1290, 2796),
      'accueil.png': png(1320, 2868),
    })

    const request = await planRefreshRequest(vault(base), { directory: base })
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

    const request = await planRefreshRequest(vault(base), { directory: base })
    // Le SVG est un logo, jamais une capture : `add_image` le pose, pas celui-ci.
    expect(request.files.map((file) => file.name)).toEqual(['accueil.png'])
  })

  it('nomme la cause de chaque refus', async () => {
    const base = await directory({ 'accueil.png': png(10, 10) })
    await expect(planRefreshRequest(vault(base), { directory: 'captures' })).rejects.toThrow(
      /relatif/,
    )
    await expect(
      planRefreshRequest(vault(base), { directory: join(base, 'accueil.png') }),
    ).rejects.toThrow(/fichier, pas un répertoire/)
    await expect(
      planRefreshRequest(vault(base), { directory: join(base, 'nulle-part') }),
    ).rejects.toThrow(/introuvable/)

    const empty = await directory({ 'notes.txt': 'rien' })
    await expect(planRefreshRequest(vault(empty), { directory: empty })).rejects.toThrow(
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

    await expect(planRefreshRequest(vault(base), { directory: base })).rejects.toThrow(/40 au plus/)
  })

  it('refuse un répertoire hors racine ou un symlink qui en sort', async () => {
    const root = await directory({})
    const outside = await directory({ 'capture.png': png(10, 10) })
    await expect(planRefreshRequest(vault(root), { directory: outside })).rejects.toThrow(
      /hors des répertoires autorisés/,
    )

    const escaped = join(root, 'captures')
    await symlink(outside, escaped)
    await expect(planRefreshRequest(vault(root), { directory: escaped })).rejects.toThrow(
      /hors des répertoires autorisés/,
    )
  })

  it('transporte le manifeste sans l’interpréter', async () => {
    const base = await directory({ '20260816-0930.png': png(1320, 2868) })
    const manifest = { budget: '20260816-0930.png' }

    const request = await planRefreshRequest(vault(base), { directory: base, manifest })
    // L'appariement vit dans l'onglet, avec la règle de la boîte « Rafraîchir ».
    expect(request.manifest).toEqual(manifest)
  })
})
