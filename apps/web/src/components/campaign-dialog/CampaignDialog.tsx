import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Check, ChevronDown, ImageUp, Plug, Sparkles, Wand2 } from 'lucide-react'
import { registerAsset } from '@/lib/assets'
import {
  DIRECTIONS,
  direction as directionOf,
  planToolCalls,
  restyleCalls,
  type BriefScreenshot,
  type CampaignBrief,
  type CampaignPlan,
  type DirectionId,
} from '@/lib/ai/plan'
import { commitAiRun, discardAiAssets, planCampaign } from '@/lib/ai/run'
import { isCampaignPlan } from '@/lib/ai/plan'
import { connectBridge, setBridgeToken, type BridgeStatus } from '@/lib/bridge-client'
import { AI_PROVIDERS, aiProvider, type ProviderId } from '@/lib/ai/providers'
import {
  imageImportErrorMessage,
  importImageFile,
  CONTENT_IMAGE_TYPES,
  IMAGE_ACCEPT,
  SCREENSHOT_IMAGE_ACCEPT,
  SCREENSHOT_IMAGE_TYPES,
} from '@/lib/image'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { getActiveScreen, useProjectStore } from '@/stores/project.store'
import { useUIStore } from '@/stores/ui.store'
import { toast } from '@/stores/toast.store'
import type { Project } from '@/types'

const NAME_FIELD_ID = 'sf-campaign-name'
const PITCH_FIELD_ID = 'sf-campaign-pitch'
const TOKEN_FIELD_ID = 'sf-campaign-token'
const ASSIST_PANEL_ID = 'sf-campaign-assist'

/**
 * Composer une campagne d'un coup, puis la corriger comme le reste.
 *
 * La boîte tient en deux temps : le brief, puis le plan. Le plan est relu avant
 * que quoi que ce soit ne soit posé — c'est la différence entre une génération
 * qu'on subit et une qu'on accepte. Ce qui en sort est fait de calques
 * ScreenForge ordinaires : chaque écran, chaque titre, chaque appareil se
 * reprend ensuite au clavier, à la souris et à l'export, sans rien savoir de la
 * façon dont il est né.
 */
export function CampaignDialog() {
  const showCampaignDialog = useUIStore((state) => state.showCampaignDialog)
  const project = useProjectStore((state) => state.project)

  if (!showCampaignDialog || !project) return null
  return <CampaignDialogContent project={project} />
}

interface LoadedShot extends BriefScreenshot {
  assetId: string
  size: { width: number; height: number }
}

function CampaignDialogContent({ project }: { project: Project }) {
  const close = () => useUIStore.getState().setShowCampaignDialog(false)
  const shotsInput = useRef<HTMLInputElement>(null)
  const logoInput = useRef<HTMLInputElement>(null)

  const [appName, setAppName] = useState(project.name)
  const [pitch, setPitch] = useState('')
  const [direction, setDirection] = useState<DirectionId>('sobre')
  const [shots, setShots] = useState<LoadedShot[]>([])
  const [logo, setLogo] = useState<{ assetId: string; size: { width: number; height: number } }>()
  const [plan, setPlan] = useState<CampaignPlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [providerId, setProviderId] = useState<ProviderId>('local')
  /* Le jeton d'appairage vit ici et nulle part ailleurs : il disparaît à la
     fermeture de l'onglet, comme celui du pont disparaît avec son processus.
     Rien ne l'écrit dans un stockage, un projet ou un journal. */
  const [token, setToken] = useState('')
  const [bridge, setBridge] = useState<BridgeStatus>({ state: 'idle' })
  const [model, setModel] = useState('')
  /* Ce que ce run a enregistré, pour pouvoir le rendre au néant s'il est
     abandonné. La ref plutôt que l'état : rien ne s'affiche à partir d'elle, et
     elle est lue dans un démontage. */
  const registered = useRef<string[]>([])
  const accepted = useRef(false)

  useEffect(
    () => () => {
      if (!accepted.current) discardAiAssets(registered.current)
    },
    [],
  )

  const brief: CampaignBrief = useMemo(
    () => ({
      appName: appName.trim() || project.name,
      pitch,
      direction,
      deviceModel: project.globals.deviceModel,
      screenshots: shots,
      logo,
    }),
    [appName, pitch, direction, project.globals.deviceModel, project.name, shots, logo],
  )

  const activeScreen = getActiveScreen(project)

  async function loadShots(chosen: File[]) {
    if (chosen.length === 0) return
    setBusy(true)
    setError(null)
    try {
      // Tout décodé avant le moindre enregistrement : un fichier illisible
      // arrête le lot, et le registre n'a rien vu.
      const images = await Promise.all(
        chosen.map((file) => importImageFile(file, SCREENSHOT_IMAGE_TYPES)),
      )
      const loaded = images.map((image, index) => {
        const assetId = registerAsset(image.dataUrl)
        registered.current.push(assetId)
        return {
          label: chosen[index].name.replace(/\.[^.]+$/, ''),
          assetId,
          size: { width: image.width, height: image.height },
        }
      })
      setShots(loaded)
      setPlan(null)
    } catch (cause) {
      setError(imageImportErrorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  async function loadLogo(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const image = await importImageFile(file, CONTENT_IMAGE_TYPES)
      const assetId = registerAsset(image.dataUrl)
      registered.current.push(assetId)
      setLogo({ assetId, size: { width: image.width, height: image.height } })
      setPlan(null)
    } catch (cause) {
      setError(imageImportErrorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  async function connect() {
    setBridge({ state: 'checking' })
    const status = await connectBridge(token.trim())
    setBridge(status)
    /* Retenu pour la session, en mémoire de module : la boîte des langues parle
       au même pont, et faire retaper le même secret par boîte serait une
       cérémonie sans gain de sécurité. Il meurt au rechargement de la page. */
    if (status.state === 'ready') {
      setBridgeToken('codex', token)
      setModel(status.models[0]?.id ?? '')
    }
  }

  const connected = bridge.state === 'ready'

  async function compose() {
    setBusy(true)
    setError(null)
    try {
      const proposal = await planCampaign(brief, {
        provider: providerId,
        token: connected ? token.trim() : undefined,
        model: model || undefined,
      })
      // Un plan est une entrée non fiable, même quand il vient d'ici : demain
      // il viendra d'ailleurs, et la boîte ne le saura pas.
      if (!isCampaignPlan(proposal)) {
        setError('Le plan proposé est invalide : rien n’a été posé.')
        return
      }
      setPlan(proposal)
    } catch (cause) {
      /* Le fournisseur distant a lâché. Le message vient du pont, qui sait
         pourquoi ; la boîte reste ouverte et la composition locale reste à un
         clic — un échec de génération ne coûte pas le brief. */
      setError(cause instanceof Error ? cause.message : 'La proposition a échoué.')
    } finally {
      setBusy(false)
    }
  }

  function accept() {
    if (!plan) return
    const outcome = commitAiRun(planToolCalls(plan, brief), {
      assetIds: registered.current,
    })
    if (!outcome.committed) {
      setError(outcome.error ?? 'La composition a échoué : le projet est resté inchangé.')
      return
    }
    accepted.current = true
    toast(
      `${outcome.screenIds.length} planche${outcome.screenIds.length > 1 ? 's' : ''} composée${
        outcome.screenIds.length > 1 ? 's' : ''
      }.`,
      'success',
    )
    close()
  }

  function harmonize() {
    if (!activeScreen) return
    const outcome = commitAiRun(restyleCalls(activeScreen.layers, direction), {
      screenId: activeScreen.id,
    })
    if (!outcome.committed) {
      setError(outcome.error ?? 'L’harmonisation a échoué : le projet est resté inchangé.')
      return
    }
    accepted.current = true
    toast(`Écran « ${activeScreen.name} » harmonisé.`, 'success')
    close()
  }

  return (
    <Dialog
      open
      onClose={busy ? () => undefined : close}
      title="Composer une campagne"
      size="lg"
      flush
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          {/* Ce que la composition implique, dit à l'endroit où on la lance —
              pas dans une page d'aide. La phrase change avec le fournisseur :
              « tout reste ici » cesserait d'être vrai dès le pont branché. */}
          <p className="text-2xs text-muted-foreground">
            {providerId === 'local' || !connected
              ? 'Tout est composé sur votre appareil, en calques modifiables.'
              : 'Le texte du brief part vers Codex. Les images restent ici. Le résultat est en calques modifiables.'}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="default" onClick={close} disabled={busy}>
              Annuler
            </Button>
            {plan ? (
              <Button variant="primary" onClick={accept} disabled={busy}>
                <Sparkles size={12} aria-hidden />
                Poser {plan.screens.length} planche{plan.screens.length > 1 ? 's' : ''}
              </Button>
            ) : (
              <Button variant="primary" onClick={() => void compose()} loading={busy}>
                <Wand2 size={12} aria-hidden />
                Proposer un plan
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="flex max-h-[60dvh] flex-col gap-4 overflow-y-auto px-6 py-4">
        {error && (
          <p role="alert" className="flex items-start gap-2 text-2xs text-destructive">
            <AlertCircle size={13} className="mt-0.5 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Field id={NAME_FIELD_ID} label="Nom de l’application">
            <Input
              id={NAME_FIELD_ID}
              font="sans"
              value={appName}
              maxLength={60}
              disabled={busy}
              onChange={(event) => setAppName(event.target.value)}
            />
          </Field>
          <Field id={PITCH_FIELD_ID} label="Ce qu’elle fait, en une phrase">
            <Input
              id={PITCH_FIELD_ID}
              font="sans"
              value={pitch}
              maxLength={140}
              placeholder="Le suivi de budget qui tient dans une poche"
              disabled={busy}
              onChange={(event) => setPitch(event.target.value)}
            />
          </Field>
        </div>

        <div>
          <h3 className="section-title">Direction visuelle</h3>
          <div
            className="mt-2 flex flex-wrap gap-2"
            role="radiogroup"
            aria-label="Direction visuelle"
          >
            {DIRECTIONS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="radio"
                aria-checked={entry.id === direction}
                disabled={busy}
                onClick={() => {
                  setDirection(entry.id)
                  setPlan(null)
                }}
                className={cn(
                  'flex items-center gap-2 rounded-md border px-3 py-2 text-2xs transition-colors',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground',
                  entry.id === direction
                    ? 'border-foreground bg-muted text-foreground'
                    : 'border-border text-muted-foreground hover:border-input',
                )}
              >
                <span
                  aria-hidden
                  className="size-4 rounded-sm border border-border"
                  style={{ background: entry.background }}
                />
                {entry.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="default" onClick={() => shotsInput.current?.click()} disabled={busy}>
            <ImageUp size={12} aria-hidden />
            {shots.length > 0 ? `${shots.length} captures` : 'Choisir les captures…'}
          </Button>
          <Button variant="default" onClick={() => logoInput.current?.click()} disabled={busy}>
            <ImageUp size={12} aria-hidden />
            {logo ? 'Logo choisi' : 'Logo (facultatif)…'}
          </Button>
          <p className="text-2xs text-muted-foreground">
            Une planche par capture. Sans capture, la campagne est composée à vide.
          </p>
        </div>

        <input
          ref={shotsInput}
          type="file"
          multiple
          accept={SCREENSHOT_IMAGE_ACCEPT}
          aria-label="Captures de l’application"
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            const chosen = [...(event.target.files ?? [])]
            event.target.value = ''
            void loadShots(chosen)
          }}
        />
        <input
          ref={logoInput}
          type="file"
          accept={IMAGE_ACCEPT}
          aria-label="Logo de l’application"
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            const chosen = event.target.files?.[0]
            event.target.value = ''
            void loadLogo(chosen)
          }}
        />

        <AssistancePanel
          providerId={providerId}
          onProvider={(next) => {
            setProviderId(next)
            setPlan(null)
          }}
          token={token}
          onToken={setToken}
          bridge={bridge}
          onConnect={() => void connect()}
          model={model}
          onModel={setModel}
          busy={busy}
        />

        {plan ? <PlanReview plan={plan} /> : null}

        {activeScreen && (
          <div className="border-t border-border pt-4">
            <h3 className="section-title">Retoucher l’écran courant</h3>
            <p className="mt-1 text-2xs text-muted-foreground">
              Applique la direction choisie à « {activeScreen.name} » seulement : fond, encre des
              textes, teinte des formes. Rien n’est créé, rien n’est supprimé.
            </p>
            <Button variant="default" className="mt-2" onClick={harmonize} disabled={busy}>
              <Wand2 size={12} aria-hidden />
              Harmoniser cet écran
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  )
}

interface AssistanceProps {
  providerId: ProviderId
  onProvider: (id: ProviderId) => void
  token: string
  onToken: (value: string) => void
  bridge: BridgeStatus
  onConnect: () => void
  model: string
  onModel: (id: string) => void
  busy: boolean
}

/**
 * Le choix du fournisseur, replié tant qu'on ne le cherche pas.
 *
 * Un seul chemin est proposé par défaut, et c'est celui qui marche sans rien
 * installer ni connecter. Le reste est derrière une divulgation : un utilisateur
 * qui ouvre « Composer une campagne » veut des planches, pas un formulaire de
 * connexion. Replié ne veut pas dire caché — l'en-tête dit toujours quel
 * fournisseur est actif, sinon la divulgation deviendrait un réglage qu'on
 * oublie avoir changé.
 *
 * Ce qui est écrit ici l'est parce que c'est vérifiable : où passent les
 * données, ce que le pont sait faire, pourquoi le jeton n'est stocké nulle part.
 */
function AssistancePanel({
  providerId,
  onProvider,
  token,
  onToken,
  bridge,
  onConnect,
  model,
  onModel,
  busy,
}: AssistanceProps) {
  const [open, setOpen] = useState(false)
  const active = aiProvider(providerId)

  return (
    <div className="border-t border-border pt-4">
      <h3 className="section-title">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={ASSIST_PANEL_ID}
          onClick={() => setOpen((was) => !was)}
          className="flex w-full items-center gap-1.5 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground"
        >
          <ChevronDown
            size={12}
            aria-hidden
            className={cn('transition-transform duration-150', open ? '' : '-rotate-90')}
          />
          Assistance
          <span className="ml-auto font-normal text-muted-foreground">{active.label}</span>
        </button>
      </h3>

      <div id={ASSIST_PANEL_ID} hidden={!open}>
        <div className="mt-2 flex flex-col gap-2" role="radiogroup" aria-label="Fournisseur">
          {AI_PROVIDERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="radio"
              aria-checked={entry.id === providerId}
              disabled={busy}
              onClick={() => onProvider(entry.id)}
              className={cn(
                'flex flex-col gap-0.5 rounded-md border px-3 py-2 text-left text-2xs transition-colors',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground',
                entry.id === providerId
                  ? 'border-foreground bg-muted'
                  : 'border-border hover:border-input',
              )}
            >
              <span className="flex items-center gap-1.5 text-foreground">
                {entry.id === providerId && <Check size={11} aria-hidden />}
                {entry.label}
                {entry.recommended && <span className="text-muted-foreground">· recommandé</span>}
              </span>
              <span className="text-muted-foreground">{entry.summary}</span>
              <span className="text-muted-foreground">{entry.dataPath}</span>
            </button>
          ))}
        </div>

        {providerId === 'codex-bridge' && (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-2xs text-muted-foreground">
              Lancez le pont avec <code>pnpm --filter bridge run start</code>, puis recopiez le
              jeton qu’il affiche. Il n’est enregistré nulle part : ni dans le projet, ni dans le
              navigateur. Il faudra le ressaisir au prochain démarrage.
            </p>
            <div className="flex items-end gap-2">
              <Field id={TOKEN_FIELD_ID} label="Jeton d’appairage" className="min-w-0 flex-1">
                <Input
                  id={TOKEN_FIELD_ID}
                  font="sans"
                  type="password"
                  autoComplete="off"
                  value={token}
                  disabled={busy}
                  placeholder="Affiché par le pont à son démarrage"
                  onChange={(event) => onToken(event.target.value)}
                />
              </Field>
              <Button
                variant="default"
                onClick={onConnect}
                disabled={busy || token.trim().length === 0}
                loading={bridge.state === 'checking'}
              >
                <Plug size={12} aria-hidden />
                Connecter
              </Button>
            </div>

            {bridge.state === 'error' && (
              <p role="alert" className="flex items-start gap-2 text-2xs text-destructive">
                <AlertCircle size={13} className="mt-0.5 shrink-0" aria-hidden />
                {bridge.message}
              </p>
            )}

            {bridge.state === 'ready' && (
              <>
                <p role="status" className="text-2xs text-muted-foreground">
                  Connecté · {bridge.hello.codexVersion ?? 'codex'} · jeton version{' '}
                  {bridge.hello.tokenVersions.codex}
                  {bridge.hello.capabilities.reasoning ? ' · raisonnement' : ''}
                </p>
                <Select
                  aria-label="Modèle"
                  label="Modèle"
                  value={model}
                  disabled={busy || bridge.models.length === 0}
                  onChange={(event) => onModel(event.target.value)}
                >
                  {bridge.models.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.displayName}
                    </option>
                  ))}
                </Select>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Le plan, avant qu'il ne devienne des calques.
 *
 * Il est montré tel qu'il sera exécuté — une ligne par planche, dans l'ordre —
 * parce que c'est la dernière occasion de dire non pour un coût nul.
 */
function PlanReview({ plan }: { plan: CampaignPlan }) {
  const palette = directionOf(plan.direction)
  return (
    <div className="border-t border-border pt-4">
      <h3 className="section-title">Plan proposé</h3>
      <p className="mt-1 text-2xs text-muted-foreground">
        {plan.screens.length} planche{plan.screens.length > 1 ? 's' : ''} · direction «{' '}
        {palette.label} » · rien n’est posé tant que vous n’avez pas accepté.
      </p>
      <ol className="mt-2 flex flex-col gap-1">
        {plan.screens.map((screen, index) => (
          <li
            key={`${screen.name}-${index}`}
            className="flex items-baseline gap-2 text-2xs text-muted-foreground"
          >
            <span className="tabular text-foreground">{index + 1}.</span>
            <span className="min-w-0">
              <span className="text-foreground">{screen.name}</span> — « {screen.headline} »
              {screen.slot ? ` · rôle ${screen.slot}` : ''}
              {screen.screenshotIndex === undefined ? '' : ' · capture posée'}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
