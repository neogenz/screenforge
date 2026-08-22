import { APP_STORE_TARGET } from '@/lib/dimensions'
import { cn } from '@/lib/utils'
import {
  Check,
  Download,
  Eye,
  EyeOff,
  Image,
  LayoutGrid,
  Loader2,
  RotateCcw,
  Smartphone,
  Type,
} from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useLang } from '../i18n'
import { useReducedMotion } from '../motion'
import { DemoBoard, DemoTile } from './DemoBoard'
import { DemoCursor, type CursorPose } from './DemoCursor'
import {
  CURSOR_CLICK_MS,
  cursorTravelMs,
  DEMO_GRADIENTS,
  DEMO_TILES,
  EMPTY_SCENE,
  FINAL_SCENE,
  NAV_HEIGHT,
  FRAME_COLORS,
  LEGIBLE_TEXT_COLOR,
  TEXT_COLORS,
  TEXT_SIZES,
  TITLE_Y,
  type CursorTarget,
  type DemoLayerId,
  type DemoSceneState,
} from './demo-script'
import { DimensionNote } from '../components/DimensionNote'

/*
 * Sous `sm`, les quatre libellés demandaient 250 px dans une barre de 348 :
 * « Exporter » sortait du cadre et se faisait couper par l'`overflow-hidden`.
 * L'icône reste, le mot part, et le nom accessible ne bouge pas — c'est le
 * repli qu'une vraie barre d'outils fait, et il rend la maquette plus crédible
 * en petit, pas moins.
 */
function ToolButton({
  target,
  icon: Icon,
  label,
  active = false,
  primary = false,
  onClick,
}: {
  target: CursorTarget
  icon: ComponentType<{ className?: string; strokeWidth?: number; 'aria-hidden'?: boolean }>
  label: string
  active?: boolean
  primary?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      data-cursor-target={target}
      onClick={onClick}
      aria-label={label}
      title={label}
      /* `active:scale-[0.96]` sur un bouton de 24 px : le mock est le seul
         endroit de la page où l'on clique pour de vrai sans que rien ne
         navigue, donc le seul retour possible est tactile. */
      className={cn(
        'flex h-6 items-center gap-1 rounded-sm px-1.5 text-[10px] font-medium transition-[background-color,color,scale] duration-150 active:scale-[0.96] sm:pr-2',
        /* Remplissage clair, pas le citron : `Button` variant `primary` de
           l'app est `bg-foreground text-stage`, et la règle qui l'impose est
           écrite deux fois dans le langage — le marqueur dit « vous êtes
           ici », jamais « cliquez ici ». La maquette peignait en citron le
           seul bouton que le visiteur reverra après achat. */
        primary
          ? 'bg-foreground text-stage hover:bg-muted-foreground'
          : active
            ? 'bg-accent text-foreground'
            : 'bg-secondary text-secondary-foreground hover:bg-accent',
      )}
    >
      {/* 1,75 de trait pour une graisse 500 : à 12 px, le 2 par défaut de
          Lucide pèse plus lourd que le mot qu'il accompagne. */}
      <Icon aria-hidden className="size-3 shrink-0" strokeWidth={1.75} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/* Hauteur sur largeur d'une planche, lue par `.demo-board` (landing.css) pour
   borner les trois planches à la largeur de la rangée. */
const BOARD_RATIO = APP_STORE_TARGET.portrait.height / APP_STORE_TARGET.portrait.width

/*
 * Une pastille de couleur : dégradé de fond, couleur de titre, couleur de
 * châssis. Trois usages, une géométrie — la pastille reste à 20 px, l'échelle
 * du faux panneau, et le bouton qui la porte fait les 24 px que WCAG 2.2
 * demande d'une cible. Le liseré blanc est indispensable : la première couleur
 * de châssis du produit est `#ffffff` et la deuxième couleur de titre `#101014`
 * — sans lui, l'une disparaît sur l'autre et les deux sur le panneau.
 */
function Swatch({
  target,
  label,
  background,
  selected,
  onClick,
}: {
  target?: CursorTarget
  label: string
  background: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      data-cursor-target={target}
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-6 place-items-center rounded-xs transition-transform duration-150 hover:scale-110 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
    >
      <span
        className={cn(
          'size-5 rounded-xs outline -outline-offset-1 outline-white/20',
          selected && 'outline-2 outline-offset-0 outline-marker',
        )}
        style={{ background }}
      />
    </button>
  )
}

/* Une bande, pas une carte : le panneau est déjà une surface, un cadre autour
   de chaque groupe en ferait une troisième. Même règle que les sections de
   panneau de l'app. */
/*
 * Deux écarts, pas trois. Le libellé collait à son contrôle de 6 px et la
 * section suivante n'en prenait que 10 : sur un panneau de 128 px, quatre
 * relations différentes s'énonçaient à quatre pixels d'écart, et la colonne se
 * lisait comme une seule pile continue. 6 px lie ce qui va ensemble, 12 px
 * sépare ce qui n'y va pas — c'est la même règle que l'app, à son échelle.
 */
function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border/60 pt-3 first:border-t-0 first:pt-0">
      <p className="text-[9px] text-muted-foreground">{title}</p>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

function SelectedPosition({
  selected,
  layerPos,
}: {
  selected: DemoLayerId
  layerPos: (layer: DemoLayerId) => { x: number; y: number }
}) {
  /* Chaque axe a son échelle : la planche fait 1320 × 2868, pas un carré.
     Un seul facteur 13.2 pour les deux affichait un Y plafonné à 1320 sur un
     board haut de 2868 — la seule arithmétique visible de la page, fausse
     d'un facteur 2,17, sur une page qui imprime 1320 × 2868 cinq fois. */
  const scale = {
    x: APP_STORE_TARGET.portrait.width / 100,
    y: APP_STORE_TARGET.portrait.height / 100,
  }
  return (
    <div className="flex gap-1.5">
      {(['X', 'Y'] as const).map((axis) => (
        <span
          key={axis}
          className="flex flex-1 items-center gap-1 rounded-xs bg-muted px-1.5 py-1 text-[10px]"
        >
          <span className="text-muted-foreground">{axis}</span>
          <span className="ml-auto tabular-nums">
            {Math.round(
              layerPos(selected)[axis === 'X' ? 'x' : 'y'] * scale[axis === 'X' ? 'x' : 'y'],
            )}
          </span>
        </span>
      ))}
    </div>
  )
}

/* La largeur de la barre de titre d'une vignette, dérivée de son rang : les
   dix vignettes portaient la même barre, ce qui annonce dix fois la même
   planche là où le produit vend dix écrans partageant un traitement. */
const tileTitleWidth = (tile: number) => 52 + ((tile * 7) % 4) * 8

/*
 * Mini-éditeur mocké : barre d'outils, panneaux Calques/Propriétés, plan de
 * travail et filmstrip — le chrome du produit en simplifié. La démo joue en
 * boucle ; toute prise de main coupe l'autoplay et les planches deviennent
 * manipulables, « Rejouer » relance la boucle. Zéro Fabric : à cette échelle
 * le DOM suffit, et le premier état est rendu côté serveur.
 */
export function DemoEditor() {
  const { t } = useLang()
  const typed = t.demo.typed

  /* Le premier état est la planche finie, pas le plan de travail vide. Le HTML
     prérendu sert donc la composition, et le visiteur qui arrive au-dessus de
     la démo voit ce que le produit fabrique plutôt que l'image qui ne vend
     rien. La construction depuis zéro reste l'histoire du produit : elle se
     joue dès que la démo est réellement regardée, précédée d'un fondu. */
  const [rawScene, setScene] = useState<DemoSceneState>(FINAL_SCENE)
  const [resetting, setResetting] = useState(false)
  const [touched, setTouched] = useState(false)
  const [cursor, setCursor] = useState<CursorPose>({ x: 0, y: 0, down: false, ms: 0 })
  const [cursorOn, setCursorOn] = useState(false)
  const [autoplay, setAutoplay] = useState(true)
  const [visible, setVisible] = useState(false)
  const reduced = useReducedMotion()
  const containerRef = useRef<HTMLDivElement>(null)
  const artboardRef = useRef<HTMLDivElement>(null)
  const cursorAt = useRef({ x: 0, y: 0 })
  const dragLayer = useRef<DemoLayerId | null>(null)
  const exportTimeout = useRef<number | undefined>(undefined)
  /* La construction ne vaut qu'une fois par visite. Chaque retour dans le champ
     rejouait `build()` depuis la planche vide : sortir de la section et y
     revenir effaçait la composition qu'on venait de regarder se monter.
     Trois états et pas un booléen, parce qu'une construction interrompue en
     plein milieu laisse une planche à moitié montée — le retour la referme sur
     son résultat plutôt que de reprendre les réglages sur un chantier. */
  const buildState = useRef<'todo' | 'running' | 'done'>('todo')
  const editStep = useRef(0)

  useEffect(
    () => () => {
      if (exportTimeout.current) window.clearTimeout(exportTimeout.current)
    },
    [],
  )

  /* En reduced-motion la composition finale est servie figée — sauf si
     l'utilisateur a pris la main, auquel cas ses actions commandent. */
  const scene = reduced && !touched ? FINAL_SCENE : rawScene
  const playing = autoplay && !reduced

  const manual = (updates: Partial<DemoSceneState>) => {
    /* Reduced-motion : la première action part de la composition finale
       affichée, pas de la scène vide — sinon un clic viderait le board. */
    const base = reduced && !touched ? FINAL_SCENE : rawScene
    setTouched(true)
    setScene({ ...base, ...updates })
  }

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    /* La moitié, mesurée sous la barre et pas contre la fenêtre entière : un
       seuil compté sur le viewport traite comme visibles les 72 px que la
       barre fixe recouvre, donc il se déclenche pendant qu'on ne voit rien.
       `rootMargin` les retranche.

       0.7 sans marge obligeait à défiler bien après l'arrivée de la section.
       Mesuré, position de défilement au premier mouvement du curseur et part
       de la démo réellement sous la barre à cet instant : 1440×900, 360 px et
       77 % contre 220 px et 57 % ; 1280×720, 540 px et 77 % contre 400 px et
       58 % ; 390×844, 200 px et 80 % contre 120 px et 62 %.

       Pas plus bas que 0.5 : l'état initial composé fait qu'une démo hors
       champ ne montre plus une planche vide, mais le fondu de remise à zéro,
       lui, ne doit pas se jouer pour personne. */
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0.5,
      rootMargin: `-${String(NAV_HEIGHT)}px 0px 0px 0px`,
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!playing || !visible) return
    let cancelled = false
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    const targetPoint = (name: CursorTarget) => {
      const root = containerRef.current
      const el = root?.querySelector(`[data-cursor-target="${name}"]`)
      if (!root || !el) return null
      const rect = el.getBoundingClientRect()
      /* Une cible masquée (panneaux repliés sous md) mesure 0×0 : sans ce
         garde-fou le curseur téléportait au coin haut-gauche du mock. */
      if (rect.width === 0 && rect.height === 0) return null
      const box = root.getBoundingClientRect()
      return {
        x: rect.left - box.left + rect.width / 2,
        y: rect.top - box.top + rect.height / 2,
      }
    }

    const moveTo = async (name: CursorTarget) => {
      const point = targetPoint(name)
      if (!point) return false
      const ms = cursorTravelMs(point.x - cursorAt.current.x, point.y - cursorAt.current.y)
      cursorAt.current = point
      setCursor({ ...point, down: false, ms })
      await sleep(ms + 40)
      return true
    }
    const click = async () => {
      setCursor((pose) => ({ ...pose, down: true }))
      await sleep(CURSOR_CLICK_MS / 2)
      setCursor((pose) => ({ ...pose, down: false }))
      await sleep(CURSOR_CLICK_MS / 2)
    }
    /* Le curseur descend sur le calque, puis curseur et calque glissent
       ensemble vers la destination — le drag est la preuve, pas un cut.
       La conversion %→px se mesure sur la planche : un facteur fixe ferait
       diverger curseur et calque dès que la taille change. */
    const dragTextTo = async (toY: number) => {
      const start = targetPoint('text-layer')
      const board = artboardRef.current
      if (!start || !board) return
      const ms = cursorTravelMs(start.x - cursorAt.current.x, start.y - cursorAt.current.y)
      setCursor({ ...start, down: true, ms })
      await sleep(ms + 40)
      const fromY = EMPTY_SCENE.textPos.y
      const pxPerPercent = board.getBoundingClientRect().height / 100
      const steps = 7
      for (let i = 1; i <= steps; i++) {
        if (cancelled) return
        const ratio = i / steps
        setScene((s) => ({ ...s, textPos: { x: 50, y: fromY + (toY - fromY) * ratio } }))
        setCursor((pose) => ({
          ...pose,
          y: start.y + (toY - fromY) * ratio * pxPerPercent,
          ms: 70,
        }))
        await sleep(70)
      }
      cursorAt.current = { x: start.x, y: start.y + (toY - fromY) * pxPerPercent }
      setCursor((pose) => ({ ...pose, down: false }))
      await sleep(200)
    }

    const exportRun = async () => {
      if (await moveTo('export-btn')) await click()
      setScene((s) => ({ ...s, exportState: 'running' }))
      await sleep(1200)
      if (cancelled) return
      setScene((s) => ({ ...s, exportState: 'done' }))
    }

    /* Premier tour : la planche se construit à partir de rien. C'est l'histoire
       du produit, et elle ne vaut qu'une fois. */
    const build = async () => {
      /* Le fondu couvre le passage de la planche finie à la planche vide : sans
         lui, la démo se met à jouer en effaçant d'un coup ce que le visiteur
         venait de voir. 250 ms, coupé sous `prefers-reduced-motion` — où la
         boucle ne joue de toute façon pas. */
      setResetting(true)
      await sleep(250)
      if (cancelled) return
      setScene(EMPTY_SCENE)
      setResetting(false)
      setCursorOn(true)
      await moveTo('stage')
      await sleep(500)
      if (cancelled) return

      await moveTo('device-btn')
      await click()
      setScene((s) => ({ ...s, device: true, selected: 'device' }))
      await sleep(700)
      if (cancelled) return

      /* Le châssis se choisit dans le panneau, sur le calque qui vient d'être
         posé : c'est le plus court chemin pour montrer que les contrôles
         agissent, et « tous les modèles courants » a besoin d'être vu une fois
         plutôt que trois fois écrit. */
      if (await moveTo('frame-color-1')) await click()
      setScene((s) => ({ ...s, frameColor: 1 }))
      await sleep(650)
      if (cancelled) return

      await moveTo('text-btn')
      await click()
      setScene((s) => ({ ...s, selected: 'text' }))
      for (let i = 1; i <= typed.length; i++) {
        if (cancelled) return
        setScene((s) => ({ ...s, textChars: i }))
        await sleep(42)
      }
      await sleep(500)
      if (cancelled) return

      await dragTextTo(TITLE_Y)
      if (cancelled) return

      await moveTo('apply-btn')
      await click()
      setScene((s) => ({ ...s, spreadTextPos: s.textPos, spreadDevicePos: s.devicePos }))
      for (let n = 1; n <= DEMO_TILES; n++) {
        if (cancelled) return
        setScene((s) => ({ ...s, tiles: n }))
        await sleep(80)
      }
      await sleep(600)
      if (cancelled) return

      await exportRun()
    }

    /* Les tours suivants ne vident rien. La boucle précédente effaçait la
       planche finie pour la refaire : sur 17 s de cycle, la scène passait
       12,6 s à être vide ou à moitié montée et 4,6 s à montrer ce que le
       produit fabrique. Elle repartait donc systématiquement de la seule image
       qui ne vend rien. Ici la planche reste montée et ce sont les réglages
       qui tournent — ce que fait un utilisateur, une fois la structure posée. */
    const editPass = async (step: number) => {
      const next = (length: number) => (step + 1) % length

      if (await moveTo('layer-row-device')) await click()
      setScene((s) => ({ ...s, selected: 'device' }))
      await sleep(450)
      if (cancelled) return

      const frame = next(FRAME_COLORS.length)
      if (await moveTo(`frame-color-${frame}`)) await click()
      setScene((s) => ({ ...s, frameColor: frame }))
      await sleep(700)
      if (cancelled) return

      /* Le fond d'abord, l'encre ensuite : c'est l'ordre dans lequel on
         travaille, et c'est ce qui garantit que l'encre choisie est lisible
         sur le fond qu'elle rejoint (`LEGIBLE_TEXT_COLOR`). Le curseur vise
         la pastille qu'il allume, pas la rangée : posé une fois au centre du
         groupe, il restait immobile pendant que trois dégradés différents
         s'activaient sous lui. */
      const bg = next(DEMO_GRADIENTS.length)
      if (await moveTo(`bg-swatch-${bg}`)) await click()
      setScene((s) => ({ ...s, bgIndex: bg, exportState: 'idle' }))
      await sleep(900)
      if (cancelled) return

      if (await moveTo('layer-row-text')) await click()
      setScene((s) => ({ ...s, selected: 'text' }))
      await sleep(450)
      if (cancelled) return

      const size = next(TEXT_SIZES.length)
      if (await moveTo(`text-size-${size}`)) await click()
      setScene((s) => ({ ...s, textSize: size }))
      await sleep(600)
      if (cancelled) return

      const tone = LEGIBLE_TEXT_COLOR[bg]
      if (await moveTo(`text-color-${tone}`)) await click()
      setScene((s) => ({ ...s, textColor: tone }))
      await sleep(700)
      if (cancelled) return

      await exportRun()
    }

    const run = async () => {
      if (buildState.current === 'todo') {
        buildState.current = 'running'
        await build()
        if (cancelled) return
        buildState.current = 'done'
      } else if (buildState.current === 'running') {
        setScene(FINAL_SCENE)
        buildState.current = 'done'
      }
      while (!cancelled) {
        /* Le temps de repos sur la planche finie. C'est l'image que la page
           doit laisser, donc c'est elle qui dure le plus longtemps. */
        await sleep(4200)
        if (cancelled) return
        setScene((s) => ({ ...s, exportState: 'idle' }))
        await editPass(editStep.current)
        editStep.current += 1
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [playing, visible, typed])

  const takeOver = () => {
    /* Reduced-motion : la scène affichée est FINAL_SCENE ; sans la recopier
       dans l'état manuel, un simple clic sur la scène viderait le board. */
    if (reduced && !touched) setScene(FINAL_SCENE)
    setTouched(true)
    if (autoplay) {
      setAutoplay(false)
      setCursorOn(false)
    }
  }

  const layerPos = (layer: DemoLayerId) => (layer === 'device' ? scene.devicePos : scene.textPos)
  const setLayerPos = (layer: DemoLayerId, pos: { x: number; y: number }) =>
    setScene((s) => (layer === 'device' ? { ...s, devicePos: pos } : { ...s, textPos: pos }))

  const onLayerPointerDown = (event: ReactPointerEvent, layer: DemoLayerId) => {
    event.stopPropagation()
    takeOver()
    dragLayer.current = layer
    setScene((s) => ({ ...s, selected: layer }))
    ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
  }
  const onLayerPointerMove = (event: ReactPointerEvent) => {
    const layer = dragLayer.current
    const board = artboardRef.current
    if (!layer || !board) return
    const rect = board.getBoundingClientRect()
    setLayerPos(layer, {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100, 8, 92),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100, 4, 96),
    })
  }
  const onLayerPointerUp = () => {
    dragLayer.current = null
  }

  const runExport = () => {
    manual({ exportState: 'running' })
    /* Le timeout est gardé en ref : un replay ou un démontage avant son
       échéance ne doit pas faire réapparaître le toast sur la scène vide. */
    if (exportTimeout.current) window.clearTimeout(exportTimeout.current)
    exportTimeout.current = window.setTimeout(
      () => setScene((s) => ({ ...s, exportState: 'done' })),
      900,
    )
  }

  /* Un calque se masque depuis la liste, comme dans l'app : c'est l'action la
     plus banale d'un panneau de calques, et son absence était ce qui faisait
     lire la liste comme une légende plutôt que comme un panneau. */
  const toggleHidden = (layer: DemoLayerId) =>
    manual({
      hidden: scene.hidden.includes(layer)
        ? scene.hidden.filter((id) => id !== layer)
        : [...scene.hidden, layer],
    })

  const layers: {
    id: DemoLayerId | 'background'
    label: string
    icon: ComponentType<{ className?: string; strokeWidth?: number; 'aria-hidden'?: boolean }>
  }[] = [
    ...(scene.textChars > 0 ? [{ id: 'text' as const, label: typed, icon: Type }] : []),
    ...(scene.device ? [{ id: 'device' as const, label: t.demo.frame, icon: Smartphone }] : []),
    { id: 'background' as const, label: t.demo.bgLayer, icon: Image },
  ]

  const typing = scene.textChars < typed.length
  const boardEdit = {
    selected: scene.selected,
    caret: typing,
    onPointerDown: onLayerPointerDown,
    onPointerMove: onLayerPointerMove,
    onPointerUp: onLayerPointerUp,
  }
  /* Les voisines se remplissent au clic sur « Tous les écrans » : c'est
     exactement l'instant où le produit prétend appliquer la composition au
     jeu, et le seul moment où la démo peut le prouver plutôt que l'écrire. */
  const spread = scene.tiles > 0

  return (
    <div
      ref={containerRef}
      onPointerDown={takeOver}
      /* Portrait sous `sm`. En 16/10 sur un écran de 390, la maquette mesurait
         348 × 218 : barre d'outils et filmstrip prenaient 92 des 218 pixels et
         il restait une planche de 50 × 108 pour montrer un écran d'iPhone. Les
         panneaux latéraux étant déjà repliés à cette largeur, la hauteur peut
         aller à la scène.

         Le chrome flotte sur la scène, comme dans le produit : barre, tiroirs
         et filmstrip sont des îlots posés sur la trame, et la scène est
         pleine largeur. La maquette portait deux colonnes pleine hauteur et
         une barre soudée au bord — trois calques et 600 px de vide en dessous,
         le plan d'un éditeur de 2010, pas de celui-ci. Un îlot fait la hauteur
         de ce qu'il contient, donc plus de vide à justifier, et le visiteur
         qui ouvre l'éditeur retrouve exactement ce qu'il a vu. */
      className="demo-stage relative aspect-[4/5] w-full overflow-hidden rounded-lg bg-stage shadow-lg outline -outline-offset-1 outline-white/10 select-none sm:aspect-[16/10]"
    >
      {/* La barre : le nom du projet à gauche, les outils, l'export à droite.
          Le point citron qui ouvrait la barre ne disait rien — le produit y
          écrit le nom du projet, et c'est ce qui fait lire la maquette comme
          un fichier ouvert plutôt qu'un gabarit. */}
      <div className="demo-island absolute inset-x-3 top-3 flex h-9 items-center gap-1.5 p-1.5">
        <span className="hidden max-w-32 truncate px-1.5 text-[10px] font-medium sm:inline">
          {t.demo.projectName}
        </span>
        <span aria-hidden className="mx-0.5 hidden h-4 w-px bg-border sm:block" />
        <ToolButton
          target="device-btn"
          icon={Smartphone}
          label={t.demo.frame}
          active={scene.device}
          onClick={() => manual({ device: true, selected: 'device' })}
        />
        <ToolButton
          target="text-btn"
          icon={Type}
          label={t.demo.text}
          active={scene.textChars > 0}
          onClick={() => manual({ textChars: typed.length, selected: 'text' })}
        />
        <ToolButton
          target="apply-btn"
          icon={LayoutGrid}
          label={t.demo.apply}
          active={scene.tiles > 0}
          onClick={() =>
            manual({
              tiles: DEMO_TILES,
              spreadTextPos: scene.textPos,
              spreadDevicePos: scene.devicePos,
            })
          }
        />
        <div className="ml-auto">
          <ToolButton
            target="export-btn"
            icon={Download}
            label={t.demo.export}
            primary
            onClick={runExport}
          />
        </div>
      </div>

      {/* Le plan de travail, pas une planche. Voir DemoBoard.tsx : une seule
          planche laissait 88 % de la scène en trame et ne montrait nulle part
          à quoi ressemble un projet de dix écrans. La rangée est bornée par
          les deux tiroirs et par le filmstrip, et chaque planche prend la
          plus petite des deux mesures (`.demo-board`, landing.css) : en
          hauteur ce que la rangée lui laisse, en largeur le tiers de la
          rangée — sous `sm` seule la hauteur compte et les voisines débordent,
          ce qui est ce qu'un plan de travail fait sur un écran étroit. Sous
          `md`, sans tiroirs, la pastille et le toast montent sous la barre :
          la rangée leur laisse cette ligne plutôt que de les recevoir sur les
          titres des voisines. */}
      <div
        className="demo-boards absolute inset-x-3 top-20 bottom-18 flex items-start justify-center gap-4 pb-7 md:inset-x-49 md:top-14 md:bottom-21"
        data-resetting={resetting ? '' : undefined}
        style={{ containerType: 'size', '--demo-board-ratio': BOARD_RATIO } as CSSProperties}
      >
        <div className="demo-board relative shrink-0">
          <DemoBoard
            scene={scene}
            title={t.demo.neighbours[0].title}
            sub={t.demo.neighbours[0].sub}
            variant={1}
            appLabel={t.demo.appLabel}
            filled={spread}
            current={false}
          />
        </div>
        <div className="demo-board relative shrink-0">
          <DemoBoard
            boardRef={artboardRef}
            scene={scene}
            title={typed.slice(0, Math.min(scene.textChars, typed.length))}
            sub={t.demo.typedSub}
            variant={0}
            appLabel={t.demo.appLabel}
            filled={scene.textChars > 0 || scene.device}
            current
            edit={boardEdit}
          />
          {/* La cote mesure la planche, et seulement elle. Elle courait sous
              la maquette entière — « 1320 px » sous une fenêtre d'éditeur de
              1150, sur une page qui promet le pixel près. Elle vient de
              `dimensions.ts` : c'est une mesure, pas du texte. */}
          <DimensionNote
            value={`${APP_STORE_TARGET.portrait.width} × ${APP_STORE_TARGET.portrait.height} px`}
            className="absolute inset-x-0 -bottom-4.5"
          />
        </div>
        <div className="demo-board relative shrink-0">
          <DemoBoard
            scene={scene}
            title={t.demo.neighbours[1].title}
            sub={t.demo.neighbours[1].sub}
            variant={2}
            appLabel={t.demo.appLabel}
            filled={spread}
            current={false}
          />
        </div>
      </div>

      {/* Calques — le tiroir gauche de l'app, réduit à sa liste. */}
      <aside className="demo-island absolute top-14 left-3 hidden w-40 flex-col md:flex">
        <p className="border-b border-border/60 px-3 py-2 text-[9px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
          {t.demo.layers}
        </p>
        {/* 160 px et pas 128 : le nom d'un calque de texte est son contenu, et
            à 128 la seule ligne que ce panneau existe pour montrer se coupait
            en « Track your sl… ». Les lignes ne se touchent plus non plus —
            `gap-px` les soudait en un bloc gris. */}
        <div className="flex flex-col gap-0.5 p-1.5">
          {layers.map((layer) => {
            const hidden = layer.id !== 'background' && scene.hidden.includes(layer.id)
            return (
              <div
                key={layer.id}
                className={cn(
                  'flex items-center rounded-sm transition-colors duration-150',
                  layer.id !== 'background' && scene.selected === layer.id
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-secondary',
                )}
              >
                <button
                  type="button"
                  data-cursor-target={
                    layer.id === 'background' ? undefined : (`layer-row-${layer.id}` as const)
                  }
                  onClick={() => manual({ selected: layer.id === 'background' ? null : layer.id })}
                  className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 pl-2 text-left text-[10px]"
                >
                  <layer.icon aria-hidden className="size-3 shrink-0" strokeWidth={1.75} />
                  <span className={cn('truncate', hidden && 'line-through opacity-50')}>
                    {layer.label}
                  </span>
                </button>
                {layer.id === 'background' ? (
                  /* Le fond ne se masque pas : une planche sans fond n'est
                     pas une planche, c'est un PNG transparent qu'App Store
                     Connect refuse. */
                  <span className="w-6 shrink-0" />
                ) : (
                  /* 24 px et pas 20 : c'est le plancher de cible WCAG 2.2
                     SC 2.5.8, et l'œil était le seul contrôle du mock en
                     dessous. */
                  <button
                    type="button"
                    aria-label={`${layer.label} : ${hidden ? t.demo.showLayer : t.demo.hideLayer}`}
                    title={hidden ? t.demo.showLayer : t.demo.hideLayer}
                    onClick={() => toggleHidden(layer.id as DemoLayerId)}
                    className="grid size-6 shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-ring"
                  >
                    {hidden ? (
                      <EyeOff aria-hidden className="size-3" strokeWidth={1.75} />
                    ) : (
                      <Eye aria-hidden className="size-3" strokeWidth={1.75} />
                    )}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </aside>

      {/* Propriétés — le tiroir droit : fond, réglages du calque, position.
          La taille d'export n'y est plus épinglée : elle est écrite sous la
          planche, en cote, là où elle mesure quelque chose. */}
      <aside className="demo-island absolute top-14 right-3 hidden w-40 flex-col md:flex">
        <p className="border-b border-border/60 px-3 py-2 text-[9px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
          {t.demo.properties}
        </p>
        <div className="flex flex-col gap-3 p-3">
          <PanelSection title={t.demo.background}>
            <div className="flex gap-1.5">
              {DEMO_GRADIENTS.map((gradient, index) => (
                <Swatch
                  key={gradient.name}
                  target={`bg-swatch-${index}`}
                  label={gradient.name}
                  background={gradient.css}
                  selected={scene.bgIndex === index}
                  onClick={() => manual({ bgIndex: index })}
                />
              ))}
            </div>
            {/* Le nom du preset sélectionné : c'est ce que l'éditeur affiche,
                et c'est ce qui prouve que ces trois pastilles sont les
                siennes et pas trois dégradés dessinés pour la vitrine. */}
            <p className="mt-1.5 truncate text-[10px]">{DEMO_GRADIENTS[scene.bgIndex].name}</p>
          </PanelSection>

          {/* Les réglages du calque sélectionné. Ils n'existaient pas : le
              panneau montrait trois pastilles et deux nombres en lecture
              seule, ce qui décrit une légende, pas un éditeur. */}
          {scene.selected === 'text' ? (
            <PanelSection title={t.demo.typography}>
              <div className="flex gap-1">
                {TEXT_SIZES.map((step, index) => (
                  <button
                    key={step.label}
                    type="button"
                    data-cursor-target={`text-size-${index}`}
                    aria-label={t.demo.textSizes[index]}
                    title={t.demo.textSizes[index]}
                    aria-pressed={scene.textSize === index}
                    onClick={() => manual({ textSize: index })}
                    className={cn(
                      'h-6 flex-1 rounded-sm text-[10px] font-medium transition-[background-color,color,scale] duration-150 active:scale-[0.96] focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-ring',
                      scene.textSize === index
                        ? 'bg-accent text-foreground'
                        : 'bg-secondary text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {step.label}
                  </button>
                ))}
              </div>
              <div className="mt-1.5 flex gap-1.5">
                {TEXT_COLORS.map((color, index) => (
                  <Swatch
                    key={color}
                    target={`text-color-${index}`}
                    label={t.demo.textColors[index]}
                    background={color}
                    selected={scene.textColor === index}
                    onClick={() => manual({ textColor: index })}
                  />
                ))}
              </div>
            </PanelSection>
          ) : null}

          {scene.selected === 'device' ? (
            <PanelSection title={t.demo.frameColor}>
              <div className="flex gap-1.5">
                {FRAME_COLORS.map((color, index) => (
                  <Swatch
                    key={color}
                    target={`frame-color-${index}`}
                    label={t.demo.frameColors[index]}
                    background={color}
                    selected={scene.frameColor === index}
                    onClick={() => manual({ frameColor: index })}
                  />
                ))}
              </div>
              <p className="mt-1.5 truncate text-[10px]">{t.demo.frameColors[scene.frameColor]}</p>
            </PanelSection>
          ) : null}

          {scene.selected ? (
            <PanelSection title={t.demo.position}>
              <SelectedPosition selected={scene.selected} layerPos={layerPos} />
            </PanelSection>
          ) : null}
        </div>
      </aside>

      {/* Le filmstrip n'a pas de surface, comme dans le produit : il porte
          des vignettes, et une vignette est déjà une surface. */}
      <div className="absolute inset-x-0 bottom-0 flex h-18 items-end justify-center gap-1.5 pb-3 md:h-21">
        {Array.from({ length: DEMO_TILES }, (_, tile) => (
          <DemoTile
            key={tile}
            scene={scene}
            filled={tile < scene.tiles}
            current={tile === 0}
            rank={tile + 1}
            titleWidth={tileTitleWidth(tile)}
          />
        ))}
      </div>

      {scene.exportState !== 'idle' ? (
        <div className="absolute top-14 right-3 flex h-6 items-center gap-1.5 rounded-sm bg-card px-2 text-[10px] font-medium shadow-md md:top-auto md:bottom-3">
          {scene.exportState === 'running' ? (
            <>
              <Loader2 aria-hidden className="size-3 animate-spin text-muted-foreground" />
              <span>{t.demo.exporting}</span>
            </>
          ) : (
            <>
              <Check aria-hidden className="size-3 text-marker" />
              {/* La dimension se replie sous `sm` : sur une maquette de
                  348 px le toast complet faisait la moitié de la largeur et
                  couvrait le téléphone qu'il vient de rendre. Elle vient de
                  `dimensions.ts` plutôt que d'une chaîne traduite — c'est
                  une mesure, pas du texte. */}
              <span className="tabular-nums">
                {t.demo.toastFile}
                <span className="hidden sm:inline">
                  {' · '}
                  {APP_STORE_TARGET.portrait.width}×{APP_STORE_TARGET.portrait.height}
                </span>
              </span>
            </>
          )}
        </div>
      ) : null}

      {/* Une seule pastille, qui dit et qui fait. Il y avait une puce
          « Cliquez pour prendre la main » en bas à gauche et, en haut à
          droite, un bouton portant une flèche de curseur : sur une capture
          il se lisait comme un second pointeur posé dans le panneau. La
          pastille est aussi le mécanisme de pause exigé par WCAG 2.2.2 —
          donc elle doit rester un bouton, atteignable au clavier.

          En reduced-motion et avant toute action, il n'y a ni animation à
          couper ni rien à rejouer : la composition finale est déjà là. La
          pastille disait « Rejouer la démo » et ne changeait visiblement
          rien — un contrôle mort.

          Sous `md` elle monte sous la barre, où les tiroirs ne sont pas :
          en bas, elle tombait sur les vignettes du filmstrip. */}
      <div
        className={cn(
          'absolute top-14 left-3 z-20 md:top-auto md:bottom-3',
          !playing && !touched && 'hidden',
        )}
      >
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => {
            if (playing) {
              takeOver()
              return
            }
            if (exportTimeout.current) window.clearTimeout(exportTimeout.current)
            /* Rejouer reconstruit depuis zéro : c'est ce que le libellé promet.
               La planche n'est pas vidée ici — `build()` s'en charge derrière
               son fondu, sinon le fondu partirait d'un écran déjà noir. */
            buildState.current = 'todo'
            editStep.current = 0
            setTouched(false)
            setAutoplay(true)
          }}
          /* 32 px et un corps de 12, avec la zone de frappe de 44 que le
             reste de l'app se donne : c'est la seule commande de la démo, et
             elle mesurait 24 px de haut pour 10 px de texte. Sous `md` les
             tiroirs sont repliés, donc rien à recouvrir sur sa ligne. */
          className="hit-44 flex h-8 items-center gap-1 rounded-sm bg-card px-3 text-xs text-muted-foreground shadow-md transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {playing ? null : (
            <RotateCcw aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />
          )}
          {playing ? t.demo.hint : t.demo.replay}
        </button>
      </div>

      <DemoCursor pose={cursor} visible={cursorOn && playing} />
    </div>
  )
}
