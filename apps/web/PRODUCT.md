# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Le premier utilisateur est un développeur iOS indépendant qui prépare seul les captures App Store de ses applications. Il travaille dans un navigateur desktop, pendant des sessions concentrées, souvent le soir. Son travail consiste à transformer des captures réelles de simulateur en une planche cohérente de dix écrans au maximum, puis à livrer des fichiers acceptés par App Store Connect.

La landing s’adresse au même utilisateur avant l’ouverture de l’éditeur. Elle doit lui permettre de comprendre rapidement ce qui est gratuit en Local, ce que Cloud ajoute et pourquoi ScreenForge réduit le travail manuel sans compromettre l’exactitude.

## Product Purpose

ScreenForge permet de composer, localiser, vérifier et exporter des captures App Store iPhone depuis un seul éditeur visuel. Le canvas, les aperçus et l’export partagent le même système de coordonnées afin que le ZIP livré corresponde exactement à ce qui a été composé.

Le produit réussit lorsque l’utilisateur peut partir de captures réelles, construire une série cohérente, exporter des PNG opaques au format Apple attendu et remettre le ZIP sans correction manuelle dans Figma, Sketch ou un autre service.

## Positioning

ScreenForge est local-first par mécanisme, pas seulement par promesse. L’éditeur Local est complet, gratuit, fonctionne sans compte ni backend et conserve les projets et images sur la machine. Cloud est un service managé optionnel à 39 USD par an : il ajoute un compte, la synchronisation, le stockage distant des projets, images et réglages, ainsi que les sauvegardes. Il ne débloque aucune capacité d’édition ou d’export.

La seconde différence durable est l’exactitude de bout en bout : ScreenForge compose et rend directement à la cible Apple plutôt que d’agrandir une image intermédiaire après coup.

## Operating Context

Le parcours principal de l’éditeur est :

1. ouvrir ou créer un projet local ;
2. importer des captures de simulateur et, si souhaité, des Apple Product Bezels fournis par l’utilisateur ;
3. composer jusqu’à dix écrans avec textes, appareils, images, formes, icônes, arrière-plans et gabarits ;
4. maintenir la cohérence de la planche, préparer les variantes localisées et figer une release ;
5. vérifier puis exporter des PNG ou un ZIP pour App Store Connect.

Local travaille depuis IndexedDB et reste fonctionnel hors ligne. Un compte Cloud actif peut recopier les projets, images sources et réglages vers Convex pour les reprendre sur une autre machine ; la copie locale reste celle sur laquelle l’utilisateur travaille. Toute écriture Cloud est autorisée côté serveur à partir de la session et du droit actif.

La landing est une surface bilingue français/anglais, pré-rendue pour chaque langue. Elle explique la proposition Local/Cloud, montre une démonstration interactive de l’éditeur, expose les spécifications d’export et conduit soit à l’éditeur gratuit, soit au choix de Cloud.

## Capabilities and Constraints

- iPhone uniquement ; aucun export iPad, Apple Watch, Mac ou Apple TV.
- Profil de production unique : portrait 6,9 pouces, 1320×2868px, de un à dix écrans.
- Export PNG 24 bits, opaque, sRGB, aux dimensions exactes ; objectif inférieur à 5 Mo par image.
- Export individuel ou ZIP groupé, sans plafond, filigrane, paywall ni contrôle de droit en Local.
- Calques texte, appareil, image, forme et icône ; arrière-plans, dégradés, gabarits, sélection multiple, historique, raccourcis, guides et édition par propriétés.
- Projets et actifs binaires persistés localement ; les calques référencent des `assetId` courts plutôt que des données inline.
- Localisations de texte, campagnes multi-écrans, releases figées et vérification avant export.
- Cadres iPhone générés inclus. Les Apple Product Bezels officiels restent optionnels, importés et stockés localement par l’utilisateur ; aucun actif Apple officiel n’est distribué par ScreenForge.
- Cloud coûte 39 USD par an, taxes comprises selon la landing actuelle. Un compte et un droit Cloud serveur actif sont requis pour la synchronisation.
- Après l’arrêt de Cloud, les copies locales restent éditables et exportables ; les données distantes restent lisibles et supprimables, mais les nouvelles synchronisations s’arrêtent.
- L’interface de l’éditeur est en français. La landing et ses métadonnées publiques existent en français et en anglais.

## Brand Commitments

Le nom du produit est **ScreenForge**. La voix est précise, dense et confiante : un instrument de travail qui nomme les contraintes, les résultats et les conséquences sans superlatif décoratif.

Les engagements de langage suivants sont durables :

- dire « Local » pour l’éditeur gratuit sur la machine et « Cloud » pour le service managé annuel ;
- présenter exactement deux offres autonomes, sans essai, faux plan intermédiaire ou achat de Local ;
- annoncer l’exactitude, la gratuité et les capacités uniquement lorsqu’elles sont démontrées par le produit ou ses tests ;
- écrire l’éditeur en français concis et maintenir une landing française et anglaise équivalente ;
- ne jamais laisser entendre que Cloud est nécessaire à l’édition, à l’export propre ou au ZIP.

## Evidence on Hand

- Spécification produit et règles d’export : `../../PRD.md`.
- Vérité commerciale et copie bilingue : `src/landing/copy.ts` et `landing.html`.
- Démonstration interactive de l’éditeur : `src/landing/demo/`.
- Illustrations de production : `public/landing/art-exact-export.webp`, `public/landing/art-forge-core.webp`, `public/landing/art-ten-screen-set.webp` et `public/og-landing.png`.
- Validation de l’export exact et opaque : `e2e/export.spec.ts` et `../../scripts/export-probe.mjs`.
- Validation de la landing, de ses offres et de ses parcours : `e2e/landing.spec.ts` et `src/lib/__tests__/landing-copy.test.ts`.
- Contrat de dimensions partagé : `../../packages/project-format/src/` et `src/lib/dimensions.ts`.
- Aucun témoignage client, logo client, prix reçu, chiffre d’adoption, benchmark public ou citation de presse n’est actuellement disponible ; les travaux futurs ne doivent pas en fabriquer.

## Product Principles

1. **Local est complet.** La valeur fondamentale de l’éditeur et de l’export ne dépend jamais d’un compte, d’une connexion ou d’un abonnement.
2. **L’exactitude est une fonctionnalité.** Une capture presque correcte est incorrecte si App Store Connect la refuse ou si l’export dérive du canvas.
3. **La planche est l’unité de travail.** ScreenForge optimise la cohérence et les opérations sur l’ensemble des dix écrans, pas seulement l’édition d’un écran isolé.
4. **Cloud reste additif.** Le service payant vend l’exploitation continue du compte, de la synchronisation, du stockage et des sauvegardes, jamais la suppression d’une limitation artificielle de Local.
5. **La preuve précède la promesse.** La landing et l’éditeur ne formulent que des capacités, prix et garanties soutenus par le code, les actifs ou les tests disponibles.

## Accessibility & Inclusion

Les deux surfaces doivent rester utilisables au clavier, conserver un focus visible, respecter `prefers-reduced-motion` et offrir des noms accessibles aux contrôles icônes. Les couples texte/surface du chrome doivent maintenir au moins 4,5:1 de contraste. Les dialogues piègent puis restaurent le focus, et les états de sauvegarde, synchronisation, erreur et chargement restent annoncés sans dépendre uniquement de la couleur.

La landing française et anglaise doit préserver la même information commerciale et fonctionnelle dans les deux langues, y compris le prix, les limites, les conditions de Local et les conséquences d’un arrêt de Cloud.
