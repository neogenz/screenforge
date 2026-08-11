import { memo, useEffect, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  ClipboardPaste,
  Copy,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react'
import { ContextMenu } from '@/components/ui/ContextMenu'
import { Input } from '@/components/ui/input'
import { Popover } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { defaultScreenName } from '@/lib/screens'
import {
  THUMBNAIL_BADGE_SIZE,
  THUMBNAIL_HEIGHT,
  THUMBNAIL_LABEL_GAP,
  THUMBNAIL_LABEL_HEIGHT,
  THUMBNAIL_LABEL_ROW,
  THUMBNAIL_WIDTH,
} from '@/lib/stage'
import type { Screen } from '@/types'

interface ScreenThumbnailProps {
  screen: Screen
  isActive: boolean
  index: number
  canDelete: boolean
  canMoveLeft: boolean
  canMoveRight: boolean
  canPasteSettings: boolean
  onSelect: (id: string) => void
  onRename: (id: string, name: string) => void
  onDuplicate: (id: string) => void
  onCopySettings: (id: string) => void
  onPasteSettings: (id: string) => void
  onDelete: (id: string) => void
  onMove: (index: number, direction: -1 | 1) => void
}

export const ScreenThumbnail = memo(function ScreenThumbnail({
  screen,
  isActive,
  index,
  canDelete,
  canMoveLeft,
  canMoveRight,
  canPasteSettings,
  onSelect,
  onRename,
  onDuplicate,
  onCopySettings,
  onPasteSettings,
  onDelete,
  onMove,
}: ScreenThumbnailProps) {
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null)
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(screen.name)
  const inputRef = useRef<HTMLInputElement>(null)
  const actionsRef = useRef<HTMLButtonElement>(null)
  const previewRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!editing) return
    // Le panneau refuse le focus automatique (`onOpenAutoFocus` prévenu dans la
    // primitive), donc il se prend ici — et la sélection du texte avec, pour
    // que renommer soit une frappe et non un effacement préalable.
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
    return () => cancelAnimationFrame(frame)
  }, [editing])

  function startRename() {
    // Le champ s'ouvre sur le nom que la tuile affiche, quel qu'il soit, et il
    // est sélectionné : renommer est une frappe. Il s'ouvrait vide pour un écran
    // resté à son rang, ce qui demandait de deviner qu'un champ vide et une
    // invite grise valaient « Écran 3 » — un état par accident, pas une valeur.
    setDraftName(screen.name)
    setEditing(true)
  }

  function finishRename() {
    setEditing(false)
    // Un écran a toujours un nom : vidé, il retombe sur son rang plutôt que de
    // laisser une tuile anonyme dans la rangée. C'est aussi la façon d'annuler
    // un renommage sans passer par l'historique.
    const next = draftName.trim() || defaultScreenName(index)
    if (next !== screen.name) onRename(screen.id, next)
  }

  return (
    <div
      // Largeur imposée par la vignette, et non par le libellé : c'est en
      // laissant l'étiquette étirer la colonne que la tuile perdait son cadrage.
      style={{ width: THUMBNAIL_WIDTH }}
      className={cn(
        'group/thumb relative shrink-0',
        'transition-[translate] duration-150 ease-out',
        // L'état sort du coin et revient à la silhouette. Le badge dit lequel,
        // le soulèvement dit lequel de loin : sur une rangée alignée, 4px de
        // décalage se lisent d'un coup d'œil, y compris en thème sombre où une
        // ombre ne se voit presque pas. Un anneau citron le dirait aussi, mais
        // 2px de trait plein sur une tuile large de 46 est le trait le plus
        // épais de l'interface — un surligneur, pas un état.
        //
        // Sans mouvement, le décalage tombe : l'ombre et le badge portent seuls
        // l'état, ce qu'ils font déjà à eux deux.
        isActive && '-translate-y-1 motion-reduce:translate-y-0',
      )}
      onContextMenu={(event) => {
        event.preventDefault()
        setMenuPosition({ left: event.clientX, top: event.clientY })
      }}
    >
      {/* Le rang, au-dessus de la composition et non dessus.
          Posé sur l'aperçu il ne coûtait aucune hauteur, et c'est bien ce qui
          l'avait mis là ; ce qu'il coûtait à la place, c'était un coin de
          chaque planche — une pastille de chrome sur dix vignettes à la fois,
          dans l'outil dont le seul travail est de montrer ces dix images. Il
          sort donc de l'image, retrouve les jetons du thème, et l'aperçu ne
          porte plus que ce que l'utilisateur y a mis.

          Le rang, pas un matricule : « 01 » sur cinq écrans se lit comme un
          code. Dix au maximum, donc jamais trois chiffres. La largeur est un
          plancher, pas une contrainte : oblongue sur « 10 », carrée sur un
          chiffre — et la boîte garde la même dans les deux états, pour que
          devenir courant ne décale rien.

          `aria-hidden` : le bouton annonce déjà le nom complet, et le rang se
          lit dans l'ordre du parcours. */}
      <span
        aria-hidden
        style={{
          height: THUMBNAIL_LABEL_HEIGHT,
          minWidth: THUMBNAIL_BADGE_SIZE,
          marginBottom: THUMBNAIL_LABEL_GAP,
        }}
        className={cn(
          'tabular flex w-fit items-center justify-center rounded-sm px-1 text-2xs',
          'transition-colors duration-150 ease-out',
          isActive ? 'marker-fill font-semibold' : 'font-medium text-muted-foreground',
        )}
      >
        {index + 1}
      </span>

      {/* Une tuile, un bouton, une cible. L'aperçu et le numéro vivaient dans
          deux boutons dont le second n'existait que pour doubler le premier au
          pointeur — `aria-hidden`, `tabIndex={-1}` et une zone de clic étendue à
          la main. Le rang est sorti de l'aperçu mais reste hors du parcours :
          il n'y a toujours qu'une boîte cliquable par écran. */}
      <button
        ref={previewRef}
        type="button"
        onClick={() => onSelect(screen.id)}
        onDoubleClick={startRename}
        title={`${screen.name} — double-clic pour renommer`}
        aria-label={`Activer ${screen.name}`}
        aria-pressed={isActive}
        // Repère du glisser-déposer : c'est cet élément, et non la colonne, que
        // le navigateur doit photographier pour l'image traînée.
        data-thumbnail-preview
        style={{ height: THUMBNAIL_HEIGHT }}
        className={cn(
          // `rounded-md` et non `rounded-xl` : le rayon d'îlot est calibré sur
          // des surfaces larges, et 21 sur une tuile de 46 en fait une gélule —
          // 46% de la largeur. La vignette montre un téléphone, pas une pilule.
          'relative block w-full cursor-pointer overflow-hidden rounded-md bg-muted',
          'border border-border',
          'transition-[border-color,box-shadow,scale] duration-150 ease-out',
          // `scale` et non `transform` : Tailwind v4 écrit la propriété `scale`,
          // que l'ancienne liste ne nommait pas — l'enfoncement sautait.
          'active:scale-[0.97] motion-reduce:transition-none',
          // Seule la tuile courante se détache ; les autres reposent à plat sur
          // la bande, leur bordure suffit à les découper. `shadow-md` est une
          // élévation d'îlot : sa nappe basse descend d'une quarantaine de
          // pixels sous une tuile qui en fait 116, et la boîte de défilement la
          // tranchait net — `overflow-x: auto` force l'autre axe. L'ombre de
          // contact tient dans les 8px que le dégagement et la levée laissent
          // sous la tuile ; l'état, lui, est déjà porté par la pastille citron
          // et par cette levée.
          isActive ? 'shadow-(--shadow-handle)' : 'hover:border-input',
        )}
      >
        {/* Pas d'`img-outline` ici : le liseré des images sert à détacher une
            image posée à même une surface, or celle-ci est déjà encadrée par la
            bordure de la tuile. Les deux traits cumulaient 2px de cadre sur 53
            de large, et le liseré, rectangulaire, se faisait couper aux quatre
            coins par l'écrêtage arrondi — d'où un aperçu qui paraissait rogné. */}
        {screen.thumbnail ? (
          <img src={screen.thumbnail} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="block h-full w-full bg-secondary" />
        )}
      </button>

      {/* Le nom, toujours — son rang à défaut. La rangée n'apparaissait qu'au
          premier renommage, et seuls les écrans nommés y écrivaient : une file
          où une tuile sur deux portait une étiquette et l'autre du vide, et où
          nommer un écran faisait sauter la scène de 22px. Un écran a un nom, le
          rang en est un par défaut, et la rangée est réservée pour les dix.

          La colonne fait `THUMBNAIL_WIDTH` : c'est ce qui décide de ce que le
          libellé peut dire, et pourquoi le rang a pris sa propre rangée plutôt
          que la gauche de celle-ci. `aria-hidden` parce que le bouton annonce
          déjà le nom complet — lu deux fois, il devient du bruit. La troncature
          n'est jamais le seul accès au nom : il reste entier sur l'infobulle,
          dans le menu contextuel et au-dessus de la planche. */}
      <span
        aria-hidden
        style={{ height: THUMBNAIL_LABEL_HEIGHT, marginTop: THUMBNAIL_LABEL_GAP }}
        className={cn(
          'block truncate text-center text-2xs',
          isActive ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {screen.name}
      </span>

      {/* Le champ ne tient pas dans la tuile, et il ne faut pas l'y forcer.
          Posé sur le bas de l'aperçu il faisait 53px de large : six caractères
          d'un nom qui en compte vingt, centrés, en corps 11, sur la capture de
          l'utilisateur. Ce n'est pas un champ, c'est une fente — et la bande ne
          pouvait pas l'élargir, elle épingle `overflow-y: hidden` et rien n'en
          sort en flux.

          Il se détache donc : le panneau est porté par le portail de Radix, et
          prend la largeur d'un nom au lieu de celle d'une vignette. Il éclot du
          bord haut de la tuile, aligné sur son bord gauche — c'est ce qui dit
          quel écran est renommé, sans qu'aucune tuile ait à changer d'état. */}
      <Popover
        open={editing}
        anchor={previewRef}
        onClose={finishRename}
        // Dehors valide, Échap annule. Les deux sorties sont distinctes parce
        // que la primitive laisse la touche à qui la demande — un drapeau posé
        // depuis le champ arriverait après elle.
        onEscape={() => setEditing(false)}
        side="top"
        align="start"
        className="w-56 p-2"
        role="dialog"
        ariaLabel={`Renommer ${screen.name}`}
      >
        <Input
          ref={inputRef}
          font="sans"
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') finishRename()
          }}
          placeholder={defaultScreenName(index)}
          aria-label="Nom de l’écran"
          spellCheck={false}
        />
        {/* Une ligne, pas deux : « Laissé vide, il garde son rang pour nom. »
            débordait et laissait « nom. » orphelin sous un champ de 224. */}
        <p className="field-label mt-1.5 leading-4">Vide, il garde son rang.</p>
      </Popover>

      <button
        ref={actionsRef}
        type="button"
        onClick={() => {
          if (menuPosition) setMenuPosition(null)
          else {
            const bounds = actionsRef.current?.getBoundingClientRect()
            if (bounds) setMenuPosition({ left: bounds.right - 180, top: bounds.top - 150 })
          }
        }}
        // Le repère est la colonne, qui commence à la rangée du rang : sans ce
        // décalage la poignée se posait 22px plus haut, à côté du numéro et
        // hors de l'aperçu qu'elle commande.
        style={{ top: THUMBNAIL_LABEL_ROW + 4 }}
        className={cn(
          // 28 de zone pour 20 de bouton, et pas les 44 de `hit-44` : sur une
          // tuile de 46×100, un carré de 44 ancré au coin couvrait 42% de
          // l'aperçu et prenait le clic destiné à l'écran lui-même. Le plancher
          // tactile ne s'applique pas ici — l'éditeur déclare son plancher
          // desktop, et le jeu d'actions complet reste sur le clic droit de
          // toute la tuile.
          'after:absolute after:-inset-1 after:content-[""]',
          'absolute right-1 flex h-5 w-5 items-center justify-center rounded-full',
          'border border-border bg-card/95 text-muted-foreground transition-opacity hover:text-foreground',
          !menuPosition &&
            'pointer-events-none opacity-0 focus:pointer-events-auto focus:opacity-100 group-hover/thumb:pointer-events-auto group-hover/thumb:opacity-100',
        )}
        aria-label={`Actions de ${screen.name}`}
        aria-expanded={menuPosition !== null}
        aria-haspopup="menu"
      >
        <MoreHorizontal size={12} strokeWidth={1.75} aria-hidden />
      </button>

      {menuPosition && (
        <ContextMenu
          position={menuPosition}
          label={`Actions de ${screen.name}`}
          onClose={() => setMenuPosition(null)}
          items={[
            {
              label: 'Renommer',
              icon: <Pencil size={11} strokeWidth={1.5} aria-hidden />,
              onSelect: startRename,
            },
            {
              label: 'Dupliquer',
              icon: <Copy size={11} strokeWidth={1.5} aria-hidden />,
              onSelect: () => onDuplicate(screen.id),
            },
            'separator',
            {
              label: 'Copier les réglages',
              icon: <ClipboardCopy size={11} strokeWidth={1.5} aria-hidden />,
              onSelect: () => onCopySettings(screen.id),
            },
            {
              label: 'Coller les réglages',
              icon: <ClipboardPaste size={11} strokeWidth={1.5} aria-hidden />,
              disabled: !canPasteSettings,
              onSelect: () => onPasteSettings(screen.id),
            },
            'separator',
            {
              label: 'Déplacer à gauche',
              icon: <ChevronLeft size={11} strokeWidth={1.5} aria-hidden />,
              disabled: !canMoveLeft,
              onSelect: () => onMove(index, -1),
            },
            {
              label: 'Déplacer à droite',
              icon: <ChevronRight size={11} strokeWidth={1.5} aria-hidden />,
              disabled: !canMoveRight,
              onSelect: () => onMove(index, 1),
            },
            {
              label: 'Supprimer',
              icon: <Trash2 size={11} strokeWidth={1.5} aria-hidden />,
              danger: true,
              disabled: !canDelete,
              onSelect: () => onDelete(screen.id),
            },
          ]}
        />
      )}
    </div>
  )
})
