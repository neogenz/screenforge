import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const WORKSPACE_ROOT = fileURLToPath(new URL('../../..', import.meta.url))

export default function globalSetup(): void {
  if (process.env.SCREENFORGE_REQUIRE_CLOUD !== '1') return

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
}
