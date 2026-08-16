import { api } from '../../backend/convex/_generated/api'
import { ConvexHttpClient } from 'convex/browser'
import { execFileSync } from 'node:child_process'
import { setTimeout } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const WORKSPACE_ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const LOCAL_CONVEX_URL = 'http://127.0.0.1:3210'

async function waitForAuth(): Promise<void> {
  const client = new ConvexHttpClient(LOCAL_CONVEX_URL)
  const deadline = Date.now() + 30_000

  while (Date.now() < deadline) {
    try {
      await client.query(api.auth.isAuthenticated, {})
      return
    } catch {
      await setTimeout(250)
    }
  }

  throw new Error('Convex Auth functions were not ready within 30 seconds.')
}

export default async function globalSetup(): Promise<void> {
  if (process.env.SCREENFORGE_REQUIRE_CLOUD !== '1') return

  execFileSync(
    'pnpm',
    ['--filter', 'backend', 'exec', 'convex', 'env', 'set', 'AUTH_TEST_PASSWORD', '1'],
    {
      cwd: WORKSPACE_ROOT,
      stdio: 'inherit',
    },
  )

  execFileSync(
    'pnpm',
    [
      '--filter',
      'backend',
      'exec',
      'auth',
      '--skip-git-check',
      '--web-server-url',
      'http://localhost:5198',
    ],
    { cwd: WORKSPACE_ROOT, stdio: 'inherit' },
  )

  await waitForAuth()
}
