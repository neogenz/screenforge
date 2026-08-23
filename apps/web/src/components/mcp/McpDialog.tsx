import { AlertCircle, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { DialogShell } from '@/components/patterns/dialog-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SetupCommand, SetupFlow, SetupProgress, SetupStep } from '@/components/patterns/setup-flow'
import type { SetupStepState } from '@/components/patterns/setup-flow'
import { StatusChip, type StatusTone } from '@/components/patterns/status-chip'
import {
  disableMcp,
  enableMcp,
  MCP_COMMAND,
  mcpRelayAddress,
  probeMcpDaemon,
  type McpProbe,
} from '@/lib/mcp/client'
import { MCP_LABELS, projectMcpSteps, useMcpStore, type McpStatus } from '@/stores/mcp.store'
import { useUIStore } from '@/stores/ui.store'
import { cn } from '@/lib/utils'

/** off patiente, connecting progresse, live confirme, error alerte — même palette que `ProjectSwitcher`. */
const MCP_STATUS_TONE: Record<McpStatus, StatusTone> = {
  off: 'neutral',
  connecting: 'pulse',
  live: 'success',
  error: 'warning',
}

const CODE_FIELD_ID = 'mcp-pairing-code'

/**
 * Brancher un agent sur le projet ouvert, marche par marche.
 *
 * Ce qui existait avant : un champ « Code à 6 chiffres affiché par le démon »,
 * un bouton, et quatre marches décoratives. Trois choses fausses en même temps,
 * mesurées sur la boîte au rechargement — le bandeau annonçait « Injoignable »
 * sans avoir rien sondé, la première marche se cochait « Démon MCP joignable »
 * sans l'avoir vérifié davantage, et le champ s'ouvrait barré de rouge avant la
 * moindre frappe. Restait une seule chose actionnable, un champ réclamant un
 * nombre dont rien ne disait ni ce qui l'affiche, ni comment le faire afficher.
 *
 * Trois principes, repris de `AssistantSetup`, qui a corrigé exactement cela
 * pour le pont :
 *
 * **Ce qui peut être constaté n'est pas demandé.** `GET /hello` répond sans
 * jeton et sans consommer de tentative d'appairage : la page sait donc si le
 * démon tourne, et sur quelle version, avant de réclamer quoi que ce soit. La
 * première marche est un état, pas une consigne, et son bouton relit cet état.
 *
 * **Ce qu'il faut lancer est écrit avant d'en avoir besoin.** La commande
 * n'apparaissait qu'en cas d'échec sur la marche du démon — donc jamais dans
 * l'état où la boîte s'ouvrait. Elle est maintenant la première chose lisible,
 * avec l'endroit d'où la lancer, parce que `--filter` ne trouve aucun paquet
 * « mcp » hors de cet espace de travail.
 *
 * **Le code est décrit par où il apparaît.** Le démon l'écrit dans le terminal
 * qui vient de le lancer, et le renouvelle toutes les cinq minutes : les deux
 * faits sont nécessaires pour aller le chercher, et aucun des deux n'était dit.
 */
export function McpDialog() {
  const [code, setCode] = useState('')
  const [probe, setProbe] = useState<McpProbe | null>(null)
  const codeRef = useRef<HTMLInputElement>(null)
  const disableRef = useRef<HTMLButtonElement>(null)
  /** Le rang de la dernière sonde demandée — voir `recheck`. */
  const probeRank = useRef(0)
  const status = useMcpStore((state) => state.status)
  const connectionStep = useMcpStore((state) => state.connectionStep)
  const message = useMcpStore((state) => state.message)
  const version = useMcpStore((state) => state.daemonVersion)
  const batches = useMcpStore((state) => state.appliedBatches)
  const calls = useMcpStore((state) => state.appliedCalls)

  /**
   * Le démon est sondé à l'ouverture, et relu sur demande.
   *
   * Sans jeton, sans coût et sans effet : il n'y a rien à autoriser pour
   * apprendre qu'un port local écoute. C'est ce qui permet à la première marche
   * de porter un résultat au moment où on la lit, plutôt qu'après une tentative.
   */
  useEffect(() => {
    let cancelled = false
    void probeMcpDaemon().then((answer) => {
      if (!cancelled) setProbe(answer)
    })
    return () => {
      cancelled = true
    }
  }, [])

  function recheck() {
    setProbe(null)
    // Même intention que le `cancelled` de l'effet ci-dessus, sur l'autre
    // source : deux « Vérifier » rapprochés partent en parallèle, et sans ce
    // rang la première réponse revenue repeint la marche, fût-elle la plus
    // ancienne. Depuis que la sonde s'abandonne au bout de trois secondes, une
    // relance pendant l'attente est le geste normal, pas le cas tordu.
    const mine = ++probeRank.current
    void probeMcpDaemon().then((answer) => {
      if (mine === probeRank.current) setProbe(answer)
    })
  }

  /**
   * Deux sources, jamais en même temps.
   *
   * Tant que rien n'a été tenté (`off`), c'est la sonde qui décrit le parcours :
   * le store, lui, ne sait encore rien. Dès qu'un appairage est en vol, le cycle
   * de connexion reprend la main — il est le seul à distinguer un code refusé
   * d'un flux tombé. Faire décider les deux à la fois est ce qui produisait une
   * marche cochée sous un bandeau en erreur.
   */
  const attempted = status !== 'off'
  const cycle = projectMcpSteps(status, connectionStep)
  const daemonUp = probe?.state === 'up'
  const steps: Record<'daemon' | 'pairing' | 'editor' | 'ready', SetupStepState> = attempted
    ? cycle
    : {
        daemon: daemonUp ? 'done' : probe ? 'error' : 'active',
        pairing: daemonUp ? 'active' : 'waiting',
        editor: 'waiting',
        ready: 'waiting',
      }
  const completed = attempted
    ? status === 'live'
      ? 4
      : connectionStep === 'ready'
        ? 3
        : connectionStep === 'editor'
          ? 2
          : connectionStep === 'pairing'
            ? 1
            : 0
    : daemonUp
      ? 1
      : 0

  const close = () => useUIStore.getState().setShowMcpDialog(false)
  const activate = () => void enableMcp(code)
  const deactivate = () => {
    void disableMcp().then(() => {
      setCode('')
      recheck()
    })
  }

  /** Le code ne sert à rien tant que personne n'écoute : le champ le dit. */
  const codeUsable = attempted || daemonUp
  const codeRefused = status === 'error' && connectionStep === 'pairing'
  /**
   * La version, d'où qu'elle vienne.
   *
   * La sonde la connaît avant l'appairage, le store après : la marche affiche
   * la même phrase des deux côtés plutôt que « MCP » tout court sur la moitié
   * du parcours.
   */
  const daemonVersion = version || (probe?.state === 'up' ? probe.version : '')

  /**
   * Le focus suit la marche qui vient de s'ouvrir.
   *
   * Un code refusé ramène au champ ; une liaison établie amène au seul geste
   * qui reste. La marche 2 renferme désormais son champ, donc « le démon vient
   * de répondre » est aussi un moment où le focus a quelque part où aller —
   * sans quoi il resterait sur « Vérifier », sur une marche déjà franchie.
   */
  useEffect(() => {
    if (status === 'live') disableRef.current?.focus()
    else if (codeRefused || (!attempted && daemonUp)) codeRef.current?.focus()
  }, [status, codeRefused, attempted, daemonUp])

  const footer =
    status === 'connecting' ? (
      <Button variant="default" loading>
        Appairer
      </Button>
    ) : status === 'live' ? (
      <Button ref={disableRef} variant="outline" onClick={deactivate}>
        Désactiver
      </Button>
    ) : (
      <Button variant="default" onClick={activate} disabled={!codeUsable || !/^\d{6}$/.test(code)}>
        Appairer
      </Button>
    )

  function daemonLine() {
    if (attempted && status === 'error' && connectionStep === 'daemon') return message
    if (!probe) return 'Recherche du démon sur l’adresse loopback…'
    if (probe.state === 'up') return `Démon MCP ${probe.version} joignable.`
    return probe.message
  }

  return (
    <DialogShell
      open
      onClose={close}
      title="Connexion MCP"
      size="md"
      footerNote="Désactiver coupe le flux et annule tout import MCP encore en cours."
      footer={footer}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          {/* Ce que le mode fait, et par quoi il passe : « démon » est le mot que
            toutes les marches emploient ensuite, il se paie une fois ici. */}
          <p className="max-w-[65ch] text-sm text-muted-foreground">
            Un agent externe peut piloter le projet actuellement ouvert dans ScreenForge. Il ne lui
            parle jamais directement : un démon lancé sur cet ordinateur fait le relais, et rien ne
            quitte la machine.
          </p>
          <p
            role="status"
            aria-live="polite"
            aria-label="État de la connexion"
            className="shrink-0"
          >
            <StatusChip tone={MCP_STATUS_TONE[status]}>{MCP_LABELS[status]}</StatusChip>
          </p>
        </div>

        <SetupFlow>
          <div className="flex flex-col gap-3 px-3 py-3">
            <SetupProgress label="Progression de la connexion MCP" value={completed} max={4} />

            <SetupStep
              rank={1}
              title="Lancez le démon sur votre ordinateur"
              state={steps.daemon}
              result={`Démon MCP ${daemonVersion} joignable.`}
              announce={false}
            >
              {/* Où, et pas seulement quoi : `--filter` ne trouve aucun paquet
                « mcp » hors de cet espace de travail, et l'échec ressemble alors
                à un démon cassé. Même piège que la commande du pont. */}
              <p className="text-xs text-muted-foreground">
                Dans un terminal, depuis le dossier où vous avez cloné ScreenForge :
              </p>
              <SetupCommand command={MCP_COMMAND} />
              <p
                role={steps.daemon === 'error' ? 'alert' : 'status'}
                className={cn(
                  'flex items-start gap-1.5 text-xs',
                  steps.daemon === 'error' ? 'text-warning' : 'text-muted-foreground',
                )}
              >
                {steps.daemon === 'error' && (
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                )}
                {daemonLine()}
              </p>
              <div>
                <Button variant="outline" onClick={attempted ? activate : recheck}>
                  <RefreshCw aria-hidden />
                  {attempted ? 'Réessayer' : 'Vérifier'}
                </Button>
              </div>
            </SetupStep>

            <SetupStep
              rank={2}
              title="Recopiez le code affiché par le démon"
              state={steps.pairing}
              result="Code accepté et session éphémère créée."
              announce={false}
            >
              {/* Le champ ne dit plus « code affiché par le démon » à quelqu'un
                qui n'a aucun moyen de savoir où regarder : la phrase cite la
                ligne exacte que le terminal vient d'écrire. */}
              <p className="text-xs text-muted-foreground">
                Le démon écrit dans ce même terminal une ligne «&nbsp;Code d’appairage ScreenForge :
                123456&nbsp;». C’est ce nombre. Il est renouvelé toutes les cinq minutes et ne sert
                qu’une fois : prenez le dernier affiché.
              </p>
              <div className="flex flex-col gap-2">
                {/* Le nom que le terminal vient d'imprimer, pas une paraphrase :
                  la phrase au-dessus dit déjà d'où il vient, et « Code à 6
                  chiffres affiché par le démon » le redisait mot pour mot. */}
                <label htmlFor={CODE_FIELD_ID} className="text-xs text-muted-foreground">
                  Code d’appairage
                </label>
                <Input
                  ref={codeRef}
                  id={CODE_FIELD_ID}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  disabled={!codeUsable}
                  aria-invalid={codeRefused}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                />
                {codeRefused && (
                  <p role="alert" className="text-xs text-destructive">
                    {message}
                  </p>
                )}
              </div>
            </SetupStep>

            <SetupStep
              rank={3}
              title="Éditeur ScreenForge"
              state={steps.editor}
              result="Flux appairé et projet synchronisé."
              announce={false}
            >
              {status === 'error' ? (
                <p role="alert" className="text-xs text-destructive">
                  {message}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Le flux local est ouvert. ScreenForge transmet l’état initial du projet.
                </p>
              )}
            </SetupStep>

            <SetupStep rank={4} title="Prêt pour l’agent" state={steps.ready} announce={false}>
              <p className="text-xs text-muted-foreground">
                L’agent peut maintenant lire, rendre et modifier ce projet tant que le mode reste
                actif.
              </p>
            </SetupStep>
          </div>

          <details className="border-t px-3 py-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none font-medium hover:text-foreground">
              Détails de connexion
            </summary>
            <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
              <dt>Transport</dt>
              <dd className="min-w-0 truncate text-foreground">{mcpRelayAddress()} · loopback</dd>
              <dt>Version</dt>
              {/* `daemonVersion` et non `version` : la sonde la connaît avant
                l'appairage, et lire le store seul écrivait « Non détectée » sous
                une marche 1 qui venait d'annoncer « Démon MCP 0.1.0 joignable ».
                « Non détectée » reste le cas où ni la sonde ni le store ne
                savent. */}
              <dd className="text-foreground">
                {daemonVersion ? `MCP ${daemonVersion}` : 'Non détectée'}
              </dd>
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
    </DialogShell>
  )
}
