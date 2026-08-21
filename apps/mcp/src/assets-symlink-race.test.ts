import { access, mkdir, mkdtemp, rename, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { AssetVault } from './relay/assets.ts'

const svg = (width: number, height: number) => `<svg viewBox="0 0 ${width} ${height}"></svg>`

async function waitFor(path: string): Promise<void> {
  for (let attempt = 0; attempt < 1_000; attempt += 1) {
    if (
      await access(path).then(
        () => true,
        () => false,
      )
    )
      return
    await new Promise((resolve) => setTimeout(resolve, 2))
  }
  throw new Error(`Point de synchronisation absent : ${path}`)
}

async function resume(hooks: string, phase: 'before' | 'after', index: number): Promise<void> {
  await waitFor(join(hooks, `${phase}-${index}`))
  await writeFile(join(hooks, `continue-${phase}-${index}`), '')
}

afterEach(() => {
  delete process.env.SCREENFORGE_OPEN_BENEATH_TEST_HOOK
})

describe('confinement du coffre d’assets', () => {
  it('refuse un ancêtre remplacé juste avant son ouverture', async () => {
    const root = await mkdtemp(join(tmpdir(), 'screenforge-mcp-root-'))
    const outside = await mkdtemp(join(tmpdir(), 'screenforge-mcp-outside-'))
    const hooks = await mkdtemp(join(tmpdir(), 'screenforge-mcp-hooks-'))
    const slot = join(root, 'slot')
    const held = join(root, 'slot-original')
    await mkdir(slot)
    await Promise.all([
      writeFile(join(outside, 'capture.svg'), svg(999, 999)),
      writeFile(join(slot, 'capture.svg'), svg(10, 20)),
    ])
    process.env.SCREENFORGE_OPEN_BENEATH_TEST_HOOK = hooks

    const offered = new AssetVault(() => Promise.resolve([root])).offer(join(slot, 'capture.svg'))
    await waitFor(join(hooks, 'before-0'))
    await rename(slot, held)
    await symlink(outside, slot)
    await writeFile(join(hooks, 'continue-before-0'), '')

    await expect(offered).rejects.toThrow(/remplacé|hors racine/)
  })

  it('reste ancré au descripteur si l’ancêtre change avant le fichier', async () => {
    const root = await mkdtemp(join(tmpdir(), 'screenforge-mcp-root-'))
    const outside = await mkdtemp(join(tmpdir(), 'screenforge-mcp-outside-'))
    const hooks = await mkdtemp(join(tmpdir(), 'screenforge-mcp-hooks-'))
    const slot = join(root, 'slot')
    const held = join(root, 'slot-original')
    await mkdir(slot)
    await Promise.all([
      writeFile(join(outside, 'capture.svg'), svg(999, 999)),
      writeFile(join(slot, 'capture.svg'), svg(10, 20)),
    ])
    process.env.SCREENFORGE_OPEN_BENEATH_TEST_HOOK = hooks

    const offered = new AssetVault(() => Promise.resolve([root])).offer(join(slot, 'capture.svg'))
    await resume(hooks, 'before', 0)
    await resume(hooks, 'after', 0)
    await waitFor(join(hooks, 'before-1'))
    await rename(slot, held)
    await symlink(outside, slot)
    await writeFile(join(hooks, 'continue-before-1'), '')
    await resume(hooks, 'after', 1)

    await expect(offered).resolves.toMatchObject({ width: 10, height: 20 })
  })
})
