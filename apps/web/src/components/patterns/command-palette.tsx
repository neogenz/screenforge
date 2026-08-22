import { Fragment, useEffect, useRef } from 'react'
import {
  Command,
  CommandCollection,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
  CommandShortcut,
} from '@/components/ui/command'
import { Kbd } from '@/components/ui/kbd'
import { getCommands, type Command as RegistryCommand } from '@/lib/commands'

export interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

interface PaletteItem {
  value: string
  label: string
  shortcut?: string
  haystack: string
}

interface PaletteGroup {
  value: string
  items: PaletteItem[]
}

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

function filterItem(itemValue: unknown, query: string) {
  const item = itemValue as PaletteItem
  return item.haystack.includes(fold(query))
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    /* Un menu n'est pas une cible de retour : il est démonté au moment même où
       la palette s'ouvre. Ce qui rend le focus, c'est le bouton qui a ouvert ce
       menu, lu sur la relation ARIA qu'il publie lui-même. */
    const rememberFocus = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement) || target.closest('[data-slot=command-dialog-popup]'))
        return
      const remembered = target.closest('[role="menu"]')
        ? document.querySelector<HTMLElement>('[aria-haspopup="menu"][aria-expanded="true"]')
        : target
      if (remembered) returnFocusRef.current = remembered
    }
    rememberFocus(document.activeElement)
    const handleFocus = (event: FocusEvent) => rememberFocus(event.target)
    document.addEventListener('focusin', handleFocus)
    return () => document.removeEventListener('focusin', handleFocus)
  }, [])

  const commands = open
    ? getCommands().filter((command) => !command.enabled || command.enabled())
    : []

  const byId = new Map<string, RegistryCommand>()
  const groups: PaletteGroup[] = []
  for (const command of commands) {
    byId.set(command.id, command)
    let group = groups.find((entry) => entry.value === command.section)
    if (!group) {
      group = { value: command.section, items: [] }
      groups.push(group)
    }
    group.items.push({
      value: command.id,
      label: command.title,
      shortcut: command.shortcut,
      haystack: fold([command.title, command.section, ...(command.keywords ?? [])].join(' ')),
    })
  }

  function dismiss() {
    const returnFocus = returnFocusRef.current
    onClose()
    requestAnimationFrame(() => {
      if (returnFocus?.isConnected) returnFocus.focus()
    })
  }

  function runCommand(item: PaletteItem) {
    /* Même chemin qu'un Échap : le focus revient d'où la palette est partie. */
    dismiss()
    byId.get(item.value)?.run()
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) dismiss()
      }}
    >
      <CommandDialogPopup aria-label="Palette de commandes">
        <Command items={groups} filter={filterItem}>
          <CommandInput
            aria-label="Rechercher une commande"
            placeholder="Rechercher une commande…"
          />
          <CommandPanel>
            <CommandEmpty>Aucune commande</CommandEmpty>
            <CommandList aria-label="Commandes">
              {(group: PaletteGroup) => (
                <Fragment key={group.value}>
                  <CommandGroup items={group.items}>
                    <CommandGroupLabel>{group.value}</CommandGroupLabel>
                    <CommandCollection>
                      {(item: PaletteItem) => (
                        <CommandItem key={item.value} value={item} onClick={() => runCommand(item)}>
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
                        </CommandItem>
                      )}
                    </CommandCollection>
                  </CommandGroup>
                </Fragment>
              )}
            </CommandList>
          </CommandPanel>
          <CommandFooter>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Kbd>↑↓</Kbd> naviguer
              </span>
              <span className="flex items-center gap-1">
                <Kbd>↵</Kbd> exécuter
              </span>
            </div>
            <span className="flex items-center gap-1">
              <Kbd>esc</Kbd> fermer
            </span>
          </CommandFooter>
        </Command>
      </CommandDialogPopup>
    </CommandDialog>
  )
}
