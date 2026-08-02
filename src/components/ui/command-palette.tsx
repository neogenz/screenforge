import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search } from 'lucide-react'
import { getCommands, type Command } from '@/lib/commands'
import { cn } from '@/lib/utils'
import { Kbd } from '@/components/ui/kbd'

export interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

/** Subsequence fuzzy match; returns a score (lower = better) or -1. */
function fuzzyScore(query: string, text: string): number {
  if (!query) return 0
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  let qi = 0
  let score = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += ti
      qi++
    }
  }
  return qi === q.length ? score : -1
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const results = useMemo(() => {
    if (!open) return []
    const commands = getCommands().filter((command) => !command.enabled || command.enabled())
    const trimmed = query.trim()
    if (!trimmed) return commands
    return commands
      .map((command) => {
        const haystack = [command.title, command.section, ...(command.keywords ?? [])].join(' ')
        return { command, score: fuzzyScore(trimmed, haystack) }
      })
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => a.score - b.score)
      .map((entry) => entry.command)
  }, [open, query])

  const grouped = useMemo(() => {
    const sections: { section: string; commands: { command: Command; index: number }[] }[] = []
    results.forEach((command, index) => {
      let group = sections.find((s) => s.section === command.section)
      if (!group) {
        group = { section: command.section, commands: [] }
        sections.push(group)
      }
      group.commands.push({ command, index })
    })
    return sections
  }, [results])

  // Reset query and selection on open / on query change (derived state, no effects).
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setQuery('')
      setActiveIndex(0)
    }
  }
  const [prevQuery, setPrevQuery] = useState(query)
  if (query !== prevQuery) {
    setPrevQuery(query)
    setActiveIndex(0)
  }

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  if (!open) return null

  function runCommand(command: Command) {
    onClose()
    command.run()
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const delta = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((index) => (index + delta + results.length) % Math.max(results.length, 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const command = results[activeIndex]
      if (command) runCommand(command)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-(--z-popover) flex items-start justify-center px-4 pt-[16vh]">
      <div aria-hidden onClick={onClose} className="absolute inset-0 animate-fade-in bg-scrim" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Palette de commandes"
        className="surface-modal relative w-[min(560px,92vw)] animate-palette-in overflow-hidden"
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search size={14} strokeWidth={1.75} className="shrink-0 text-faint" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Rechercher une commande"
            placeholder="Rechercher une commande…"
            spellCheck={false}
            className="h-10 w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-faint"
          />
          <Kbd>esc</Kbd>
        </div>

        <div ref={listRef} role="listbox" aria-label="Commandes" className="max-h-80 overflow-y-auto p-1.5">
          {results.length === 0 && (
            <p className="px-3 py-6 text-center text-[12px] text-faint">
              Aucune commande pour « {query} »
            </p>
          )}
          {grouped.map((group) => (
            <div key={group.section}>
              <p className="caps-label px-2 pb-1 pt-2.5">{group.section}</p>
              {group.commands.map(({ command, index }) => (
                <button
                  key={command.id}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  data-index={index}
                  onClick={() => runCommand(command)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left',
                    'transition-colors duration-75 ease-out',
                    index === activeIndex ? 'bg-raised-hover text-foreground' : 'text-foreground-muted',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-[12px]">{command.title}</span>
                  {command.shortcut && <Kbd>{command.shortcut}</Kbd>}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 border-t border-border px-3 py-2">
          <span className="caps-label flex items-center gap-1"><Kbd>↑↓</Kbd> naviguer</span>
          <span className="caps-label flex items-center gap-1"><Kbd>↵</Kbd> exécuter</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
