import { execFile } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(root, 'build/open-beneath')
await mkdir(dirname(output), { recursive: true })
const flags = ['-std=c11', '-O2', '-Wall', '-Wextra']
if (process.env.SCREENFORGE_NATIVE_TEST === '1') flags.push('-DSCREENFORGE_TEST_HOOKS')
await run(process.env.CC || 'cc', [...flags, resolve(root, 'native/open-beneath.c'), '-o', output])
