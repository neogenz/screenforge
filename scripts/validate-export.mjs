import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import JSZip from 'jszip'
import { STORE_TARGET_PROFILES } from '../packages/project-format/src/dimensions.ts'

const EXPECTED_BIT_DEPTH = 8
const EXPECTED_COLOR_TYPE = 2
const INTERNAL_SIZE_TARGET = 5 * 1024 * 1024
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]
const PROFILES = Object.fromEntries(
  Object.entries(STORE_TARGET_PROFILES).map(([id, profile]) => [
    id,
    {
      folder: profile.zipFolder,
      width: profile.output.portrait.width,
      height: profile.output.portrait.height,
      maxFiles: profile.maxScreens,
    },
  ]),
)

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

/** @param {PngMetadata} metadata @param {string} path @param {{width: number; height: number}} profile */
function assertPng(metadata, path, profile) {
  if (metadata.width !== profile.width || metadata.height !== profile.height) {
    throw new Error(
      `${path}: ${metadata.width}×${metadata.height}, attendu ${profile.width}×${profile.height}`,
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

/** Lit le répertoire central : JSZip masque sinon deux entrées de même nom. @param {Uint8Array} bytes */
function centralDirectoryNames(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let eocd = -1
  for (let at = bytes.byteLength - 22; at >= Math.max(0, bytes.byteLength - 65_557); at -= 1) {
    if (view.getUint32(at, true) === 0x06054b50) {
      eocd = at
      break
    }
  }
  if (eocd < 0) throw new Error('répertoire central ZIP introuvable')
  const count = view.getUint16(eocd + 10, true)
  let offset = view.getUint32(eocd + 16, true)
  const names = []
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > bytes.byteLength || view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error('entrée du répertoire central ZIP invalide')
    }
    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    names.push(new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength)))
    offset += 46 + nameLength + extraLength + commentLength
  }
  return names
}

/** @typedef {'app-store-iphone' | 'google-play-phone'} TargetId */

/** @param {string[]} paths @param {string | undefined} targetId */
function resolveProfile(paths, targetId) {
  if (targetId && !Object.hasOwn(PROFILES, targetId))
    throw new Error(`cible inconnue : ${targetId}`)
  const inferred = Object.entries(PROFILES).find(([, profile]) =>
    paths.some((path) => path.startsWith(`${profile.folder}/`)),
  )?.[0]
  const id = /** @type {TargetId | undefined} */ (targetId ?? inferred)
  if (!id) throw new Error('cible indétectable : attendu un dossier 6.9/ ou phone/')
  return { id, ...PROFILES[id] }
}

/** @param {Uint8Array} zipBytes @param {string} [targetId] */
export async function validateExportZip(zipBytes, targetId) {
  const centralNames = centralDirectoryNames(zipBytes).filter((name) => !name.endsWith('/'))
  if (new Set(centralNames).size !== centralNames.length) {
    throw new Error('le ZIP contient un chemin en double')
  }
  const zip = await JSZip.loadAsync(zipBytes)
  const files = Object.values(zip.files)
    .filter((entry) => !entry.dir)
    .sort((left, right) => left.name.localeCompare(right.name))

  const profile = resolveProfile(
    files.map((file) => file.name),
    targetId,
  )
  if (files.length < 1 || files.length > profile.maxFiles) {
    throw new Error(
      `le ZIP ${profile.id} doit contenir entre 1 et ${profile.maxFiles} PNG, reçu ${files.length}`,
    )
  }

  const summaries = []
  const filePattern = new RegExp(
    `^${profile.folder.replace('.', '\\.')}\\/(\\d{2})_([a-z0-9_]+)\\.png$`,
  )
  for (let index = 0; index < files.length; index += 1) {
    const entry = files[index]
    const match = filePattern.exec(entry.name)
    if (!match) {
      throw new Error(`${entry.name}: chemin invalide, attendu ${profile.folder}/NN_nom.png`)
    }
    const expectedIndex = index + 1
    if (Number(match[1]) !== expectedIndex) {
      throw new Error(
        `${entry.name}: index ${match[1]}, attendu ${String(expectedIndex).padStart(2, '0')}`,
      )
    }
    const bytes = await entry.async('uint8array')
    const metadata = readPngMetadata(bytes, entry.name)
    assertPng(metadata, entry.name, profile)
    summaries.push({ path: entry.name, ...metadata })
  }
  return summaries
}

async function main() {
  const args = process.argv.slice(2)
  const targetAt = args.indexOf('--target')
  const inlineTarget = args.find((argument) => argument.startsWith('--target='))?.slice(9)
  const targetId = inlineTarget ?? (targetAt >= 0 ? args[targetAt + 1] : undefined)
  const inputPath = args.find(
    (argument, index) =>
      argument !== '--' &&
      argument !== '--target' &&
      index !== targetAt + 1 &&
      !argument.startsWith('--target='),
  )
  if (!inputPath) {
    throw new Error(
      'usage: pnpm validate:export -- <screenforge.zip> [--target app-store-iphone|google-play-phone]',
    )
  }
  const summaries = await validateExportZip(await readFile(inputPath), targetId)
  const totalBytes = summaries.reduce((total, file) => total + file.byteLength, 0)
  console.log(
    `VALID ${summaries.length} PNG · ${summaries[0].width}×${summaries[0].height} · RGB opaque · ${(totalBytes / 1024 / 1024).toFixed(2)} MB`,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`INVALID ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
}
