import { DialogShell } from '@/components/patterns/dialog-shell'
import { Kbd } from '@/components/ui/kbd'

const SHORTCUT_GROUPS: { title: string; entries: { keys: string; label: string }[] }[] = [
  {
    title: 'Général',
    entries: [
      { keys: '⌘K', label: 'Palette de commandes' },
      { keys: '⌘Z', label: 'Annuler' },
      { keys: '⌘⇧Z', label: 'Rétablir' },
      { keys: '⌘S', label: 'Enregistrer' },
      { keys: '⌘E', label: 'Exporter' },
      { keys: '⌘⇧L', label: 'Panneau Calques' },
      { keys: '⌘⇧P', label: 'Panneau Propriétés' },
      { keys: '?', label: 'Raccourcis clavier' },
    ],
  },
  {
    title: 'Calques',
    entries: [
      { keys: 'T', label: 'Ajouter un texte' },
      { keys: 'R', label: 'Ajouter une forme' },
      { keys: '⌘C / ⌘X / ⌘V', label: 'Copier / couper / coller' },
      { keys: '⌘D', label: 'Dupliquer' },
      { keys: '⌫', label: 'Supprimer' },
      { keys: '←→↑↓', label: 'Déplacer (⇧ = ×10)' },
      { keys: '⌥↑↓', label: 'Ordre de plan' },
      { keys: 'F2', label: 'Renommer' },
    ],
  },
  {
    title: 'Affichage',
    entries: [
      { keys: '⌘+ / ⌘−', label: 'Zoom avant / arrière' },
      { keys: '⌘0', label: 'Ajuster aux écrans' },
      { keys: 'Espace', label: 'Déplacer la vue (maintenir)' },
      { keys: '⌘A', label: 'Tout sélectionner' },
      { keys: 'Échap', label: 'Désélectionner / fermer' },
    ],
  },
]

export function ShortcutsOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <DialogShell open={open} onClose={onClose} title="Raccourcis clavier" size="sm">
      <div className="flex flex-col gap-4">
        {SHORTCUT_GROUPS.map((group) => (
          <section key={group.title}>
            <h3 className="pb-2 text-xs text-muted-foreground">{group.title}</h3>
            <ul className="flex flex-col gap-1.5">
              {group.entries.map((entry) => (
                <li key={entry.keys} className="flex items-center justify-between gap-4">
                  <span className="text-sm text-muted-foreground">{entry.label}</span>
                  <Kbd>{entry.keys}</Kbd>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </DialogShell>
  )
}
