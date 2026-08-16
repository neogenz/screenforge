import { create } from 'zustand'
import {
  deleteCustomTemplate,
  isCustomTemplate,
  MAX_CUSTOM_TEMPLATES,
  MAX_TEMPLATE_NAME_LENGTH,
  readCustomTemplates,
  templateFromScreen,
  TemplateRefusedError,
  writeCustomTemplate,
  type CustomTemplate,
} from '@/lib/custom-templates'
import { getActiveScreen, useProjectStore } from '@/stores/project.store'

/**
 * La bibliothèque de gabarits, qui n'est pas le projet.
 *
 * Elle vit dans son propre store et non dans `project.store` pour la raison qui
 * fait tout l'intérêt de la fonctionnalité : un gabarit survit au projet qui
 * l'a produit. Le mettre dans le projet l'aurait fait voyager dans les exports,
 * les releases et la sync Cloud, et l'aurait soumis à `isProject` — qui n'a
 * rien à dire d'une bibliothèque personnelle. Le store du projet reste la
 * source de vérité de ce qui est sur la planche, et de rien d'autre.
 *
 * IndexedDB est la vérité, ce store en est le reflet : chaque écriture passe
 * par le disque avant de changer l'état, sans quoi l'interface montrerait un
 * gabarit qu'un rechargement ferait disparaître.
 */

export interface TemplateSaveInput {
  name: string
  description?: string
  screenId?: string
  source?: CustomTemplate['source']
}

export type TemplateSaveOutcome =
  { ok: true; template: CustomTemplate } | { ok: false; error: string }

interface TemplatesState {
  templates: CustomTemplate[]
  hydrated: boolean
  hydrate: () => Promise<void>
  save: (input: TemplateSaveInput) => Promise<TemplateSaveOutcome>
  remove: (id: string) => Promise<void>
}

let hydrating: Promise<void> | null = null

export const useTemplatesStore = create<TemplatesState>()((set, get) => ({
  templates: [],
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return
    const current = (hydrating ??= (async () => {
      try {
        set({ templates: await readCustomTemplates(), hydrated: true })
      } catch (error) {
        console.warn('Could not read the saved templates.', error)
        set({ hydrated: true })
      }
    })())
    try {
      await current
    } finally {
      if (hydrating === current) hydrating = null
    }
  },

  save: async (input) => {
    await get().hydrate()
    const name = input.name.trim()
    if (!name) return { ok: false, error: 'Un gabarit a besoin d’un nom.' }
    if (name.length > MAX_TEMPLATE_NAME_LENGTH) {
      return { ok: false, error: `Nom trop long : ${MAX_TEMPLATE_NAME_LENGTH} caractères au plus.` }
    }

    const existing = get().templates
    /* Refus plutôt que suffixe automatique : « Hero 2 » posé sans qu'on l'ait
       demandé donne deux gabarits presque homonymes, et l'agent qui réapplique
       « Hero » ne sait plus lequel il obtient. */
    if (existing.some((template) => template.name === name)) {
      return {
        ok: false,
        error: `Un gabarit s’appelle déjà « ${name} ». Choisissez un autre nom ou supprimez celui-là.`,
      }
    }
    if (existing.length >= MAX_CUSTOM_TEMPLATES) {
      return {
        ok: false,
        error: `Bibliothèque pleine : ${MAX_CUSTOM_TEMPLATES} gabarits au plus. Supprimez-en un.`,
      }
    }

    const project = useProjectStore.getState().project
    if (!project) return { ok: false, error: 'Aucun projet ouvert.' }
    const screen = input.screenId
      ? project.screens.find((candidate) => candidate.id === input.screenId)
      : getActiveScreen(project)
    if (!screen) {
      const known = project.screens.map((candidate) => `${candidate.id} (${candidate.name})`)
      return {
        ok: false,
        error: `Aucun écran « ${input.screenId} ». Écrans : ${known.join(', ')}.`,
      }
    }

    let template: CustomTemplate
    try {
      template = templateFromScreen(screen, {
        name,
        description: input.description,
        source: input.source ?? 'user',
      })
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof TemplateRefusedError ? error.message : 'Gabarit impossible à figer.',
      }
    }

    /* Relu par le contrat avant d'atteindre le disque : un enregistrement que
       `readCustomTemplates` refuserait ensuite serait un gabarit qui disparaît
       au rechargement sans avoir jamais dit non. */
    if (!isCustomTemplate(template)) {
      return { ok: false, error: 'Cet écran ne produit pas un gabarit valide.' }
    }

    try {
      await writeCustomTemplate(template)
    } catch (error) {
      console.warn('Could not save the template.', error)
      return { ok: false, error: 'Le gabarit n’a pas pu être écrit sur ce navigateur.' }
    }

    set((state) => ({ templates: [template, ...state.templates] }))
    return { ok: true, template }
  },

  remove: async (id) => {
    await get().hydrate()
    await deleteCustomTemplate(id)
    set((state) => ({ templates: state.templates.filter((template) => template.id !== id) }))
  },
}))
