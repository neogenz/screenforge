---
status: done
---

# Instruction: Finition impeccable — visuels réels, motion, audits, anti-slop

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
public/
├── og-landing.png              ✅ image OG finale (planche exportée recadrée)
└── landing/                    ✅ visuels réels : planche, éditeur, export ZIP
src/landing/
├── components/                 ✏️ branche les visuels finaux, ajoute les reveals
├── motion.ts                   ✅ tokens de reveal (stagger, ease-out expo, reduced-motion)
└── Landing.tsx                 ✏️ orchestration du reveal initial
scripts/
└── landing-audit.mjs           ✅ contraste + bans impeccable (gradient text, border-stripe)
package.json                    ✏️ script audit:landing
```

## Tasks to do

### `1)` Visuels réels du produit

> Remplacer chaque placeholder par une capture véritable — l'anti-slop décisif.

1. Produire dans l'app une planche de 10 écrans soignée, l'exporter, recadrer pour le hero (`public/landing/hero.png`, densité 2×).
2. Capturer l'éditeur en session réelle (bloc feature) et le dialogue d'export / ZIP (bloc export) ; thème sombre, contenu coloré — la seule couleur de la page vient du produit.
3. Découper `public/og-landing.png` (1200×630) depuis la planche hero ; vérifier le poids (< 300 ko par image, compression sans banding sur les dégradés).

### `2)` Motion d'ensemble

> Un reveal orchestré au chargement, rien de dispersé ensuite.

1. `motion.ts` : ease-out expo 160–240ms, transform/opacity uniquement, stagger 60–90ms sur hero puis sections.
2. Reveal au scroll via IntersectionObserver (une seule fois par section, seuil ~0,2), jamais d'animation au scroll continu (pas de parallaxe).
3. `prefers-reduced-motion` : tout devient des fades courts ; le contenu n'est jamais invisible sans JS.
4. Chevron FAQ et hover states en 120–160ms, cohérents avec la grammaire de l'app.

### `3)` Audit anti-slop et accessibilité

> Les interdits impeccable et le contraste sont vérifiés par script, pas à l'œil.

1. `scripts/landing-audit.mjs` : scan du CSS/rendu pour `background-clip: text`, `border-left/right` > 1px colorés, glassmorphism décoratif (`backdrop-filter` hors nav), icônes emoji ; échec = code 1.
2. Vérifier le contraste de chaque paire encre/surface de la landing ≥ 4,5:1 (réutiliser la mécanique de `scripts/contrast-audit.mjs`).
3. Script `audit:landing` dans `package.json`, branché sur `test:release` si le coût est nul.
4. Revue manuelle finale contre la checklist impeccable : hiérarchie typographique ≥ 1,25, longueur de ligne ≤ 75ch, une seule couleur d'accent, aucune carte imbriquée.

### `4)` Passe bilingue et responsive finale

> Les deux langues et toutes les largeurs reçoivent la même finition.

1. Relire chaque chaîne FR et EN : longueur comparable (le FR court ~15% plus long), aucun débordement de CTA, césures propres.
2. Vérifier 320 / 768 / 1024 / 1440px : hero en un viewport desktop, pricing empilé Lifetime d'abord sur mobile, aucune fonctionnalité masquée.
3. Vérifier `<html lang>`, titre et description basculés ; re-tester le toggle après navigation par ancres.
4. `npm run lint && npm run typecheck && npm run build` propres ; `dist/landing.html` autonome.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                        |
| ---- | ---------------------------------------------------------------------------------------------------------- |
| 1    | Aucun placeholder ne subsiste ; chaque visuel est une capture/export réel de l'app ; OG 1200×630 valide    |
| 2    | Le chargement joue un reveal unique orchestré ; aucune animation en reduced-motion ; zéro parallaxe        |
| 3    | `audit:landing` passe ; la checklist impeccable ne relève aucun ban ; contrastes ≥ 4,5:1 partout           |
| 4    | EN et FR rendent sans débordement aux quatre largeurs ; lint, typecheck et build sont propres              |
