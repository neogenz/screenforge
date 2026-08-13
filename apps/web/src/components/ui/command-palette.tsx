import { Command } from 'cmdk'
import { Search } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { getCommands, type Command as RegistryCommand } from '@/lib/commands'
import { cn } from '@/lib/utils'
import { Kbd } from '@/components/ui/kbd'

export interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const rememberFocus = (target: EventTarget | null) => {
      if (target instanceof HTMLElement && !target.closest('[cmdk-dialog]')) {
        returnFocusRef.current = target
      }
    }
    rememberFocus(document.activeElement)
    const handleFocus = (event: FocusEvent) => rememberFocus(event.target)
    document.addEventListener('focusin', handleFocus)
    return () => document.removeEventListener('focusin', handleFocus)
  }, [])

  const commands = open
    ? getCommands().filter((command) => !command.enabled || command.enabled())
    : []

  const sections: { section: string; commands: RegistryCommand[] }[] = []
  for (const command of commands) {
    let group = sections.find((entry) => entry.section === command.section)
    if (!group) {
      group = { section: command.section, commands: [] }
      sections.push(group)
    }
    group.commands.push(command)
  }

  function runCommand(command: RegistryCommand) {
    /* Même chemin qu'un Échap : le focus revient d'où la palette est partie.
       Exécuter « Basculer le thème » laissait sinon le focus dans une boîte
       démontée — au début du document en pratique. */
    dismiss()
    command.run()
  }

  function dismiss() {
    const returnFocus = returnFocusRef.current
    onClose()
    requestAnimationFrame(() => {
      if (returnFocus?.isConnected) returnFocus.focus()
    })
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) dismiss()
      }}
      label="Palette de commandes"
      loop
      overlayClassName="fixed inset-0 z-(--z-popover) animate-fade-in bg-black/50"
      contentClassName={cn(
        'surface-modal fixed left-1/2 top-[16vh] z-(--z-popover) w-[min(560px,92vw)]',
        '-translate-x-1/2 animate-palette-in overflow-hidden outline-none',
      )}
    >
      <div className="flex items-center gap-2 border-b border-border px-3">
        <Search
          size={14}
          strokeWidth={1.75}
          className="shrink-0 text-muted-foreground"
          aria-hidden
        />
        <Command.Input
          aria-label="Rechercher une commande"
          placeholder="Rechercher une commande…"
          className="h-10 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
        />
        <Kbd>esc</Kbd>
      </div>

      <Command.List label="Commandes" className="max-h-80 overflow-y-auto p-1.5">
        <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
          Aucune commande
        </Command.Empty>
        {sections.map((group) => (
          <Command.Group key={group.section} heading={group.section}>
            {group.commands.map((command) => (
              <Command.Item
                key={command.id}
                value={command.title}
                keywords={[command.section, ...(command.keywords ?? [])]}
                onSelect={() => runCommand(command)}
                className={cn(
                  'flex w-full cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-left',
                  'text-muted-foreground transition-colors duration-75 ease-out',
                  'data-[selected=true]:bg-accent data-[selected=true]:text-foreground',
                )}
              >
                <span className="min-w-0 flex-1 truncate text-sm">{command.title}</span>
                {command.shortcut && <Kbd>{command.shortcut}</Kbd>}
              </Command.Item>
            ))}
          </Command.Group>
        ))}
      </Command.List>

      <div className="flex items-center gap-3 border-t border-border px-3 py-2">
        <span className="field-label flex items-center gap-1">
          <Kbd>↑↓</Kbd> naviguer
        </span>
        <span className="field-label flex items-center gap-1">
          <Kbd>↵</Kbd> exécuter
        </span>
      </div>
    </Command.Dialog>
  )
}
