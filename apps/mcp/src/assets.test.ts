import { mkdtemp, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import {
  AssetRefusedError,
  AssetVault,
  MAX_ASSET_BYTES,
  MAX_VAULT_ASSETS,
  MAX_VAULT_BYTES,
} from './relay/assets.ts'
import { planAddImage } from './tools/add-image.ts'

/**
 * Les dimensions sont lues dans l'en-tête, et c'est ce qui se vérifie ici.
 *
 * Un chiffre faux ne casse rien de visible : il produit un appel que le contrat
 * accepte et un cadrage « cover » calculé sur le mauvais rapport, donc une
 * capture étirée que personne ne relie à un décalage d'octet. Les trois lecteurs
 * sont donc mis face à de vrais fichiers, pas à des tableaux d'octets écrits à
 * la main pour leur faire plaisir.
 */

function pngBytes(width: number, height: number, totalBytes?: number): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const chunk = (type: string, data: Buffer) => {
    const head = Buffer.alloc(8)
    head.writeUInt32BE(data.length, 0)
    head.write(type, 4, 'ascii')
    // Le CRC n'est pas relu par le lecteur d'en-tête ; quatre zéros suffisent
    // à faire un fichier de la bonne forme sans embarquer une table de CRC.
    return Buffer.concat([head, data, Buffer.alloc(4)])
  }
  const raw = Buffer.alloc(height * (width * 4 + 1))
  const imageData = totalBytes ? Buffer.alloc(totalBytes - 57) : deflateSync(raw)
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', imageData),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Un JPEG minimal : SOI, un APP0 à ignorer, puis le SOF0 qui porte la taille. */
function jpegBytes(width: number, height: number): Buffer {
  const app0 = Buffer.concat([
    Buffer.from([0xff, 0xe0, 0x00, 0x10]),
    Buffer.from('JFIF\0'),
    Buffer.alloc(9),
  ])
  const sof0 = Buffer.alloc(19)
  sof0.writeUInt16BE(0xffc0, 0)
  sof0.writeUInt16BE(17, 2)
  sof0[4] = 8
  sof0.writeUInt16BE(height, 5)
  sof0.writeUInt16BE(width, 7)
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof0, Buffer.from([0xff, 0xd9])])
}

async function sandbox(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'screenforge-mcp-'))
}

describe('coffre d’assets', () => {
  it('lit les dimensions des trois formats et rend un identifiant, pas un chemin', async () => {
    const dir = await sandbox()
    const vault = new AssetVault()

    await writeFile(join(dir, 'capture.png'), pngBytes(1290, 2796))
    await writeFile(join(dir, 'photo.jpg'), jpegBytes(800, 600))
    await writeFile(
      join(dir, 'logo.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40"><rect width="120" height="40"/></svg>',
    )

    const png = await vault.offer(join(dir, 'capture.png'))
    expect([png.width, png.height]).toEqual([1290, 2796])
    expect(png.mediaType).toBe('image/png')
    // L'identifiant ne porte rien du chemin : c'est lui qui voyage jusqu'à la page.
    expect(png.id).not.toContain(dir)

    const jpeg = await vault.offer(join(dir, 'photo.jpg'))
    expect([jpeg.width, jpeg.height]).toEqual([800, 600])

    const svg = await vault.offer(join(dir, 'logo.svg'))
    expect([svg.width, svg.height]).toEqual([120, 40])
  })

  it('ne sert que ce qui a été offert', async () => {
    const dir = await sandbox()
    const vault = new AssetVault()
    await writeFile(join(dir, 'capture.png'), pngBytes(10, 20))

    const offered = await vault.offer(join(dir, 'capture.png'))
    expect((await vault.read(offered.id))?.mediaType).toBe('image/png')
    expect(await vault.read('jamais-offert')).toBeNull()
  })

  it('sert les octets inspectés même si le chemin est remplacé puis supprimé', async () => {
    const dir = await sandbox()
    const vault = new AssetVault()
    const path = join(dir, 'capture.png')
    const original = pngBytes(10, 20)
    await writeFile(path, original)

    const offered = await vault.offer(path)
    await writeFile(path, pngBytes(30, 40))
    await unlink(path)
    const first = vault.read(offered.id)!
    expect(first.bytes).toEqual(original)
    first.bytes.fill(0)
    expect(vault.read(offered.id)!.bytes).toEqual(original)
  })

  it('borne taille unitaire, nombre, total puis purge tout', async () => {
    const dir = await sandbox()
    const tooLarge = join(dir, 'trop.png')
    await writeFile(tooLarge, Buffer.alloc(MAX_ASSET_BYTES + 1))
    await expect(new AssetVault().offer(tooLarge)).rejects.toThrow(/trop lourd/)

    const small = join(dir, 'petit.png')
    await writeFile(small, pngBytes(1, 1))
    const countVault = new AssetVault()
    for (let index = 0; index < MAX_VAULT_ASSETS; index += 1) await countVault.offer(small)
    await expect(countVault.offer(small)).rejects.toThrow(/fichiers au plus/)

    const large = join(dir, 'large.png')
    await writeFile(large, pngBytes(1, 1, MAX_VAULT_BYTES / 8))
    const byteVault = new AssetVault()
    const offered = []
    for (let index = 0; index < 8; index += 1) offered.push(await byteVault.offer(large))
    await expect(byteVault.offer(large)).rejects.toThrow(/64 Mo au total/)
    byteVault.clear()
    expect(byteVault.read(offered[0]!.id)).toBeNull()
    await expect(byteVault.offer(small)).resolves.toMatchObject({ width: 1, height: 1 })
  })

  it('sérialise les offres concurrentes et invalide celles précédant une purge', async () => {
    const dir = await sandbox()
    const small = join(dir, 'petit.png')
    await writeFile(small, pngBytes(1, 1))
    const vault = new AssetVault()

    const concurrent = await Promise.allSettled(
      Array.from({ length: MAX_VAULT_ASSETS + 1 }, () => vault.offer(small)),
    )
    expect(concurrent.filter((result) => result.status === 'fulfilled')).toHaveLength(
      MAX_VAULT_ASSETS,
    )
    expect(concurrent.filter((result) => result.status === 'rejected')).toHaveLength(1)

    const pending = new AssetVault()
    const offered = pending.offer(small)
    pending.clear()
    await expect(offered).rejects.toThrow(/révoqué/)
  })

  it('nomme la cause de chaque refus', async () => {
    const dir = await sandbox()
    const vault = new AssetVault()

    await expect(vault.offer('captures/accueil.png')).rejects.toThrow(/absolu/)
    await expect(vault.offer(join(dir, 'notes.txt'))).rejects.toThrow(/Format non pris en charge/)
    await expect(vault.offer(join(dir, 'absent.png'))).rejects.toThrow(/introuvable/)

    await writeFile(join(dir, 'vide.png'), Buffer.from([137, 80, 78, 71]))
    await expect(vault.offer(join(dir, 'vide.png'))).rejects.toThrow(/Média invalide/)

    await writeFile(
      join(dir, 'actif.svg'),
      '<svg width="1" height="1"><script>alert(1)</script></svg>',
    )
    await expect(vault.offer(join(dir, 'actif.svg'))).rejects.toThrow(/invalide ou actif/)
  })
})

describe('plan d’ajout d’image', () => {
  it('traduit un chemin en appel du contrat, jamais en chemin envoyé à la page', async () => {
    const dir = await sandbox()
    const vault = new AssetVault()
    await writeFile(join(dir, 'accueil.png'), pngBytes(1290, 2796))
    const path = join(dir, 'accueil.png')

    const device = await planAddImage(vault, { path, role: 'screenshot', slot: 'ecran-1' })
    expect(device.tool).toBe('add_device')
    expect(device.args.screenshotWidth).toBe(1290)
    expect(device.args.screenshotHeight).toBe(2796)
    expect(JSON.stringify(device)).not.toContain(dir)

    // Remplir un cadre déjà posé n'en ajoute pas un second.
    const filled = await planAddImage(vault, { path, role: 'screenshot', layerId: 'calque-7' })
    expect(filled.tool).toBe('place_screenshot_asset')
    expect(filled.args.layerId).toBe('calque-7')

    // Un logo prend la taille qu'il aurait à la souris, pas ses 1290 pixels.
    const logo = await planAddImage(vault, { path, role: 'image', name: 'Logo' })
    expect(logo.tool).toBe('add_image')
    expect(logo.args.originalWidth).toBe(1290)
    expect(logo.args.width).toBeLessThanOrEqual(600)
    expect(logo.args.height).toBe(600)
  })

  it('refuse un SVG comme capture d’écran, et dit par quoi le remplacer', async () => {
    const dir = await sandbox()
    const vault = new AssetVault()
    await writeFile(join(dir, 'logo.svg'), '<svg viewBox="0 0 10 10"></svg>')

    await expect(
      planAddImage(vault, { path: join(dir, 'logo.svg'), role: 'screenshot' }),
    ).rejects.toBeInstanceOf(AssetRefusedError)
    await expect(
      planAddImage(vault, { path: join(dir, 'logo.svg'), role: 'screenshot' }),
    ).rejects.toThrow(/role « image »/)
  })
})
