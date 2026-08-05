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
import { THUMBNAIL_BADGE_SIZE, THUMBNAIL_HEIGHT, THUMBNAIL_WIDTH } from '@/lib/stage'
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
      {/* Une tuile, un bouton, une cible. L'aperçu et le numéro vivaient dans
          deux boutons dont le second n'existait que pour doubler le premier au
          pointeur — `aria-hidden`, `tabIndex={-1}` et une zone de clic étendue à
          la main. Le numéro est maintenant *dans* l'aperçu, donc la question ne
          se pose plus : il n'y a plus qu'une boîte. */}
      <button
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
          'relative block w-full cursor-pointer overflow-hidden rounded-xl bg-muted',
          'border border-border',
          'transition-[border-color,box-shadow,scale] duration-150 ease-out',
          // `scale` et non `transform` : Tailwind v4 écrit la propriété `scale`,
          // que l'ancienne liste ne nommait pas — l'enfoncement sautait.
          'active:scale-[0.97] motion-reduce:transition-none',
          // L'aperçu porte le travail de l'utilisateur, et une part de l'état :
          // l'ombre d'un cran au-dessus, jamais un anneau.
          isActive ? 'shadow-md' : 'shadow-(--shadow-handle) hover:border-input',
        )}
      >
        {screen.thumbnail ? (
          <img src={screen.thumbnail} alt="" className="img-outline h-full w-full object-cover" />
        ) : (
          <span className="block h-full w-full bg-secondary" />
        )}

        {/* Le numéro est une marque sur l'image, plus un objet de la scène.
            Sous l'aperçu il devait tenir contre deux thèmes *et* contre une
            capture presque toujours claire ; posé dessus, il n'a plus qu'une
            surface à contraster, et son voile la lui fournit — sur une capture
            blanche comme sur une noire.

            Le rang, pas un matricule : « 01 » sur cinq écrans se lit comme un
            code. Dix au maximum, donc jamais trois chiffres. Le nom complet
            reste sur l'infobulle, dans le menu contextuel et au-dessus de la
            planche ; il ne tiendrait ici qu'amputé, et « 03 O… » ne dit rien de
            plus que « 03 ».

            La largeur est un plancher, pas une contrainte : oblongue sur « 10 »,
            carrée sur un chiffre. */}
        <span
          style={{ height: THUMBNAIL_BADGE_SIZE, minWidth: THUMBNAIL_BADGE_SIZE }}
          className={cn(
            'tabular absolute left-1 top-1 flex items-center justify-center',
            'rounded-sm px-1 text-2xs transition-colors duration-150 ease-out',
            // Le voile et son encre sont des littéraux assumés : ils se posent
            // sur la capture de l'utilisateur, pas sur du chrome. Un jeton de
            // thème disparaîtrait sur la moitié des aperçus — même raison que
            // le `border-white` de l'arrêt de dégradé et que `SELECTION_INK`.
            // Aucune matrice ne peut les vérifier, le pire cas est donc calculé
            // ici : blanc sur un noir à 60% posé sur un aperçu blanc, 5.7:1 ;
            // sur un aperçu noir, 21:1. À 45% le pire cas tombait à 3.3:1.
            //
            // Pas d'ombre de contact : une marque posée sur l'image ne se
            // détache pas d'elle.
            isActive
              ? 'marker-fill font-semibold'
              : 'bg-black/60 font-medium text-white backdrop-blur-xs',
          )}
        >
          {index + 1}
        </span>
      </button>

      {/* Le champ se pose sur le bas de l'aperçu : un `input` dans un `button`
          est invalide, et l'échanger dans le flux ferait sauter la rangée au
          premier clic de renommage. Pleine largeur de la tuile, à l'opposé du
          badge, qu'il ne recouvre donc jamais. */}
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
          // Pleine largeur, et le bas arrondi comme l'aperçu qu'il coiffe :
          // posé à plat il aurait débordé de deux angles vifs sur les coins
          // ronds de la tuile.
          className="field-surface absolute inset-x-0 bottom-0 w-full rounded-b-xl px-1 text-center text-2xs text-foreground outline-none"
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
