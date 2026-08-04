/** Image file helpers shared by layer import flows. */

export function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () =>
      typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Invalid file'))
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read file'))
    reader.readAsDataURL(file)
  })
}

export function decodeImage(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => reject(new Error('Unable to decode image'))
    image.src = src
  })
}

export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/svg+xml'

export function isSupportedImageFile(file: File): boolean {
  return ['image/png', 'image/jpeg', 'image/svg+xml'].includes(file.type)
}
