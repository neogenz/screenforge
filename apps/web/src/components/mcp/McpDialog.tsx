import { useState } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { McpStatusDot } from '@/components/mcp/McpStatusDot'
import { disableMcp, enableMcp } from '@/lib/mcp/client'
import { MCP_LABELS, useMcpStore } from '@/stores/mcp.store'
import { useUIStore } from '@/stores/ui.store'

/**
 * La boîte qui ouvre — et referme — la porte de l'agent.
 *
 * Aucun jeton n'y est montré ni demandé, contrairement au pont : ce qui garde
 * l'échange fermé n'est pas un secret recopié mais l'origine de la page, que le
 * démon vérifie et qu'un site hostile ne peut pas usurper. Le jeton existe, il
 * est simplement une conséquence du clic — le faire apparaître ferait croire
 * qu'il y a quelque chose à en faire.
 *
 * La phrase du bas dit ce que le mode implique, là où on l'active : un agent
 * externe écrit dans ce projet. Ce n'est pas une mise en garde décorative, c'est
 * la seule chose que l'utilisateur doit savoir avant de cliquer.
 */
export function McpDialog() {
  const status = useMcpStore((s) => s.status)
  const message = useMcpStore((s) => s.message)
  const enabled = useMcpStore((s) => s.enabled)
  const batches = useMcpStore((s) => s.appliedBatches)
  const calls = useMcpStore((s) => s.appliedCalls)
  const [pairing, setPairing] = useState(false)

  const close = () => useUIStore.getState().setShowMcpDialog(false)

  async function activate() {
    setPairing(true)
    try {
      await enableMcp()
    } finally {
      setPairing(false)
    }
  }

  return (
    <Dialog
      open
      onClose={close}
      title="Connexion MCP"
      size="sm"
      footerNote="Tant que la connexion est active, un agent externe peut créer et modifier les écrans de ce projet. Chaque lot reste annulable d’un ⌘Z."
      /* Un seul bouton au pied : la croix et Échap ferment déjà, et un
         « Fermer » de plus aurait donné deux boutons du même nom accessible
         dans la même boîte. */
      footer={
        enabled ? (
          <Button variant="default" onClick={disableMcp}>
            Désactiver
          </Button>
        ) : (
          <Button variant="primary" loading={pairing} onClick={() => void activate()}>
            Activer
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-2">
        <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm">
          <McpStatusDot status={status} />
          <span className="text-foreground">{MCP_LABELS[status]}</span>
        </p>

        {/* L'erreur sous le statut plutôt qu'à sa place : « Injoignable » dit
            l'état, la phrase dit quoi faire, et les deux se lisent ensemble. */}
        {status === 'error' && message && <p className="text-sm text-destructive">{message}</p>}

        <p className="text-sm text-muted-foreground">
          Le démon MCP tourne sur cette machine et relaie ce qu’un agent — Claude Code, Codex,
          opencode — demande à l’éditeur ouvert.
        </p>

        {batches > 0 && (
          <p className="text-2xs text-muted-foreground">
            {batches} lot{batches > 1 ? 's' : ''} appliqué{batches > 1 ? 's' : ''} depuis
            l’ouverture, {calls} appel{calls > 1 ? 's' : ''} au total.
          </p>
        )}
      </div>
    </Dialog>
  )
}
