import { useCallback, useState } from 'react'
import { exportScreenToBlob, inspectPng } from '@/lib/export'
import { createExportZip, downloadBlob, slugify, type ExportEntry } from '@/lib/zip'
import { getStoreTargetProfile } from '@/lib/dimensions'
import { captureAnalytics, captureDiagnosticLog } from '@/lib/analytics'
import type { Layer, Screen, StoreTargetId } from '@/types'

interface ExportProgress {
  current: number
  total: number
  label: string
}

export interface ExportedFileSummary {
  path: string
  size: number
}

export interface ExportScreen {
  screen: Screen
  screenIndex: number
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Échec inattendu de l’export.'
}

/**
 * Bounded parallelism: each StaticCanvas export allocates tens of MB on the
 * main thread, so two workers is the sweet spot between speed and memory.
 */
const EXPORT_CONCURRENCY = 2

interface ExportJob {
  screen: Screen
  screenIndex: number
  index: number
}

/** Never release export UI while another Fabric worker is still active. */
export async function waitForExportWorkers(workers: Promise<void>[]): Promise<void> {
  const settled = await Promise.allSettled(workers)
  const failed = settled.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  )
  if (failed) throw failed.reason
}

export function useExport() {
  const [progress, setProgress] = useState<ExportProgress | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completedFiles, setCompletedFiles] = useState<ExportedFileSummary[]>([])

  const exportBatch = useCallback(
    async (
      projectName: string,
      target: StoreTargetId,
      screens: ExportScreen[],
      layoutLayers: Layer[],
    ) => {
      const startedAt = performance.now()
      setIsExporting(true)
      setError(null)
      setCompletedFiles([])

      const profile = getStoreTargetProfile(target)
      const dimension = profile.output.size
      const jobs: ExportJob[] = screens.map(({ screen, screenIndex }, index) => ({
        screen,
        screenIndex,
        index,
      }))
      const total = jobs.length
      const entries: ExportEntry[] = []
      const summaries: ExportedFileSummary[] = []
      let completed = 0
      let cursor = 0

      async function worker(): Promise<void> {
        while (cursor < jobs.length) {
          const job = jobs[cursor]
          cursor += 1
          setProgress({
            current: completed,
            total,
            label: `Rendu ${String(job.index + 1).padStart(2, '0')} · ${job.screen.name}`,
          })
          let blob: Blob
          try {
            blob = await exportScreenToBlob(
              job.screen,
              layoutLayers,
              profile.output.portrait.width,
              profile.output.portrait.height,
              job.screenIndex,
              profile.board,
            )
          } catch (cause) {
            throw new Error(`${job.screen.name} : ${errorMessage(cause)}`)
          }

          const name = slugify(job.screen.name)
          const path = `${profile.zipFolder}/${String(job.index + 1).padStart(2, '0')}_${name}.png`
          const metadata = await inspectPng(blob)
          entries.push({ folder: profile.zipFolder, index: job.index + 1, name, blob })
          summaries.push({ path, size: metadata.byteLength })
          completed += 1
          setProgress({ current: completed, total, label: `${completed}/${total} rendus` })
        }
      }

      try {
        await waitForExportWorkers(
          Array.from({ length: Math.min(EXPORT_CONCURRENCY, jobs.length) }, () => worker()),
        )

        setProgress({
          current: total,
          total,
          label: 'Validation et création du ZIP',
        })
        // Parallel workers finish out of order — restore a deterministic order.
        entries.sort((a, b) => a.folder.localeCompare(b.folder) || a.index - b.index)
        summaries.sort((a, b) => a.path.localeCompare(b.path))

        const zipBlob = await createExportZip(entries)
        downloadBlob(
          zipBlob,
          `${slugify(projectName)}-${profile.platform === 'android' ? 'google-play' : 'app-store'}.zip`,
        )
        setCompletedFiles(summaries)
        captureAnalytics('screenforge_export_succeeded', {
          duration_ms: Math.round(performance.now() - startedAt),
          dimension,
          screen_count: screens.length,
        })
      } catch (cause) {
        setError(errorMessage(cause))
        captureAnalytics('screenforge_export_failed', {
          duration_ms: Math.round(performance.now() - startedAt),
          dimension,
          screen_count: screens.length,
          issue: 'export',
        })
        captureDiagnosticLog('export_failed', { issue: 'export' })
        throw cause
      } finally {
        setIsExporting(false)
        setProgress(null)
      }
    },
    [],
  )

  return {
    exportBatch,
    isExporting,
    progress,
    error,
    completedFiles,
    clearError: () => setError(null),
  }
}
