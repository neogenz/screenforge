import { useCallback, useState } from 'react'
import {
  exportsLeft,
  recordExport,
  rightsOf,
  FREE_EXPORTS_PER_PROJECT,
  type Rights,
} from '@/lib/entitlements'
import { exportScreenToBlob, inspectPng } from '@/lib/export'
import { createExportZip, downloadBlob, slugify, type ExportEntry } from '@/lib/zip'
import { useAuthStore } from '@/stores/auth.store'
import type { DisplayClass, Layer, Screen } from '@/types'

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
 * Le refus de quota se distingue d'une panne.
 *
 * La boîte d'export affiche un échec en rouge et propose de réessayer ; une
 * limite atteinte demande l'inverse — Local ou Cloud, et rien à réessayer. Sans ce
 * type, l'appelant devrait reconnaître la limite à son message.
 */
export class ExportQuotaError extends Error {
  constructor() {
    super(
      `Limite de l’essai atteinte : ${FREE_EXPORTS_PER_PROJECT} exports par projet. Local ou Cloud les rend illimités et sans filigrane.`,
    )
    this.name = 'ExportQuotaError'
  }
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
  dimension: DisplayClass
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
      projectId: string,
      projectName: string,
      screens: ExportScreen[],
      layoutLayers: Layer[],
      dimensions: DisplayClass[],
    ) => {
      const rights: Rights = rightsOf(useAuthStore.getState().entitlements)
      /* Avant le lot, pas pendant : rendre dix planches pour refuser le
         téléchargement à la fin ferait payer l'attente pour rien. */
      if (exportsLeft(projectId, rights) <= 0) {
        const quota = new ExportQuotaError()
        setError(quota.message)
        throw quota
      }

      setIsExporting(true)
      setError(null)
      setCompletedFiles([])

      const jobs: ExportJob[] = dimensions.flatMap((dimension) =>
        screens.map(({ screen, screenIndex }, index) => ({
          screen,
          screenIndex,
          index,
          dimension,
        })),
      )
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
              job.dimension.portrait.width,
              job.dimension.portrait.height,
              job.screenIndex,
              !rights.cleanExport,
            )
          } catch (cause) {
            throw new Error(`${job.screen.name} : ${errorMessage(cause)}`)
          }

          const name = slugify(job.screen.name)
          const dimensionName = job.dimension.size.replace('"', '')
          const path = `${dimensionName}/${String(job.index + 1).padStart(2, '0')}_${name}.png`
          const metadata = await inspectPng(blob)
          entries.push({ dimension: dimensionName, index: job.index + 1, name, blob })
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
          label: rights.zip ? 'Validation et création du ZIP' : 'Validation et téléchargement',
        })
        // Parallel workers finish out of order — restore a deterministic order.
        entries.sort((a, b) => a.dimension.localeCompare(b.dimension) || a.index - b.index)
        summaries.sort((a, b) => a.path.localeCompare(b.path))

        if (rights.zip) {
          const zipBlob = await createExportZip(entries)
          downloadBlob(zipBlob, `${slugify(projectName)}-app-store.zip`)
        } else {
          /* Sans Local ni Cloud, les PNG descendent un par un : le ZIP groupé est ce
             que les offres payantes achètent. Les fichiers sont les mêmes, à la
             hiérarchie de dossiers près — le palier gratuit sert à juger
             l'éditeur, pas à repartir avec un lot prêt pour App Store Connect. */
          for (const entry of entries) {
            downloadBlob(entry.blob, `${String(entry.index).padStart(2, '0')}_${entry.name}.png`)
          }
        }

        /* Après le succès seulement, et une fois par lot : un rendu qui échoue
           ne consomme rien, et sélectionner dix planches ne coûte pas dix
           crédits. */
        if (!rights.cleanExport) recordExport(projectId)
        setCompletedFiles(summaries)
      } catch (cause) {
        setError(errorMessage(cause))
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
