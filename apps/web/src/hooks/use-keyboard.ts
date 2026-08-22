import { useEffect } from 'react'
import { useCanvasStore } from '@/stores/canvas.store'
import { getProjectLayers, useProjectStore } from '@/stores/project.store'
import { useUIStore } from '@/stores/ui.store'
import { registerAsset, resolveAsset } from '@/lib/assets'
import { collectLayerAssetIds } from '@/lib/asset-refs'
import { createShapeLayer, createTextLayer } from '@/lib/layer-factories'
import { APP_STORE_PROFILE, getStoreTargetProfile } from '@/lib/dimensions'
import { saveCurrentProject } from '@/lib/storage'
import type { Layer } from '@/types'

interface ClipboardEntry {
  layer: Layer
  /** Payloads capturés à la copie : un collage dans un autre projet doit pouvoir
      ré-enregistrer les images que `hydrateAssets` a effacées entre-temps. */
  assets: Record<string, string>
}

let clipboard: ClipboardEntry[] = []

function copySelectedLayers(layers: Layer[], selectedLayerIds: string[]): ClipboardEntry[] {
  const selected = new Set(selectedLayerIds)
  return layers
    .filter((layer) => selected.has(layer.id))
    .map((layer) => {
      const ids = new Set<string>()
      collectLayerAssetIds(layer, ids)
      const assets: Record<string, string> = {}
      for (const id of ids) {
        const dataUrl = resolveAsset(id)
        if (dataUrl) assets[id] = dataUrl
      }
      return { layer: structuredClone(layer), assets }
    })
}

function remapClipboardAssets(entry: ClipboardEntry): Layer {
  const remap = (id: string): string => {
    const dataUrl = entry.assets[id] ?? resolveAsset(id)
    return dataUrl ? registerAsset(dataUrl) : id
  }
  const layer = structuredClone(entry.layer)
  if (layer.type === 'image') layer.assetId = remap(layer.assetId)
  if (layer.type === 'device-frame') {
    if (layer.screenshotAssetId) layer.screenshotAssetId = remap(layer.screenshotAssetId)
    if (layer.importedBezel) layer.importedBezel.assetId = remap(layer.importedBezel.assetId)
  }
  return layer
}

const NON_TEXT_INPUT_TYPES = new Set(['range', 'checkbox', 'radio', 'button', 'file', 'color'])

function isEditingInput(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  // Un curseur Base UI est un `<input type="range">` : rien à y éditer, ⌘Z
  // doit encore défaire le geste qu'on vient d'y faire.
  if (tag === 'input') return !NON_TEXT_INPUT_TYPES.has((el as HTMLInputElement).type)
  if (tag === 'textarea' || tag === 'select') return true
  if ((el as HTMLElement).isContentEditable) return true
  const canvasContainer = document.querySelector('.canvas-container')
  if (canvasContainer?.contains(el)) return true
  return false
}

function activeControlUsesArrowKeys(): boolean {
  const el = document.activeElement
  if (!(el instanceof HTMLElement)) return false
  return (
    el.matches(
      '[role="slider"], [role="menuitem"], [role="option"], [role="switch"], [role="tab"]',
    ) || Boolean(el.closest('[role="group"]'))
  )
}

export function useKeyboard(): void {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      const meta = e.metaKey || e.ctrlKey
      const shift = e.shiftKey
      const key = e.key

      // Command palette: global, even from inside inputs.
      if (meta && !shift && key.toLowerCase() === 'k') {
        e.preventDefault()
        const ui = useUIStore.getState()
        ui.setShowCommandPalette(!ui.showCommandPalette)
        return
      }

      if (isEditingInput()) return

      const { selectedLayerIds, setLayers, selectLayers, clearSelection, undo, redo, addLayer } =
        useCanvasStore.getState()
      const layers = getProjectLayers(useProjectStore.getState().project)
      const layerCount = layers.length

      const {
        zoomIn,
        zoomOut,
        resetZoom,
        toggleLayers,
        toggleProps,
        closeDrawers,
        setShowExportDialog,
        setShowShortcuts,
      } = useUIStore.getState()

      // Drawers
      if (meta && shift && key.toLowerCase() === 'l') {
        e.preventDefault()
        toggleLayers()
        return
      }
      if (meta && shift && key.toLowerCase() === 'p') {
        e.preventDefault()
        toggleProps()
        return
      }

      // Shortcuts overlay
      if (key === '?') {
        e.preventDefault()
        setShowShortcuts(true)
        return
      }

      if (meta && !shift && key === 's') {
        e.preventDefault()
        void saveCurrentProject().catch(() => undefined)
        return
      }

      // Export dialog
      if (meta && !shift && key.toLowerCase() === 'e') {
        e.preventDefault()
        setShowExportDialog(true)
        return
      }

      // Add text / shape — mêmes actions que la palette (commands.ts).
      // Une surface à sémantique clavier propre — listbox (typeahead APG),
      // menu, dialogue — possède les lettres qu'on y tape : un Select ouvert
      // recevait le typeahead Radix ET un calque derrière lui.
      const letterOwnedBySurface =
        document.activeElement instanceof HTMLElement &&
        document.activeElement.closest('[role="listbox"], [role="menu"], [role="dialog"]') !== null
      if (!meta && !shift && !letterOwnedBySurface && key.toLowerCase() === 't') {
        e.preventDefault()
        const project = useProjectStore.getState().project
        addLayer(
          createTextLayer(
            layerCount,
            project ? getStoreTargetProfile(project.target).board : APP_STORE_PROFILE.board,
          ),
        )
        return
      }
      if (!meta && !shift && !letterOwnedBySurface && key.toLowerCase() === 'r') {
        e.preventDefault()
        const project = useProjectStore.getState().project
        addLayer(
          createShapeLayer(
            layerCount,
            'rectangle',
            project ? getStoreTargetProfile(project.target).board : APP_STORE_PROFILE.board,
          ),
        )
        return
      }

      // Undo
      if (meta && !shift && key === 'z') {
        e.preventDefault()
        undo()
        return
      }

      // Redo
      if (meta && shift && key === 'z') {
        e.preventDefault()
        redo()
        return
      }

      // Copy
      if (meta && !shift && key === 'c') {
        if (selectedLayerIds.length === 0) return
        e.preventDefault()
        clipboard = copySelectedLayers(layers, selectedLayerIds)
        return
      }

      // Cut
      if (meta && !shift && key === 'x') {
        if (selectedLayerIds.length === 0) return
        e.preventDefault()
        clipboard = copySelectedLayers(layers, selectedLayerIds)
        setLayers(layers.filter((layer) => !selectedLayerIds.includes(layer.id)))
        clearSelection()
        return
      }

      // Paste
      if (meta && !shift && key === 'v') {
        if (clipboard.length === 0) return
        e.preventDefault()
        let screenZ = layers.filter((layer) => layer.scope !== 'layout').length
        let layoutZ = layers.length - screenZ
        const newIds: string[] = []
        const pastedLayers = clipboard.map((entry) => {
          const layer = remapClipboardAssets(entry)
          const newLayer: Layer = {
            ...layer,
            id: crypto.randomUUID(),
            name: `${layer.name} copie`,
            x: layer.x + 20,
            y: layer.y + 20,
            zIndex: layer.scope === 'layout' ? layoutZ++ : screenZ++,
          }
          newIds.push(newLayer.id)
          return newLayer
        })
        setLayers([...layers, ...pastedLayers])
        selectLayers(newIds)
        return
      }

      // Duplicate
      if (meta && !shift && key === 'd') {
        if (selectedLayerIds.length === 0) return
        e.preventDefault()
        let screenZ = layers.filter((layer) => layer.scope !== 'layout').length
        let layoutZ = layers.length - screenZ
        const newIds: string[] = []
        const duplicates = layers
          .filter((layer) => selectedLayerIds.includes(layer.id))
          .map((layer) => {
            const duplicate: Layer = {
              ...layer,
              id: crypto.randomUUID(),
              name: `${layer.name} copie`,
              x: layer.x + 16,
              y: layer.y + 16,
              zIndex: layer.scope === 'layout' ? layoutZ++ : screenZ++,
            }
            newIds.push(duplicate.id)
            return duplicate
          })
        setLayers([...layers, ...duplicates])
        selectLayers(newIds)
        return
      }

      // Delete
      if (key === 'Delete' || key === 'Backspace') {
        if (selectedLayerIds.length === 0) return
        e.preventDefault()
        setLayers(layers.filter((layer) => !selectedLayerIds.includes(layer.id)))
        clearSelection()
        return
      }

      // Select all
      if (meta && !shift && key === 'a') {
        e.preventDefault()
        selectLayers(layers.map((l) => l.id))
        return
      }

      // Escape
      if (key === 'Escape') {
        /* Les boîtes Radix (export, modèles, réglages globaux…) arrêtent la
           propagation de la touche — elles se ferment seules, et les branches
           qui les nommaient ici n'étaient jamais atteintes. */
        const ui = useUIStore.getState()
        if (ui.layersOpen || ui.propsOpen) {
          closeDrawers()
          return
        }
        clearSelection()
        return
      }

      // Arrow nudge — burst-coalesced so holding a key is one undo step.
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
        if (activeControlUsesArrowKeys()) return
        if (selectedLayerIds.length === 0) return
        e.preventDefault()
        const delta = shift ? 10 : 1
        const dx = key === 'ArrowLeft' ? -delta : key === 'ArrowRight' ? delta : 0
        const dy = key === 'ArrowUp' ? -delta : key === 'ArrowDown' ? delta : 0
        setLayers(
          layers.map((layer) =>
            selectedLayerIds.includes(layer.id)
              ? { ...layer, x: layer.x + dx, y: layer.y + dy }
              : layer,
          ),
          { coalesceKey: `nudge:${[...selectedLayerIds].sort().join(',')}` },
        )
        return
      }

      // Zoom in
      if (meta && (key === '+' || key === '=')) {
        e.preventDefault()
        zoomIn()
        return
      }

      // Zoom out
      if (meta && key === '-') {
        e.preventDefault()
        zoomOut()
        return
      }

      // Reset zoom
      if (meta && key === '0') {
        e.preventDefault()
        resetZoom()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
