---
status: done
---

# Audit des deux sources

Ce que les deux dépôts cités par la commande contiennent, à quel commit, sous
quelle licence, et ce qui en est repris. Le fichier existe pour qu'une reprise
d'idée reste distinguable d'une reprise de code, et pour qu'aucun asset
n'entre dans ScreenForge sans provenance démontrée.

## Les commits examinés

| Dépôt                        | URL                                                     | HEAD lu                                    | Date du HEAD | Licence            |
| ---------------------------- | ------------------------------------------------------- | ------------------------------------------ | ------------ | ------------------ |
| shotluma                     | https://github.com/realZachi/shotluma                    | `4ff3397b46ccea087234506fede32b66e9a7050c` | 2026-08-10   | MIT (`LICENSE`)    |
| open-screenshot-generator    | https://github.com/dotnetdreamer/open-screenshot-generator | `a25360ba2deb13a1a7eeea01681f7f55ca013fc6` | 2026-08-09   | MIT (`LICENSE`)    |

Les deux clones ont servi à la lecture uniquement, hors du dépôt, et ne sont
pas versionnés ici. Les références `fichier:ligne` de ce document et des
commentaires du code pointent ces deux commits.

## Classement de ce qui est repris

Trois catégories, et une seule est utilisée pour l'instant.

- **Copié** : lignes reprises telles quelles. **Aucune.** La licence MIT
  l'autoriserait avec sa notice ; le besoin ne s'est pas présenté, les deux
  bases n'ayant ni le même modèle de données (`Project → Screen → Layer`), ni
  le même moteur de rendu (Fabric v7 contre DOM/React chez OSG, `matrix3d` CSS
  chez shotluma).
- **Adapté** : structure d'un fichier reprise et réécrite. **Aucun.**
- **Réimplémenté depuis l'idée** : l'idée est publique, le code est écrit ici.
  **Tout ce qui suit.** Une idée n'est pas couverte par le droit d'auteur :
  aucune attribution n'est due, et aucune notice MIT n'a donc à être ajoutée
  au dépôt tant que la colonne « Copié » reste vide. Si elle cesse de l'être,
  la notice du dépôt d'origine part avec les lignes, dans un
  `THIRD-PARTY-NOTICES.md` créé à ce moment-là.

## shotluma — ce qui vaut d'être repris

- **L'IA pose des calques, pas une image.** `src/ai/tools.ts` n'expose pas un
  « génère-moi une capture » : il expose le vocabulaire de l'éditeur —
  `add_slide`, `delete_slide`, `add_text`, `add_icon`, `update_element`, plus
  les groupes `createMediaTools` / `createInspectionTools` / `createSlideTools`
  et un `declare_plan` réservé au mode génération. Le modèle conduit l'éditeur
  au lieu de le court-circuiter, donc tout ce qu'il produit reste sélectionnable
  et modifiable. C'est la thèse de la phase 6.
- **Un plan déclaré avant l'exécution.** `src/ai/plan-tool.ts` et
  `src/ai/run-plan.ts` séparent « ce que je vais faire » de « je le fais ».
  L'utilisateur voit la campagne avant qu'elle ne s'écrive.
- **Le pont local est un programme séparé, pas un OAuth dans la page.**
  `scripts/shotluma-codex-bridge.ts:11` fixe `BRIDGE_HOST = '127.0.0.1'` et
  `src/ai/codex-connection.ts:2` en dérive l'origine attendue ; l'origine
  appelante est vérifiée des deux côtés (`codex-connection.ts:51`,
  `shotluma-codex-bridge.ts:69`). Le README l'énonce : le connecteur n'écoute
  que sur la boucle locale. Modèle retenu pour la phase 7.
- **Le registre de fournisseurs est testé, pas déduit.**
  `src/ai/provider-config.ts:83` et son test `provider-config.test.ts:237`
  traitent `127.0.0.1` comme un cas nommé plutôt que comme une chaîne parmi
  d'autres.

Non repris : la géométrie `matrix3d` des maquettes en perspective
(`src/mockups/README.md`), qui suppose des overlays photo dont ce dépôt ne peut
pas justifier la provenance — voir plus bas.

## open-screenshot-generator — ce qui vaut d'être repris, et le contre-exemple

- **Le contre-exemple, vérifié.** Remplacer une capture y réinitialise le
  cadrage sans condition :
  `src/components/open-screenshot-generator/elements/DeviceFrameElement.tsx:84-89`
  écrit `screenshotRect: initialRect` à chaque import, et
  `PropertiesPanel.tsx:660-667` fait la même chose depuis le panneau. Le
  recadrage d'une release est donc perdu à la suivante. C'est exactement ce que
  la phase 2 rend impossible ici, et `apps/web/e2e/screenshot-framing.spec.ts`
  est le test qui tombera si la même chose revient.
- **Le rectangle de capture en pourcentage** (`screenshotRect`) est une bonne
  intuition — un cadrage exprimé relativement à l'ouverture survit à un
  changement de taille d'appareil. ScreenForge le réimplémente autrement
  (`mode` + point focal + zoom dans `lib/screenshot-placement.ts`), parce qu'un
  rectangle libre ne dit pas ce que l'utilisateur voulait garder au centre,
  alors qu'un point focal le dit et se transpose à un autre rapport d'image.
- **Le journal de licences des assets** (`docs/image-asset-licenses.md`) est la
  bonne pratique, indépendamment du fait que ces assets-là ne soient pas
  reprenables.

## Assets : rien n'est importé

Le contrat interdit d'importer un asset sans provenance commerciale démontrée.
Aucun fichier binaire des deux dépôts n'entre dans ScreenForge. Détail par
source nommée :

| Source                                          | Constat                                                                                                                                          | Décision     |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| Overlays de maquettes shotluma (`src/assets/mockups/*.webp`) | Le dépôt ne documente l'origine d'aucun des sept fichiers ; `src/mockups/README.md` se contente de recommander de vérifier la licence avant d'en ajouter | Non importé  |
| Photos OSG (`public/elements/images/`)          | `docs/image-asset-licenses.md` : collection gratuite Adobe Stock, licence standard **au compte personnel du propriétaire du projet**. Une licence standard n'est pas sous-licenciable : elle couvre ce dépôt-là, pas le nôtre | Non importé  |
| Apple Product Bezels                            | Distribués sous les conditions d'Apple, incompatibles avec une redistribution dans un dépôt tiers                                                  | Non importé  |
| Freepik / Vecteezy / Mobbin / SVG Repo          | Aucun des deux dépôts n'en tire d'asset ; aucune licence commerciale vérifiable à notre nom                                                        | Non importé  |
| Badges de magasin hors charte                   | Aucun repris                                                                                                                                       | Non importé  |

Les cadres d'appareil de ScreenForge restent ceux du dépôt :
`apps/web/src/assets/device-frames/`, générés en SVG par le projet lui-même.
La phase 3 ajoute des icônes ; leur source devra être une bibliothèque déjà
installée (Lucide, licence ISC) plutôt qu'un nouvel import binaire.

## Marques

Les deux dépôts portent la même réserve, et elle vaut ici : Apple, App Store et
iPhone sont des marques d'Apple Inc.; ScreenForge est un projet indépendant,
sans affiliation ni approbation d'Apple.
