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
import { cn } from '@/lib/utils'
import {
  THUMBNAIL_BADGE_GAP,
  THUMBNAIL_BADGE_SIZE,
  THUMBNAIL_HEIGHT,
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

  useEffect(() => {
    if (!editing) return
    const frame = requestAnimationFrame(() => inputRef.current?.select())
    return () => cancelAnimationFrame(frame)
  }, [editing])

  function startRename() {
    setDraftName(screen.name)
    setEditing(true)
  }

  function commitRename() {
    const trimmed = draftName.trim()
    if (trimmed && trimmed !== screen.name) onRename(screen.id, trimmed)
    setEditing(false)
  }

  return (
    <div
      // Largeur imposée par la vignette, et non par le libellé : c'est en
      // laissant l'étiquette étirer la colonne que la tuile perdait son cadrage.
      style={{ width: THUMBNAIL_WIDTH }}
      className="group/thumb relative shrink-0"
      onContextMenu={(event) => {
        event.preventDefault()
        setMenuPosition({ left: event.clientX, top: event.clientY })
      }}
    >
      {/* Une colonne, un bouton. L'aperçu et le numéro vivaient dans deux boutons
          dont le second n'existait que pour doubler le premier au pointeur —
          `aria-hidden`, `tabIndex={-1}` et une zone de clic étendue à la main
          pour rattraper ses 20px. Ils sont ici un seul objet, une seule cible,
          un seul arrêt de tabulation ; l'écart de 6 les lie sans les souder. */}
      <button
        type="button"
        onClick={() => onSelect(screen.id)}
        onDoubleClick={startRename}
        title={`${screen.name} — double-clic pour renommer`}
        aria-label={`Activer ${screen.name}`}
        aria-pressed={isActive}
        style={{ gap: THUMBNAIL_BADGE_GAP }}
        // Le rayon ne se voit pas ici — le bouton n'a ni fond ni trait — il
        // donne sa forme à l'anneau de focus, qui cernait la colonne d'un
        // rectangle vif autour d'un aperçu arrondi et d'une puce ronde. Même
        // valeur que l'aperçu, à retrait nul : l'anneau tombe à 14 + 2.
        className="flex w-full cursor-pointer flex-col items-center rounded-xl"
      >
        <span
          // Repère du glisser-déposer : c'est cet élément, et non la colonne,
          // que le navigateur doit photographier pour l'image traînée.
          data-thumbnail-preview
          style={{ height: THUMBNAIL_HEIGHT }}
          // L'aperçu ne porte pas l'état : il porte le travail de l'utilisateur.
          // Son trait le ferme, son ombre de contact le pose, rien d'autre.
          className={cn(
            'block w-full shrink-0 overflow-hidden rounded-xl bg-muted',
            'border border-border shadow-(--shadow-handle)',
            'transition-[border-color,transform] duration-150 ease-out',
            'group-active/thumb:scale-[0.97] motion-reduce:transition-none',
            !isActive && 'group-hover/thumb:border-input',
          )}
        >
          {screen.thumbnail ? (
            <img
              src={screen.thumbnail}
              alt=""
              className="img-outline h-full w-full object-cover"
            />
          ) : (
            <span className="block h-full w-full bg-secondary" />
          )}
        </span>

        {/* La puce porte l'état, seule. L'écran courant se signalait par un halo
            citron de 2px autour d'une tuile large de 46 : proportionnellement le
            trait le plus épais de l'interface, et un surlignage plutôt qu'un
            état. Une pastille pleine se repère d'aussi loin sans cerner l'aperçu.

            Le numéro seul, et non le nom : la tuile fait la largeur de
            l'artboard, où un nom ne tient qu'amputé — « 03 O… » ne dit rien de
            plus que « 03 ». Le nom complet reste sur l'infobulle, dans le menu
            contextuel, et au-dessus de la planche sur le canevas. */}
        <span
          // La pastille n'existe que pour l'écran courant. Sur chacune des dix,
          // elle n'était plus un état mais un ornement : dix jetons blancs sur
          // une scène claire, dix jetons sombres sur une scène noire, chacun
          // plus visible comme forme que le chiffre qu'il portait. Au repos il
          // ne reste que le chiffre ; la boîte de 20 reste réservée pour tous,
          // sinon la rangée sauterait à chaque changement d'écran.
          //
          // Ronde de 20 sur un chiffre, très légèrement oblongue sur « 10 » : la
          // largeur est un plancher, pas une contrainte. À 20 fixes le seul
          // nombre à deux chiffres du projet touchait les deux bords.
          style={{ height: THUMBNAIL_BADGE_SIZE, minWidth: THUMBNAIL_BADGE_SIZE }}
          className={cn(
            'tabular flex shrink-0 items-center justify-center rounded-full px-1 text-sm',
            'transition-colors duration-150 ease-out',
            // Le citron est posé sur la scène, pas peint dessus : la même ombre
            // de contact que l'aperçu et que le « + ». Un aplat sans arête ne
            // se distingue d'un surlignage que par sa forme.
            isActive
              ? 'marker-fill font-semibold shadow-(--shadow-handle) group-hover/thumb:bg-marker-hover'
              : 'font-medium text-muted-foreground group-hover/thumb:bg-accent group-hover/thumb:text-foreground',
          )}
        >
          {/* Le rang, pas un matricule : « 01 » sur cinq écrans se lit comme un
              code et remplit la pastille de deux glyphes de 11px là où un seul
              de 14 se lit d'un coup d'œil. Dix au maximum, donc jamais trois. */}
          {index + 1}
        </span>
      </button>

      {/* Le champ se pose sur la puce plutôt qu'à sa place : un `input` dans un
          `button` est invalide, et l'échanger dans le flux ferait sauter la
          colonne au premier clic de renommage. Il prend toute la largeur de la
          vignette, pas celle de la puce : un nom ne se saisit pas dans 20px. */}
      {editing && (
        <input
          ref={inputRef}
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          onBlur={commitRename}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commitRename()
            if (event.key === 'Escape') setEditing(false)
          }}
          aria-label="Nom de l’écran"
          spellCheck={false}
          style={{ height: THUMBNAIL_BADGE_SIZE }}
          className="field-surface absolute inset-x-0 bottom-0 w-full rounded-full px-1.5 text-center text-2xs text-foreground outline-none"
        />
      )}

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
        className={cn(
          // 28 de zone pour 20 de bouton, et pas les 44 de `hit-44` : sur une
          // tuile de 46×100, un carré de 44 ancré au coin couvrait 42% de
          // l'aperçu et prenait le clic destiné à l'écran lui-même. Le plancher
          // tactile ne s'applique pas ici — l'éditeur déclare son plancher
          // desktop, et le jeu d'actions complet reste sur le clic droit de
          // toute la tuile.
          'after:absolute after:-inset-1 after:content-[""]',
          'absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full',
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
            { label: 'Renommer', icon: <Pencil size={11} strokeWidth={1.5} aria-hidden />, onSelect: startRename },
            { label: 'Dupliquer', icon: <Copy size={11} strokeWidth={1.5} aria-hidden />, onSelect: () => onDuplicate(screen.id) },
            'separator',
            { label: 'Copier les réglages', icon: <ClipboardCopy size={11} strokeWidth={1.5} aria-hidden />, onSelect: () => onCopySettings(screen.id) },
            { label: 'Coller les réglages', icon: <ClipboardPaste size={11} strokeWidth={1.5} aria-hidden />, disabled: !canPasteSettings, onSelect: () => onPasteSettings(screen.id) },
            'separator',
            { label: 'Déplacer à gauche', icon: <ChevronLeft size={11} strokeWidth={1.5} aria-hidden />, disabled: !canMoveLeft, onSelect: () => onMove(index, -1) },
            { label: 'Déplacer à droite', icon: <ChevronRight size={11} strokeWidth={1.5} aria-hidden />, disabled: !canMoveRight, onSelect: () => onMove(index, 1) },
            { label: 'Supprimer', icon: <Trash2 size={11} strokeWidth={1.5} aria-hidden />, danger: true, disabled: !canDelete, onSelect: () => onDelete(screen.id) },
          ]}
        />
      )}
    </div>
  )
})
