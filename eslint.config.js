import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  {
    ignores: [
      '**/dist',
      '**/dist-ssr',
      '**/build',
      '**/test-results',
      '**/playwright-report',
      '.claude/worktrees/**',
      // Écrit par `convex dev`, réécrit à chaque poussée : le corriger ne tient pas.
      '**/convex/_generated',
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['apps/*/src/**/*.{ts,tsx}', 'packages/*/src/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // `ui/` est écrit par le CLI coss et jamais retouché : ses fichiers
    // exportent des variantes CVA et des contextes à côté des composants.
    files: ['apps/web/src/components/ui/**/*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['apps/*/e2e/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    // Les fonctions Convex ne vivent pas dans `src/` : sans ce bloc, tout le
    // backend serait le seul code du dépôt que rien ne relit.
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['apps/backend/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['apps/*/*.config.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
  },
  {
    ...js.configs.recommended,
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      // Ces scripts pilotent un navigateur : le corps des `page.evaluate`
      // s'exécute dans la page et lit ses globales, comme les specs e2e.
      globals: { ...globals.browser, ...globals.node },
    },
  },
  prettier,
)
