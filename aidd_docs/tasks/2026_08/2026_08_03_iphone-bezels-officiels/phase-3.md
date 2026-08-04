---
status: done
---

# Instruction: Corrections de revue avant livraison

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── src/
│   ├── components/
│   │   ├── canvas/
│   │   │   └── canvas-utils.ts                  ✏️ lire la couleur d’écran vide depuis les valeurs de contenu
│   │   ├── device-picker/
│   │   │   └── DevicePicker.tsx                 ✏️ sérialiser les imports et ignorer tout résultat obsolète
│   │   └── ui/
│   │       └── segmented.tsx                    ✏️ exposer l’état disabled natif aux options de source
│   └── lib/
│       ├── content-defaults.ts                  ✏️ centraliser la couleur d’écran vide
│       └── device-bezel.ts                      ✏️ prévalider l’IHDR et borner le flood-fill en mémoire
└── e2e/
    ├── helpers.ts                               ✏️ remplacer les attentes temporelles et mutualiser l’extraction ZIP
    ├── device-bezel-analysis.spec.ts            ✏️ prouver le rejet précoce au-delà de 40 MP
    ├── device-bezel-import.spec.ts              ✏️ couvrir concurrence, stabilité et Dynamic Island réel
    └── export.spec.ts                           ✏️ réutiliser le helper ZIP commun
```

## Tasks to do

### `1)` Faire de la limite PNG une vraie frontière mémoire

> Rejeter les dimensions hostiles avant décodage et éviter les allocations proportionnelles superflues.

1. Ajouter d’abord un PNG synthétique dont l’IHDR annonce plus de 40 mégapixels avec un payload minuscule.
2. Vérifier la signature PNG, la présence de l’IHDR et ses dimensions avant tout `Image` ou canvas ; conserver les erreurs de domaine actuelles.
3. Réutiliser les octets déjà lus pour produire la data URL, sans seconde lecture complète du fichier.
4. Remplacer la pile `number[]` et le tableau de voisins par un parcours sans allocation par pixel, borné et itératif.
5. Conserver la détection exacte de l’ouverture des fixtures et du PNG Apple réel.

### `2)` Sérialiser les imports depuis tous les points d’entrée

> Un second choix de fichier ne doit jamais courir en parallèle ni écraser un résultat plus récent.

1. Étendre `Segmented` avec un état `disabled` appliqué aux boutons natifs.
2. Désactiver la source, importer et remplacer pendant l’analyse, avec l’état `aria-busy` existant.
3. Garder un identifiant de requête transitoire dans une ref et ignorer toute résolution obsolète.
4. Tester le chargement avec `FileReader` contrôlé dans la page afin que le scénario reste rapide et sans temporisation.
5. Vérifier qu’une tentative concurrente ne modifie ni l’asset ni le calque sélectionné.

### `3)` Rendre les tests d’export stables et non dupliqués

> Les scénarios attendent un état observable et partagent une seule lecture du ZIP.

1. Remplacer les délais utilisés par `waitForApp` et `addDeviceLayer` par des attentes de visibilité ou de store.
2. Choisir le modèle d’appareil par son rôle et son nom accessible, jamais avec `.first()`.
3. Déplacer téléchargement, lecture ZIP et extraction PNG dans un helper E2E partagé.
4. Réutiliser ce helper dans les tests export synthétique et Apple réel sans affaiblir les assertions de chemin ZIP.

### `4)` Conserver une preuve reproductible du Dynamic Island réel

> Le contrat local doit détecter un décalage qui ferait apparaître l’îlot deux fois.

1. Étendre le scénario contractuel avec `APPLE_SCREENSHOT_PATH`, ignoré lorsque l’un des deux chemins réels manque.
2. Décoder le bezel et la capture hors dépôt, vérifier que la boîte écran détectée correspond aux dimensions de la capture du même modèle.
3. Décoder l’export et affirmer que la région centrale supérieure ne contient qu’un seul îlot aligné, sans snapshot visuel.
4. Garder les deux fichiers Apple hors du worktree et ne produire aucun artefact persistant.

### `5)` Aligner la conformité mineure

> Les nouvelles valeurs de contenu suivent la source unique du projet.

1. Ajouter une constante sémantique pour l’écran vide dans `content-defaults.ts`.
2. L’utiliser dans le SVG transitoire au lieu du hex inline.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Un PNG dont l’IHDR dépasse 40 MP est refusé avant décodage ; les fixtures et le Product Bezel Apple gardent exactement la même boîte écran ; le parcours n’alloue plus de tableau JavaScript par pixel |
| 2 | Pendant une analyse contrôlée, tous les déclencheurs d’import sont désactivés et une seconde tentative ne peut ni lancer une analyse concurrente ni écraser le premier résultat |
| 3 | Les nouveaux parcours bezel n’appellent aucun `waitForTimeout`, ne choisissent aucun élément par position et utilisent une seule implémentation d’extraction ZIP tout en conservant les assertions App Store |
| 4 | Avec `APPLE_BEZEL_PATH` et `APPLE_SCREENSHOT_PATH` du même iPhone, import, reload et export passent ; la boîte écran correspond à la capture et la région supérieure exportée ne montre qu’un Dynamic Island |
| 5 | Le SVG de bezel ne contient plus de couleur de contenu inline ajoutée par cette fonctionnalité |
