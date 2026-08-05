---
status: done
---

# Instruction: Conversion — pricing, FAQ, CTA final, footer, SEO

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
src/landing/
├── Landing.tsx                 ✏️ assemble pricing + FAQ + CTA final + footer
├── copy.ts                     ✏️ textes pricing/FAQ/footer EN+FR
├── links.ts                    ✏️ cibles checkout provisoires branchées sur les cartes
└── components/
    ├── Pricing.tsx             ✅ 3 offres, Lifetime mise en avant
    ├── Faq.tsx                 ✅ accordéon 4-6 questions (details/summary natif)
    ├── FinalCta.tsx            ✅ une ligne, un bouton
    └── Footer.tsx              ✅ liens, légal, bascule langue
```

## Wireframe

```txt
┌──────────────────────────────────────────────────────────┐
│ (1) Pricing: [Gratuit]  [Mensuel 9,99 $]  [Lifetime 39,99$]│
├──────────────────────────────────────────────────────────┤
│ (2) FAQ: 4-6 questions en accordéon                      │
├──────────────────────────────────────────────────────────┤
│ (3) CTA final: headline courte + bouton unique           │
├──────────────────────────────────────────────────────────┤
│ (4) Footer: logo · liens · légal · EN|FR                 │
└──────────────────────────────────────────────────────────┘
```

1. Pricing : trois offres côte à côte, la Lifetime distinguée par le contraste de valeur (jamais par une couleur) ; prix en tabulaire.
2. FAQ : réponses courtes, ton direct ; accordéon natif accessible au clavier.
3. CTA final : répète la promesse, un seul bouton vers l'app.
4. Footer : discret, liens légaux et contact, rappel de la bascule de langue.

## Tasks to do

### `1)` Pricing à trois offres

> Gratuit (freemium watermark) · Mensuel 9,99 $ · Lifetime 39,99 $ — la valeur monte vers la droite.

1. Carte Gratuit : export limité + watermark (copie exacte dans `copy.ts`) ; CTA « Ouvrir l'app » → `LINKS.app`.
2. Carte Mensuel : 9,99 $/mois, tout débloqué, résiliable ; CTA → `LINKS.checkoutMonthly` (provisoire).
3. Carte Lifetime : 39,99 $ une fois, mises à jour incluses ; distinguée par un fond d'un palier plus clair + libellé « Meilleure valeur », jamais par une couleur chromatique ni un border-left.
4. Prix en `.tabular`, mention « USD » ; sous 900px les cartes empilent, Lifetime en premier sur mobile.
5. Une note sous les cartes : paiement sécurisé à venir / liste d'attente — honnête tant que le checkout n'existe pas.

### `2)` FAQ accordéon

> Lever les quatre freins à l'achat, sans mur de texte.

1. Questions couvrant : ce que le gratuit inclut (watermark), la différence mensuel/lifetime, les dimensions supportées, où vont les images (nulle part), remboursement.
2. `<details>/<summary>` natif stylé : focus-visible visible, chevron Lucide animé en transform, ouverture animée via `grid-template-rows`.
3. Réponses ≤ 3 phrases, aucune redite du pricing.

### `3)` CTA final + footer

> Terminer sans friction : une phrase, un bouton, des liens.

1. `FinalCta` : headline courte reprenant la promesse du hero + CTA primaire unique vers `LINKS.app`.
2. `Footer` : logo, contact (`LINKS.contact`), mentions légales (pages prévues, liens provisoires), toggle EN|FR rappelé.
3. Footer discret : hairline en séparation, texte encre secondaire, pas de fond contrasté.

### `4)` SEO & partage

> La page doit se vendre fermée : meta, OG, JSON-LD.

1. Meta title/description par langue (bascule au toggle), canonical, `hreflang` EN/FR si les URLs le permettent, sinon documenté comme limite.
2. OG/Twitter cards : image `public/og-landing.png` (placeholder admis, remplacée en phase 4).
3. JSON-LD `SoftwareApplication` avec les deux offres (9,99 USD/mois, 39,99 USD one-time) injecté en dur dans `landing.html`.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                       |
| ---- | --------------------------------------------------------------------------------------------------------- |
| 1    | Les trois offres sont lisibles dans les deux langues ; la Lifetime se distingue sans couleur ; CTAs câblés sur `links.ts` |
| 2    | La FAQ s'ouvre au clavier, un seul item ouvert à la fois n'est pas exigé, le focus reste visible          |
| 3    | La page se termine par un CTA unique ; le footer n'offre aucun bouton primaire                             |
| 4    | Le validateur JSON-LD reconnaît `SoftwareApplication` avec deux `Offer` ; l'aperçu OG affiche titre + image |
