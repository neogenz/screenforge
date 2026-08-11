import { defineConfig, devices } from '@playwright/test'
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
 * Le second serveur ne démarre que si le déploiement local tourne. Sinon
 * `sync.spec.ts` se saute tout seul — il vérifie `localConvex()` avant de
 * naviguer — et `pnpm run test:e2e` reste exécutable sans backend, comme il
 * l'était sans Docker.
 */
const convex = localConvex()

const LOCAL_FIRST_PORT = 5199
const CLOUD_PORT = 5198
const CLOUD_SPEC = '**/sync.spec.ts'
/* Repris dans le projet : un `testIgnore` de projet remplace celui de la
   configuration, il ne s'y ajoute pas — les specs d'avant-lancement ont leur
   propre configuration et leur propre serveur. */
const PRELAUNCH_SPECS = '**/*.prelaunch.spec.ts'

const API_URL = 'VITE_API_URL=http://127.0.0.1:8787'

export default defineConfig({
  testDir: './e2e',
  testIgnore: PRELAUNCH_SPECS,
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
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
    {
      name: 'cloud',
      testMatch: CLOUD_SPEC,
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${String(CLOUD_PORT)}` },
    },
  ],
  webServer: [
    {
      command: `${API_URL} pnpm run dev --port ${String(LOCAL_FIRST_PORT)}`,
      url: `http://localhost:${String(LOCAL_FIRST_PORT)}`,
      reuseExistingServer: true,
      timeout: 30_000,
    },
    ...(convex
      ? [
          {
            command: `${API_URL} VITE_CONVEX_URL=${convex.url} pnpm run dev --port ${String(CLOUD_PORT)}`,
            url: `http://localhost:${String(CLOUD_PORT)}`,
            reuseExistingServer: true,
            timeout: 30_000,
          },
        ]
      : []),
  ],
})
