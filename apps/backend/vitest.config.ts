import { defineConfig } from 'vitest/config'

/**
 * `convex-test` exécute les fonctions du déploiement dans un simulateur, et ce
 * simulateur exige le runtime Edge : les fonctions Convex tournent sur un moteur
 * qui n'a ni `fs` ni `process`, et les tester sous Node laisserait passer un
 * import qui casse à la poussée.
 *
 * Ce que le simulateur ne couvre pas est écrit une seule fois, dans
 * `phase-6.md` : les plafonds de taille, les crons, et les messages d'erreur du
 * vrai moteur. Ces trois-là se vérifient contre un déploiement réel.
 */
export default defineConfig({
  test: {
    environment: 'edge-runtime',
    setupFiles: ['./vitest.setup.ts'],
    server: { deps: { inline: ['convex-test'] } },
  },
})
