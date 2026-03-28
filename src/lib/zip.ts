import JSZip from 'jszip'

export interface ExportEntry {
  dimension: string  // e.g. '6.9'
  index: number      // 1-based
  name: string       // screen name slugified
  blob: Blob
}

export async function createExportZip(entries: ExportEntry[]): Promise<Blob> {
  const zip = new JSZip()
  for (const entry of entries) {
    const filename = `${String(entry.index).padStart(2, '0')}_${entry.name}.png`
    zip.file(`${entry.dimension}/${filename}`, entry.blob)
  }
  return zip.generateAsync({ type: 'blob' })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}
