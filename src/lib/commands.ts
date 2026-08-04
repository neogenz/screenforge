import { getProjectLayers, useProjectStore } from '@/stores/project.store'
import { useCanvasStore } from '@/stores/canvas.store'
import { useHistoryStore } from '@/stores/history.store'
import { useUIStore } from '@/stores/ui.store'
import {
  createDeviceLayer,
  createShapeLayer,
  createTextLayer,
} from '@/lib/layer-factories'
import type { AlignMode, DistributeMode } from '@/lib/align'

export interface Command {
  id: string
  title: string
  section: 'Calques' | 'Alignement' | 'Écrans' | 'Affichage' | 'Projet'
  keywords?: string[]
  shortcut?: string
  enabled?: () => boolean
  run: () => void
}

/**
 * Référence : l'artboard quand un seul calque est sélectionné, la boîte de la
 * sélection au-delà. `canvas.store` s'en charge, la palette n'a que les libellés.
 */
const ALIGNMENTS = [
  { id: 'left', title: 'Aligner à gauche', mode: 'left' },
  { id: 'center-x', title: 'Centrer horizontalement', mode: 'center-x' },
  { id: 'right', title: 'Aligner à droite', mode: 'right' },
  { id: 'top', title: 'Aligner en haut', mode: 'top' },
  { id: 'center-y', title: 'Centrer verticalement', mode: 'center-y' },
  { id: 'bottom', title: 'Aligner en bas', mode: 'bottom' },
] as const satisfies readonly { id: string; title: string; mode: AlignMode }[]

const DISTRIBUTIONS = [
  { id: 'horizontal', title: 'Répartir horizontalement', mode: 'horizontal' },
  { id: 'vertical', title: 'Répartir verticalement', mode: 'vertical' },
] as const satisfies readonly { id: string; title: string; mode: DistributeMode }[]

/**
 * Command registry for the ⌘K palette. Commands read stores imperatively
 * (getState) so the list is cheap to rebuild on every open.
 */
export function getCommands(): Command[] {
  const ui = useUIStore.getState
  const canvas = useCanvasStore.getState
  const project = useProjectStore.getState
  const history = useHistoryStore.getState

  const layerCount = () => getProjectLayers(project().project).length
  const hasSelection = () => canvas().selectedLayerIds.length > 0
  const activeScreenId = () => project().project?.activeScreenId ?? ''

  return [
    {
      id: 'add-text',
      title: 'Ajouter un texte',
      section: 'Calques',
      keywords: ['texte', 'titre', 'typo'],
      shortcut: 'T',
      run: () => canvas().addLayer(createTextLayer(layerCount())),
    },
    {
      id: 'add-shape',
      title: 'Ajouter une forme',
      section: 'Calques',
      keywords: ['rectangle', 'forme', 'cercle'],
      shortcut: 'R',
      run: () => canvas().addLayer(createShapeLayer(layerCount())),
    },
    {
      id: 'add-device',
      title: 'Ajouter un cadre iPhone',
      section: 'Calques',
      keywords: ['iphone', 'device', 'mockup', 'cadre'],
      run: () => {
        const model = project().project?.globals.deviceModel ?? 'iphone-17-pro-max'
        canvas().addLayer(createDeviceLayer(model, layerCount()))
      },
    },
    {
      id: 'add-image',
      title: 'Importer une image…',
      section: 'Calques',
      keywords: ['image', 'png', 'import'],
      run: () => document.getElementById('sf-image-import-input')?.click(),
    },
    {
      id: 'duplicate-layer',
      title: 'Dupliquer le calque',
      section: 'Calques',
      shortcut: '⌘D',
      enabled: hasSelection,
      run: () => {
        for (const id of canvas().selectedLayerIds) canvas().duplicateLayer(id)
      },
    },
    {
      id: 'delete-layer',
      title: 'Supprimer le calque',
      section: 'Calques',
      shortcut: '⌫',
      enabled: hasSelection,
      run: () => {
        for (const id of canvas().selectedLayerIds) canvas().removeLayer(id)
      },
    },
    ...ALIGNMENTS.map(({ id, title, mode }) => ({
      id: `align-${id}`,
      title,
      section: 'Alignement' as const,
      keywords: ['aligner', 'align', id],
      enabled: hasSelection,
      run: () => canvas().alignSelection(mode),
    })),
    ...DISTRIBUTIONS.map(({ id, title, mode }) => ({
      id: `distribute-${id}`,
      title,
      section: 'Alignement' as const,
      keywords: ['répartir', 'distribuer', 'espacer'],
      // Deux calques n'ont pas d'intervalle intérieur : rien à répartir.
      enabled: () => canvas().selectedLayerIds.length >= 3,
      run: () => canvas().distributeSelection(mode),
    })),
    {
      id: 'new-screen',
      title: 'Nouvel écran',
      section: 'Écrans',
      keywords: ['écran', 'screen', 'ajouter'],
      run: () => {
        if (project().addScreen()) canvas().clearSelection()
      },
    },
    {
      id: 'duplicate-screen',
      title: 'Dupliquer l’écran actif',
      section: 'Écrans',
      run: () => {
        if (project().duplicateScreen(activeScreenId())) canvas().clearSelection()
      },
    },
    {
      id: 'undo',
      title: 'Annuler',
      section: 'Projet',
      shortcut: '⌘Z',
      enabled: () => history().past.length > 0,
      run: () => canvas().undo(),
    },
    {
      id: 'redo',
      title: 'Rétablir',
      section: 'Projet',
      shortcut: '⌘⇧Z',
      enabled: () => history().future.length > 0,
      run: () => canvas().redo(),
    },
    {
      id: 'export',
      title: 'Exporter…',
      section: 'Projet',
      keywords: ['zip', 'png', 'app store'],
      shortcut: '⌘E',
      run: () => ui().setShowExportDialog(true),
    },
    {
      id: 'templates',
      title: 'Modèles de mise en page…',
      section: 'Projet',
      keywords: ['template', 'modèle'],
      run: () => ui().setShowTemplatesPicker(true),
    },
    {
      id: 'globals',
      title: 'Réglages globaux…',
      section: 'Projet',
      keywords: ['défaut', 'global', 'réglages'],
      run: () => ui().setShowGlobalsEditor(true),
    },
    {
      id: 'toggle-theme',
      title: 'Basculer le thème',
      section: 'Affichage',
      keywords: ['sombre', 'clair', 'dark', 'light'],
      run: () => ui().toggleTheme(),
    },
    {
      id: 'toggle-layers',
      title: 'Basculer le panneau Calques',
      section: 'Affichage',
      shortcut: '⌘⇧L',
      run: () => ui().toggleLayers(),
    },
    {
      id: 'toggle-properties',
      title: 'Basculer le panneau Propriétés',
      section: 'Affichage',
      shortcut: '⌘⇧P',
      run: () => ui().toggleProps(),
    },
    {
      id: 'zoom-in',
      title: 'Zoom avant',
      section: 'Affichage',
      shortcut: '⌘+',
      run: () => ui().zoomIn(),
    },
    {
      id: 'zoom-out',
      title: 'Zoom arrière',
      section: 'Affichage',
      shortcut: '⌘−',
      run: () => ui().zoomOut(),
    },
    {
      id: 'zoom-fit',
      title: 'Ajuster aux écrans',
      section: 'Affichage',
      shortcut: '⌘0',
      run: () => ui().resetZoom(),
    },
    {
      id: 'shortcuts',
      title: 'Raccourcis clavier',
      section: 'Affichage',
      shortcut: '?',
      run: () => ui().setShowShortcuts(true),
    },
  ]
}
