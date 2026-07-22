import { useCallback, useState } from 'react'
import { exportScreenToBlob, inspectPng } from '@/lib/export'
import { createExportZip, downloadBlob, slugify, type ExportEntry } from '@/lib/zip'
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

export function useExport() {
  const [progress, setProgress] = useState<ExportProgress | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completedFiles, setCompletedFiles] = useState<ExportedFileSummary[]>([])

  const exportBatch = useCallback(async (
    projectName: string,
    screens: ExportScreen[],
    layoutLayers: Layer[],
    dimensions: DisplayClass[],
  ) => {
    setIsExporting(true)
    setError(null)
    setCompletedFiles([])
    const total = screens.length * dimensions.length
    const entries: ExportEntry[] = []
    const summaries: ExportedFileSummary[] = []
    let current = 0

    try {
      for (const dimension of dimensions) {
        for (let index = 0; index < screens.length; index += 1) {
          const { screen, screenIndex } = screens[index]
          current += 1
          setProgress({
            current,
            total,
            label: `Rendu ${String(index + 1).padStart(2, '0')} · ${screen.name}`,
          })
          let blob: Blob
          try {
            blob = await exportScreenToBlob(
              screen,
              layoutLayers,
              dimension.portrait.width,
              dimension.portrait.height,
              screenIndex,
            )
          } catch (cause) {
            throw new Error(`${screen.name} : ${errorMessage(cause)}`)
          }

          const name = slugify(screen.name)
          const dimensionName = dimension.size.replace('"', '')
          const path = `${dimensionName}/${String(index + 1).padStart(2, '0')}_${name}.png`
          const metadata = await inspectPng(blob)
          entries.push({
            dimension: dimensionName,
            index: index + 1,
            name,
            blob,
          })
          summaries.push({ path, size: metadata.byteLength })
        }
      }

      setProgress({ current: total, total, label: 'Validation et création du ZIP' })
      const zipBlob = await createExportZip(entries)
      downloadBlob(zipBlob, `${slugify(projectName)}-app-store.zip`)
      setCompletedFiles(summaries)
    } catch (cause) {
      setError(errorMessage(cause))
      throw cause
    } finally {
      setIsExporting(false)
      setProgress(null)
    }
  }, [])

  return {
    exportBatch,
    isExporting,
    progress,
    error,
    completedFiles,
    clearError: () => setError(null),
  }
}
