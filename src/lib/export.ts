import { StaticCanvas } from 'fabric'

// Working canvas dimensions — must match use-canvas hook
const WORKING_WIDTH = 440
const WORKING_HEIGHT = 956

export async function exportScreenToBlob(
  canvasJSON: object,
  targetWidth: number,
  targetHeight: number
): Promise<Blob> {
  // Create canvas at exact target dimensions so output is pixel-exact
  const exportCanvas = new StaticCanvas(undefined, {
    width: targetWidth,
    height: targetHeight,
    backgroundColor: '#ffffff',
  })

  await exportCanvas.loadFromJSON(canvasJSON)

  // Scale all objects from working size to target size
  const scaleX = targetWidth / WORKING_WIDTH
  const scaleY = targetHeight / WORKING_HEIGHT
  for (const obj of exportCanvas.getObjects()) {
    obj.set({
      left: (obj.left ?? 0) * scaleX,
      top: (obj.top ?? 0) * scaleY,
      scaleX: (obj.scaleX ?? 1) * scaleX,
      scaleY: (obj.scaleY ?? 1) * scaleY,
    })
    obj.setCoords()
  }

  exportCanvas.requestRenderAll()

  const dataUrl = exportCanvas.toDataURL({
    format: 'png',
    multiplier: 1,
  })

  const blob = dataUrlToBlob(dataUrl)

  exportCanvas.dispose()

  return blob
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png'
  const bytes = atob(base64)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

export async function validateExportDimensions(
  blob: Blob,
  expectedWidth: number,
  expectedHeight: number
): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      resolve(img.naturalWidth === expectedWidth && img.naturalHeight === expectedHeight)
      URL.revokeObjectURL(img.src)
    }
    img.onerror = () => resolve(false)
    img.src = URL.createObjectURL(blob)
  })
}
