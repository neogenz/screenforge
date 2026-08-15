# Serveur MCP ScreenForge

Un petit processus qui tourne sur votre machine et laisse un agent — Claude
Code, Codex, opencode — composer directement dans l'éditeur **que vous avez
ouvert** : ajouter des écrans, poser des textes, choisir des fonds, placer vos
captures. Ce que vous voyez apparaître sur la planche est le projet, pas un
aperçu : c'est annulable d'un Ctrl+Z, éditable à la souris, exportable.

C'est le sens inverse du pont (`apps/bridge`), qui laisse ScreenForge demander
des accroches à un modèle. Ici c'est l'agent qui tient l'initiative, et l'app
qui exécute.

## Pourquoi deux transports

Un navigateur ne reçoit pas de connexion entrante et ne parle pas stdio ; un
agent ne sait parler qu'à un serveur MCP. Le démon tient donc les deux bouts :

```
agent  ──stdio (JSON-RPC)──►  apps/mcp  ──SSE + POST──►  onglet ScreenForge
```

L'onglet appelle, le démon attend. Aucune extension navigateur, aucun backend.

## Ce que l'agent peut faire, et rien d'autre

Les outils exposés sont exactement les entrées de `AI_TOOLS`, le vocabulaire
fermé de `@screenforge/project-format` : catalogues énumérés (appareils, formes,
icônes, polices), bornes numériques, aucune propriété non déclarée. Le schéma
annoncé à l'agent et le schéma revalidé dans le navigateur sont le même objet —
c'est ce que le paquet partagé existe pour garantir.

Un agent qui déraille peut au pire poser un texte au mauvais endroit. Il ne peut
pas injecter du JSON Fabric, lire une image, ni écrire ailleurs que dans le
projet ouvert.

| Outil                           | Effet                                                |
| ------------------------------- | ---------------------------------------------------- |
| `screenforge_get_project_state` | Lit le projet, ses écrans, ses calques               |
| `screenforge_get_screen`        | Lit un écran                                         |
| `screenforge_get_thumbnail`     | **Voit** un écran rendu, en PNG                      |
| `screenforge_add_screen`        | Ajoute une planche                                   |
| `screenforge_set_background`    | Remplace un fond                                     |
| `screenforge_add_text` …        | Pose un calque (texte, forme, icône, appareil)       |
| `screenforge_add_image`         | Pose une image **de votre disque** (logo ou capture) |
| `screenforge_update_layer`      | Modifie un calque existant                           |
| `screenforge_apply`             | Applique un lot **en une seule écriture**            |
| `screenforge_save_template`     | Garde une mise en page réussie comme gabarit         |
| `screenforge_list_templates`    | Relit les gabarits gardés, tous projets confondus    |

`screenforge_apply` n'est pas une commodité : la page applique un lot par
`commitAiRun`, donc en une transaction validée et une seule annulation. Dix
appels séparés seraient dix écritures, et un refus au sixième laisserait cinq
écrans à moitié composés dans votre projet.

### Voir, et poser une image

Ces deux-là sont les seuls outils que le contrat partagé ne porte pas tels
quels, et chacun pour une raison qui tient à qui détient quoi.

`screenforge_get_thumbnail` fait rendre un écran **par l'onglet** : les polices
Google, les gabarits d'appareil et vos captures n'existent que là, et un rendu
côté démon en serait une approximation qui mentirait exactement là où l'agent a
besoin de vérité. Le retour est une image MCP, pas une URL. Rien n'est écrit :
le rendu se fait sur une toile jetable, sans toucher au projet, à l'historique
ni à la sélection.

`screenforge_add_image` prend un **chemin absolu** sur votre machine. Le chemin
ne traverse pas : le démon le fait entrer dans un coffre qui vit avec son
processus, l'appel qui part vers la page ne porte qu'un identifiant, et la page
récupère les octets par `GET /asset/:id`, sur jeton. La route ne sait pas lire
un chemin — un `?path=` aurait fait de l'onglet un lecteur de tout le disque, à
un paramètre près. Sont refusés, chacun avec sa cause nommée : un chemin
relatif, une extension hors PNG/JPEG/SVG, un fichier absent, plus de 16 Mo (la
même borne que l'import à la souris, parce que ce qui entre finit dans
IndexedDB), un SVG donné comme capture d'écran.

### Garder une mise en page

Le lot appartient à une fiche App Store ; la composition trouvée au troisième
essai n'appartient à rien, et disparaissait avec le projet.
`screenforge_save_template` la range dans la bibliothèque du navigateur, hors
des projets — c'est ce qui la rend applicable au projet suivant, à la souris
comme par l'agent, depuis « Modèles de mise en page ».

Un gabarit emporte ses images (un logo) mais **pas la capture d'écran** : celle-ci
appartient à la fiche, et un gabarit qui la porterait ferait porter à chaque
écran construit depuis lui la capture d'un autre. Le cadre iPhone reste, vide,
et c'est le rafraîchissement par lots qui le remplit. Un nom déjà pris est
refusé plutôt que suffixé : deux gabarits presque homonymes rendent la
réapplication aveugle.

## Démarrer

Depuis le dossier où vous avez cloné ScreenForge :

```bash
pnpm --filter mcp run build
```

Puis configurez votre agent avec le chemin **absolu** du fichier construit.

### Claude Desktop / Claude Code

`~/Library/Application Support/Claude/claude_desktop_config.json` :

```json
{
  "mcpServers": {
    "screenforge": {
      "command": "node",
      "args": ["/chemin/absolu/vers/screen-forge/apps/mcp/build/main.js"]
    }
  }
}
```

### Codex

`~/.codex/config.toml` :

```toml
[mcp_servers.screenforge]
command = "node"
args = ["/chemin/absolu/vers/screen-forge/apps/mcp/build/main.js"]
```

Ou, en une commande :
`codex mcp add screenforge -- node /chemin/absolu/…/apps/mcp/build/main.js`

### opencode

`~/.config/opencode/opencode.json` :

```json
{
  "mcp": {
    "screenforge": {
      "type": "local",
      "command": ["node", "/chemin/absolu/vers/screen-forge/apps/mcp/build/main.js"],
      "enabled": true
    }
  }
}
```

En développement, `pnpm --filter mcp run start` lance les sources directement —
Node lit le TypeScript en dépouillant les types, il n'y a rien à construire.
Tout ce qui est écrit part sur `stderr` : `stdout` est le canal JSON-RPC, et un
`console.log` égaré y couperait une trame en deux.

## Brancher l'éditeur

1. Ouvrez ScreenForge (`pnpm run dev`, ou la version déployée servie en local).
2. Activez « Connexion MCP » dans la barre du haut.

L'onglet appelle `POST /pair`, reçoit un jeton et ouvre son flux. Aucun secret à
recopier : ce qui garde l'échange fermé n'est pas le jeton mais l'**origine** —
seule une page servie depuis une origine admise l'obtient, et une page hostile
ne peut pas mentir sur la sienne. Le jeton sert ensuite, pour que le flux et les
réponses ne dépendent pas d'un en-tête qu'`EventSource` ne sait pas poser.

Le démon écoute sur `127.0.0.1:4591`, jamais sur `0.0.0.0`. Les origines admises
sont celles des serveurs de développement (5173, 4173, 5199) ; ajoutez-en avec
`SCREENFORGE_MCP_ORIGINS`, déplacez le port avec `SCREENFORGE_MCP_PORT`.

Déplacer le port se fait des deux côtés, sans quoi l'onglet continuerait
d'appeler 4591. Une page statique ne lit pas de variable d'environnement, donc
c'est son stockage local qui porte la valeur :

```js
localStorage.setItem('screenforge-mcp-port', '4592')
```

Pas de champ dans l'interface : c'est un réglage de machine, pas une préférence
de projet, et le défaut convient partout ailleurs. Le seul autre reliquat que
l'onglet garde est `screenforge-mcp`, le drapeau qui dit que le mode a été
demandé — **jamais le jeton**, qui meurt avec le rechargement comme celui du
pont meurt avec son processus.

Un seul onglet à la fois : le dernier arrivé évince le précédent, et les appels
en vol de l'évincé repartent en erreur. Deux onglets se partageant les lots
donneraient à l'agent un projet qui se contredit d'un appel à l'autre.

## Vérifier

```bash
node scripts/mcp-live-probe.mjs
```

La sonde lance le vrai binaire, lui parle le vrai JSON-RPC et joue l'éditeur en
face : aller-retour, lot en une livraison, appel refusé sans éditeur, identifiant
hors catalogue refusé avec les valeurs admises, vignette revenue en bloc image,
fichier local servi sur jeton sans que son chemin ne sorte, gabarit relayé
jusqu'à la page, et `stdout` resté propre.
