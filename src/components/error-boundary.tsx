import { Component, createRef, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { deleteProject } from '@/lib/storage'
import { useProjectStore } from '@/stores/project.store'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  failed: boolean
  resetting: boolean
  resetError: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false, resetting: false, resetError: false }
  private reloadButton = createRef<HTMLButtonElement>()

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ScreenForge rendering failed.', error, info)
  }

  componentDidUpdate(
    _previousProps: ErrorBoundaryProps,
    previousState: ErrorBoundaryState,
  ): void {
    if (!previousState.failed && this.state.failed) this.reloadButton.current?.focus()
  }

  private reload = (): void => window.location.reload()

  private resetProject = async (): Promise<void> => {
    if (!window.confirm('Supprimer le projet actif et ses ressources locales ?')) return
    const projectId = useProjectStore.getState().project?.id
    if (!projectId) {
      window.location.reload()
      return
    }
    this.setState({ resetting: true, resetError: false })
    try {
      await deleteProject(projectId)
      window.location.reload()
    } catch (error) {
      console.error('Could not reset the active project.', error)
      this.setState({ resetting: false, resetError: true })
    }
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children
    return (
      <main className="flex h-full min-h-screen items-center justify-center bg-stage p-6 text-foreground">
        <section
          role="alert"
          aria-labelledby="error-boundary-title"
          className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl"
        >
          <h1 id="error-boundary-title" className="text-lg font-semibold">
            ScreenForge doit redémarrer
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Une erreur inattendue a interrompu l’affichage. Votre projet local est conservé.
          </p>
          {this.state.resetError && (
            <p role="status" className="mt-3 text-sm text-destructive">
              La réinitialisation a échoué. Le projet a été conservé.
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button ref={this.reloadButton} variant="primary" size="lg" onClick={this.reload}>
              Recharger l’application
            </Button>
            <Button
              variant="danger"
              size="lg"
              loading={this.state.resetting}
              onClick={() => void this.resetProject()}
            >
              Réinitialiser le projet
            </Button>
          </div>
        </section>
      </main>
    )
  }
}
