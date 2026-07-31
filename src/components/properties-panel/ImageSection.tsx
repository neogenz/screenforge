import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { useCanvasStore } from '@/stores/canvas.store'
import { ShadowEditor } from '@/components/properties-panel/ShadowEditor'
import { Button } from '@/components/ui/button'
import { registerAsset } from '@/lib/assets'
import { decodeImage, IMAGE_ACCEPT, isSupportedImageFile, readAsDataUrl } from '@/lib/image'
import type { ImageLayer, Layer } from '@/types'

interface ImageSectionProps {
  layer: ImageLayer
}

export function ImageSection({ layer }: ImageSectionProps) {
  const updateLayer = useCanvasStore((s) => s.updateLayer)
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  function update(patch: Partial<ImageLayer>, options?: { coalesceKey?: string }) {
    updateLayer(layer.id, patch as Partial<Layer>, options)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setFileError(null)
    e.target.value = ''
    if (!isSupportedImageFile(file)) {
      setFileError('Format non pris en charge. Utilisez un PNG, JPEG ou SVG.')
      return
    }

    try {
      const dataUrl = await readAsDataUrl(file)
      const dimensions = await decodeImage(dataUrl)
      update({
        assetId: registerAsset(dataUrl),
        originalWidth: dimensions.width,
        originalHeight: dimensions.height,
      })
    } catch {
      setFileError("L'image est illisible ou endommagée.")
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div>
        <input
          ref={fileRef}
          type="file"
          accept={IMAGE_ACCEPT}
          onChange={(event) => void handleFileChange(event)}
          className="sr-only"
          aria-label="Remplacer le fichier image"
        />
        <Button
          variant="default"
          className="w-full"
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={11} strokeWidth={1.5} aria-hidden />
          Remplacer
        </Button>
        {fileError && (
          <p role="alert" className="mt-1.5 text-[11px] leading-relaxed text-danger">
            {fileError}
          </p>
        )}
      </div>

      <ShadowEditor
        shadow={layer.shadow}
        onChange={(shadow, options) => update({ shadow }, options)}
        ariaLabel="Activer l’ombre"
        coalesceKey={`layer:${layer.id}:shadow`}
      />
    </div>
  )
}
