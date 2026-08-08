import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { attachProjects, unattachedProjects, type LocalProject } from '@/lib/sync'
import { toast } from '@/stores/toast.store'
import { useUIStore } from '@/stores/ui.store'

export function MigrateProjectsDialog() {
  const showMigrateDialog = useUIStore((s) => s.showMigrateDialog)

  if (!showMigrateDialog) return null
  return <MigrateProjectsDialogContent />
}

/**
 * Le premier login ne doit jamais faire perdre un projet local.
 *
 * Le cycle de synchronisation ne pousse que le projet ouvert : sans cette
 * boîte, quelqu'un qui a construit cinq projets avant d'acheter le Cloud en
 * verrait remonter un seul, et rien ne le lui dirait. Le geste est proposé, pas
 * exécuté d'office — envoyer sans demander déciderait à la place de
 * l'utilisateur ce qui quitte sa machine.
 *
 * « Plus tard » n'enregistre rien : la boîte reparaît au login suivant tant
 * qu'il reste des projets non rattachés. Une préférence « ne plus demander »
 * ferait taire, sans les rattacher, exactement les projets qu'elle protège.
 */
function MigrateProjectsDialogContent() {
  const setShowMigrateDialog = useUIStore((s) => s.setShowMigrateDialog)
  const [projects, setProjects] = useState<LocalProject[] | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let cancelled = false
    void unattachedProjects().then((found) => {
      if (!cancelled) setProjects(found)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function attachAll() {
    if (!projects) return
    setPending(true)
    const failed = await attachProjects(projects.map((project) => project.id))
    setPending(false)
    setShowMigrateDialog(false)

    if (failed.length === 0) {
      const s = plural(projects.length)
      toast(`${projects.length} projet${s} rattaché${s} à votre compte.`, 'success')
      return
    }
    /* Rien n'est perdu même en échec : les projets sont toujours sur le disque
       et la boîte reviendra. Le message le dit, sinon un échec de réseau
       ressemble à une perte. */
    const s = plural(failed.length)
    toast(
      `${failed.length} projet${s} n’${s ? 'ont' : 'a'} pas pu être envoyé${s}. La copie locale est intacte.`,
      'error',
    )
  }

  return (
    <Dialog
      open
      onClose={() => setShowMigrateDialog(false)}
      title="Rattacher vos projets"
      size="sm"
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button variant="default" disabled={pending} onClick={() => setShowMigrateDialog(false)}>
            Plus tard
          </Button>
          <Button
            variant="primary"
            loading={pending}
            disabled={pending || !projects?.length}
            onClick={() => void attachAll()}
          >
            Tout rattacher
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm leading-5 text-foreground">
          Ces projets n’existent que dans ce navigateur. Rattachez-les à votre compte pour les
          retrouver sur vos autres machines.
        </p>

        <ul className="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
          {projects?.map((project) => (
            <li
              key={project.id}
              className="flex min-h-9 items-center justify-between gap-3 rounded-md border border-border px-3 py-1.5"
            >
              <span className="min-w-0 truncate text-sm text-foreground">{project.name}</span>
              <span className="shrink-0 text-2xs text-muted-foreground tabular-nums">
                {DATE.format(project.updatedAt)}
              </span>
            </li>
          ))}
        </ul>

        <p className="field-label">
          Rien n’est supprimé : la copie locale reste, rattachée ou non.
        </p>
      </div>
    </Dialog>
  )
}

function plural(count: number): string {
  return count > 1 ? 's' : ''
}

const DATE = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' })
