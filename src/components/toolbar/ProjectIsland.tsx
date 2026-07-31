import { useRef, useState } from 'react'
import { Check, LoaderCircle, TriangleAlert } from 'lucide-react'
import { useProjectStore } from '@/stores/project.store'
import { useUIStore, type SaveStatus } from '@/stores/ui.store'
import { cn } from '@/lib/utils'
import { Kbd } from '@/components/ui/kbd'

const SAVE_LABELS: Record<SaveStatus, string> = {
  idle: 'Modifications non enregistrées',
  saving: 'Enregistrement…',
  saved: 'Enregistré',
  error: 'Échec de l’enregistrement',
}

/** Floating top-left island: brand mark, project name, save status, ⌘K. */
export function ProjectIsland() {
  const saveStatus = useUIStore((s) => s.saveStatus)

  return (
    <div className="island flex h-11 items-center gap-2.5 pl-3.5 pr-1.5">
      <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px] bg-primary" />
      <ProjectName />
      <span
        role="status"
        aria-live="polite"
        className={cn(
          'mono-label hidden shrink-0 items-center gap-1.5 md:flex',
          saveStatus === 'error' ? 'text-danger' : 'text-muted',
        )}
      >
        {saveStatus === 'saving' && <LoaderCircle size={11} className="animate-spin" aria-hidden />}
        {saveStatus === 'saved' && <Check size={11} className="text-success" aria-hidden />}
        {saveStatus === 'error' && <TriangleAlert size={11} aria-hidden />}
        {SAVE_LABELS[saveStatus]}
      </span>
      <button
        type="button"
        aria-label="Ouvrir la palette de commandes"
        title="Palette de commandes (⌘K)"
        onClick={() => useUIStore.getState().setShowCommandPalette(true)}
        className={cn(
          'flex h-8 items-center gap-1 rounded-lg border border-transparent px-2 text-muted outline-none',
          'transition-colors duration-150 ease-out hover:bg-surface-hover hover:text-foreground',
          'focus-visible:border-border-strong',
        )}
      >
        <Kbd>⌘K</Kbd>
      </button>
    </div>
  )
}

function ProjectName() {
  const name = useProjectStore((s) => s.project?.name ?? '')
  const updateProjectName = useProjectStore((s) => s.updateProjectName)
  const [draft, setDraft] = useState(name)
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const [prevName, setPrevName] = useState(name)
  if (name !== prevName) {
    setPrevName(name)
    if (!editing) setDraft(name)
  }

  function commit() {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== name) updateProjectName(trimmed)
    setEditing(false)
  }

  return (
    <input
      ref={inputRef}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={() => setEditing(true)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          commit()
          inputRef.current?.blur()
        }
        if (event.key === 'Escape') {
          setDraft(name)
          setEditing(false)
          inputRef.current?.blur()
        }
      }}
      aria-label="Nom du projet"
      spellCheck={false}
      className={cn(
        'h-8 w-40 min-w-0 truncate rounded-lg border border-transparent bg-transparent px-1.5',
        'text-[13px] font-medium tracking-[-0.01em] text-foreground transition-colors',
        'hover:border-border focus:border-border-strong focus:bg-surface focus:outline-none',
      )}
    />
  )
}
