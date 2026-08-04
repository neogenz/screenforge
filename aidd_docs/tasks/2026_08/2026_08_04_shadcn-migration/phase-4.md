---
status: done
---

<!-- Fill or omit these sections; never add, rename, or reorder one. -->

# Instruction: Toast, palette ⌘K et spécifiques

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── package.json                     ✏️ -radix-ui packages inutilisés éventuels (ménage final)
└── src/
    ├── App.tsx                      ✏️ Overlays : Toaster sonner + palette cmdk montés à la racine
    ├── stores/toast.store.ts        ✏️ adaptateur fin sur sonner (toast() fire-and-forget conservé)
    ├── lib/commands.ts              ✏️ registre branché sur cmdk (inchangé côté API)
    └── components/ui/
        ├── toast.tsx                ❌ ToastViewport custom remplacé par sonner
        ├── command-palette.tsx      ✏️ rebuilt sur cmdk (fuzzy natif, groupes, role listbox/option)
        ├── number-field.tsx         ✏️ re-stylé aux tokens shadcn (comportement scrub inchangé — exception assumée)
        ├── swatch-button.tsx        ✏️ rebuilt comme variante de Button (pastille damier conservée — exception assumée)
        └── kbd.tsx                  ✏️ re-stylé aux tokens shadcn (conservé, trivial)
```

## User Journey

```mermaid
flowchart TD
  A[sonner + cmdk installés phase 1] --> B[toast() même signature, rendu sonner]
  B --> C[Palette ⌘K sur cmdk, même registre de commandes]
  C --> D[NumberField/SwatchButton re-stylés, comportements intacts]
  D --> E[Suite e2e complète + release OK]
```

## Tasks to do

### `1)` Remplacer ToastViewport par sonner

> Garder l'appel `toast(message, tone?)` partout, changer seulement le moteur.

1. `toast.store.ts` devient un adaptateur : `toast()` appelle sonner (`toast.success/error/info`), même signature
2. `App.tsx` : `<Toaster />` sonner (position, thème dark/light via tokens, durée 3500ms) remplace `ToastViewport`
3. Vérifier le contrat e2e : les toasts sonner exposent `role="status"` ; sinon ajouter `toastOptions={{ role: 'status' }}` / ajuster les specs

### `2)` Rebasculer CommandPalette sur cmdk

1. `command-palette.tsx` : `Command.Dialog` cmdk avec `open/onClose` ; registre `lib/commands.ts` inchangé ; groupes par section ; `role="dialog"` nommé « Palette de commandes » et items `role="option"` conservés
2. Nav clavier, ⌘K et coalescing d'historique (nudge burst) non régressés

### `3)` Re-styler les exceptions custom

1. `number-field.tsx` : aucun changement de comportement (scrub, seuil 3px, ⇧/⌥, Échap, ↑↓) — uniquement tokens/shadcn styling
2. `swatch-button.tsx` : basé sur Button shadcn, pastille 32px + `.checkerboard` + ring de sélection sans décalage layout
3. `kbd.tsx` : tokens shadcn
4. Ménage : retirer les imports/deps orphelins, `pnpm run test:release` complet (unit + typecheck + lint + build + e2e + contrast)

## Test acceptance criteria

<!-- Each criterion is an observable behavior, not a command. -->

| Task | Acceptance criteria                                                                                                    |
| ---- | ---------------------------------------------------------------------------------------------------------------------- |
| 1    | `getByRole('status')` voit toujours « Enregistré », « Projet importé. », « Archive projet invalide. » (e2e verts)       |
| 2    | ⌘K ouvre `getByRole('dialog', { name: 'Palette de commandes' })`, l'option « Ajouter un texte » s'exécute ; une rafale de flèches = 1 undo (e2e command-palette vert) |
| 3    | Les champs `getByLabel('Position X'/'Largeur'/'Rotation')` scrubbent et commitent sans dérive (e2e canvas-transforms vert) ; `pnpm run test:release` passe en entier |
