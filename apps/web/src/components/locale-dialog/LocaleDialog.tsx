import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, Languages, Plus, Trash2 } from 'lucide-react'
import {
  addLocale,
  applyTranslations,
  fontsForScript,
  localeBlocked,
  removeLocale,
  reviewLocale,
  setLocaleFont,
  setLocaleText,
  textLayersOf,
  unreviewedCount,
  SCRIPTS,
  type LocaleFinding,
} from '@/lib/locale'
import {
  LOCALE_CODE,
  MAX_LOCALE_NAME_LENGTH,
  MAX_LOCALE_TEXT_LENGTH,
  MAX_PROJECT_LOCALES,
} from '@/lib/project-validation'
import { bridgeToken, translateViaBridge } from '@/lib/bridge-client'
import { loadGoogleFont } from '@/lib/fonts'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useProjectStore } from '@/stores/project.store'
import { useUIStore } from '@/stores/ui.store'
import { toast } from '@/stores/toast.store'
import type { LocaleVariant, Project, ScriptId, TextLayer } from '@/types'

const CODE_FIELD_ID = 'sf-locale-code'
const NAME_FIELD_ID = 'sf-locale-name'

/**
 * Les langues du projet, et ce qui les empêche de sortir.
 *
 * La boîte ne promet aucune traduction juste : elle rend une variante
 * **relisible**. Chaque texte est modifiable ligne à ligne, porte son état de
 * révision, et tout débordement est nommé sur la ligne qui le cause. Une langue
 * qui déborde ne s'exporte pas — c'est la seule règle dure, parce qu'une
 * capture dont l'accroche sort du cadre est refusée par App Store Connect ou,
 * pire, acceptée telle quelle.
 */
export function LocaleDialog() {
  const showLocaleDialog = useUIStore((state) => state.showLocaleDialog)
  const project = useProjectStore((state) => state.project)

  if (!showLocaleDialog || !project) return null
  return <LocaleDialogContent project={project} />
}

function LocaleDialogContent({ project }: { project: Project }) {
  const close = () => useUIStore.getState().setShowLocaleDialog(false)
  const locales = project.locales ?? []

  const [selectedCode, setSelectedCode] = useState(() => locales[0]?.code ?? '')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [scriptId, setScriptId] = useState<ScriptId>('latin')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const locale = locales.find((entry) => entry.code === selectedCode) ?? locales[0]

  /* La mesure lit la police réellement chargée : sans elle, le navigateur
     substitue un repli latin et une accroche japonaise paraît tenir. */
  useEffect(() => {
    if (locale?.fontFamily) void loadGoogleFont(locale.fontFamily)
  }, [locale?.fontFamily])

  const findings = useMemo(() => (locale ? reviewLocale(project, locale) : []), [project, locale])
  const findingsByLayer = useMemo(() => {
    const map = new Map<string, LocaleFinding[]>()
    for (const finding of findings) {
      map.set(finding.layerId, [...(map.get(finding.layerId) ?? []), finding])
    }
    return map
  }, [findings])

  function create() {
    setError(null)
    const trimmed = code.trim()
    if (!LOCALE_CODE.test(trimmed)) {
      setError(
        'Code de langue attendu : deux lettres, éventuellement suivies d’une région (pt-BR).',
      )
      return
    }
    const outcome = addLocale(
      trimmed,
      name.trim() || trimmed,
      scriptId,
      fontsForScript(scriptId)[0],
    )
    if (!outcome.committed) {
      setError(
        locales.some((entry) => entry.code === trimmed)
          ? 'Cette langue existe déjà.'
          : `Maximum ${MAX_PROJECT_LOCALES} langues par projet.`,
      )
      return
    }
    setSelectedCode(trimmed)
    setCode('')
    setName('')
  }

  async function translate(target: LocaleVariant, layers: TextLayer[]) {
    const token = bridgeToken('codex')
    if (!token) {
      setError(
        'Aucun pont appairé. Ouvrez « Composer une campagne », section Assistance, pour vous connecter — ou traduisez à la main.',
      )
      return
    }
    setBusy(true)
    setError(null)
    try {
      const sources = layers.map((layer) => layer.content)
      const translated = await translateViaBridge(
        { code: target.code, name: target.name, script: target.script },
        sources,
        token,
      )
      const proposals = Object.fromEntries(
        layers.map((layer, index) => [layer.id, translated[index]]),
      )
      const outcome = applyTranslations(target.code, proposals)
      if (!outcome.committed) {
        setError('Aucune proposition n’a pu être reprise : la langue est restée inchangée.')
        return
      }
      toast(`${outcome.value} textes proposés, à relire.`, 'success')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La traduction a échoué.')
    } finally {
      setBusy(false)
    }
  }

  const layers = textLayersOf(project)
  const blocked = locale ? localeBlocked(findings) : false

  return (
    <Dialog
      open
      onClose={busy ? () => undefined : close}
      title="Langues"
      size="lg"
      flush
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <p className="text-2xs text-muted-foreground">
            {locale
              ? blocked
                ? `${findings.length} problème${findings.length > 1 ? 's' : ''} à corriger avant d’exporter cette langue.`
                : `« ${locale.name} » est exportable. ${unreviewedCount(locale)} texte${unreviewedCount(locale) > 1 ? 's' : ''} encore à relire.`
              : 'Une langue ne duplique rien : elle ne porte que les textes.'}
          </p>
          <Button variant="default" onClick={close} disabled={busy}>
            Fermer
          </Button>
        </div>
      }
    >
      <div className="flex max-h-[60dvh] flex-col gap-4 overflow-y-auto px-6 py-4">
        {error && (
          <p role="alert" className="flex items-start gap-2 text-2xs text-destructive">
            <AlertCircle size={13} className="mt-0.5 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-end gap-2">
          <Field id={CODE_FIELD_ID} label="Code" className="w-24">
            <Input
              id={CODE_FIELD_ID}
              font="sans"
              value={code}
              maxLength={12}
              placeholder="ja"
              disabled={busy}
              onChange={(event) => setCode(event.target.value)}
            />
          </Field>
          <Field id={NAME_FIELD_ID} label="Nom" className="min-w-0 flex-1">
            <Input
              id={NAME_FIELD_ID}
              font="sans"
              value={name}
              maxLength={MAX_LOCALE_NAME_LENGTH}
              placeholder="Japonais"
              disabled={busy}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Select
            className="w-44"
            label="Écriture"
            aria-label="Écriture"
            value={scriptId}
            disabled={busy}
            onChange={(event) => setScriptId(event.target.value as ScriptId)}
          >
            {SCRIPTS.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </Select>
          <Button
            variant="primary"
            onClick={create}
            disabled={busy || locales.length >= MAX_PROJECT_LOCALES}
          >
            <Plus size={12} aria-hidden />
            Ajouter
          </Button>
        </div>

        {locales.length > 0 && (
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Langue">
            {locales.map((entry) => (
              <button
                key={entry.code}
                type="button"
                role="radio"
                aria-checked={entry.code === locale?.code}
                disabled={busy}
                onClick={() => setSelectedCode(entry.code)}
                className={cn(
                  'flex items-center gap-2 rounded-md border px-3 py-2 text-2xs transition-colors',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground',
                  entry.code === locale?.code
                    ? 'border-foreground bg-muted text-foreground'
                    : 'border-border text-muted-foreground hover:border-input',
                )}
              >
                <span className="tabular">{entry.code}</span>
                {entry.name}
              </button>
            ))}
          </div>
        )}

        {locale && (
          <>
            <div className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
              <Select
                className="w-56"
                label="Police"
                aria-label="Police de la langue"
                value={locale.fontFamily ?? ''}
                disabled={busy}
                onChange={(event) => setLocaleFont(locale.code, event.target.value || undefined)}
              >
                <option value="">Celle de chaque calque</option>
                {fontsForScript(locale.script).map((family) => (
                  <option key={family} value={family}>
                    {family}
                  </option>
                ))}
              </Select>
              <Button
                variant="default"
                onClick={() => void translate(locale, layers)}
                loading={busy}
              >
                <Languages size={12} aria-hidden />
                Traduire via le pont
              </Button>
              <Button
                variant="default"
                onClick={() => {
                  removeLocale(locale.code)
                  setSelectedCode('')
                }}
                disabled={busy}
              >
                <Trash2 size={12} aria-hidden />
                Supprimer
              </Button>
            </div>

            <ul className="flex flex-col gap-3">
              {layers.map((layer) => (
                <TextRow
                  key={layer.id}
                  layer={layer}
                  locale={locale}
                  findings={findingsByLayer.get(layer.id) ?? []}
                  disabled={busy}
                />
              ))}
            </ul>
          </>
        )}
      </div>
    </Dialog>
  )
}

/**
 * Une ligne : l'original, la variante, ce qui cloche.
 *
 * L'original reste visible pendant la relecture — sans lui, l'utilisateur
 * relit un texte sans savoir ce qu'il devait dire. Le débordement est affiché
 * sur la ligne qui le cause, pas dans une liste séparée : une alerte qu'il faut
 * aller chercher n'est pas une alerte.
 */
function TextRow({
  layer,
  locale,
  findings,
  disabled,
}: {
  layer: TextLayer
  locale: LocaleVariant
  findings: LocaleFinding[]
  disabled: boolean
}) {
  const variant = locale.texts[layer.id]
  const fieldId = `sf-locale-${locale.code}-${layer.id}`

  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={fieldId} className="field-label min-w-0 truncate">
          {layer.name}
        </label>
        <span className="min-w-0 truncate text-2xs text-muted-foreground">{layer.content}</span>
      </div>
      <div className="flex items-center gap-2">
        <Input
          id={fieldId}
          font="sans"
          value={variant?.value ?? ''}
          maxLength={MAX_LOCALE_TEXT_LENGTH}
          disabled={disabled}
          aria-invalid={findings.length > 0}
          onChange={(event) =>
            setLocaleText(locale.code, layer.id, event.target.value, variant?.reviewed ?? false)
          }
        />
        {/* Relu est un fait qu'on déclare, pas un état qu'on devine : une
            traduction reprise du pont arrive toujours non relue. */}
        <button
          type="button"
          role="checkbox"
          aria-checked={variant?.reviewed ?? false}
          aria-label={`Marquer « ${layer.name} » comme relu`}
          disabled={disabled}
          onClick={() =>
            setLocaleText(
              locale.code,
              layer.id,
              variant?.value ?? '',
              !(variant?.reviewed ?? false),
            )
          }
          className={cn(
            'flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-2xs transition-colors',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground',
            variant?.reviewed
              ? 'border-foreground bg-muted text-foreground'
              : 'border-border text-muted-foreground hover:border-input',
          )}
        >
          <Check size={11} aria-hidden />
          Relu
        </button>
      </div>
      {findings.map((finding) => (
        <p
          key={finding.kind}
          role="alert"
          className="flex items-start gap-1.5 text-2xs text-destructive"
        >
          <AlertCircle size={12} className="mt-px shrink-0" aria-hidden />
          {finding.detail}
        </p>
      ))}
    </li>
  )
}
