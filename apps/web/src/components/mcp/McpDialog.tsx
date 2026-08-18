import { RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SetupCommand, SetupFlow, SetupProgress, SetupStep } from '@/components/ui/setup-flow'
import { disableMcp, enableMcp, MCP_COMMAND, mcpRelayAddress } from '@/lib/mcp/client'
import { MCP_LABELS, projectMcpSteps, useMcpStore } from '@/stores/mcp.store'
import { useUIStore } from '@/stores/ui.store'

/** La porte locale vers le projet ouvert, décrite par ses seuls jalons observables. */
export function McpDialog() {
  const [code, setCode] = useState('')
  const codeRef = useRef<HTMLInputElement>(null)
  const disableRef = useRef<HTMLButtonElement>(null)
  const status = useMcpStore((state) => state.status)
  const connectionStep = useMcpStore((state) => state.connectionStep)
  const message = useMcpStore((state) => state.message)
  const version = useMcpStore((state) => state.daemonVersion)
  const batches = useMcpStore((state) => state.appliedBatches)
  const calls = useMcpStore((state) => state.appliedCalls)
  const steps = projectMcpSteps(status, connectionStep)
  const completed =
    status === 'live'
      ? 4
      : connectionStep === 'ready'
        ? 3
        : connectionStep === 'editor'
          ? 2
          : connectionStep === 'pairing'
            ? 1
            : 0

  const close = () => useUIStore.getState().setShowMcpDialog(false)
  const activate = () => void enableMcp(code)
  const deactivate = () => {
    void disableMcp().then(() => {
      setCode('')
      codeRef.current?.focus()
    })
  }

  useEffect(() => {
    if (status === 'error' && connectionStep === 'pairing') codeRef.current?.focus()
    if (status === 'live') disableRef.current?.focus()
  }, [connectionStep, status])

  const footer =
    status === 'connecting' ? (
      <Button variant="primary" loading>
        Appairer
      </Button>
    ) : status === 'live' ? (
      <Button ref={disableRef} variant="default" onClick={deactivate}>
        Désactiver
      </Button>
    ) : (
      <Button variant="primary" onClick={activate} disabled={!/^\d{6}$/.test(code)}>
        Appairer
      </Button>
    )

  return (
    <Dialog
      open
      onClose={close}
      title="Connexion MCP"
      size="md"
      footerNote="Désactiver coupe le flux et annule tout import MCP encore en cours."
      footer={footer}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="max-w-[65ch] text-sm text-muted-foreground">
            Un agent externe peut piloter le projet actuellement ouvert dans ScreenForge.
          </p>
          <p role="status" aria-live="polite" className="shrink-0 text-2xs text-foreground">
            {MCP_LABELS[status]}
          </p>
        </div>

        <SetupFlow>
          <div className="flex flex-col gap-3 px-3 py-3">
            <SetupProgress label="Progression de la connexion MCP" value={completed} max={4} />

            {status !== 'live' ? (
              <div className="flex flex-col gap-2">
                <label htmlFor="mcp-pairing-code" className="field-label">
                  Code à 6 chiffres affiché par le démon
                </label>
                <Input
                  ref={codeRef}
                  id="mcp-pairing-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  aria-invalid={status === 'error' && connectionStep === 'pairing'}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                />
                {status === 'error' && connectionStep === 'pairing' ? (
                  <p role="alert" className="text-2xs text-destructive">
                    {message}
                  </p>
                ) : (
                  <p className="text-2xs text-muted-foreground">
                    Usage unique, valable cinq minutes. Le jeton de session reste en mémoire.
                  </p>
                )}
              </div>
            ) : null}

            <SetupStep
              rank={1}
              title="Démon local"
              state={steps.daemon}
              result={`Démon ${version || 'MCP'} joignable.`}
              announce={false}
            >
              {status === 'error' && connectionStep === 'daemon' ? (
                <div className="flex flex-col gap-2">
                  <p role="alert" className="text-2xs text-destructive">
                    {message}
                  </p>
                  <SetupCommand command={MCP_COMMAND} />
                  <div>
                    <Button variant="default" onClick={activate}>
                      <RefreshCw size={12} aria-hidden />
                      Réessayer
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-2xs text-muted-foreground">
                  {status === 'off'
                    ? 'Lancez le démon qui tourne uniquement sur cette machine.'
                    : 'Recherche du démon sur l’adresse loopback…'}
                </p>
              )}
            </SetupStep>

            <SetupStep
              rank={2}
              title="Code d’appairage"
              state={steps.pairing}
              result="Code accepté et session éphémère créée."
              announce={false}
            >
              <p className="text-2xs text-muted-foreground">
                Le code est vérifié localement et ne peut servir qu’une fois.
              </p>
            </SetupStep>

            <SetupStep
              rank={3}
              title="Éditeur ScreenForge"
              state={steps.editor}
              result="Flux appairé et projet synchronisé."
              announce={false}
            >
              {status === 'error' ? (
                <p role="alert" className="text-2xs text-destructive">
                  {message}
                </p>
              ) : (
                <p className="text-2xs text-muted-foreground">
                  Le flux local est ouvert. ScreenForge transmet l’état initial du projet.
                </p>
              )}
            </SetupStep>

            <SetupStep rank={4} title="Prêt pour l’agent" state={steps.ready} announce={false}>
              <p className="text-2xs text-muted-foreground">
                L’agent peut maintenant lire, rendre et modifier ce projet tant que le mode reste
                actif.
              </p>
            </SetupStep>
          </div>

          <details className="border-t border-border px-3 py-2 text-2xs text-muted-foreground">
            <summary className="cursor-pointer select-none font-medium hover:text-foreground">
              Détails de connexion
            </summary>
            <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
              <dt>Transport</dt>
              <dd className="min-w-0 truncate text-foreground">{mcpRelayAddress()} · loopback</dd>
              <dt>Version</dt>
              <dd className="text-foreground">{version ? `MCP ${version}` : 'Non détectée'}</dd>
              <dt>Activité</dt>
              <dd className="text-foreground">
                {batches} lot{batches > 1 ? 's' : ''} · {calls} appel{calls > 1 ? 's' : ''}
              </dd>
            </dl>
            <p className="mt-2 max-w-[65ch]">
              Un seul onglet ScreenForge reçoit les appels. L’agent peut lire l’état et une
              miniature rendue, puis créer ou modifier les écrans du projet ouvert. Le jeton de
              session n’est jamais affiché ni conservé.
            </p>
          </details>
        </SetupFlow>
      </div>
    </Dialog>
  )
}
