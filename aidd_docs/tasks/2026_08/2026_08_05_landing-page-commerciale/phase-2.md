---
status: pending
---

# Instruction: Sections éditoriales — nav, hero, preuve, features

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
src/landing/
├── Landing.tsx                 ✏️ assemble nav + sections éditoriales
├── copy.ts                     ✏️ textes nav/hero/preuve/features EN+FR
├── components/
│   ├── Nav.tsx                 ✅ barre sticky, ancres, toggle langue, CTA
│   ├── Hero.tsx                ✅ headline + CTAs + visuel produit
│   ├── ProofStrip.tsx          ✅ arguments chiffrés (tabular)
│   └── Features.tsx            ✅ 2 features éditoriales + bandeau local-first
└── assets/                     ✅ visuels réels exportés de l'app (placeholders admis ici)
```

## Wireframe

```txt
┌──────────────────────────────────────────────────────────┐
│ (1) Nav: logo · Features · Pricing · FAQ · EN|FR · CTA    │
├──────────────────────────────────────────────────────────┤
│ (2) Hero: headline · sous-titre · CTA primaire · CTA 2e  │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ (3) Visuel produit: planche d'écrans exportée réelle  │ │
│ └──────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────┤
│ (4) Preuve chiffrée: dimensions exactes · zéro backend   │
├──────────────────────────────┬───────────────────────────┤
│ (5) Feature majeure: éditeur │ (6) Export pixel-exact    │
│     visuel + texte           │     visuel + texte        │
├──────────────────────────────┴───────────────────────────┤
│ (7) Bandeau: 100% local, vos images restent chez vous    │
└──────────────────────────────────────────────────────────┘
```

1. Nav : fine, sticky, fond matérialisé au scroll ; le toggle EN/FR y vit.
2. Hero : aligné gauche, asymétrique ; headline Inter extra-bold fluide (`clamp`), une seule phrase de valeur.
3. Visuel : vraie planche d'écrans exportée — la preuve produit immédiate.
4. Preuve : 1320×2868 pixel-exact, PNG-24, zéro upload — chiffres tabulaires, sans carte.
5. Feature éditeur : texte gauche, visuel débordant la grille.
6. Feature export : ZIP → App Store Connect, composition inversée.
7. Bandeau local-first : l'argument anti-abonnement, pleine largeur, sans icône décorative.

## Tasks to do

### `1)` Nav sticky

> Orientation permanente : ancres, langue, CTA « Ouvrir l'app ».

1. Barre `h-12` sticky, transparente au sommet, fond `--color-panel` + hairline après scroll (IntersectionObserver ou listener throttlé).
2. Logo ScreenForge, ancres Features/Pricing/FAQ, toggle EN|FR (deux boutons, état actif visible), CTA primaire vers `LINKS.app`.
3. Menu replié sous 768px (aucun lien masqué, tous accessibles).

### `2)` Hero asymétrique

> La proposition de valeur en une phrase, la preuve en une image.

1. Headline fluide `clamp(2.5rem, 6vw, 4.5rem)`, Inter 800, tracking serré, alignée gauche ; sous-titre 1-2 phrases, `max-width 65ch`.
2. CTA primaire (remplie, neutre clair sur sombre) « Ouvrir l'app gratuitement » + CTA secondaire (ghost) « Voir les tarifs » → `#pricing`.
3. Visuel produit sous le texte : planche d'écrans réelle exportée, légèrement décalée hors grille ; placeholder admis à cette phase, remplacé en phase 4.
4. Interdits impeccable : pas de gradient text, pas de glassmorphism, pas d'icône géante arrondie.

### `3)` ProofStrip chiffrée

> Les trois nombres qui vendent, en tabulaire, sans carte ni icône.

1. Trois métriques : `1320×2868` (pixel-exact 6.9"), `PNG-24` (validation App Store), `0 upload` (local-first).
2. Chiffres en `.tabular` grande taille, libellé court dessous ; séparation par hairlines, jamais de cartes.
3. Rangée → colonne sous 768px.

### `4)` Features éditoriales

> Deux blocs alternés brisant la grille + un bandeau, pas de grille de cartes identiques.

1. Bloc éditeur (texte gauche / visuel débordant) : calques, devices iPhone officiels, fonds et dégradés, planche de 10 écrans.
2. Bloc export (inversé) : dimensions exactes `lib/dimensions.ts`, ZIP par dimension, validation App Store Connect.
3. Bandeau local-first pleine largeur : les images ne quittent jamais la machine, aucun compte requis.
4. Copy dans `copy.ts` EN+FR, ton précis et confiant (voix de marque), zéro superlatif creux.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------ |
| 1    | La nav reste visible au scroll, matérialise un fond après le hero, toutes ses ancres atteignent leur section |
| 2    | Le hero tient en un viewport desktop, CTA primaire unique, aucun texte en gradient, visuel non générique     |
| 3    | Les trois métriques s'affichent en chiffres tabulaires alignés, contrastes ≥ 4,5:1                           |
| 4    | Les deux blocs features alternent leur composition et le bandeau est pleine largeur ; aucune carte en grille |
