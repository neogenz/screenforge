import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const RULE_NAME = /^[A-Z][A-Z0-9_]*$/

/** @param {string} output */
export function enforceConvexPreflight(output) {
  let result
  try {
    result = JSON.parse(output)
  } catch {
    throw new Error('Convex preflight returned an invalid response.')
  }

  if (
    !result ||
    typeof result !== 'object' ||
    typeof result.ready !== 'boolean' ||
    !Array.isArray(result.missing) ||
    !Array.isArray(result.inconsistent) ||
    ![...result.missing, ...result.inconsistent].every(
      (rule) => typeof rule === 'string' && RULE_NAME.test(rule),
    ) ||
    result.ready !== (result.missing.length === 0 && result.inconsistent.length === 0)
  ) {
    throw new Error('Convex preflight returned an invalid response.')
  }

  if (!result.ready) {
    const findings = [
      .../** @type {string[]} */ (result.missing).map((rule) => `missing:${rule}`),
      .../** @type {string[]} */ (result.inconsistent).map((rule) => `inconsistent:${rule}`),
    ]
    throw new Error(`Convex preflight blocked deployment: ${findings.join(', ')}`)
  }

  return 'Convex preflight passed.'
}

async function main() {
  try {
    process.stdin.setEncoding('utf8')
    let output = ''
    for await (const chunk of process.stdin) output += chunk
    console.log(enforceConvexPreflight(output))
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Convex preflight failed.')
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await main()
