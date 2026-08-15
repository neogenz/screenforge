import { serve } from '@hono/node-server'
import { McpServer } from '@modelcontextprotocol/server'
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio'
import { allowedOrigins, relayPort, RELAY_HOST } from './relay/protocol.ts'
import { createRelay, createRelayState, MCP_VERSION } from './relay/server.ts'
import { registerEditorTools } from './tools/editor-tools.ts'

/**
 * Un seul processus, deux faces : stdio vers l'agent, HTTP vers l'éditeur.
 *
 * Un navigateur ne peut pas être un serveur MCP — il ne reçoit pas de
 * connexion entrante et ne parle pas stdio. Un démon qui tient les deux bouts
 * est ce qui évite une extension navigateur ou un backend : l'agent parle le
 * protocole qu'il connaît, la page ouvre un flux sortant qu'elle sait ouvrir.
 *
 * **Rien sur `stdout`.** C'est le canal JSON-RPC ; un `console.log` égaré y
 * insère du texte au milieu d'une trame et l'agent perd la connexion sans rien
 * pouvoir en dire. Tout ce que ce fichier écrit part sur `stderr`, que les
 * clients MCP affichent dans leurs journaux.
 *
 * `hostname` est `127.0.0.1` et non `0.0.0.0` : un démon qui écoute sur toutes
 * les interfaces est un service exposé au réseau local, jeton ou pas.
 */

const state = createRelayState()
const origins = allowedOrigins()
const port = relayPort()
const server = new McpServer({ name: 'screenforge', version: MCP_VERSION })

registerEditorTools(server, state.session)

serve({ fetch: createRelay(state, origins).fetch, hostname: RELAY_HOST, port }, () => {
  console.error(`Relais ScreenForge sur http://${RELAY_HOST}:${port}`)
  console.error(`Origines admises : ${origins.join(', ')}`)
  console.error('Ouvrez ScreenForge et activez « Connexion MCP » pour brancher l’éditeur.')
})

const transport = new StdioServerTransport()
await server.connect(transport)
console.error('Serveur MCP ScreenForge en écoute sur stdio.')
