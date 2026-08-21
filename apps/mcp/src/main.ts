import { serve } from '@hono/node-server'
import { McpServer } from '@modelcontextprotocol/server'
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio'
import { fileURLToPath } from 'node:url'
import { delimiter, isAbsolute } from 'node:path'
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

const server = new McpServer({ name: 'screenforge', version: MCP_VERSION })

async function assetRoots(): Promise<string[]> {
  const configured = (process.env.SCREENFORGE_MCP_ASSET_ROOTS ?? '')
    .split(delimiter)
    .map((root) => root.trim())
    .filter((root) => root.length > 0 && isAbsolute(root))
  if (!server.server.getClientCapabilities()?.roots) return configured
  try {
    const listed = await server.server.listRoots()
    return [
      ...configured,
      ...listed.roots.flatMap((root) => {
        try {
          const path = fileURLToPath(root.uri)
          return isAbsolute(path) ? [path] : []
        } catch {
          return []
        }
      }),
    ]
  } catch {
    return configured
  }
}

const state = createRelayState(
  {
    announce: (code, expiresAt) => {
      const seconds = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
      console.error(`Code d’appairage ScreenForge : ${code} (valable ${seconds} s)`)
    },
  },
  assetRoots,
)
const origins = allowedOrigins()
const port = relayPort()

server.server.setNotificationHandler('notifications/roots/list_changed', () => state.assets.clear())

registerEditorTools(server, state)

serve({ fetch: createRelay(state, origins).fetch, hostname: RELAY_HOST, port }, () => {
  console.error(`Relais ScreenForge sur http://${RELAY_HOST}:${port}`)
  console.error(`Origines admises : ${origins.join(', ')}`)
  console.error('Ouvrez ScreenForge et activez « Connexion MCP » pour brancher l’éditeur.')
})

const transport = new StdioServerTransport()
await server.connect(transport)
console.error('Serveur MCP ScreenForge en écoute sur stdio.')
