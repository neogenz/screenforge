---
status: pending
---

# Instruction: Observation & assets — miniatures, images locales

## Architecture projection

```txt
apps/mcp/src/
  tools/
    get-thumbnail.ts          ✅ tool `screenforge_get_thumbnail` : PNG base64 d'un écran (renvoyé comme image MCP)
    add-image.ts              ✅ tool `screenforge_add_image` : chemin local → layer image / screenshot device
  relay/
    server.ts                 ✏️ GET /asset/:id sert les fichiers locaux déclarés par l'agent (allowlist de chemins de la session)
apps/web/src/
  lib/mcp/
    session.ts                ✏️ répond à get_thumbnail via canvas.toDataURL de l'écran demandé
    assets.ts                 ✅ fetch GET /asset/:id → registerAsset(dataUrl) → assetId renvoyé à l'agent
e2e/
  mcp-assets.spec.ts          ✅ image fixture poussée par l'agent → layer image présent → export pixel-exact inchangé
```

## User Journey

```mermaid
flowchart TD
  A[Agent joint/repère un screenshot local] --> B[screenforge_add_image : chemin + rôle image|screenshot]
  B --> C[Démon expose GET /asset/:id, app fetch + registerAsset]
  C --> D[Layer image ou device-frame.screenshotAssetId créé, cover centré]
  D --> E[Agent appelle screenforge_get_thumbnail]
  E --> F[App rend l'écran courant → PNG → agent voit le résultat et itère]
```

## Tasks to do

### `1)` `screenforge_get_thumbnail`

> L'agent voit ce qu'il fait — boucle de feedback visuel.

1. Côté app : rendre l'écran demandé (StaticCanvas d'export à faible multiplier, ex. 0.5) → PNG base64 → `POST /result`.
2. Côté MCP : retourner le contenu en `content: [{ type: 'image', data, mimeType }]` (format image MCP standard).
3. Paramètres : `screenId?` (défaut écran actif), `maxWidth?` (défaut 640).

### `2)` `screenforge_add_image`

> Un fichier local de l'utilisateur devient un asset du projet ouvert.

1. Côté démon : valider que le chemin existe et est un PNG/JPG/SVG ; l'enregistrer dans la allowlist de session ; renvoyer l'URL `/asset/:id`.
2. Côté app : fetch → `registerAsset` → créer le layer (`image` avec dimensions mesurées, ou `device-frame.screenshotAssetId` + placement cover centré) dans le batch courant.
3. Refus net : chemin inexistant, type non supporté, fichier > 20 Mo → erreur actionnable.

### `3)` e2e assets

1. `e2e/mcp-assets.spec.ts` : faux démon sert une fixture PNG → batch `add_image` + `add_device` → asserter assetId résolu et affichage.
2. Ré-exécuter `e2e/export.spec.ts` : l'export reste pixel-exact avec des assets venus du MCP.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                       |
| ---- | --------------------------------------------------------------------------------------------------------- |
| 1    | L'agent reçoit une image MCP affichable de l'écran demandé ; écran inconnu → erreur avec la liste des écrans. |
| 2    | Une image locale fournie par l'agent apparaît dans le projet ouvert (layer ou screenshot device) en cover centré ; les refus sont explicites. |
| 3    | L'export d'un projet contenant des assets MCP reste pixel-exact (1320×2868, PNG-24 opaque).                 |
