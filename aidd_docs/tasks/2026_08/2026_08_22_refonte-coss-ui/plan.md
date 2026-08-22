---
objective: "L'éditeur ScreenForge et ses treize dialogues tournent sur le design system coss ui (Base UI, palette neutre coss, composants installés par le CLI comme dans mandat-tan) avec une finition oa-design — motion, squelettes, états vides, copy — et ne gardent du langage v6 qu'une couche d'extension (stage, marqueur citron, artboard, z) sans casser les gates contrast/scale/semantics/motion."
status: in-progress
---

<!-- Fill or omit these sections; never add, rename, or reorder one. -->

# Plan: refonte frontend sur le design system coss ui

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Remplacer la couche UI (Radix + 24 primitives maison + `tw-animate-css` + `index.css` de 828 lignes) par coss ui installé tel quel (palette `@coss/colors-neutral`, `--radius` coss, tailles coss, anatomie `data-slot`), structurer le projet comme mandat-tan (`components/ui/` = coss non modifié, `components/patterns/` = compositions métier, `design-system/tokens.css` = la seule extension), réécrire le chrome, les panneaux et les dialogues dans cette grammaire, et monter la finition au niveau oa-design (motion, squelettes, états vides, notices, copy). Ce qui survit du langage v6 est ce que l'outil exige : stage toujours plus sombre que les artboards, chrome achromatique, `--color-marker` citron pour « vous êtes ici », rien de chromatique sur l'artboard, géométrie de chrome dans `lib/stage.ts`. |
| **Source** | Demande utilisateur du 22/08/2026 (texte) : « refonte totale du frontend UX/UI en remplaçant l'actuel par coss ui, inspirée de `~/workspace/perso/_projets/mandat-tan`, appuyée sur `/oa-design` », précisée en cours de route : « je veux vraiment que tu te bases sur le DS de coss ui et leur librairie de composants ; dans mandat c'est assez bien fait ». Références lues : `mandat-tan/components.json`, `src/styles.css`, `src/design-system/{tokens,motion}.css`, `src/components/ui/{button,dialog}.tsx`, `src/components/patterns/{app-shell,section-card}.tsx`, `aidd_docs/memory/architecture.md` ; skill `oa-design` (`_root.css`, `_tokens.md`, `_layout.md`, `_components.md`, `_motion.md`, `_copy.md`). |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1   | Fondations : coss installé, tokens coss + extension ScreenForge, motion, police | [`phase-1.md`](./phase-1.md) |
| 2   | Primitives : `ui/` = coss, adaptateurs maison, features recâblées | [`phase-2.md`](./phase-2.md) |
| 3   | Chrome : barre haute, îlots, filmstrip, HUD, menus contextuels | [`phase-3.md`](./phase-3.md) |
| 4   | Panneaux Calques et Propriétés : Field, InputGroup, sections | [`phase-4.md`](./phase-4.md) |
| 5   | Dialogues : anatomie coss, AlertDialog, parcours multi-étapes | [`phase-5.md`](./phase-5.md) |
| 6   | Finition oa-design : états, squelettes, toasts, copy, micro-détails | [`phase-6.md`](./phase-6.md) |
| 7   | Gates, tests et mémoire : audits re-calibrés, e2e verts, docs à jour | [`phase-7.md`](./phase-7.md) |

## Resources

<!-- External sources only (URLs, docs), not code files. Omit if none consulted. -->

| Source | Verified |
| ------ | -------- |
| https://coss.com/ui/docs/get-started | Installation par le CLI shadcn via registre `@coss` (`https://coss.com/ui/r/{name}.json`) : `pnpm dlx shadcn@latest add @coss/ui` (primitives) ou `@coss/style` (tout + thème), `@base-ui/react` ≥ 1.5, Tailwind v4 CSS-first. Confirmé par `mandat-tan/components.json` (style `base-nova`, `@base-ui/react 1.7.0`). |
| https://coss.com/ui/docs/styling | Contrat de tokens shadcn, palette installée par `@coss/colors-neutral` en `:root` / `.dark` (`--alpha(var(--color-black) / 4%)`, `color-mix`), consommée via `@theme inline` ; `--radius` unique (0.625rem) dont `sm/md/lg/xl/2xl` dérivent par `calc`. |
| https://base-ui.com/react/handbook/animation | Transitions CSS pilotées par `data-starting-style` / `data-ending-style` / `data-open` ; `keepMounted` pour les sorties ; pas de lib JS requise. |
| https://base-ui.com/react/overview/quick-start | Base UI exige `isolation: isolate` sur le conteneur racine (portails) ; `useRender` + `render` prop remplace `asChild`/`Slot`. |

## Decisions

<!-- Architecture-magnitude only, one you'd regret reversing. Omit if none qualify. -->

| Decision | Why |
| -------- | --- |
| **coss ui est le design system**, installé par le CLI et non réécrit : palette `@coss/colors-neutral` (light + `.dark`), `--radius: 0.625rem` et sa chaîne, tailles de contrôles coss (`h-9 sm:h-8`, `icon-sm`, `xs`…), variantes de Button coss, anatomie `data-slot`. Les composants sous `components/ui/` ne sont **pas modifiés** ; ce qui est propre au projet vit dans `components/patterns/` (structure mandat-tan). | Demande explicite de l'utilisateur. Un composant coss retouché ne se met plus à jour par le CLI et redevient une primitive maison : c'est exactement l'état de départ. La palette coss neutral est à chroma 0 (`neutral-*`, `black/white` en alpha), donc compatible avec la règle « rien de teinté à côté de l'artboard ». |
| Une **seule couche d'extension**, `src/design-system/tokens.css` (comme mandat-tan) : `--stage`, `--stage-dot`, `--marker*`, `--artboard-*`, `--selection-soft`, `--guide*`, `--z-*`, ombres de poignée, durées. Tout le reste de `index.css` (32 kB, 16 tokens hors contrat, `.island`, `.field-surface`, `.surface-inner`, `.menu-shadow`, neuf `@keyframes`) disparaît. | Mandat-tan montre le bon ratio : 186 lignes de `styles.css` + une extension nommée. Les utilitaires maison existaient pour compenser des primitives maison ; coss les rend sans objet (`CardFrame`/`Card` pour les surfaces, `Field` pour les libellés, `InputGroup` pour les unités). |
| Les **échelles fermées deviennent celles de coss** : type `text-xs/sm/base` (12/14/16), hauteurs `h-7/h-8/h-9` (28/32/36, rendu desktop via `sm:`), rayons `sm/md/lg/xl/2xl` (6/8/10/14/18), et `audit:scale` est **re-calibré** sur ces valeurs (phase 7) au lieu de forcer coss dans l'ancienne chaîne 6/9/12/15/21. | Le guard existe pour empêcher la dérive, pas pour figer une valeur. Re-thémer `--radius` à 0.9375rem sur coss donnerait des boutons à 13 px de rayon et des popups à 23 : coss est dessiné pour 10. Le garde continue de compter (≤ 3 polices, ≤ 3 hauteurs, ≤ 5 rayons, line-height sur 4 px) ; seules ses bornes changent. |
| `--primary` coss neutral (neutral-800 clair / neutral-100 sombre) **est** le CTA Exporter ; `--color-marker` reste une extension, jamais sur une action. Dark reste le thème par défaut (`.dark` posé sur `<html>` au boot, `.light` disparaît au profit de l'absence de classe). | La palette coss neutral fait déjà un `primary` blanc-sur-graphite en sombre : c'est le CTA v6 sans rien re-thémer. Le citron n'a pas de nom dans le contrat shadcn et n'en prend pas (`accent` reste le lavis de survol coss). Base UI et coss lisent `.dark`, pas `.light` : on adopte leur convention. |
| **Aucun wrapper durable** : la phase 2 remplace les 24 primitives par coss sous les mêmes chemins `@/components/ui/*`, et recâble chaque feature sur l'API coss (`render` au lieu de `asChild`, `DialogPopup/Header/Panel/Footer`, `SelectTrigger/Value/Popup/Item`, `MenuPopup`, `NumberField` + `NumberFieldScrubArea`). Ce qui n'existe pas dans coss (pastille couleur `SwatchButton`, composition angle `AngleControl`, fondu de défilement) devient un **pattern** dans `components/patterns/`, composé de primitives coss, jamais une primitive maison dans `ui/`. | Demande explicite de l'utilisateur : « s'il existe dans coss, reprends-le ». Vérifié sur le registre (`coss.com/ui/r/registry.json`, 2026-08-22) : `number-field` expose `NumberFieldScrubArea` (Base UI, pointer-lock), donc le scrub maison de 178 lignes n'a plus de raison d'être ; `toolbar`, `toggle-group`, `context-menu`, `command`, `empty`, `skeleton`, `kbd`, `input-group`, `scroll-area` existent tous. Le contrat scrub reste couvert par `canvas-transforms.spec.ts`. Le recâblage se fait feature par feature, e2e lancées entre deux, pour localiser chaque régression. |
| Motion **100 % CSS** : `design-system/motion.css` de mandat-tan (`--duration-fast/base/slow`, `--ease-out`, `transition-ui`, `animate-enter`, `animate-mark`) + `oa-arrive` et la physique des toasts de `_root.css`, pilotés par `data-starting-style`/`data-ending-style` de Base UI ; `tw-animate-css` supprimé ; **pas de `motion`**. | Tout ce que ScreenForge anime tient en < 300 ms transform/opacity (`motion.spec.ts`). Les ressorts oa sont chiffrés pour `motion` ; `linear()` natif suffit pour le seul rebond (`--ease-settle`). Une lib de 30 kB pour la chorégraphie de hauteur de trois dialogues n'a pas de retour. |
| `corner-shape: squircle` en amélioration progressive sur `CardFrame`/popups, **sans `clip-path: shape()`**. | `clip-path` coupe le `box-shadow`, or l'ombre de l'artboard courant porte l'état. `corner-shape` dégrade en arrondi sans rien casser. |
| Inter auto-hébergée via `@fontsource-variable/inter` ; Geist Mono pour `kbd`/`code` (coss par défaut) ; le flip `<link media="print">` de `index.html` disparaît. | Mandat-tan et oa-design (« a font CDN… has failed in production »). Un woff2 local rend le mécanisme de chargement non bloquant inutile. |
| `sonner` reste le moteur des toasts (style coss `toast` + keyframes oa). `cmdk` reste le moteur de la palette ⌘K, habillé coss `command`. | Les stores et contrats e2e existent ; coss fournit des styles, pas des moteurs différents. |
| Confirmations destructives : `AlertDialog` coss via un pattern `ConfirmAction` (mandat-tan), jamais `window.confirm`, jamais un Dialog ordinaire. | Règle mandat-tan et `_copy.md` (« Delete site », pas « Oui »). |
| La landing (`src/landing/`) est **hors périmètre**. | CSS, motion et audit propres (`audit:landing`), plan jumeau du 21/08. Elle ne dépend de `index.css` que par les tokens du contrat shadcn, que coss fournit sous les mêmes noms. |
