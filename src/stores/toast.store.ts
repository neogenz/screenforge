import { createElement } from 'react'
import { toast as sonner } from 'sonner'

export type ToastTone = 'info' | 'success' | 'error'

interface ToastOptions {
  duration?: number
}

/** Fire-and-forget toast, callable from anywhere (stores, hooks, commands). */
export function toast(message: string, tone: ToastTone = 'info', options?: ToastOptions) {
  // Le rôle vit dans le contenu : sonner n'en pose pas sur le toast lui-même,
  // et les tests comme les lecteurs d'écran s'appuient sur status/alert.
  const content = createElement('span', { role: tone === 'error' ? 'alert' : 'status' }, message)
  if (tone === 'success') sonner.success(content, options)
  else if (tone === 'error') sonner.error(content, options)
  else sonner.info(content, options)
}
