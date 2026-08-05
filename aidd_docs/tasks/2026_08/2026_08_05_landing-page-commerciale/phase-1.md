---
status: done
---

# Instruction: Socle landing — entry Vite, shell HTML, tokens, i18n EN/FR

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── landing.html                  ✅ second entry Vite (meta, OG, fonts, lang)
├── vite.config.ts                ✏️ build.rollupOptions.input { main, landing }
└── src/
    └── landing/
        ├── main.tsx              ✅ bootstrap React, applique la langue sur <html>
        ├── Landing.tsx           ✅ composition des sections (remplies en phases 2-3)
        ├── i18n.ts               ✅ détection langue, persistance localStorage, hook useLang
        ├── copy.ts               ✅ dictionnaire EN/FR — source unique de tout le texte
        └── links.ts              ✅ constante LINKS (app, checkout provisoires, légal)
```

## Tasks to do

### `1)` Entry Vite multi-page

> Servir `/landing.html` en dev et l'émettre au build sans toucher au bundle de l'app.

1. Ajouter `build.rollupOptions.input = { main: 'index.html', landing: 'landing.html' }` dans `vite.config.ts` (chemins résolus via `path.resolve`).
2. Vérifier `npm run dev` → `/landing.html` répond ; `npm run build` → `dist/landing.html` émis, `dist/index.html` inchangé.

### `2)` Shell HTML de la landing

> Un document autonome : SEO, OG, fonts hors chemin critique, fond anti-flash.

1. Écrire `landing.html` : `<html lang="en">` (basculé par JS), `<title>` + meta description, OG/Twitter cards, `theme-color`.
2. Reprendre le pattern de `index.html` : preload + `media="print"` onload pour la feuille Inter, fond OKLCH inline anti-flash (sombre, chroma 0).
3. Pas de skeleton : la landing est quasi statique, le premier paint doit être le contenu.

### `3)` Socle React + tokens

> La landing consomme les tokens de marque sans hériter du chrome éditeur.

1. `main.tsx` monte `Landing.tsx` dans `#root`, importe `@/index.css` (tokens `@theme` OKLCH, Inter, motion).
2. Poser la classe de thème sombre sur `<html>` dès le bootstrap (la landing est dark-first, pas de toggle de thème en itération 1).
3. `Landing.tsx` rend la structure de sections vides avec ancres (`#features`, `#pricing`, `#faq`).

### `4)` i18n EN/FR sans dépendance

> Un dictionnaire typé, une détection, un toggle — rien de plus.

1. `copy.ts` : objet `en` complet, `fr: typeof en` — l'exhaustivité FR est garantie par le typage.
2. `i18n.ts` : langue initiale = localStorage → `navigator.language` (préfixe `fr` → FR, sinon EN) ; `setLang` persiste et met à jour `<html lang>`.
3. Hook `useLang()` exposant `{ lang, t, setLang }` ; tout le texte de la page passe par `t`, aucune chaîne en dur dans les composants.
4. `links.ts` : `LINKS = { app: '/', checkoutMonthly: '…', checkoutLifetime: '…', contact: 'mailto:…' }` — les cibles checkout sont provisoires (plan SaaS séparé).

## Test acceptance criteria

| Task | Acceptance criteria                                                                 |
| ---- | ----------------------------------------------------------------------------------- |
| 1    | `/landing.html` se charge en dev ; le build émet les deux HTML sans erreur de typecheck/lint |
| 2    | View-source de la landing contient title, description et OG en dur (pas injectés par React) |
| 3    | Premier paint sombre sans flash blanc, Inter appliqué, tokens `--color-*` résolus   |
| 4    | Le toggle EN/FR rebascule tout le texte visible, survit au rechargement, et `<html lang>` suit |
