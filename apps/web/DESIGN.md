---
name: ScreenForge
description: Éditeur local-first de captures App Store, précis, dense et discret.
colors:
  stage: "oklch(0.145 0 0)"
  background: "oklch(0.175 0 0)"
  card: "oklch(0.215 0 0)"
  popover: "oklch(0.215 0 0)"
  muted: "oklch(0.165 0 0)"
  secondary: "oklch(0.26 0 0)"
  accent: "oklch(0.3 0 0)"
  foreground: "oklch(0.97 0 0)"
  muted-foreground: "oklch(0.78 0 0)"
  primary: "oklch(0.97 0 0)"
  primary-foreground: "oklch(0.145 0 0)"
  border: "oklch(0.26 0 0)"
  input: "oklch(0.36 0 0)"
  marker: "oklch(0.87 0.2 124)"
  marker-hover: "oklch(0.92 0.2 124)"
  marker-ink: "oklch(0.24 0.05 124)"
  marker-soft: "oklch(0.87 0.2 124 / 0.11)"
  marker-line: "oklch(0.87 0.2 124 / 0.55)"
  destructive: "oklch(0.64 0.18 25)"
  success: "oklch(0.65 0.12 155)"
  warning: "oklch(0.72 0.11 75)"
  artboard-ring: "oklch(1 0 0 / 0.1)"
  artboard-shadow: "oklch(0 0 0 / 0.5)"
  selection-soft: "oklch(0.97 0 0 / 0.14)"
  guide: "oklch(0.97 0 0 / 0.85)"
  guide-halo: "oklch(0 0 0 / 0.4)"
typography:
  panel-title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "20px"
    letterSpacing: "-0.014em"
    fontFeature: "'cv05' 1, 'cv08' 1, 'ss03' 1"
  section-title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: "20px"
    letterSpacing: "-0.006em"
    fontFeature: "'cv05' 1, 'cv08' 1, 'ss03' 1"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
    letterSpacing: "0"
    fontFeature: "'cv05' 1, 'cv08' 1, 'ss03' 1"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: "16px"
    letterSpacing: "0"
    fontFeature: "'cv05' 1, 'cv08' 1, 'ss03' 1"
rounded:
  xs: "6px"
  sm: "9px"
  md: "12px"
  lg: "15px"
  xl: "21px"
  full: "9999px"
spacing:
  "1": "4px"
  "1.5": "6px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "6": "24px"
  "8": "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "36px"
  button-default:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "36px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "36px"
  field:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "32px"
  island:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    padding: "9px"
  dialog:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    padding: "24px"
  marker-badge:
    backgroundColor: "{colors.marker}"
    textColor: "{colors.marker-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 4px"
    height: "16px"
  screen-thumbnail:
    backgroundColor: "{colors.muted}"
    rounded: "{rounded.md}"
    height: "116px"
    width: "53px"
---

# Design System: ScreenForge

## Overview

**Creative North Star: "L’Instrument de Précision"**

ScreenForge est un outil de composition, pas un dashboard. Son chrome dense flotte au-dessus du travail puis s’efface derrière les planches. La précision vient d’une hiérarchie mesurée, de contrôles compacts et d’états sans ambiguïté, jamais d’une décoration ajoutée.

Le système est dark-first parce que l’éditeur s’utilise surtout sur desktop pendant des sessions concentrées, souvent le soir. Les surfaces restent strictement achromatiques afin de ne pas contaminer le jugement des couleurs exportées. Le citron n’est ni une marque publicitaire ni un appel à l’action : il indique exclusivement « vous êtes ici ».

**Key Characteristics:**

- Chrome monochrome, compact et flottant.
- Un seul pigment réservé à l’état courant et au focus.
- Profondeur obtenue par niveaux de luminance, puis par bordures, puis par ombres.
- Typographie Inter unique, hiérarchisée par taille et poids.
- Interface française, concise et opératoire.

## Colors

La palette oppose un graphite achromatique à un unique citron de repérage. Le thème sombre est normatif dans le frontmatter ; le thème clair conserve les mêmes rôles avec une scène presque blanche et des îlots blancs.

### Primary

- **Citron de repérage** (`marker`) : écran courant, calque sélectionné, outil actif, coche et focus. Son encre dédiée (`marker-ink`) est la seule encre autorisée sur cet aplat.
- **Action pleine neutre** (`primary`) : action principale d’une surface, notamment Exporter. Elle ne concurrence jamais le repère citron.

### Secondary

- **Relief neutre** (`secondary`) : boutons au repos, options actives et vignettes sans contenu.
- **Survol neutre** (`accent`) : survols shadcn et états transitoires sans signification de localisation.

### Tertiary

- **Rouge destructif** (`destructive`) : erreurs et actions irréversibles seulement.
- **Vert de résultat** (`success`) et **ambre d’attention** (`warning`) : verdicts fonctionnels, jamais décoration.

### Neutral

- **Scène graphite** (`stage`) : sol le plus sombre, derrière les artboards.
- **Panneau** (`card`) et **creux** (`muted`) : un champ est plus sombre que le panneau qui le porte.
- **Encre principale** (`foreground`) et **encre secondaire** (`muted-foreground`) : texte et métadonnées, avec un contraste minimal de 4,5:1.
- **Structure** (`border`, `input`) : séparation au repos puis bordure renforcée au survol.
- **Chrome d’artboard** (`artboard-ring`, `artboard-shadow`, `selection-soft`, `guide`, `guide-halo`) : toujours neutre pour ne pas altérer la lecture du contenu.

### Named Rules

**The One Marker Rule.** Le citron dit uniquement « ici ». Il ne colore jamais une action, un décor ou le bord d’un artboard.

**The True Neutral Rule.** Toute surface voisine du contenu reste à chroma zéro, dans les deux thèmes.

## Typography

**Display Font:** Inter Variable (with ui-sans-serif fallback)
**Body Font:** Inter Variable (with ui-sans-serif fallback)

**Character:** Une seule famille optique, sobre et serrée, avec les variantes `cv05`, `cv08` et `ss03`. La hiérarchie vient d’écarts francs de taille et de poids ; les valeurs numériques utilisent les chiffres tabulaires d’Inter plutôt qu’une seconde police mono.

### Hierarchy

- **Panel title** (Inter, weight 600, 16px, line-height 20px): titre principal d’un drawer ou d’une boîte.
- **Section title** (Inter, weight 600, 14px, line-height 20px): découpe les groupes de propriétés sans capitale trackée.
- **Body** (Inter, weight 400, 14px, line-height 20px): libellés d’actions, valeurs et texte fonctionnel.
- **Label** (Inter, weight 500, 11px, line-height 16px): micro-libellés de champs et métadonnées, toujours en casse normale.

### Named Rules

**The Three-Level Rule.** Un panneau utilise panneau, section et libellé ; aucun échelon intermédiaire ne doit aplatir la hiérarchie.

**The Tabular Rule.** Toute valeur numérique qui peut changer de largeur active les chiffres tabulaires.

## Layout

Le canvas est full-bleed. Une barre unique de 50px, les drawers et la pellicule flottent avec une marge de 12px ; ils réservent de l’espace au cadrage sans déplacer l’artboard à leur ouverture. Les drawers Calques et Propriétés mesurent respectivement 280px et 320px, mais se bornent toujours à la largeur de la fenêtre.

La grille spatiale part de 4px et privilégie 6px pour lier, 8px pour séparer, 12px pour isoler et 24px pour les retraits de modal. Le filmstrip n’est pas un îlot : les aperçus sont les surfaces et restent au rapport réel 1320×2868.

Le comportement responsive protège l’opération plutôt que la composition décorative : la pellicule s’ancre à gauche sous 361px, les boîtes à deux colonnes s’empilent sous 612px, les outils de création se replient sous 640px, les drawers deviennent exclusifs sous 876px et les actions secondaires se replient sous 1280px. Aucun contrôle critique ne disparaît ; il change de contenant.

**The Ten-Screen Rule.** L’unité de travail est la planche de dix écrans. Tout geste répétitif dix fois doit avoir un équivalent « pour tous les écrans ».

## Elevation & Depth

La profondeur est hybride : les écarts de luminance portent la structure, les bordures confirment les limites et les ombres sont réservées aux surfaces réellement flottantes. Les champs descendent grâce à un fond en creux et une ombre interne ; les îlots, menus et modales montent selon trois niveaux seulement.

### Shadow Vocabulary

- **Island** (`0 1px 1px oklch(0 0 0 / 0.3), 0 6px 16px -6px oklch(0 0 0 / 0.4), 0 24px 48px -24px oklch(0 0 0 / 0.55)`): barre, drawer et autres îlots persistants.
- **Menu** (`0 2px 6px oklch(0 0 0 / 0.24), 0 12px 32px -10px oklch(0 0 0 / 0.45), 0 32px 64px -32px oklch(0 0 0 / 0.6)`): popover, menu et palette au-dessus du chrome.
- **Modal** (`0 8px 24px -8px oklch(0 0 0 / 0.4), 0 40px 96px -24px oklch(0 0 0 / 0.65)`): boîte bloquante au-dessus du voile.
- **Contact** (`0 1px 3px oklch(0 0 0 / 0.4)`): poignée ou vignette courante qui se détache localement.
- **Inset** (`box-shadow: inset 0 1px 0 oklch(0 0 0 / 0.35)`): creux d’un champ.

**The Earned Depth Rule.** Une ombre n’existe que si une surface flotte ou se détache physiquement ; un panneau statique se sépare d’abord par sa matière.

## Shapes

Les rayons forment une chaîne fermée de 6, 9, 12, 15 et 21px dérivée d’une seule base. Les contrôles utilisent principalement 12px, les menus 15px et les îlots ou modales 21px. Le rayon intérieur reste égal au rayon extérieur moins le retrait ; un îlot de 21px avec 9px de retrait reçoit donc un contrôle de 12px.

Les pastilles, switches et swatches utilisent le plein rayon parce que leur silhouette est sémantiquement circulaire. Les vignettes étroites restent à 12px : un rayon d’îlot les transformerait en gélules.

**The Nested Radius Rule.** Rayon intérieur = rayon extérieur − retrait. Ne choisissez jamais les trois valeurs indépendamment.

## Components

### Buttons

- **Shape:** contrôles compacts de 32, 36 ou 40px, rayon médian.
- **Primary:** aplat neutre inversé, une seule action principale par surface.
- **Default:** relief neutre avec bordure structurelle.
- **Ghost / Icon:** transparent au repos, encre secondaire, survol neutre ; tout bouton icône porte un nom accessible et une infobulle.
- **Hover / Focus:** transitions couleur et bordure en 150ms ; focus citron visible, état désactivé à opacité réduite, chargement avec libellé conservé.

### Cards / Containers

- **Islands:** panneau, bordure, rayon large et élévation basse ; la barre et les drawers utilisent ce modèle.
- **Modal:** même matière avec élévation forte, voile, focus piégé et retour du focus.
- **Filmstrip:** aucun conteneur décoratif ; les vignettes portent elles-mêmes la structure.

### Inputs / Fields

- **Style:** surface en creux, bordure, rayon de contrôle, hauteur 32px.
- **Grammar:** les contrôles d’une ligne portent leur libellé dans le champ ; seuls les contrôles composites ou multilignes empilent un libellé.
- **Focus:** bordure et anneau citron sur le contrôle complet.
- **Numbers:** champ scrubbable sur toute la surface, saisie clavier et chiffres tabulaires.
- **Error / Disabled:** erreur par la bordure destructive, jamais par un fond rouge ; désactivation explicite sans interaction.

### Navigation

La TopBar réunit identité du projet, outils de création, états de sauvegarde et Exporter. Les outils utilisent des boutons icônes neutres ; les groupes sont séparés par l’espace et un filet, jamais par un rail décoratif. Sous les seuils mesurés, les mêmes commandes passent dans le menu secondaire.

### Screen Thumbnail

L’aperçu respecte le rapport d’export et ne contient aucun chrome superposé. Le rang se place au-dessus, le nom au-dessous. L’écran courant se soulève légèrement, prend une ombre de contact et reçoit l’unique badge citron ; la sélection secondaire reste neutre.

## Do's and Don'ts

### Do:

- **Do** garder toutes les surfaces de chrome à chroma zéro.
- **Do** réserver le citron à l’état courant et au focus.
- **Do** utiliser les primitives partagées et leurs variantes CVA avant toute classe de contrôle locale.
- **Do** conserver des états hover, active, disabled, focus-visible, loading et invalid lisibles.
- **Do** écrire toute l’interface en français concis et en casse normale.
- **Do** vérifier le contraste avec `pnpm run audit:contrast` et les échelles avec `pnpm run audit:scale`.

### Don't:

- **Don't** utiliser le citron pour Exporter, pour une illustration ou pour un anneau d’artboard.
- **Don't** empiler des cartes dans des cartes ou donner une ombre à une surface statique.
- **Don't** introduire de capitale trackée, de police mono décorative ou de nouvel échelon typographique.
- **Don't** poser un badge, un libellé ou un contrôle sur l’aperçu d’un écran.
- **Don't** masquer une commande critique au responsive ; repliez-la dans un contenant adapté.
