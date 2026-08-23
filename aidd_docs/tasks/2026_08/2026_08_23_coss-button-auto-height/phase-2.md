---
status: done
---

# Instruction: Interdire le retour du défaut, et l'écrire

## Pourquoi une garde rendue

Le défaut est muet par construction : la classe demandée est bien écrite, le
composant est bien celui du registre, rien n'échoue à la compilation, et
`audit:scale` ne voit qu'une hauteur de 32px de plus — une valeur parfaitement
légitime de l'échelle coss. Seule la géométrie rendue distingue « ce bouton
mesure 32px » de « ce bouton peint 50px de contenu dans 32px de boîte ».

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── apps/web/e2e/
│   ├── helpers.ts               ✏️ `expectNoClippedControl(page)`, la mesure partagée
│   ├── project-file.spec.ts     ✏️ appel sélecteur ouvert, en 1600px, avant la réduction à 600
│   ├── export.spec.ts           ✏️ appel dialogue « Export officiel » ouvert
│   ├── ai-campaign.spec.ts      ✏️ appel bande d'onglets « Visuels proposés » affichée
│   └── semantics.spec.ts        ✏️ appel sur le balayage existant : barre supérieure et outil scindé
├── aidd_docs/memory/design.md   ✏️ la même règle, une phrase, section « System »
└── CLAUDE.md                    ✏️ une puce dans « Design language » : la variante coss déclare sa hauteur deux fois
```

## User Journey

```mermaid
flowchart TD
  A[Un scénario ouvre une surface] --> B[expectNoClippedControl balaie les boutons visibles]
  B --> C{Un enfant sort de la boîte de son bouton}
  C -- oui --> D[Échec nommant le bouton et les pixels débordés]
  C -- non --> E[Le scénario continue]
```

## Test Scope

```mermaid
---
title: Test scope
---
journey
  section Setup
    Créer trois projets locaux en viewport 1600px => catalogue peuplé: 5: browser
  section Happy path
    Ouvrir le sélecteur puis balayer les boutons visibles => aucun contenu ne sort de sa boîte: 5: browser
    Ouvrir l export officiel puis balayer => aucun contenu ne sort de sa boîte: 5: browser
    Afficher la revue de plan puis balayer => aucun contenu ne sort de sa boîte: 5: browser
  section Edge case - régression réintroduite
    Retirer un sm:h-auto de la phase 1 => relancer la suite => au moins un scénario échoue en nommant le bouton: 1: browser
  section Edge case - geste volontaire
    Un bouton déborde par intention => déclarer l exception dans le helper => la garde reste verte et documentée: 1: browser
```

## Tasks to do

### `1)` La mesure partagée

> Un contrôle ne peint rien hors de sa boîte.

1. Ajouter `expectNoClippedControl(page)` à `apps/web/e2e/helpers.ts`, sur le modèle du balayage de curseurs de `semantics.spec.ts` : un seul `page.evaluate`, puis `expect(offenders).toEqual([])`.
2. Dans la page : pour chaque `[data-slot="button"]` de boîte non nulle, comparer le rectangle de chaque enfant élément visible à celui du bouton, tolérance 1px en haut comme en bas.
3. Retourner un objet parlant par fautif — libellé accessible ou texte tronqué, hauteur de la boîte, hauteur du contenu, dépassement en pixels — pour que l'échec nomme le bouton sans qu'on ait à ouvrir la trace.
4. Prévoir, comme le `gesture` du balayage de curseurs, une liste d'exceptions déclarées et commentées, vide au départ ; un débordement voulu s'y écrit plutôt que d'affaiblir la mesure.

### `2)` Les trois points d'appel

> Là où la suite ouvre déjà la surface, la mesure ne coûte qu'une ligne.

1. `project-file.spec.ts`, scénario « structures, filters and opens local projects… » : appeler la garde juste après l'ouverture du sélecteur, **avant** le `setViewportSize({ width: 600 })`, sinon la mesure passe sous le point d'arrêt `sm` et rate précisément le cas fautif.
2. `export.spec.ts` : appeler la garde une fois le dialogue « Export officiel » visible, la liste d'écrans rendue.
3. `ai-campaign.spec.ts` : appeler la garde une fois la tablist « Visuels proposés » visible.
4. `semantics.spec.ts` : appeler la garde sur le balayage existant, qui ouvre déjà le sélecteur en 1600px — c'est lui qui couvre la barre supérieure et son outil scindé.
5. Confirmer la valeur de la garde : rétablir l'état d'avant correctif et vérifier que la suite échoue en nommant les boutons, puis le remettre.

> La garde mesure la géométrie, pas l'intention : rétablir la taille d'icône fautive **sans** rétablir le `gap-2` ne la déclenche pas, puisque la paire tient alors dans sa boîte. C'est le contrat voulu — « rien ne peint hors de son contrôle » — et pas « chaque icône rend la taille demandée », qui échouerait aujourd'hui partout dans l'application.

### `3)` L'écrire une fois

> Le prochain appelant doit lire le piège avant de le retrouver.

1. Ajouter à la section « Design language » de `CLAUDE.md` une puce courte : une variante de taille coss déclare sa hauteur deux fois (`h-9 sm:h-8`), `cn()` indexe ses conflits par modificateur, donc un `h-auto` nu ne gagne qu'en dessous de 640px — un bouton qui doit épouser son contenu s'écrit `h-auto sm:h-auto`, et la garde e2e le mesure.
2. Refléter la même règle en une phrase dans `aidd_docs/memory/design.md`, section « System », là où vit déjà la règle « jamais éditer `components/ui/` ».

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | Le helper renvoie une liste vide sur l'application corrigée, et une entrée nommant le bouton, sa boîte et son dépassement dès qu'un contenu sort de sa boîte. |
| 2    | Les quatre scénarios passent ; rétabli l'état d'avant correctif, `project-file` échoue sur « Ouvrir « Projet Bêta » » (boîte 286×43, débord 8) et `semantics` sur « Ajouter un appareil » (boîte 32×32, débord 2). |
| 3    | `CLAUDE.md` et `aidd_docs/memory/design.md` énoncent la règle `h-auto sm:h-auto` et nomment la garde qui la tient.                                            |
