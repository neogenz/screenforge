import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  Check,
  ChevronDown,
  ImageUp,
  Megaphone,
  Paintbrush,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { registerAsset } from '@/lib/assets'
import {
  DIRECTIONS,
  isCampaignPlan,
  planScreenLayout,
  planToolCalls,
  resolvePalette,
  restyleCalls,
  type BriefScreenshot,
  type CampaignBrief,
  type CampaignPlan,
  type DirectionId,
} from '@/lib/ai/plan'
import { paletteFromScreenshots, type Palette } from '@/lib/ai/palette'
import { PlanPreview } from '@/components/campaign-dialog/PlanPreview'
import { commitAiRun, discardAiAssets, planCampaign } from '@/lib/ai/run'
import { archetypeSpec } from '@/lib/ai/archetypes'
import { AI_LIMITS } from '@/lib/ai/tools'
import { connectBridge, setBridgeToken } from '@/lib/bridge-client'
import { connectApiProvider, setApiKey } from '@/lib/ai/direct-api'
import { aiProvider, type ProviderId } from '@/lib/ai/providers'
import { AssistantSetup } from '@/components/campaign-dialog/AssistantSetup'
import {
  assistantSession,
  rememberAssistant,
  restoreAssistant,
  type AssistantConnection,
} from '@/lib/ai/session'
import { forgetStoredSecret } from '@/lib/ai/key-store'
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
const URL_FIELD_ID = 'sf-campaign-url'
const COUNT_FIELD_ID = 'sf-campaign-count'
const HEADLINE_FIELD_ID = 'sf-campaign-headline'
const ASSIST_PANEL_ID = 'sf-campaign-assist'

/** Le défaut quand aucune capture n'est encore déposée : Apple en montre trois. */
const DEFAULT_SCREEN_COUNT = 4

/**
 * Générer les visuels de la fiche App Store, puis les corriger comme le reste.
 *
 * La boîte tient en deux temps : le brief, puis le plan. Le plan est relu avant
 * que quoi que ce soit ne soit posé — c'est la différence entre une génération
 * qu'on subit et une qu'on accepte. Ce qui en sort est fait de calques
 * ScreenForge ordinaires : chaque écran, chaque titre, chaque appareil se
 * reprend ensuite au clavier, à la souris et à l'export, sans rien savoir de la
 * façon dont il est né.
 *
 * Le vocabulaire est celui de l'App Store, pas celui de l'implémentation.
 * « Composition locale » et « Assistance » nommaient des choses vraies —
 * l'absence de réseau, le choix du fournisseur — que personne n'était venu
 * chercher : l'utilisateur vient faire des images pour sa fiche. Le fournisseur
 * s'appelle donc par ce qu'il change pour lui, « qui écrit les accroches », et
 * le premier dit lui-même qu'il ne rédige pas. Une interface qui promet une IA
 * sur un gabarit déterministe se paie deux fois : à l'essai, puis en confiance.
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
  const [landingUrl, setLandingUrl] = useState('')
  const [direction, setDirection] = useState<DirectionId>('sobre')
  /* La palette lue dans les captures et le fait de s'en servir sont deux états :
     l'utilisateur peut revenir à « Sobre » puis y retourner sans relire les
     pixels, et un nouveau lot de captures remplace la palette sans annuler le
     choix. */
  const [shotPalette, setShotPalette] = useState<Palette | null>(null)
  const [useShotPalette, setUseShotPalette] = useState(false)
  const [chosenCount, setChosenCount] = useState(DEFAULT_SCREEN_COUNT)
  const [shots, setShots] = useState<LoadedShot[]>([])
  const [logo, setLogo] = useState<{ assetId: string; size: { width: number; height: number } }>()
  const [plan, setPlan] = useState<CampaignPlan | null>(null)
  /* Le visuel en cours de relecture. Un index et non l'objet : la revue édite
     le plan, et garder une copie du visuel focalisé ferait deux vérités dont
     l'une vieillit à la première frappe. */
  const [focus, setFocus] = useState(0)
  const [regenerating, setRegenerating] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  /*
     L'appairage est repris de la session, pas reconstruit à chaque ouverture.

     Générer ferme la boîte : quand l'état vivait ici, chaque génération coûtait
     de relancer le pont, recoller le jeton et rechoisir le modèle. Voir
     `lib/ai/session.ts` pour ce que la session porte, et `lib/ai/key-store.ts`
     pour ce qui survit à l'onglet — une clé d'API, scellée ; jamais le jeton du
     pont, qui meurt avec son processus.
  */
  const [restored] = useState(assistantSession)
  const [providerId, setProviderId] = useState<ProviderId>(restored.providerId)
  const [secret, setSecret] = useState(restored.secret)
  const [connection, setConnection] = useState<AssistantConnection>(restored.connection)
  const [model, setModel] = useState(restored.model)

  /* La lecture du disque est asynchrone et la boîte est chargée à la demande :
     le module et le composant arrivent ensemble, donc la valeur initiale
     ci-dessus est la meilleure hypothèse et celle-ci est la réponse. Elle ne
     s'applique qu'à une session vierge — `restoreAssistant` le vérifie — donc
     ce qui aurait été saisi entre-temps n'est pas écrasé. */
  useEffect(() => {
    let cancelled = false
    void restoreAssistant().then((settled) => {
      if (cancelled) return
      setProviderId(settled.providerId)
      setSecret(settled.secret)
      setConnection(settled.connection)
      setModel(settled.model)
    })
    return () => {
      cancelled = true
    }
  }, [])

  /* Une seule écriture, en effet, plutôt qu'un miroir dans chaque `setState` :
     quatre points d'écriture auraient dérivé au premier oubli, et écrire pendant
     le rendu ferait de la session un effet de bord du rendu. */
  useEffect(() => {
    rememberAssistant({ providerId, secret, connection, model })
  }, [providerId, secret, connection, model])
  /* Ce que ce run a enregistré, pour pouvoir le rendre au néant s'il est
     abandonné. La ref plutôt que l'état : rien ne s'affiche à partir d'elle, et
     elle est lue dans un démontage. */
  const registered = useRef<string[]>([])

  /*
   * Le nettoyage ne se demande pas si le run a été accepté : il ne libère que
   * ce que le projet ne référence pas.
   *
   * `discardAiAssets` relit le projet courant et protège tout ce qu'il tient,
   * donc les captures posées survivent d'elles-mêmes. Un drapeau « accepté »
   * n'ajoutait rien et retranchait : il couvrait aussi ce qu'un run accepté
   * n'avait *pas* posé — le logo laissé de côté, les captures au-delà de dix,
   * celles d'un premier import remplacé — et ces fichiers-là restaient dans
   * IndexedDB jusqu'au balayage du chargement suivant. Accepter puis fermer
   * est une seule tournée de rendu : personne ne peut annuler entre les deux,
   * donc le projet référence encore ce qu'il vient de recevoir.
   */
  useEffect(() => () => discardAiAssets(registered.current), [])

  const palette = useShotPalette && shotPalette ? shotPalette : undefined

  /* La place qui reste, pas ce que l'App Store accepte en tout.
     `add_screen` refuse dès que le projet porte dix écrans, or un projet neuf
     en porte déjà un : la liste proposait donc « 10 visuels » là où dix est
     impossible, et le lot entier était annulé au clic final, après la revue,
     sur « Campagne pleine ». Le plafond se lit avant de choisir, pas après
     avoir relu. Dérivé au rendu et non recopié dans l'état : le projet peut
     gagner un écran pendant que la boîte est ouverte. */
  const room = Math.max(0, AI_LIMITS.maxScreens - project.screens.length)
  const full = room === 0
  const screenCount = Math.max(1, Math.min(chosenCount, room))

  const brief: CampaignBrief = useMemo(
    () => ({
      appName: appName.trim() || project.name,
      pitch,
      landingUrl: landingUrl.trim() || undefined,
      direction,
      palette,
      screenCount,
      deviceModel: project.globals.deviceModel,
      screenshots: shots,
      logo,
    }),
    [
      appName,
      pitch,
      landingUrl,
      direction,
      palette,
      screenCount,
      project.globals.deviceModel,
      project.name,
      shots,
      logo,
    ],
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
      /* Le nombre suit les captures déposées : c'est le cas courant, et
         l'utilisateur qui en veut plus le dit juste en dessous. Le plafond est
         appliqué au rendu, pas ici : c'est la place du projet, pas un choix. */
      setChosenCount(Math.max(1, loaded.length))
      setPlan(null)
      setShotPalette(await paletteFromScreenshots(loaded.map((shot) => shot.assetId)))
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

  /**
   * Appaire, quel que soit le fournisseur — et sans jamais écrire le secret.
   *
   * Les deux familles se rejoignent sur un seul état : le pont rend un `hello`
   * et une liste de modèles, une API rend son catalogue, et l'installation
   * guidée affiche la même marche dans les deux cas. Ce qui reste différent est
   * le seul fait qui compte pour l'utilisateur, et il est dans `providers.ts` :
   * un jeton n'ouvre qu'un programme de sa machine, une clé est facturée.
   */
  async function connect() {
    const trimmed = secret.trim()
    setConnection({ state: 'checking' })

    const engine = aiProvider(providerId).engine
    if (engine) {
      const status = await connectBridge(trimmed, engine)
      if (status.state !== 'ready') {
        setConnection({
          state: 'error',
          message: status.state === 'error' ? status.message : 'Le pont n’a pas répondu.',
        })
        return
      }
      /* Retenu pour la session, en mémoire de module : la boîte des langues
         parle au même pont, et faire retaper le même secret par boîte serait
         une cérémonie sans gain de sécurité. Il meurt au rechargement. */
      setBridgeToken('assistant', trimmed, engine)
      setModel(status.models[0]?.id ?? '')
      setConnection({
        state: 'ready',
        models: status.models,
        detail:
          `Connecté · ${engine} ${status.hello.engines.find((one) => one.id === engine)?.version ?? ''} · jeton version ${status.hello.tokenVersions.assistant}`.trim(),
      })
      return
    }

    if (providerId === 'anthropic' || providerId === 'openrouter') {
      const status = await connectApiProvider(providerId, trimmed)
      if (status.state !== 'ready') {
        setConnection({
          state: 'error',
          message: status.state === 'error' ? status.message : 'Clé refusée.',
        })
        return
      }
      setApiKey(providerId, trimmed)
      /* Le premier modèle du catalogue n'est un défaut acceptable que sur une
         liste courte. Sur les centaines d'OpenRouter, il serait arbitraire :
         le champ reste vide, et l'étape 3 se coche quand l'utilisateur a
         choisi. */
      setModel(status.models.length > 40 ? '' : (status.models[0]?.id ?? ''))
      setConnection({
        state: 'ready',
        models: status.models,
        detail: `Clé acceptée · ${status.models.length} modèle${status.models.length > 1 ? 's' : ''} disponible${status.models.length > 1 ? 's' : ''}`,
      })
    }
  }

  const connected = connection.state === 'ready'

  /* Changer de fournisseur remet l'appairage à zéro : un jeton de pont collé
     dans le champ d'une clé Anthropic ne vaut rien, et un modèle choisi chez
     l'un n'existe pas chez l'autre. */
  function pickProvider(next: ProviderId) {
    setProviderId(next)
    setSecret('')
    setModel('')
    setConnection({ state: 'idle' })
  }

  /* Le seul chemin de sortie d'une clé enregistrée. Sans lui, la persistance
     serait à sens unique : une clé collée une fois resterait sur cette machine
     sans que rien dans l'interface ne sache la retirer. Le fournisseur et le
     modèle restent choisis — ce sont des préférences, pas des secrets. */
  function forgetSecret() {
    setSecret('')
    setConnection({ state: 'idle' })
    void forgetStoredSecret(providerId)
  }

  async function compose() {
    setBusy(true)
    setError(null)
    try {
      const proposal = await planCampaign(brief, {
        provider: providerId,
        token: connected ? secret.trim() : undefined,
        model: model || undefined,
      })
      // Un plan est une entrée non fiable, même quand il vient d'ici : demain
      // il viendra d'ailleurs, et la boîte ne le saura pas.
      if (!isCampaignPlan(proposal)) {
        setError('La proposition est invalide : rien n’a été posé.')
        return
      }
      setPlan(proposal)
      setFocus(0)
    } catch (cause) {
      /* Le fournisseur distant a lâché. Le message vient du pont, qui sait
         pourquoi ; la boîte reste ouverte et la génération sans modèle reste à
         un clic — un échec de génération ne coûte pas le brief. */
      setError(cause instanceof Error ? cause.message : 'La proposition a échoué.')
    } finally {
      setBusy(false)
    }
  }

  /**
   * La revue édite le plan, elle ne le contourne pas.
   *
   * Le plan reste le seul objet que `planToolCalls` traduit : réécrire une
   * accroche ici change ce qui sera posé, exactement comme si le fournisseur
   * l'avait écrite. L'alternative — poser puis corriger sur le canevas — coûte
   * un pas d'annulation par correction et se fait sur dix écrans déjà créés.
   */
  function editScreen(index: number, headline: string) {
    setPlan((current) =>
      current
        ? {
            ...current,
            screens: current.screens.map((screen, at) =>
              at === index ? { ...screen, headline } : screen,
            ),
          }
        : current,
    )
  }

  function dropScreen(index: number) {
    setPlan((current) => {
      // Un plan vide n'est pas un plan : le bouton se désactive au dernier, et
      // c'est « Annuler » qui refuse la proposition entière.
      if (!current || current.screens.length <= 1) return current
      return { ...current, screens: current.screens.filter((_unused, at) => at !== index) }
    })
    setFocus((current) => Math.max(0, current > index ? current - 1 : Math.min(current, index)))
  }

  /**
   * Redemander une accroche, pour ce visuel seulement.
   *
   * Un brief d'un seul visuel, avec la capture de celui-ci : le modèle garde le
   * nom, la phrase et la page du produit, et ne rend qu'une ligne. N'a de sens
   * qu'avec un modèle branché — sans lui la génération est déterministe, et un
   * bouton qui rendrait deux fois le même texte serait un bouton qui ment.
   */
  async function regenerate(index: number) {
    if (!plan) return
    const screen = plan.screens[index]
    if (!screen) return
    setRegenerating(index)
    setError(null)
    try {
      const shot = brief.screenshots[screen.screenshotIndex ?? index]
      const proposal = await planCampaign(
        { ...brief, screenCount: 1, screenshots: shot ? [shot] : [] },
        {
          provider: providerId,
          token: connected ? secret.trim() : undefined,
          model: model || undefined,
        },
      )
      const written = isCampaignPlan(proposal) ? proposal.screens[0]?.headline : undefined
      if (!written) {
        setError('Le modèle n’a rien rendu pour ce visuel : l’accroche est inchangée.')
        return
      }
      editScreen(index, written)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La proposition a échoué.')
    } finally {
      setRegenerating(null)
    }
  }

  function accept() {
    if (!plan) return
    const outcome = commitAiRun(planToolCalls(plan, brief), {
      assetIds: registered.current,
    })
    if (!outcome.committed) {
      setError(outcome.error ?? 'La génération a échoué : le projet est resté inchangé.')
      return
    }
    toast(
      `${outcome.screenIds.length} visuel${outcome.screenIds.length > 1 ? 's' : ''} ajouté${
        outcome.screenIds.length > 1 ? 's' : ''
      }.`,
      'success',
    )
    close()
  }

  function harmonize() {
    if (!activeScreen) return
    const calls = restyleCalls(activeScreen, resolvePalette(brief))
    /* Rien à repeindre : on le dit, et on ne ferme pas. Fermer sur un
       changement nul renvoyait l'utilisateur sur un écran identique en lui
       ayant pris son brief — la lecture était « le bouton ne marche pas ». */
    if (calls.length === 0) {
      setError(
        `« ${activeScreen.name} » porte déjà ce style. Choisissez une autre direction à l’étape 3 pour voir un changement.`,
      )
      return
    }
    const outcome = commitAiRun(calls, {
      screenId: activeScreen.id,
    })
    if (!outcome.committed) {
      setError(outcome.error ?? 'Le restylage a échoué : le projet est resté inchangé.')
      return
    }
    // Rien de posé ici : le restylage repeint les calques déjà en place. Les
    // captures importées de ce run repartent au néant au démontage, comme
    // n'importe quel fichier que le projet ne référence pas.
    toast(`Écran « ${activeScreen.name} » restylé.`, 'success')
    close()
  }

  return (
    <Dialog
      open
      onClose={busy ? () => undefined : close}
      title="Générer les visuels App Store"
      size="lg"
      flush
      /* Ce que la génération implique, dit à l'endroit où on la lance — pas
         dans une page d'aide. La phrase change avec le fournisseur : « tout
         reste ici » cesserait d'être vrai dès le pont branché. */
      footerNote={
        providerId === 'local' || !connected
          ? 'Tout est composé sur votre appareil, en calques modifiables.'
          : 'Le texte du brief part vers Codex. Les images restent ici. Le résultat est en calques modifiables.'
      }
      footer={
        <>
          <Button variant="default" onClick={close} disabled={busy}>
            Annuler
          </Button>
          {plan ? (
            <Button variant="primary" onClick={accept} disabled={busy}>
              <Check size={12} aria-hidden />
              Ajouter {plan.screens.length} visuel{plan.screens.length > 1 ? 's' : ''}
            </Button>
          ) : (
            // « Proposer », pas « Générer » : le bouton ne pose rien, il montre.
            // C'est la promesse que la relecture tient juste au-dessus.
            <Button variant="primary" onClick={() => void compose()} loading={busy} disabled={full}>
              <Megaphone size={12} aria-hidden />
              Proposer {screenCount} visuel{screenCount > 1 ? 's' : ''}
            </Button>
          )}
        </>
      }
    >
      <div className="flex max-h-[60dvh] flex-col gap-4 overflow-y-auto px-6 py-4">
        {error && (
          <p role="alert" className="flex items-start gap-2 text-2xs text-destructive">
            <AlertCircle size={13} className="mt-0.5 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        {/* Une phrase, pas un paragraphe. Ce qui entre, ce qui sort, et le fait
            que rien n'est posé sans relecture — le reste s'apprend en trois
            étapes numérotées plutôt qu'en explications empilées. */}
        <p className="text-2xs text-muted-foreground">
          Vos captures d’écran deviennent les{' '}
          <strong className="text-foreground">visuels de votre fiche App Store</strong> : un fond,
          une accroche, l’appareil qui porte la capture. Vous relisez la proposition avant qu’elle
          n’entre dans le projet.
        </p>

        <Step index={1} title="Vos captures d’écran">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="default" onClick={() => shotsInput.current?.click()} disabled={busy}>
              <ImageUp size={12} aria-hidden />
              {shots.length > 0
                ? `${shots.length} capture${shots.length > 1 ? 's' : ''}`
                : 'Choisir les captures…'}
            </Button>
            <Button variant="default" onClick={() => logoInput.current?.click()} disabled={busy}>
              <ImageUp size={12} aria-hidden />
              {logo ? 'Logo choisi' : 'Logo (facultatif)…'}
            </Button>
          </div>
          <p className="mt-2 text-2xs text-muted-foreground">
            {shots.length > 0
              ? 'Une capture par visuel, dans l’ordre déposé. Le nom de chaque fichier sert de nom d’écran.'
              : 'Facultatif : sans capture, les visuels sont posés avec leur fond et leur accroche, l’appareil restant à remplir.'}
          </p>
        </Step>

        <Step index={2} title="Votre application">
          <div className="grid grid-cols-2 gap-2">
            <Field id={NAME_FIELD_ID} label="Nom">
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
          {/* Le champ n'apparaît que quand quelqu'un sait le lire. Affiché en
              permanence, il aurait promis une analyse de la page que la
              génération sans modèle ne fait pas et ne peut pas faire. */}
          {aiProvider(providerId).transport !== 'in-process' && (
            <>
              <Field id={URL_FIELD_ID} label="Page du produit (facultatif)" className="mt-2">
                <Input
                  id={URL_FIELD_ID}
                  font="sans"
                  type="url"
                  inputMode="url"
                  value={landingUrl}
                  maxLength={2048}
                  placeholder="https://monapp.com"
                  disabled={busy}
                  onChange={(event) => setLandingUrl(event.target.value)}
                />
              </Field>
              <p className="mt-1.5 text-2xs text-muted-foreground">
                Citée au modèle comme contexte, pour qu’il reprenne votre vocabulaire. ScreenForge
                ne la charge jamais lui-même.
              </p>
            </>
          )}
        </Step>

        <Step index={3} title="Le style des visuels">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Style des visuels">
            {DIRECTIONS.map((entry) => (
              <StyleChip
                key={entry.id}
                label={entry.label}
                swatch={entry.background}
                selected={!useShotPalette && entry.id === direction}
                disabled={busy}
                onSelect={() => {
                  setDirection(entry.id)
                  setUseShotPalette(false)
                  setPlan(null)
                }}
              />
            ))}
            <StyleChip
              label="D’après mes captures"
              /* Pas `transparent` en attendant les captures : une pastille vide
                 se lit comme une pastille cassée. Le gris de la surface dit
                 « rien à montrer pour l'instant », ce que le titre confirme. */
              swatch={shotPalette?.background ?? 'var(--color-muted)'}
              selected={useShotPalette}
              disabled={busy || !shotPalette}
              title={
                shotPalette
                  ? 'Les couleurs dominantes lues dans vos captures.'
                  : 'Déposez des captures : leurs couleurs seront lues ici.'
              }
              onSelect={() => {
                setUseShotPalette(true)
                setPlan(null)
              }}
            />
          </div>
          <p className="mt-2 text-2xs text-muted-foreground">
            Couleur de fond, encre des accroches et teinte des formes, sur tous les visuels.
          </p>
        </Step>

        {full ? (
          <p role="status" className="text-2xs text-muted-foreground">
            Ce projet porte déjà {AI_LIMITS.maxScreens} écrans, le maximum d’une fiche App Store :
            aucun visuel ne peut y être ajouté. Supprimez-en un dans la pellicule, ou repeignez
            l’écran courant au style choisi ci-dessous.
          </p>
        ) : (
          <>
            <Field id={COUNT_FIELD_ID} label="Combien de visuels">
              <Select
                id={COUNT_FIELD_ID}
                value={String(screenCount)}
                disabled={busy}
                onChange={(event) => {
                  setChosenCount(Number(event.target.value))
                  setPlan(null)
                }}
              >
                {Array.from({ length: room }, (_unused, index) => index + 1).map((count) => (
                  <option key={count} value={count}>
                    {count} visuel{count > 1 ? 's' : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <p className="-mt-2 text-2xs text-muted-foreground">
              {room < AI_LIMITS.maxScreens
                ? `Ce projet porte déjà ${project.screens.length} écran${project.screens.length > 1 ? 's' : ''} : il reste de la place pour ${room}. L’App Store en accepte ${AI_LIMITS.maxScreens} par langue. `
                : `L’App Store en accepte ${AI_LIMITS.maxScreens} par langue. `}
              Au-delà de vos captures, les visuels sont posés avec l’appareil vide — « Actualiser
              les captures » les remplira plus tard.
            </p>
          </>
        )}

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

        <AssistancePanel providerLabel={aiProvider(providerId).label}>
          <AssistantSetup
            providerId={providerId}
            onProvider={(next) => {
              pickProvider(next)
              setPlan(null)
            }}
            secret={secret}
            onSecret={setSecret}
            connection={connection}
            onConnect={() => void connect()}
            onForget={forgetSecret}
            model={model}
            onModel={setModel}
            busy={busy}
          />
        </AssistancePanel>

        {plan ? (
          <PlanReview
            plan={plan}
            brief={brief}
            focus={Math.min(focus, plan.screens.length - 1)}
            onFocus={setFocus}
            onHeadline={editScreen}
            onDrop={dropScreen}
            onRegenerate={connected ? (index) => void regenerate(index) : undefined}
            regenerating={regenerating}
            busy={busy}
          />
        ) : null}

        {/* Une seconde action, pas une étape de la première : elle ne génère
            rien, ne regarde ni les captures ni le nombre demandé, et touche un
            écran qui existe déjà. Sous le même titre que le reste, elle se
            lisait comme la suite du formulaire. */}
        {activeScreen && (
          <div className="border-t border-border pt-4">
            <h3 className="section-title">Sans rien générer : repeindre l’écran affiché</h3>
            <p className="mt-1 text-2xs text-muted-foreground">
              Applique le style choisi à l’étape 3 aux calques déjà posés sur « {activeScreen.name}{' '}
              » : fond, encre des textes, teinte des formes. Aucun calque n’est créé ni supprimé,
              aucune capture n’est utilisée.
            </p>
            <Button variant="default" className="mt-2" onClick={harmonize} disabled={busy}>
              <Paintbrush size={12} aria-hidden />
              Repeindre « {activeScreen.name} »
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  )
}

/**
 * Une étape numérotée.
 *
 * Le numéro n'est pas un ornement : la boîte demandait des captures au milieu,
 * un nom en haut et un style entre les deux, et la seule façon de savoir dans
 * quel ordre remplir était d'avoir déjà réussi une fois. Trois chiffres disent
 * la séquence sans une phrase de plus.
 */
function Step({
  index,
  title,
  children,
}: {
  index: number
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h3 className="section-title flex items-center gap-2">
        <span
          aria-hidden
          className="tabular flex size-4 items-center justify-center rounded-sm bg-muted text-2xs font-semibold text-muted-foreground"
        >
          {index}
        </span>
        {title}
      </h3>
      <div className="mt-2">{children}</div>
    </div>
  )
}

function StyleChip({
  label,
  swatch,
  selected,
  disabled,
  title,
  onSelect,
}: {
  label: string
  swatch: string
  selected: boolean
  disabled?: boolean
  title?: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      title={title}
      onClick={onSelect}
      className={cn(
        'flex items-center gap-2 rounded-md border px-3 py-2 text-2xs transition-colors',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground',
        'disabled:opacity-50',
        selected
          ? 'border-foreground bg-muted text-foreground'
          : 'border-border text-muted-foreground hover:border-input',
      )}
    >
      <span
        aria-hidden
        className="size-4 rounded-sm border border-border"
        style={{ background: swatch }}
      />
      {label}
    </button>
  )
}

/**
 * Qui écrit les accroches, replié tant qu'on ne le cherche pas.
 *
 * Un seul chemin est proposé par défaut, et c'est celui qui marche sans rien
 * installer ni connecter. Le reste est derrière une divulgation : un utilisateur
 * qui ouvre cette boîte veut des visuels, pas un formulaire de connexion.
 * Replié ne veut pas dire caché — l'en-tête dit toujours qui écrit, sinon la
 * divulgation deviendrait un réglage qu'on oublie avoir changé.
 *
 * Le titre nomme ce qui change pour l'utilisateur et non l'architecture. Sous
 * « Assistance », la ligne repliée annonçait « Composition locale » : deux mots
 * qui décrivent le transport et pas une seule fois ce qu'ils lui coûtent — des
 * accroches qu'il devra écrire lui-même.
 *
 * Ce composant ne fait plus que la divulgation. Le choix et le branchement
 * vivent dans `AssistantSetup`, parce que cinq fournisseurs, deux familles
 * d'authentification et trois marches ne sont plus un détail d'un formulaire de
 * campagne : c'est un écran à part entière, qui a ses propres états.
 */
function AssistancePanel({
  providerLabel,
  children,
}: {
  providerLabel: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

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
          Qui écrit les accroches
          <span className="ml-auto font-normal text-muted-foreground">{providerLabel}</span>
        </button>
      </h3>

      <div id={ASSIST_PANEL_ID} hidden={!open} className="mt-2">
        {children}
      </div>
    </div>
  )
}

interface PlanReviewProps {
  plan: CampaignPlan
  brief: CampaignBrief
  focus: number
  onFocus: (index: number) => void
  onHeadline: (index: number, headline: string) => void
  onDrop: (index: number) => void
  /** Absent tant qu'aucun modèle n'est branché : voir `regenerate`. */
  onRegenerate?: (index: number) => void
  regenerating: number | null
  busy: boolean
}

/**
 * Le plan, avant qu'il ne devienne des calques — et corrigeable ici.
 *
 * Une bande de vignettes, un aperçu, un champ. La revue tenait auparavant en
 * une liste de titres entre guillemets : elle disait ce qui allait être posé et
 * ne montrait pas de quoi ça aurait l'air, ce qui laissait une seule façon de
 * juger une composition — la poser sur dix écrans, la regarder, tout annuler.
 *
 * Corriger ici plutôt qu'après coup n'est pas un raccourci : après la pose,
 * chaque accroche réécrite est un pas d'annulation de plus, sur un projet où
 * les dix écrans existent déjà. Avant, le plan n'est encore rien.
 */
function PlanReview({
  plan,
  brief,
  focus,
  onFocus,
  onHeadline,
  onDrop,
  onRegenerate,
  regenerating,
  busy,
}: PlanReviewProps) {
  const current = plan.screens[focus]
  const layout = planScreenLayout(plan, brief, focus)
  const only = plan.screens.length === 1

  return (
    <div className="border-t border-border pt-4">
      <h3 className="section-title flex items-center gap-2">
        À relire avant d’ajouter
        <span className="ml-auto flex items-center gap-1" aria-hidden>
          {[plan.palette.background, plan.palette.ink, plan.palette.accent].map((color) => (
            <span
              key={color}
              className="size-3 rounded-sm border border-border"
              style={{ background: color }}
            />
          ))}
        </span>
      </h3>
      <p className="mt-1 text-2xs text-muted-foreground">
        {plan.screens.length} visuel{plan.screens.length > 1 ? 's' : ''} à ajouter aux écrans du
        projet. Rien n’a encore bougé : le bouton en bas les pose, et un seul ⌘Z les retire tous.
      </p>

      {/* La bande sert à choisir, pas à juger : c'est l'aperçu en dessous qui
          montre. Elle porte quand même les compositions et non des numéros —
          au-delà de trois visuels, « le troisième » ne désigne plus rien. */}
      <div
        className="mt-2 flex gap-2 overflow-x-auto pb-1"
        role="tablist"
        aria-label="Visuels proposés"
      >
        {plan.screens.map((screen, index) => (
          <button
            key={`${screen.name}-${index}`}
            type="button"
            role="tab"
            aria-selected={index === focus}
            aria-label={`Visuel ${index + 1} : ${screen.headline}`}
            onClick={() => onFocus(index)}
            className={cn(
              'flex shrink-0 flex-col items-center gap-1 rounded-md p-1 transition-colors',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground',
              index === focus ? 'bg-muted' : 'hover:bg-muted/60',
            )}
          >
            <PlanPreview plan={plan} brief={brief} index={index} size="thumb" />
            <span
              className={cn(
                'tabular text-2xs',
                index === focus ? 'font-semibold text-foreground' : 'text-muted-foreground',
              )}
            >
              {index + 1}
            </span>
          </button>
        ))}
      </div>

      {current && (
        <div className="mt-2 flex gap-3">
          <PlanPreview plan={plan} brief={brief} index={focus} size="full" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Field id={HEADLINE_FIELD_ID} label={`Accroche du visuel ${focus + 1}`}>
              <Input
                id={HEADLINE_FIELD_ID}
                font="sans"
                value={current.headline}
                maxLength={AI_LIMITS.maxTextLength}
                disabled={busy || regenerating !== null}
                onChange={(event) => onHeadline(focus, event.target.value)}
              />
            </Field>
            {/* La composition est nommée parce qu'elle est choisie : à 132px,
                deux mises en page voisines se distinguent mal, et l'utilisateur
                qui vient de voir dix visuels identiques a besoin de lire que
                celui-ci n'est pas celui d'à côté. La capture n'est annoncée que
                là où un appareil la portera — le libellé de l'archétype dit
                déjà, sur le visuel de clôture, qu'il n'y en a pas. */}
            <p className="text-2xs text-muted-foreground">
              {layout ? `${archetypeSpec(layout.archetype).label}.` : ''}
              {layout?.device
                ? current.screenshotIndex === undefined
                  ? ' Aucune capture pour ce visuel : l’appareil sera posé vide.'
                  : ` Capture « ${brief.screenshots[current.screenshotIndex]?.label} », posée dans l’appareil.`
                : ''}
            </p>
            {/* Sous le texte qu'elles concernent, et non collées au bas de la
                colonne : l'aperçu fait 286px de haut, ce qui laissait un vide
                de la hauteur d'une section entre l'accroche et « Retirer ». */}
            <div className="flex flex-wrap gap-2">
              {onRegenerate && (
                <Button
                  variant="default"
                  onClick={() => onRegenerate(focus)}
                  loading={regenerating === focus}
                  disabled={busy || regenerating !== null}
                >
                  <RefreshCw size={12} aria-hidden />
                  Réécrire
                </Button>
              )}
              <Button
                variant="default"
                onClick={() => onDrop(focus)}
                disabled={busy || only || regenerating !== null}
                title={only ? 'Il faut au moins un visuel : utilisez « Annuler ».' : undefined}
              >
                <Trash2 size={12} aria-hidden />
                Retirer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
