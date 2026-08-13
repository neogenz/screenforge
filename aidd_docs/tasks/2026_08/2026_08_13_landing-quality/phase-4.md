---
status: todo
---

# Instruction: code mort, dérives et cohérence FR

## Architecture projection

```txt
apps/web/src/landing/
  components/SpreadDiagram.tsx  🗑 mort (zéro import — Features rend ArtVisual)
  components/ExportSpec.tsx     🗑 mort (idem)
  copy.ts                       ✏️ clés mortes (diagram*/zip*/specRows/proof.label/
                                   pricing.storageLabel), types resserrés
  motion.ts                     ✏️ REVEAL_DURATION_MS / REVEAL_STAGGER_MS morts
  components/ArtVisual.tsx      ✏️ prop priority jamais passée ; srcset (3 webp servis
                                   pleine taille à tous les viewports)
  i18n.ts                       ✏️ branches localStorage/navigator inatteignables
                                   (document.lang toujours posé) — supprimer ou câbler
  components/Pricing.tsx        ✏️ md:px-10 → md:px-14 (retrait des sections sœurs)
  components/Footer.tsx         ✏️ idem
  components/ProofStrip.tsx     ✏️ lg:px-14 vs md:px-14 mélangés (768–1024px décalés)
  components/Nav.tsx            ✏️ italique synthétique du logo (Gloock n'a pas d'italique)
  components/Footer.tsx         ✏️ idem wordmark
  demo/DemoPhoneApp.tsx         ✏️ « Nights », « Goal », « Deep/Light/REM », jours EN
                                   en dur dans la page FR — contre la règle de copy.ts:71-75
```

## Tasks to do

### `1)` Supprimer les morts

> `SpreadDiagram.tsx` et `ExportSpec.tsx` ne sont importés nulle part (grep exhaustif) ; leurs clés de copy, `proof.label`, `pricing.storageLabel`, la prop `priority` d'`ArtVisual`, et `REVEAL_*` de `motion.ts` (dont l'en-tête décrit un stagger qui n'existe pas) meurent avec eux.

1. Supprimer les deux composants, purger `copy.ts` (le type `Copy` garantit la parité EN/FR à la compilation), purger `motion.ts`.

### `2)` i18n : détection morte

> `detect()` (`i18n.ts:17-33`) ne peut jamais dépasser sa première branche : `document.documentElement.lang` est toujours valide (hardcodé en dev, posé par le prerender en prod). `setLang` écrit une préférence que personne ne lit ; un navigateur FR sur `/landing.html` n'est jamais orienté.

1. Choix : supprimer les branches mortes (le document fait foi, documenté), **ou** rediriger au premier chargement selon `navigator.language` quand aucun choix stocké — trancher, puis aligner le code et le commentaire.

### `3)` Dérives visuelles

1. Retraits : `Pricing.tsx:170` et `Footer.tsx:14` `md:px-10` → `md:px-14` (toutes les autres sections) ; `ProofStrip.tsx` unifier `lg:px-14`/`md:px-14`.
2. Italique synthétique : Gloock n'a que le romain (`landing.css:37-43`) — retirer `italic` du logo (`Nav.tsx:88`) et du footer (`Footer.tsx:16`), ou assumer l'oblique navigateur en commentaire.
3. `ArtVisual` : ajouter un `srcset` (les webp 93–245Ko partent entiers sur mobile), garder `loading="lazy"`.

### `4)` L'anglais en dur dans la maquette FR

> `copy.ts:71-75` traduit `appLabel` au motif que « “Last night” sous “Suivez votre sommeil” trahit un gabarit » — mais `DemoPhoneApp.tsx` garde `Nights` (:363), `Goal` (:472), `Deep/Light/REM` (:79-83), `DAYS` (:63-73). « Nights » se rend ~16px : lisible.

1. Passer ces chaînes par `t.demo.*` (a11y intacte : le conteneur est `aria-hidden`, seul l'œil est concerné).

### `5)` Dev-only, consigné

- `/landing-fr.html` 404 en dev : seul le clic simple est intercepté (`LangLink.tsx:21-25`) ; middle-click → 404 Vite. Accepté (le prerender n'existe qu'au build) — un `historyApiFallback` dev vers `landing.html` est possible si ça gêne.

## Validation

- `pnpm run typecheck` : la purge de `copy.ts` compile dans les deux langues.
- `pnpm run build` + revue visuelle des retraits à 800/1200/1600px.
- Page FR : plus un mot anglais lisible dans la maquette téléphone.
