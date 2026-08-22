import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Languages, Plus, Trash2 } from 'lucide-react'
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
import { RadioGroup, RadioPrimitive } from '@/components/ui/radio-group'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DialogShell } from '@/components/patterns/dialog-shell'
import { DialogColumns } from '@/components/patterns/dialog-columns'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { SelectField } from '@/components/patterns/select-field'
import { Hint } from '@/components/patterns/hint'
import { useProjectStore } from '@/stores/project.store'
import { useUIStore } from '@/stores/ui.store'
import { toast } from '@/stores/toast.store'
import type { LocaleVariant, Project, ScriptId, TextLayer } from '@/types'

const CODE_FIELD_ID = 'sf-locale-code'
const NAME_FIELD_ID = 'sf-locale-name'

/** Les trois défauts que `reviewLocale` sait nommer, tous bloquants à égalité. */
const FINDING_LABELS: Record<LocaleFinding['kind'], string> = {
  empty: 'Vide',
  overflow: 'Débordement',
  'off-canvas': 'Hors cadre',
}

/**
 * Les langues du projet, et ce qui les empêche de sortir.
 *
 * La boîte ne promet aucune traduction juste : elle rend une variante
 * **relisible**. Chaque texte est modifiable ligne à ligne, porte son état de
 * révision, et tout débordement est nommé sur la ligne qui le cause. Une langue
 * qui déborde ne s'exporte pas — c'est la seule règle dure, parce qu'une
 * capture dont l'accroche sort du cadre est refusée par la boutique ou,
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
        'Rien n’est pré-rempli sans le pont local, qui n’est pas connecté. Saisissez les traductions ci-dessous, ou branchez un modèle depuis « Générer les visuels de la fiche » → « Qui écrit les accroches ».',
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
        // Le moteur retenu à l'appairage, partagé avec la campagne.
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
    <DialogShell
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
        <Button variant="outline" onClick={close} disabled={busy}>
          Fermer
        </Button>
      }
    >
      <div className="flex flex-col">
        {error && (
          <Alert variant="error" className="mx-6 mt-4">
            <AlertCircle aria-hidden />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogColumns
          railLabel="Langues du projet"
          contentLabel={locale ? `Textes · ${locale.name}` : undefined}
          rail={
            <>
              {/* Ce qu'ajouter une langue fait au projet, dit avant le formulaire.
                  Les deux craintes qu'on a devant ce bouton sont « est-ce que ça
                  duplique mes dix écrans ? » et « est-ce que ça touche ma mise en
                  page ? » : les deux réponses sont non, et aucune n'était écrite. */}
              <p className="text-xs text-muted-foreground">
                Une langue ne duplique pas le projet. Elle ne stocke que le texte traduit de chaque
                calque — la mise en page, les captures et les appareils restent les mêmes.
              </p>

              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Field className="w-20 gap-1.5">
                    <FieldLabel htmlFor={CODE_FIELD_ID}>Code</FieldLabel>
                    <Input
                      id={CODE_FIELD_ID}
                      value={code}
                      maxLength={12}
                      placeholder="ja"
                      disabled={busy}
                      onChange={(event) => setCode(event.target.value)}
                    />
                  </Field>
                  <Field className="min-w-0 flex-1 gap-1.5">
                    <FieldLabel htmlFor={NAME_FIELD_ID}>Nom</FieldLabel>
                    <Input
                      id={NAME_FIELD_ID}
                      value={name}
                      maxLength={MAX_LOCALE_NAME_LENGTH}
                      placeholder="Japonais"
                      disabled={busy}
                      onChange={(event) => setName(event.target.value)}
                    />
                  </Field>
                </div>
                <SelectField<ScriptId>
                  label="Écriture"
                  aria-label="Écriture"
                  value={scriptId}
                  disabled={busy}
                  onValueChange={setScriptId}
                  items={SCRIPTS.map((entry) => ({ value: entry.id, label: entry.label }))}
                />
                <Button
                  variant="default"
                  onClick={create}
                  disabled={busy || locales.length >= MAX_PROJECT_LOCALES}
                >
                  <Plus size={12} aria-hidden />
                  Ajouter
                </Button>
                {/* « Écriture » ne décide rien de visible ici, mais tout du rendu :
                    une accroche japonaise composée dans une police latine se mesure
                    juste et s'exporte en carrés vides. */}
                <p className="text-xs text-muted-foreground">
                  Propose des polices capables d’afficher la langue. Le code suit l’App Store : deux
                  lettres, plus une région si besoin (<span className="tabular-nums">pt-BR</span>).
                </p>
              </div>

              {locales.length > 0 && (
                <RadioGroup
                  className="gap-1.5 border-t border-border pt-3"
                  aria-label="Langue"
                  value={locale?.code ?? null}
                  onValueChange={(code) => {
                    if (typeof code === 'string') setSelectedCode(code)
                  }}
                  disabled={busy}
                >
                  {locales.map((entry) => (
                    /* La carte est le bouton radio : Base UI porte l'état, le focus
                       tombe sur l'élément lui-même. */
                    <RadioPrimitive.Root
                      key={entry.code}
                      value={entry.code}
                      className={cn(
                        'flex items-center gap-2 rounded-md border px-3 py-2 text-xs transition-colors outline-none',
                        'focus-visible:ring-1 focus-visible:ring-ring',
                        'data-disabled:cursor-not-allowed data-disabled:opacity-50',
                        entry.code === locale?.code
                          ? 'border-foreground bg-muted text-foreground'
                          : 'border-border text-muted-foreground hover:border-input',
                      )}
                    >
                      <span className="tabular-nums">{entry.code}</span>
                      {entry.name}
                    </RadioPrimitive.Root>
                  ))}
                </RadioGroup>
              )}
            </>
          }
        >
          {locale ? (
            <>
              <div className="flex flex-wrap items-end gap-2">
                <SelectField
                  className="w-56"
                  label="Police de cette langue"
                  aria-label="Police de cette langue"
                  value={locale.fontFamily ?? ''}
                  disabled={busy}
                  onValueChange={(next) => setLocaleFont(locale.code, next || undefined)}
                  items={[
                    { value: '', label: 'Garder celle de chaque calque' },
                    ...fontsForScript(locale.script).map((family) => ({
                      value: family,
                      label: family,
                    })),
                  ]}
                />
                <Hint content="Envoie les textes d’origine au pont local et remplit les traductions ci-dessous, à relire.">
                  <Button
                    variant="outline"
                    onClick={() => void translate(locale, layers)}
                    loading={busy}
                  >
                    <Languages size={12} aria-hidden />
                    Pré-remplir via le pont
                  </Button>
                </Hint>
                <Button
                  variant="outline"
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
                <h3 className="text-sm font-medium">Calque · texte d’origine</h3>
                <span className="text-xs text-muted-foreground">Traduction · relu</span>
              </div>
              {layers.length === 0 ? (
                <p className="text-xs text-muted-foreground">
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
          ) : (
            <p className="text-xs text-muted-foreground">
              Ajoutez une langue, ou choisissez-en une dans la liste, pour en relire les textes.
            </p>
          )}
        </DialogColumns>
      </div>
    </DialogShell>
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
        <label htmlFor={fieldId} className="min-w-0 truncate text-xs text-foreground">
          {layer.content}
        </label>
        <span className="text-xs text-muted-foreground shrink-0">{layer.name}</span>
      </div>
      <div className="flex items-center gap-2">
        <Input
          id={fieldId}
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
        <Hint content="Votre pense-bête de relecture. Il n’empêche jamais l’export ; seul un texte qui déborde le fait.">
          <label
            className={cn(
              'flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs',
              variant?.reviewed ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            <Checkbox
              checked={variant?.reviewed ?? false}
              aria-label={`Marquer la traduction de « ${layer.name} » comme relue`}
              disabled={disabled}
              onCheckedChange={(checked) =>
                setLocaleText(locale.code, layer.id, variant?.value ?? '', checked)
              }
            />
            Relu
          </label>
        </Hint>
      </div>
      {findings.map((finding) => (
        <Alert key={finding.kind} variant="error" className="py-1.5">
          <AlertCircle aria-hidden />
          <AlertDescription className="flex flex-wrap items-center gap-1.5 text-xs">
            <Badge variant="error" size="sm">
              {FINDING_LABELS[finding.kind]}
            </Badge>
            {finding.detail}
          </AlertDescription>
        </Alert>
      ))}
    </li>
  )
}
