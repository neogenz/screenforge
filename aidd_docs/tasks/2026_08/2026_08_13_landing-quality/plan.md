---
objective: "La landing publie exactement ce que le produit tient, dans les deux langues et pour tous les lecteurs : métadonnées prerendues justes, WCAG tenu au clavier comme au tactile, démo qui honore ses propres commentaires, et zéro code mort."
status: proposed
---

# Plan: qualité landing — SEO, a11y, démo, cohérence

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Corriger les défauts prouvés par l'audit du 2026-08-13 (trois agents code + passe live dev/prod 320→1600px) : 1 bloquant SEO, ~12 sérieux, ~24 mineurs sur `apps/web/src/landing/`, `landing.html`, `scripts/prerender-landing.mjs` |
| **Source** | Demande utilisateur du 2026-08-13 ; audit complet en fin de session (rapports des trois agents dans la conversation) ; captures live des états 320px/375px/1600px, EN dev et FR prerendu |

## Phases

| # | Phase | File |
| --- | --- | --- |
| 1 | Métadonnées prerendues justes et complètes | [`phase-1.md`](./phase-1.md) |
| 2 | WCAG tenu : nav, contraste, mouvement, ordre | [`phase-2.md`](./phase-2.md) |
| 3 | La démo honore ses propres commentaires | [`phase-3.md`](./phase-3.md) |
| 4 | Code mort, dérives et cohérence FR | [`phase-4.md`](./phase-4.md) |

## Resources

| Source | Verified |
| --- | --- |
| `apps/web/dist/landing-fr.html` après `pnpm run build` | Preuve du bloquant : `og:description` FR mais `<meta name="description">` restée EN |
| Passe live 320px | Burger rogné au bord droit, `overflow-x: clip` interdit de l'atteindre |
| https://developers.google.com/search/docs/specialty/international/localized-versions | hreflang exige des URLs pleinement qualifiées |
| https://ogp.me/ | `og:locale` au format `language_TERRITORY` ; `og:image` absolue |
| https://www.w3.org/WAI/WCAG21/Techniques/failures/F16 | Le marquee auto sans mécanisme de pause fourni par la page est un échec 2.2.2, `prefers-reduced-motion` n'en tient pas lieu |
| MDN IntersectionObserver | `isIntersecting` est vrai dès le premier pixel ; le seuil se lit dans `intersectionRatio` |

## Decisions

| Decision | Why |
| --- | --- |
| URLs absolues (hreflang, canonical, og:image, og:url) paramétrées par une env `SITE_ORIGIN` du prerender, avec le relatif conservé en fallback dev | Le domaine n'est pas encore arrêté ; le jour où il l'est, une variable suffit et rien n'est recopié en dur dans quatre balises |
| Marquee : bouton pause visible au focus/survol de la bande, en plus de `prefers-reduced-motion` | F16 : l'OS ne tient pas lieu de mécanisme fourni par la page ; le bouton n'apparaît que là où le mouvement est |
| Les ancres de nav (L'éditeur/Tarifs/FAQ) s'affichent inline dès que la barre a la place, le burger reste sous le seuil | La règle est déjà écrite dans le commentaire du CTA de `Nav.tsx:115-117` et appliquée au seul CTA ; on l'applique aux ancres au lieu d'inventer autre chose |
| Démo : corriger S1 (ratio) + S3 (cancelled) en priorité, puis S2 (rebuild) via un ref `builtOnce` | Ces trois-là couvrent la moitié des symptômes visibles à eux seuls ; le reste suit |
| Les composants morts (`SpreadDiagram`, `ExportSpec`) sont supprimés, pas réactivés | `Features.tsx` rend `ArtVisual` à leur place depuis leur remplacement ; un composant mort et sa copy sont un coût de lecture sans rendu |
| « Prices in USD, tax included » : à vérifier contre la config Polar avant tout lancement indexable, reformuler si non tenu | Affichage TTC opposable (consommateurs UE) ; rien dans le repo ne prouve que le checkout est TTC — `plans.ts:11` dit que le prix est fixé chez Polar |

## Découvertes hors périmètre (déjà actées ailleurs)

- Le dialogue campagne (retour de sous-vue en bas à droite, brief dense) a été corrigé directement en session le 2026-08-13 : `back` en haut à gauche dans la primitive `Dialog`, rangée `AssistantRow` de navigation, champs modèle déplacés dans la sous-vue, métas de sections retirées.
- `/landing-fr.html` est un 404 en dev (seul le clic simple est intercepté par `LangLink`) : accepté, dev uniquement, documenté dans phase-4.
