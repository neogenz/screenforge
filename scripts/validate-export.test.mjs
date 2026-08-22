import assert from 'node:assert/strict'
import { test } from 'node:test'
import JSZip from 'jszip'
import { validateExportZip } from './validate-export.mjs'

/** @param {number} width @param {number} height @param {number} colorType */
function png(width, height, colorType = 2) {
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

/** @param {string} folder @param {number} count @param {number} width @param {number} height @param {number} colorType */
async function bundle(folder, count, width, height, colorType = 2) {
  const zip = new JSZip()
  for (let index = 1; index <= count; index += 1) {
    zip.file(
      `${folder}/${String(index).padStart(2, '0')}_screen.png`,
      png(width, height, colorType),
    )
  }
  return zip.generateAsync({ type: 'uint8array' })
}

test('accepte les contrats Apple et Google Play exacts', async () => {
  assert.equal((await validateExportZip(await bundle('6.9', 1, 1320, 2868))).length, 1)
  assert.equal(
    (await validateExportZip(await bundle('phone', 4, 1080, 1920), 'google-play-phone')).length,
    4,
  )
})

test('refuse le neuvième PNG Android, les dimensions et l’alpha', async () => {
  await assert.rejects(validateExportZip(await bundle('phone', 9, 1080, 1920)), /entre 1 et 8/)
  await assert.rejects(validateExportZip(await bundle('phone', 1, 1081, 1920)), /attendu 1080×1920/)
  await assert.rejects(validateExportZip(await bundle('phone', 1, 1080, 1920, 6)), /RGB opaque/)
})

test('refuse un PNG qui dépasse la cible interne de 5 MB', async () => {
  const zip = new JSZip()
  const oversized = new Uint8Array(5 * 1024 * 1024 + 1)
  oversized.set(png(1080, 1920))
  zip.file('phone/01_screen.png', oversized)
  await assert.rejects(
    validateExportZip(await zip.generateAsync({ type: 'uint8array' })),
    /cible interne maximale 5 MB/,
  )
})

test('refuse deux entrées portant le même chemin', async () => {
  const bytes = Buffer.from(await bundle('phone', 2, 1080, 1920))
  const from = Buffer.from('phone/02_screen.png')
  const to = Buffer.from('phone/01_screen.png')
  let at = bytes.indexOf(from)
  while (at >= 0) {
    to.copy(bytes, at)
    at = bytes.indexOf(from, at + from.length)
  }
  await assert.rejects(validateExportZip(bytes), /chemin en double/)
})
