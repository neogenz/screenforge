import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const RELEASE_TAG = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

/** @param {string} tag @param {string} version */
export function verifyReleaseTag(tag, version) {
  const match = RELEASE_TAG.exec(tag)
  assert(match, `Invalid release tag: ${tag}`)
  assert.equal(match.slice(1).join('.'), version, `Tag ${tag} does not match version ${version}`)
}

function selfTest() {
  verifyReleaseTag('v0.1.0', '0.1.0')
  verifyReleaseTag('v12.34.56', '12.34.56')
  for (const tag of ['1.2.3', 'v1.2', 'v01.2.3', 'v1.02.3', 'v1.2.03', 'v1.2.3-beta']) {
    assert.throws(() => verifyReleaseTag(tag, '1.2.3'))
  }
  assert.throws(() => verifyReleaseTag('v1.2.3', '1.2.4'))
  console.log('Release tag contract passed.')
}

/** @param {string | undefined} argument */
async function main(argument) {
  if (argument === '--self-test') return selfTest()
  assert(argument, 'Usage: verify-release-tag.mjs <vMAJOR.MINOR.PATCH> | --self-test')
  const pkg = JSON.parse(await readFile(resolve(import.meta.dirname, '../package.json'), 'utf8'))
  verifyReleaseTag(argument, pkg.version)
  console.log(`Release tag ${argument} matches package version ${pkg.version}.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main(process.argv[2])
}
