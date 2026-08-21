import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import posthogRollupPlugin from '@posthog/rollup-plugin'
import path from 'path'

const posthogPersonalApiKey = process.env.POSTHOG_PERSONAL_API_KEY?.trim()

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    Boolean(posthogPersonalApiKey) &&
      posthogRollupPlugin({
        personalApiKey: posthogPersonalApiKey ?? '',
        projectId: '254685',
        host: 'https://eu.i.posthog.com',
        sourcemaps: {
          enabled: true,
          releaseName: 'screenforge-web',
          releaseVersion: process.env.VITE_APP_VERSION,
          build: process.env.VITE_GIT_SHA,
          deleteAfterUpload: true,
        },
      }),
  ],
  /* Le `.env` vit à la racine de l'espace de travail, pas dans ce paquet : la
     même URL de déploiement sert le web et les scripts d'audit, et deux fichiers
     à tenir en phase auraient divergé au premier changement d'environnement. */
  envDir: path.resolve(import.meta.dirname, '../..'),
  /* Le port est épinglé parce qu'un déploiement le connaît par cœur : `SITE_URL`
     vaut `http://localhost:5173` sur la préproduction, et `safeRedirect` ne
     renvoie jamais ailleurs. Sans `strictPort`, Vite glisse silencieusement sur
     5174 quand 5173 est pris, et le retour d'authentification livre alors son
     code de connexion à une fenêtre qui n'existe pas — ou à l'autre projet qui
     occupe 5173. Refuser de démarrer est le seul échec qui se voit. */
  server: { port: 5173, strictPort: true },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(import.meta.dirname, 'index.html'),
        landing: path.resolve(import.meta.dirname, 'landing.html'),
        privacy: path.resolve(import.meta.dirname, 'privacy.html'),
      },
    },
  },
})
