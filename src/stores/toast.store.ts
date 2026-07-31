import { create } from 'zustand'

export type ToastTone = 'info' | 'success' | 'error'

export interface ToastItem {
  id: number
  message: string
  tone: ToastTone
}

interface ToastState {
  toasts: ToastItem[]
  push: (message: string, tone: ToastTone) => void
  dismiss: (id: number) => void
}

let nextToastId = 1
const TOAST_DURATION = 3500

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  push: (message, tone) => {
    const id = nextToastId++
    set((state) => ({ toasts: [...state.toasts.slice(-3), { id, message, tone }] }))
    setTimeout(() => {
      useToastStore.getState().dismiss(id)
    }, TOAST_DURATION)
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

/** Fire-and-forget toast, callable from anywhere (stores, hooks, commands). */
export function toast(message: string, tone: ToastTone = 'info') {
  useToastStore.getState().push(message, tone)
}
