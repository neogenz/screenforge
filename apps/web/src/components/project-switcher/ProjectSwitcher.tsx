import { useRef, useState } from 'react'
import {
  ChevronDown,
  Cloud,
  CloudUpload,
  FileDown,
  FileText,
  FolderOpen,
  HardDrive,
  LoaderCircle,
  PenLine,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/patterns/icon-button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { StatusChip, type StatusTone } from '@/components/patterns/status-chip'
import { AnchoredPopover } from '@/components/patterns/anchored-popover'
import {
  createProjectFile,
  PROJECT_FILE_EXTENSION,
  PROJECT_FILE_MIME,
  projectFileErrorMessage,
} from '@/lib/project-file'
import {
  listProjectCatalogue,
  PROJECT_AVAILABILITY_LABELS,
  type ProjectAvailability,
  type ProjectCatalogueEntry,
} from '@/lib/sync'
import { importPortableProject, openStoredProject, saveCurrentProject } from '@/lib/storage'
import { downloadBlob, slugify } from '@/lib/zip'
import { useProjectStore } from '@/stores/project.store'
import { toast } from '@/stores/toast.store'

interface ProjectSwitcherProps {
  projectNameInputId: string
}

const DATE = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' })

const AVAILABILITY_ICONS: Record<ProjectAvailability, typeof HardDrive> = {
  'device-only': HardDrive,
  cloud: Cloud,
  pending: CloudUpload,
}

/** « Cet appareil » informe, « Cloud » confirme, « À synchroniser » patiente. */
const AVAILABILITY_TONE: Record<ProjectAvailability, StatusTone> = {
  'device-only': 'neutral',
  cloud: 'success',
  pending: 'pulse',
}

function Availability({ value }: { value: ProjectAvailability }) {
  const Icon = AVAILABILITY_ICONS[value]
  return (
    <StatusChip
      tone={AVAILABILITY_TONE[value]}
      size="sm"
      icon={<Icon size={11} strokeWidth={1.75} aria-hidden />}
    >
      {PROJECT_AVAILABILITY_LABELS[value]}
    </StatusChip>
  )
}

export function ProjectSwitcher({ projectNameInputId }: ProjectSwitcherProps) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [filter, setFilter] = useState('')
  const [catalogue, setCatalogue] = useState<ProjectCatalogueEntry[]>([])
  const triggerRef = useRef<HTMLButtonElement>(null)
  const filterRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const currentProjectId = useProjectStore((state) => state.project?.id ?? null)
  const currentProjectName = useProjectStore((state) => state.project?.name ?? '')
  const current = catalogue.find((project) => project.id === currentProjectId)
  const needle = filter.trim().toLocaleLowerCase('fr-FR')
  const others = catalogue.filter(
    (project) =>
      project.id !== currentProjectId &&
      (!needle || project.name.toLocaleLowerCase('fr-FR').includes(needle)),
  )

  async function refresh() {
    setLoading(true)
    setLoadError(false)
    try {
      setCatalogue(await listProjectCatalogue())
    } catch (error) {
      console.error('Could not list local projects.', error)
      setCatalogue([])
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  function openSwitcher() {
    setOpen(true)
    void refresh()
    requestAnimationFrame(() => filterRef.current?.focus())
  }

  function closeAndFocusTrigger() {
    setOpen(false)
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  function renameCurrent() {
    setOpen(false)
    requestAnimationFrame(() => {
      const input = document.getElementById(projectNameInputId)
      if (input instanceof HTMLInputElement) {
        input.focus()
        input.select()
      }
    })
  }

  async function downloadCurrent() {
    const project = useProjectStore.getState().project
    if (!project) return
    setOpen(false)
    setBusy(true)
    try {
      await saveCurrentProject()
      const blob = await createProjectFile(useProjectStore.getState().project ?? project)
      downloadBlob(blob, `${slugify(project.name)}${PROJECT_FILE_EXTENSION}`)
      toast('Copie du projet téléchargée.', 'success')
    } catch (error) {
      toast(projectFileErrorMessage(error), 'error')
    } finally {
      setBusy(false)
      requestAnimationFrame(() => triggerRef.current?.focus())
    }
  }

  async function openProject(projectId: string) {
    setBusy(true)
    try {
      const project = await openStoredProject(projectId)
      if (!project) throw new Error('Project not found.')
      closeAndFocusTrigger()
    } catch (error) {
      console.error('Could not open the local project.', error)
      toast('Ouverture du projet impossible.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function importProject(file: File) {
    setBusy(true)
    try {
      await importPortableProject(file)
      toast('Projet importé.', 'success')
    } catch (error) {
      toast(projectFileErrorMessage(error), 'error')
    } finally {
      setBusy(false)
      requestAnimationFrame(() => triggerRef.current?.focus())
    }
  }

  return (
    <>
      <IconButton
        ref={triggerRef}
        size="sm"
        className="shrink-0"
        aria-label="Ouvrir le sélecteur de projets"
        tooltip="Projets"
        aria-busy={busy}
        aria-expanded={open}
        active={open}
        onClick={() => {
          if (busy) return
          if (open) setOpen(false)
          else openSwitcher()
        }}
      >
        {busy ? (
          <LoaderCircle size={13} className="animate-spin" aria-hidden />
        ) : (
          <ChevronDown size={13} strokeWidth={2} aria-hidden />
        )}
      </IconButton>

      <AnchoredPopover
        open={open}
        anchor={triggerRef}
        onClose={() => setOpen(false)}
        onEscape={closeAndFocusTrigger}
        role="dialog"
        ariaLabel="Sélecteur de projets"
        className="w-[min(22rem,calc(100vw-1rem))]"
      >
        <ScrollArea scrollFade className="max-h-[calc(100vh-1rem)]">
          {/* Carte plutôt que bande pleine largeur : le projet courant se
              détache de la liste filtrable qui suit, la même distinction que
              le tiroir Propriétés fait entre sa section et le reste. */}
          <Card
            render={<section aria-labelledby="current-project-title" />}
            className="m-3 p-3 shadow-none"
          >
            <h2 id="current-project-title" className="section-title mb-2">
              Projet courant
            </h2>
            <div aria-current="page" className="flex min-w-0 items-center gap-2">
              <FileText size={15} className="shrink-0 text-muted-foreground" aria-hidden />
              <span
                className="min-w-0 flex-1 truncate text-sm font-medium"
                title={currentProjectName}
              >
                {currentProjectName}
              </span>
              {current && <Availability value={current.availability} />}
            </div>
            <div className="mt-2 flex gap-1">
              <Button size="sm" variant="ghost" onClick={renameCurrent}>
                <PenLine size={13} strokeWidth={1.75} aria-hidden />
                Renommer
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => void downloadCurrent()}
              >
                <FileDown size={13} strokeWidth={1.75} aria-hidden />
                Télécharger une copie
              </Button>
            </div>
          </Card>

          <section className="p-3" aria-labelledby="other-projects-title">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 id="other-projects-title" className="section-title">
                Autres projets
              </h3>
              {!loading && !loadError && (
                <span className="text-2xs text-muted-foreground tabular-nums">{others.length}</span>
              )}
            </div>
            <Input
              ref={filterRef}
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filtrer par nom"
              aria-label="Filtrer les projets"
            />

            <div className="mt-2" role="region" aria-labelledby="other-projects-title">
              {loading ? (
                <p role="status" className="py-4 text-center text-xs text-muted-foreground">
                  Chargement des projets…
                </p>
              ) : loadError ? (
                <div className="flex flex-col items-center gap-2 py-3 text-center">
                  <p role="alert" className="text-xs text-destructive">
                    Catalogue local indisponible. Le projet courant reste ouvert.
                  </p>
                  <Button size="sm" variant="outline" onClick={() => void refresh()}>
                    <RefreshCw size={13} strokeWidth={1.75} aria-hidden />
                    Réessayer
                  </Button>
                </div>
              ) : others.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  {needle
                    ? 'Aucun projet ne correspond à ce filtre.'
                    : 'Aucun autre projet sur cet appareil.'}
                </p>
              ) : (
                <ul className="flex max-h-60 flex-col overflow-y-auto">
                  {others.map((project) => {
                    const date = DATE.format(project.updatedAt)
                    const availabilityId = `project-${project.id}-availability`
                    const dateId = `project-${project.id}-date`
                    return (
                      <li key={project.id}>
                        <Button
                          variant="ghost"
                          disabled={busy}
                          aria-label={`Ouvrir « ${project.name} »`}
                          aria-describedby={`${availabilityId} ${dateId}`}
                          onClick={() => void openProject(project.id)}
                          onKeyDown={(event) => {
                            if (event.key !== 'Enter' && event.key !== ' ') return
                            event.preventDefault()
                            void openProject(project.id)
                          }}
                          className="h-auto min-h-11 w-full justify-start gap-2 rounded-none border-x-0 border-t-0 border-b border-border px-1 text-left font-normal last:border-b-0 focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-40"
                        >
                          <FileText
                            size={14}
                            className="shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-foreground">
                              {project.name}
                            </span>
                            <span id={availabilityId}>
                              <Availability value={project.availability} />
                            </span>
                          </span>
                          <time
                            id={dateId}
                            dateTime={new Date(project.updatedAt).toISOString()}
                            className="shrink-0 text-2xs text-muted-foreground tabular-nums"
                          >
                            <span className="sr-only">Modifié le </span>
                            {date}
                          </time>
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </section>

          <footer className="border-t border-border p-2">
            <Button
              size="sm"
              variant="ghost"
              className="w-full justify-start"
              disabled={busy}
              onClick={() => {
                setOpen(false)
                triggerRef.current?.focus()
                fileRef.current?.click()
              }}
            >
              <FolderOpen size={13} strokeWidth={1.75} aria-hidden />
              Importer un fichier…
            </Button>
          </footer>
        </ScrollArea>
      </AnchoredPopover>

      <Input
        unstyled
        nativeInput
        ref={fileRef}
        type="file"
        accept={`${PROJECT_FILE_EXTENSION},${PROJECT_FILE_MIME}`}
        aria-label="Ouvrir un projet ScreenForge"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void importProject(file)
        }}
      />
    </>
  )
}
