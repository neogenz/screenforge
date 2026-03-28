import { useState, useCallback } from 'react'
import { exportScreenToBlob } from '@/lib/export'
import { createExportZip, downloadBlob, slugify, type ExportEntry } from '@/lib/zip'
import type { DisplayClass } from '@/types'

interface ExportProgress {
  current: number
  total: number
  label: string
}

export function useExport() {
  const [progress, setProgress] = useState<ExportProgress | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const exportSingle = useCallback(async (
    canvasJSON: object,
    screenName: string,
    dimension: DisplayClass
  ) => {
    setIsExporting(true)
    try {
      const blob = await exportScreenToBlob(canvasJSON, dimension.portrait.width, dimension.portrait.height)
      downloadBlob(blob, `${slugify(screenName)}_${dimension.size.replace('"', 'in')}.png`)
    } finally {
      setIsExporting(false)
    }
  }, [])

  const exportBatch = useCallback(async (
    screens: { canvasJSON: object; name: string }[],
    dimensions: DisplayClass[]
  ) => {
    setIsExporting(true)
    const total = screens.length * dimensions.length
    const entries: ExportEntry[] = []
    let current = 0

    try {
      for (const dim of dimensions) {
        for (let i = 0; i < screens.length; i++) {
          current++
          setProgress({ current, total, label: `Exporting ${screens[i].name} at ${dim.size}...` })
          const blob = await exportScreenToBlob(screens[i].canvasJSON, dim.portrait.width, dim.portrait.height)
          entries.push({
            dimension: dim.size.replace('"', ''),
            index: i + 1,
            name: slugify(screens[i].name),
            blob,
          })
        }
      }
      const zipBlob = await createExportZip(entries)
      downloadBlob(zipBlob, 'screenforge-export.zip')
    } finally {
      setIsExporting(false)
      setProgress(null)
    }
  }, [])

  return { exportSingle, exportBatch, isExporting, progress }
}
