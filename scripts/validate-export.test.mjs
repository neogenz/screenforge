import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import JSZip from 'jszip'
import { validateExportZip } from './validate-export.mjs'

/** @param {number} width @param {number} height @param {number} colorType */
function pngHeader(width, height, colorType = 2) {
  const bytes = new Uint8Array(33)
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10])
  const view = new DataView(bytes.buffer)
  view.setUint32(8, 13)
  bytes.set([73, 72, 68, 82], 12)
  view.setUint32(16, width)
  view.setUint32(20, height)
  bytes[24] = 8
  bytes[25] = colorType
  return bytes
}

/** @param {readonly (readonly [string, Uint8Array])[]} files */
async function archive(files) {
  const zip = new JSZip()
  for (const [path, bytes] of files) zip.file(path, bytes)
  return zip.generateAsync({ type: 'uint8array' })
}

describe('validateExportZip', () => {
  it('accepts exact iPad and Apple Watch portrait exports', async () => {
    const ipad = await validateExportZip(
      await archive([['ipad-13/01_accueil.png', pngHeader(2064, 2752)]]),
    )
    const watch = await validateExportZip(
      await archive([['watch-series-10/01_accueil.png', pngHeader(416, 496)]]),
    )

    assert.deepEqual(
      ipad.map(({ path, width, height }) => ({ path, width, height })),
      [{ path: 'ipad-13/01_accueil.png', width: 2064, height: 2752 }],
    )
    assert.deepEqual(
      watch.map(({ path, width, height }) => ({ path, width, height })),
      [{ path: 'watch-series-10/01_accueil.png', width: 416, height: 496 }],
    )
  })

  it('rejects an inverse size, alpha, an unknown folder and a mixed-profile ZIP', async () => {
    await assert.rejects(
      validateExportZip(await archive([['ipad-13/01_paysage.png', pngHeader(2752, 2064)]])),
      /2752×2064, attendu 2064×2752/,
    )
    await assert.rejects(
      validateExportZip(await archive([['watch-series-10/01_alpha.png', pngHeader(416, 496, 6)]])),
      /RGB opaque/,
    )
    await assert.rejects(
      validateExportZip(await archive([['ipad/01_inconnu.png', pngHeader(2064, 2752)]])),
      /profil App Store inconnu/,
    )
    await assert.rejects(
      validateExportZip(
        await archive([
          ['ipad-13/01_ipad.png', pngHeader(2064, 2752)],
          ['watch-series-10/02_watch.png', pngHeader(416, 496)],
        ]),
      ),
      /mélange plusieurs profils/,
    )
  })
})
