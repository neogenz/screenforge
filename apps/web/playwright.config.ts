import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { localConvex } from '../backend/tests/stack'

/**
 * Deux serveurs, parce que deux promesses opposées se mesurent dans la même
 * exécution.
 *
 * Sans `VITE_CONVEX_URL`, `cloudConfigured` est une constante `false` à la
 * compilation : la couche cloud disparaît à l'élagage, et c'est ce que
 * `boot-shell.spec.ts` mesure — le SDK ne doit pas être téléchargé par qui
 * n'aura jamais de compte. Avec la variable, la même couche doit fonctionner
 * pour de bon, et c'est ce que `sync.spec.ts` mesure. Un seul serveur ne peut
 * pas porter les deux : celui qui satisfait l'un fait échouer l'autre en
 * silence, ou pire, fait sauter l'autre sans le dire.
 *
 * Le second serveur ne démarre que si le déploiement local tourne en mode
 * ordinaire. Le gate release possède aussi ce déploiement et interdit les skips
 * cloud.
 */
const REQUIRE_CLOUD = process.env.SCREENFORGE_REQUIRE_CLOUD === '1'
const WORKSPACE_ROOT = fileURLToPath(new URL('../..', import.meta.url))

const LOCAL_FIRST_PORT = 5199
const CLOUD_PORT = 5198
const CLOUD_SPEC = '**/sync.spec.ts'
/* Repris dans le projet : un `testIgnore` de projet remplace celui de la
   configuration, il ne s'y ajoute pas — les specs d'avant-lancement ont leur
   propre configuration et leur propre serveur. */
const PRELAUNCH_SPECS = '**/*.prelaunch.spec.ts'

/* La vente ouverte : la suite principale mesure les paliers payants. */
const LAUNCH = 'VITE_COMMERCIAL_LAUNCH=1'
const configuredConvex = localConvex()
const convex = REQUIRE_CLOUD
  ? {
      url: 'http://127.0.0.1:3210',
      site: 'http://127.0.0.1:3211',
      adminKey: '',
    }
  : configuredConvex && (await deploymentReady(configuredConvex.url))
    ? configuredConvex
    : null

async function deploymentReady(url: string): Promise<boolean> {
  try {
    return (await fetch(`${url}/version`, { signal: AbortSignal.timeout(1000) })).ok
  } catch {
    return false
  }
}

export default defineConfig({
  testDir: './e2e',
  testIgnore: PRELAUNCH_SPECS,
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  globalSetup: REQUIRE_CLOUD ? './e2e/global-setup.ts' : undefined,
  use: {
    viewport: { width: 1600, height: 1000 },
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'local-first',
      testIgnore: [PRELAUNCH_SPECS, CLOUD_SPEC],
      use: {
        ...devices['Desktop Chrome'],
        baseURL: `http://localhost:${String(LOCAL_FIRST_PORT)}`,
      },
    },
    ...(convex
      ? [
          {
            name: 'cloud',
            testMatch: CLOUD_SPEC,
            use: {
              ...devices['Desktop Chrome'],
              baseURL: `http://localhost:${String(CLOUD_PORT)}`,
            },
          },
        ]
      : []),
  ],
  webServer: [
    ...(REQUIRE_CLOUD
      ? [
          {
            command: 'pnpm run dev:backend',
            cwd: WORKSPACE_ROOT,
            url: 'http://127.0.0.1:3210/version',
            reuseExistingServer: true,
            timeout: 60_000,
            stdout: 'pipe' as const,
            stderr: 'pipe' as const,
          },
        ]
      : []),
    {
      /* Blanchie, et pas seulement absente : `envDir` désigne la racine de
         l'espace de travail, où `convex dev` écrit `VITE_CONVEX_URL` dès qu'un
         déploiement local existe. Ce serveur en héritait, et `boot-shell` — qui
         mesure que le SDK n'est pas téléchargé par qui n'aura jamais de compte —
         échouait sur toute machine ayant simplement démarré le backend une fois.
         Une variable de processus vide l'emporte sur le fichier, `cloudConfigured`
         reste faux, et l'élagage a lieu comme sans la variable. Même geste que
         `VITE_COMMERCIAL_LAUNCH` dans la configuration d'avant-lancement. */
      command: `${LAUNCH} VITE_CONVEX_URL= pnpm run dev --port ${String(LOCAL_FIRST_PORT)}`,
      url: `http://localhost:${String(LOCAL_FIRST_PORT)}`,
      reuseExistingServer: true,
      timeout: 30_000,
    },
    ...(convex
      ? [
          {
            command: `${LAUNCH} VITE_CONVEX_URL=${convex.url} pnpm run dev --port ${String(CLOUD_PORT)}`,
            url: `http://localhost:${String(CLOUD_PORT)}`,
            reuseExistingServer: true,
            timeout: 30_000,
          },
        ]
      : []),
  ],
})
