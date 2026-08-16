export interface ExportEntry {
  dimension: string // e.g. '6.9'
  index: number // 1-based
  name: string // screen name slugified
  blob: Blob
}

export async function createExportZip(entries: ExportEntry[]): Promise<Blob> {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  for (const entry of entries) {
    const filename = `${String(entry.index).padStart(2, '0')}_${entry.name}.png`
    zip.file(`${entry.dimension}/${filename}`, entry.blob)
  }
  return zip.generateAsync({ type: 'blob', mimeType: 'application/zip' })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  /* Révoqué à la tâche suivante (`0`), l'URL mourait avant que le navigateur
     ait engagé la lecture du téléchargement — le second export d'un lot
     cassait le premier. 10 s laissent l'engagement sans retenir le blob. */
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function slugify(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'screen'
  )
}
