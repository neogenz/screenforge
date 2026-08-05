import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import JSZip from 'jszip'

const EXPECTED_WIDTH = 1320
const EXPECTED_HEIGHT = 2868
const EXPECTED_BIT_DEPTH = 8
const EXPECTED_COLOR_TYPE = 2
const INTERNAL_SIZE_TARGET = 5 * 1024 * 1024
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]
const FILE_PATTERN = /^6\.9\/(\d{2})_([a-z0-9_]+)\.png$/

/**
 * @typedef {{ width: number; height: number; bitDepth: number; colorType: number; byteLength: number }} PngMetadata
 */

/** @param {Uint8Array} bytes @param {string} path @returns {PngMetadata} */
function readPngMetadata(bytes, path) {
  if (bytes.byteLength < 33 || !PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
    throw new Error(`${path}: signature PNG invalide`)
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const chunkLength = view.getUint32(8)
  const chunkType = new TextDecoder().decode(bytes.subarray(12, 16))
  if (chunkLength !== 13 || chunkType !== 'IHDR') {
    throw new Error(`${path}: en-tête IHDR invalide`)
  }
  return {
    width: view.getUint32(16),
    height: view.getUint32(20),
    bitDepth: view.getUint8(24),
    colorType: view.getUint8(25),
    byteLength: bytes.byteLength,
  }
}

/** @param {PngMetadata} metadata @param {string} path */
function assertPng(metadata, path) {
  if (metadata.width !== EXPECTED_WIDTH || metadata.height !== EXPECTED_HEIGHT) {
    throw new Error(
      `${path}: ${metadata.width}×${metadata.height}, attendu ${EXPECTED_WIDTH}×${EXPECTED_HEIGHT}`,
    )
  }
  if (metadata.bitDepth !== EXPECTED_BIT_DEPTH) {
    throw new Error(`${path}: ${metadata.bitDepth} bits, attendu ${EXPECTED_BIT_DEPTH}`)
  }
  if (metadata.colorType !== EXPECTED_COLOR_TYPE) {
    throw new Error(`${path}: type PNG ${metadata.colorType}, attendu RGB opaque (2)`)
  }
  if (metadata.byteLength > INTERNAL_SIZE_TARGET) {
    throw new Error(
      `${path}: ${(metadata.byteLength / 1024 / 1024).toFixed(2)} MB, cible interne maximale 5 MB`,
    )
  }
}

/** @param {Uint8Array} zipBytes */
export async function validateExportZip(zipBytes) {
  const zip = await JSZip.loadAsync(zipBytes)
  const files = Object.values(zip.files)
    .filter((entry) => !entry.dir)
    .sort((left, right) => left.name.localeCompare(right.name))

  if (files.length < 1 || files.length > 10) {
    throw new Error(`le ZIP doit contenir entre 1 et 10 PNG, reçu ${files.length}`)
  }

  const summaries = []
  for (let index = 0; index < files.length; index += 1) {
    const entry = files[index]
    const match = FILE_PATTERN.exec(entry.name)
    if (!match) throw new Error(`${entry.name}: chemin invalide, attendu 6.9/NN_nom.png`)
    const expectedIndex = index + 1
    if (Number(match[1]) !== expectedIndex) {
      throw new Error(
        `${entry.name}: index ${match[1]}, attendu ${String(expectedIndex).padStart(2, '0')}`,
      )
    }
    const bytes = await entry.async('uint8array')
    const metadata = readPngMetadata(bytes, entry.name)
    assertPng(metadata, entry.name)
    summaries.push({ path: entry.name, ...metadata })
  }
  return summaries
}

async function main() {
  const inputPath = process.argv.slice(2).find((argument) => argument !== '--')
  if (!inputPath) throw new Error('usage: pnpm validate:export -- <screenforge-app-store.zip>')
  const summaries = await validateExportZip(await readFile(inputPath))
  const totalBytes = summaries.reduce((total, file) => total + file.byteLength, 0)
  console.log(
    `VALID ${summaries.length} PNG · ${EXPECTED_WIDTH}×${EXPECTED_HEIGHT} · RGB opaque · ${(totalBytes / 1024 / 1024).toFixed(2)} MB`,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`INVALID ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
}
