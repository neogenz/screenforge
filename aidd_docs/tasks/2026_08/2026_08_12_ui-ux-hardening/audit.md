# Audit UX/UI et benchmark de composants — 2026-08-12

## Verdict

ScreenForge n'a pas besoin d'un nouveau design system. Le socle actuel est déjà cohérent,
tokenisé, responsive, accessible dans ses parcours principaux et particulièrement prudent sur
Fabric.js. Une migration globale vers Coss, Appica, Beautiful UI ou Amicro ajouterait du risque
sans corriger les défauts observés.

Le meilleur retour sur investissement est un durcissement ciblé : supprimer le flash de thème au
démarrage, rendre les contrôles composites conformes à leur rôle ARIA, remettre tous les focus sur
le token global, puis fermer les angles morts des audits visuels.

## Preuves exécutées

| Vérification | Résultat |
| --- | --- |
| `pnpm test` | Réussi : 38 tests bridge, 49 API, 311 web, 29 RLS, typecheck et lint sans erreur |
| `pnpm run build` | Réussi ; dialogues métier et JSZip restent séparés du chemin principal |
| `pnpm run audit:contrast` | Réussi ; pire ratio sombre 4,78:1, clair 4,55:1 |
| `pnpm run audit:scale` | Réussi ; échelles rendues 11/14/16 px, contrôles 32/36 px, rayons 6/9/12/21 px |
| `pnpm run probe:visual` | Réussi ; captures sombre/clair × vide/peuplé, aucun débordement ou glitch évident |
| Playwright UX ciblé | 35 scénarios réussis : boot, responsive 320 px, dialogues, sémantique, résilience, canvas, palette, écrans et calques |

## Score

| Axe | Note | Constat |
| --- | ---: | --- |
| Accessibilité | 3/4 | Focus visible et Radix largement présents ; certains widgets ARIA maison n'ont pas leur navigation fléchée attendue |
| Performance | 4/4 | Dialogues lourds lazy, export séparé, synchro Fabric patchée, miniatures débouncées et annulables ; aucun défaut mesuré |
| Thèmes | 3/4 | Tokens OKLCH et contrastes solides ; le boot clair et quelques focus locaux divergent |
| Responsive | 4/4 | Le chrome et les dialogues passent les scénarios jusqu'à 320/375 px |
| Anti-patterns | 4/4 | Éditeur neutre et retenu, sans glassmorphism décoratif ni animation envahissante |
| **Total** | **18/20** | **Socle solide, écarts concentrés et corrigeables sans refonte** |

## Constats prioritaires

### P2 — à corriger

1. **Flash du mauvais thème pour les utilisateurs en clair.** `apps/web/index.html` peint toujours
   un boot sombre ; la préférence `screenforge-theme` n'est lue qu'au montage du store. Le fond
   clair inline est en plus resté à `oklch(0.88 0 0)` alors que la scène claire courante est plus
   lumineuse. Un script inline minimal avant peinture suffit ; aucun provider n'est nécessaire.

2. **Rôles composites sans modèle clavier composite.** Les groupes radio de `LocaleDialog`,
   `AssistantSetup` et `CampaignDialog`, les onglets de revue de campagne, ainsi que les listboxes
   de `FontPicker` et `VectorPicker`, exposent les bons rôles mais reposent surtout sur Tab + Entrée.
   Les rôles ARIA annoncés impliquent focus roving, flèches et sélection cohérente. Le projet possède
   déjà les radios natives, Popover et `cmdk` : aucune dépendance n'est requise.

3. **Focus local incohérent avec le contrat global.** Plusieurs cartes interactives dans les
   dialogues Release, Locale, Campaign, Export et Publish remplacent le ring citron global par
   `ring-foreground`. Utiliser `ring-ring` ou laisser l'outline global évite deux grammaires de
   focus selon la surface.

4. **Taille de toast hors échelle et invisible pour l'audit.** `apps/web/src/App.tsx` fixe Sonner à
   `12.5px`, alors que l'échelle fermée rendue est 11/14/16 px. `scripts/scale-audit.mjs` ne montre
   ni toast ni dialogue, donc il ne peut pas détecter cette dérive.

5. **Source de design obsolète.** `.impeccable.md` se présente encore comme v4 et contredit le code
   v5 sur le focus, le corps, les titres de section, les rayons et le sixième niveau `stage-veil`.
   Cela peut faire réintroduire des valeurs déjà abandonnées.

### P3 — hygiène

1. `TopBar.tsx` garde un bouton de palette maison alors que `IconButton` couvre déjà sa taille, son
   focus et son état hover.
2. `eslint.config.js` inspecte `.claude/worktrees/**` ; le lint racine remonte actuellement deux
   avertissements dans du code généré d'un worktree étranger au produit.
3. `scripts/contrast-audit.mjs` ne verrouille pas les couples textuels `warning/card` et
   `success/card`, bien qu'ils soient utilisés dans les dialogues. Ils passent aujourd'hui ; le
   risque est une régression future.

## Ce qui fonctionne et doit rester

- La scène full-bleed, les drawers overlay, la pellicule et `stage.ts` ne présentent pas de défaut
  structurel observé.
- Le contrat shadcn, les tokens OKLCH, l'accent citron réservé à l'état et la séparation
  chrome/contenu sont cohérents dans les deux thèmes.
- La chaîne Fabric évite correctement `clipPath` et le cache objet, choisit patch/full, limite les
  travaux par frame et annule les captures de miniatures obsolètes.
- Les gros fichiers `TopBar` et `CampaignDialog` ne sont pas un problème démontré à eux seuls. Les
  scinder sans profil ou défaut concret ne ferait que déplacer du code.
- Les dialogues sont déjà chargés dynamiquement ; JSZip reste hors du chemin principal. Aucun lot
  de « performance refactor » spéculatif n'est justifié.

## Benchmark

| Source | Plus-value réelle pour ScreenForge | Décision |
| --- | --- | --- |
| [shadcn/ui](https://ui.shadcn.com/docs/components) | Contrat déjà adopté ; bons modèles Combobox, Field, Radio Group et Tabs, avec variantes Radix disponibles | Rester la fondation ; reprendre seulement les comportements manquants |
| [Coss UI](https://coss.com/ui) | Catalogue Cal.com en Tailwind v4, tokens compatibles shadcn et autocomplete riche ; migration Radix vers Base UI documentée | Référence d'interaction, pas migration : Base UI ajouterait un second socle et Coss évolue encore |
| [Appica Autocomplete](https://appica.dev/ui/components/react/autocomplete) | Excellent modèle composé : filtrage, groupes, grille 2D, clear, popup portallé et navigation clavier ; script de thème avant peinture | Reprendre le comportement et le test, pas le package ni son ThemeProvider |
| [Beautiful UI](https://beautifului.dev/) | Bibliothèque MIT copy/paste dédiée aux interfaces IA : thinking, approval, task rows, prompt bar, actions de sélection ; thème posé avant peinture | Inspiration ponctuelle pour Campaign/Assistant seulement ; aucun changement du chrome éditeur |
| [Amicro](https://amicro.vercel.app/) | Catalogue de micro-transitions React + Motion, utile pour étudier morph, pulse et feedback d'action | Ne pas installer Motion ; les transitions CSS existantes couvrent les besoins mesurés |

## Décision de périmètre

Le plan ne remplace ni Radix, ni Sonner, ni le design system local. Il ne crée pas de primitive
générique tant qu'une dépendance installée ou un composant existant tient le besoin. Il ne touche
pas à Fabric.js sans profil montrant une régression. Ce périmètre corrige les défauts prouvés avec
le moins de code et de risque visuel.
