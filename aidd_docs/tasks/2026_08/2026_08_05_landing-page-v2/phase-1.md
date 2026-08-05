---
status: pending
---

# Instruction: Prerender — HTML complet, documents EN + FR, hreflang

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── landing.html                    ✏️ devient le template : commentaires d'injection, hreflang
├── vite.config.ts                  ✏️ inchangé côté entries ; le SSR passe par le script
├── scripts/
│   └── prerender-landing.mjs       ✅ build SSR + injection + écrit landing.html / landing-fr.html
├── package.json                    ✏️ build enchaîne le prerender ; script dev SSR inutile
└── src/landing/
    ├── entry-server.tsx            ✅ renderToString(<Landing initialLang>) par langue
    ├── main.tsx                    ✏️ hydrateRoot quand #root est pré-rempli
    ├── i18n.ts                     ✏️ garde SSR (pas de navigator/localStorage) + lang explicite
    ├── Landing.tsx                 ✏️ prop initialLang optionnelle
    └── components/Nav.tsx          ✏️ toggle langue = navigation vers l'autre document
```

## Tasks to do

### `1)` Entry serveur + hydratation

> Le même arbre React rend au build (chaîne) et au runtime (hydratation).

1. `entry-server.tsx` : exporte `render(lang)` → `renderToString(<Landing initialLang={lang} />)`.
2. `i18n.ts` : `detect()` tolère l'absence de `navigator`/`localStorage` (SSR) ; `initLang(lang?)` accepte une langue explicite qui prime sur la détection.
3. `Landing.tsx` : `initialLang` optionnelle, passée à l'init du store de langue.
4. `main.tsx` : si `#root` a des enfants → `hydrateRoot`, sinon `createRoot` (le dev reste CSR).

### `2)` Script de prerender

> Après `vite build`, deux documents complets sont écrits dans `dist/`.

1. `scripts/prerender-landing.mjs` : lance `vite build --ssr src/landing/entry-server.tsx --outDir dist-ssr`, importe le bundle, rend `en` et `fr`.
2. Injection dans le template `dist/landing.html` : contenu dans `#root`, `lang`, `<title>`, meta description, canonical + `alternate hreflang` EN/FR.
3. Écrit `dist/landing.html` (EN) et `dist/landing-fr.html` (FR) ; supprime `dist-ssr` après usage.
4. `package.json` : `"build": "tsc -b && vite build && node scripts/prerender-landing.mjs"`.

### `3)` Toggle langue = navigation

> Deux documents statiques : le toggle devient un lien, pas une mutation.

1. Nav et footer : EN ↔ FR pointent vers `/landing.html` / `landing-fr.html` (relatif, marche en `preview`).
2. L'état actif se déduit du document courant, pas d'un store ; `setLang` côté client reste pour le dev CSR.
3. Vérifier `npm run preview` : les deux pages servies complètes sans JS (désactiver JS au test).

## Test acceptance criteria

| Task | Acceptance criteria                                                                                  |
| ---- | ---------------------------------------------------------------------------------------------------- |
| 1    | `dist/landing.html` contient le texte du hero en clair dans le HTML (view-source, sans JS)           |
| 2    | `dist/landing-fr.html` rend la page entièrement en français, `<html lang="fr">`, titre FR            |
| 3    | Chaque document porte canonical + `hreflang` en/fr ; le toggle navigue vers l'autre document         |
| 4    | La page servie JS désactivé affiche tout le contenu ; avec JS, l'hydratation ne produit aucun warning |
