import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  /* Le `.env` vit à la racine de l'espace de travail, pas dans ce paquet : la
     même URL Supabase sert le web et le futur `apps/api`, et deux fichiers à
     tenir en phase auraient divergé au premier changement de clé. */
  envDir: path.resolve(import.meta.dirname, '../..'),
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
      },
    },
  },
})
