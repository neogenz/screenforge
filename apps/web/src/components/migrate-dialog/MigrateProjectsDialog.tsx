import { useEffect, useState } from 'react'
import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DialogShell } from '@/components/patterns/dialog-shell'
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
 * Le cycle de synchronisation ne pousse aucun projet antérieur au login, même
 * celui qui est ouvert. Cette boîte propose le geste explicite qui les ajoute
 * au Cloud; l'exécuter d'office déciderait à la place de l'utilisateur ce qui
 * quitte sa machine.
 *
 * « Pas maintenant » n'enregistre rien : la boîte reparaît au login suivant tant
 * qu'il reste des projets non rattachés. Une préférence « ne plus demander »
 * ferait taire, sans les rattacher, exactement les projets qu'elle protège.
 */
function MigrateProjectsDialogContent() {
  const setShowMigrateDialog = useUIStore((s) => s.setShowMigrateDialog)
  const [projects, setProjects] = useState<LocalProject[] | null>(null)
  const [pending, setPending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  /** La liste reste sémantiquement plate (une `ul`) : la case coche l'ajout, elle ne groupe rien. */
  const [selected, setSelected] = useState<Set<string>>(new Set())
  /**
   * Tout part coché par défaut : c'est le geste d'origine (« ajouter tout »)
   * qu'une case décoche désormais au lieu d'exclure. Réinitialisé pendant le
   * rendu — et non dans un effet — dès que la liste change de référence, pour
   * qu'une nouvelle tentative de chargement reparte cochée sans un rendu
   * intermédiaire vide.
   */
  const [selectedFor, setSelectedFor] = useState<LocalProject[] | null>(null)
  if (projects !== selectedFor) {
    setSelectedFor(projects)
    setSelected(new Set(projects?.map((project) => project.id)))
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  useEffect(() => {
    let cancelled = false
    void unattachedProjects()
      .then((found) => {
        if (!cancelled) setProjects(found)
      })
      .catch((error: unknown) => {
        console.error('Could not list local projects to attach.', error)
        if (!cancelled) {
          setProjects([])
          setLoadError(true)
          toast('Liste des projets locaux indisponible. Vous pouvez réessayer.', 'error')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [loadAttempt])

  function retryLoad() {
    setProjects(null)
    setLoadError(false)
    setLoading(true)
    setLoadAttempt((attempt) => attempt + 1)
  }

  async function attachAll() {
    if (!projects) return
    const ids = Array.from(selected)
    if (ids.length === 0) return
    setPending(true)
    let failed: string[]
    try {
      failed = await attachProjects(ids)
    } catch (error) {
      console.error('Could not attach local projects.', error)
      toast(
        'Ajout au Cloud impossible. Leur copie locale reste disponible ; vous pouvez réessayer.',
        'error',
      )
      return
    } finally {
      setPending(false)
    }
    setShowMigrateDialog(false)

    if (failed.length === 0) {
      toast(
        `${ids.length} projet${plural(ids.length)} ajouté${plural(ids.length)} au Cloud. Leur copie locale reste disponible.`,
        'success',
      )
      return
    }
    /* Rien n'est perdu même en échec : les projets sont toujours sur le disque
       et la boîte reviendra. Le message le dit, sinon un échec de réseau
       ressemble à une perte. */
    const failedNames = projects
      .filter((project) => failed.includes(project.id))
      .map((project) => `« ${project.name} »`)
    toast(
      `Échec de l’ajout au Cloud pour ${failedNames.join(', ')}. Leur copie locale reste disponible.`,
      'error',
    )
  }

  const selectedCount = selected.size
  const attachLabel =
    selectedCount === 1
      ? 'Ajouter ce projet au Cloud'
      : selectedCount > 1
        ? `Ajouter les ${selectedCount} projets au Cloud`
        : 'Ajouter les projets au Cloud'

  return (
    <DialogShell
      open
      onClose={() => setShowMigrateDialog(false)}
      title="Ajouter ces projets au Cloud ?"
      size="sm"
      footer={
        <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
          <Button variant="outline" disabled={pending} onClick={() => setShowMigrateDialog(false)}>
            Pas maintenant
          </Button>
          {loadError ? (
            <Button variant="default" loading={loading} disabled={loading} onClick={retryLoad}>
              Réessayer
            </Button>
          ) : (
            <Button
              variant="default"
              className="h-auto min-h-9 max-w-full whitespace-normal py-2 text-center"
              loading={pending || loading}
              disabled={pending || loading || selectedCount === 0}
              onClick={() => void attachAll()}
            >
              {attachLabel}
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm leading-5 text-foreground">
          Ces projets sont enregistrés uniquement sur cet appareil. Ajoutez-les au Cloud pour les
          retrouver sur vos autres appareils.
        </p>

        <section aria-labelledby="projects-to-attach-title">
          <h3 id="projects-to-attach-title" className="section-title mb-1">
            Projets à ajouter
          </h3>
          {loading ? (
            <p role="status" className="py-3 text-xs text-muted-foreground">
              Chargement des projets à ajouter…
            </p>
          ) : loadError ? (
            <p role="alert" className="py-2 text-xs leading-4 text-destructive">
              Impossible de lire les projets locaux. Rien n’a été modifié ; vous pouvez réessayer.
            </p>
          ) : (
            <ul
              aria-labelledby="projects-to-attach-title"
              className="flex max-h-56 flex-col overflow-y-auto"
            >
              {projects?.map((project) => (
                <li
                  key={project.id}
                  className="flex min-h-10 items-center gap-2 border-b border-border py-2 last:border-b-0"
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={selected.has(project.id)}
                      onCheckedChange={() => toggle(project.id)}
                    />
                    <FileText size={14} className="shrink-0 text-muted-foreground" aria-hidden />
                    <span
                      className="min-w-0 flex-1 truncate text-sm text-foreground"
                      title={project.name}
                    >
                      {project.name}
                    </span>
                  </label>
                  <time
                    dateTime={new Date(project.updatedAt).toISOString()}
                    className="shrink-0 text-2xs text-muted-foreground tabular-nums"
                  >
                    <span className="sr-only">Modifié le </span>
                    {DATE.format(project.updatedAt)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-xs text-muted-foreground">Leur copie locale reste disponible.</p>
        {pending && (
          <p role="status" className="sr-only">
            Ajout des projets au Cloud en cours.
          </p>
        )}
      </div>
    </DialogShell>
  )
}

function plural(count: number): string {
  return count > 1 ? 's' : ''
}

const DATE = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' })
