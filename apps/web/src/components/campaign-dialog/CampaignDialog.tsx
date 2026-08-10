import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, ImageUp, Sparkles, Wand2 } from 'lucide-react'
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
import { getActiveScreen, useProjectStore } from '@/stores/project.store'
import { useUIStore } from '@/stores/ui.store'
import { toast } from '@/stores/toast.store'
import type { Project } from '@/types'

const NAME_FIELD_ID = 'sf-campaign-name'
const PITCH_FIELD_ID = 'sf-campaign-pitch'

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

  async function compose() {
    setBusy(true)
    setError(null)
    try {
      const proposal = await planCampaign(brief)
      // Un plan est une entrée non fiable, même quand il vient d'ici : demain
      // il viendra d'ailleurs, et la boîte ne le saura pas.
      if (!isCampaignPlan(proposal)) {
        setError('Le plan proposé est invalide : rien n’a été posé.')
        return
      }
      setPlan(proposal)
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
          <p className="text-2xs text-muted-foreground">
            Tout est composé sur votre appareil, en calques modifiables.
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
