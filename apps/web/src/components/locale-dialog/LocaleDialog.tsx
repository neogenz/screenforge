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
import { bridgeEngine, bridgeToken, translateViaBridge } from '@/lib/bridge-client'
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

/**
 * L'état d'une langue en une phrase, et une seule.
 *
 * Deux faits distincts vivent ici et l'un seulement est bloquant : un texte qui
 * déborde de son cadre interdit l'export, une traduction non relue ne l'interdit
 * pas. Les annoncer côte à côte les met sur le même plan.
 */
function localeStatus(
  name: string,
  findings: number,
  unreviewed: number,
  blocked: boolean,
): string {
  if (blocked) {
    return `« ${name} » ne peut pas sortir : ${findings} texte${findings > 1 ? 's débordent' : ' déborde'} de son cadre. Raccourcissez-${findings > 1 ? 'les' : 'le'} ci-dessous.`
  }
  if (unreviewed > 0) {
    return `« ${name} » est exportable. ${unreviewed} traduction${unreviewed > 1 ? 's' : ''} sans relecture déclarée — c'est un pense-bête, pas un verrou.`
  }
  return `« ${name} » est exportable, et tout est relu.`
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
    const token = bridgeToken('assistant')
    if (!token) {
      /* L'erreur nomme le geste, pas l'absence : « aucun pont appairé » décrit
         un état interne à qui n'a jamais entendu parler du pont. La traduction
         à la main reste dite en premier — c'est le chemin qui marche tout de
         suite, et le pont est facultatif par contrat. */
      setError(
        'Rien n’est pré-rempli sans le pont local, qui n’est pas connecté. Saisissez les traductions ci-dessous, ou branchez un modèle depuis « Générer les visuels App Store » → « Qui écrit les accroches ».',
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
        // Le moteur retenu à l'appairage : sur une machine qui n'a que Claude
        // Code, repartir sur Codex ferait échouer la traduction après une
        // campagne réussie, avec tout de branché.
        bridgeEngine(),
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
      /* Un seul état à la fois, et il dit ce qui bloque plutôt que de compter.
         L'ancienne phrase juxtaposait « est exportable » et « encore à relire »
         sans dire lequel des deux empêchait de sortir — les deux se lisaient
         comme des conditions, alors qu'une seule l'est. */
      footerNote={
        locale
          ? localeStatus(locale.name, findings.length, unreviewedCount(locale), blocked)
          : undefined
      }
      footer={
        <Button variant="default" onClick={close} disabled={busy}>
          Fermer
        </Button>
      }
    >
      <div className="flex max-h-[60dvh] flex-col gap-4 overflow-y-auto px-6 py-4">
        {error && (
          <p role="alert" className="flex items-start gap-2 text-2xs text-destructive">
            <AlertCircle size={13} className="mt-0.5 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        {/* Ce qu'ajouter une langue fait au projet, dit avant le formulaire.
            Les deux craintes qu'on a devant ce bouton sont « est-ce que ça
            duplique mes dix écrans ? » et « est-ce que ça touche ma mise en
            page ? » : les deux réponses sont non, et aucune n'était écrite. */}
        <p className="text-2xs text-muted-foreground">
          Une langue ne duplique pas le projet. Elle ne stocke que le texte traduit de chaque calque
          — la mise en page, les captures et les appareils restent les mêmes. Vous figez ensuite une
          release dans la langue de votre choix.
        </p>

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
        {/* « Écriture » ne décide rien de visible ici, mais tout du rendu : une
            accroche japonaise composée dans une police latine se mesure juste
            et s'exporte en carrés vides. */}
        <p className="-mt-2 text-2xs text-muted-foreground">
          L’écriture sert à proposer des polices capables d’afficher la langue. Le code suit l’App
          Store : deux lettres, plus une région si besoin (<span className="tabular">pt-BR</span>
          ).
        </p>

        {locales.length > 0 && (
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Langue">
            {locales.map((entry) => (
              <label
                key={entry.code}
                className={cn(
                  'relative flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-2xs transition-colors',
                  'has-[:focus-visible]:outline-none has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-ring',
                  busy && 'cursor-not-allowed opacity-50',
                  entry.code === locale?.code
                    ? 'border-foreground bg-muted text-foreground'
                    : 'border-border text-muted-foreground hover:border-input',
                )}
              >
                <input
                  type="radio"
                  name="screenforge-locale"
                  value={entry.code}
                  checked={entry.code === locale?.code}
                  disabled={busy}
                  onChange={() => setSelectedCode(entry.code)}
                  className="absolute inset-0 z-10 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                />
                <span className="tabular">{entry.code}</span>
                {entry.name}
              </label>
            ))}
          </div>
        )}

        {locale && (
          <>
            <div className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
              <Select
                className="w-56"
                label="Police de cette langue"
                aria-label="Police de cette langue"
                value={locale.fontFamily ?? ''}
                disabled={busy}
                onChange={(event) => setLocaleFont(locale.code, event.target.value || undefined)}
              >
                <option value="">Garder celle de chaque calque</option>
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
                title="Envoie les textes d’origine au pont local et remplit les traductions ci-dessous, à relire."
              >
                <Languages size={12} aria-hidden />
                Pré-remplir via le pont
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

            {/* En-tête de colonnes. Sans elle, chaque ligne montrait deux textes
                — le nom du calque à gauche, l'original en gris à droite, la
                traduction dans le champ — et rien ne disait lequel était
                lequel : on relit une traduction sans savoir ce qu'elle traduit. */}
            <div className="flex items-baseline justify-between gap-2 border-t border-border pt-4">
              <h3 className="section-title">Calque · texte d’origine</h3>
              <span className="field-label">Traduction · relu</span>
            </div>
            {layers.length === 0 ? (
              <p className="text-2xs text-muted-foreground">
                Aucun texte dans ce projet. Ajoutez un calque de texte, il apparaîtra ici.
              </p>
            ) : (
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
            )}
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
      {/* Le nom du calque et son texte d'origine sur la même ligne, mais pas au
          même poids : c'est le texte qu'on relit, le nom ne sert qu'à le
          situer. L'original ne descend jamais sous 4.5:1 — on ne relit pas une
          traduction contre une source en gris pâle. */}
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={fieldId} className="min-w-0 truncate text-2xs text-foreground">
          {layer.content}
        </label>
        <span className="field-label shrink-0">{layer.name}</span>
      </div>
      <div className="flex items-center gap-2">
        <Input
          id={fieldId}
          font="sans"
          value={variant?.value ?? ''}
          maxLength={MAX_LOCALE_TEXT_LENGTH}
          disabled={disabled}
          aria-invalid={findings.length > 0}
          /* Vide, le calque garde son texte d'origine — c'est ce que fait
             `localized()`. Le montrer en filigrane dit à quoi ressemblera la
             planche tant que personne n'a traduit cette ligne. */
          placeholder={layer.content}
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
          aria-label={`Marquer la traduction de « ${layer.name} » comme relue`}
          title="Votre pense-bête de relecture. Il n’empêche jamais l’export ; seul un texte qui déborde le fait."
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
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
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
