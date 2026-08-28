import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Languages, Plus, SpellCheck, Trash2 } from 'lucide-react'
import {
  addLocale,
  applySourceTexts,
  applyTranslations,
  fontsForScript,
  localeBlocked,
  removeLocale,
  reviewLocale,
  setLocaleFont,
  setLocaleText,
  textLayersOf,
  unreviewedCount,
  type LocaleFinding,
} from '@/lib/locale'
import {
  LOCALE_CATALOG,
  defaultSourceLanguage,
  localeEntry,
  localeName,
} from '@/lib/locale-catalog'
import { MAX_LOCALE_TEXT_LENGTH, MAX_PROJECT_LOCALES } from '@/lib/project-validation'
import { MAX_TEXT_JOB_LENGTH, runTextJob, textWriterUnavailable } from '@/lib/ai/text'
import { aiProvider } from '@/lib/ai/providers'
import { AssistantSetup } from '@/components/campaign-dialog/AssistantSetup'
import { useAssistant } from '@/components/campaign-dialog/use-assistant'
import { loadGoogleFont } from '@/lib/fonts'
import { cn } from '@/lib/utils'
import { RadioGroup, RadioPrimitive } from '@/components/ui/radio-group'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmAction } from '@/components/patterns/confirm-action'
import { DialogShell } from '@/components/patterns/dialog-shell'
import { DialogColumns } from '@/components/patterns/dialog-columns'
import { Input } from '@/components/ui/input'
import { SelectField } from '@/components/patterns/select-field'
import { Hint } from '@/components/patterns/hint'
import { useProjectStore } from '@/stores/project.store'
import { useUIStore } from '@/stores/ui.store'
import { toast } from '@/stores/toast.store'
import type { LocaleVariant, Project, TextLayer } from '@/types'

const ADD_FIELD_ID = 'sf-locale-add'
const SOURCE_FIELD_ID = 'sf-locale-source'

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
 *
 * Le rédacteur qui remplit ces textes est le même que celui de la fiche : la
 * session d'appairage (`use-assistant.ts`) est partagée, choisir « qui écrit »
 * une fois suffit pour traduire et relire ici aussi.
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

/** Une phrase pour ce que le rédacteur n'a pas pu écrire : trop long, ou rien à faire. */
function tooLongMessage(skipped: number, verb: 'traduire' | 'relire'): string {
  if (skipped === 0) return `Aucun texte à ${verb}.`
  return `${skipped > 1 ? `${skipped} textes dépassent` : 'Un texte dépasse'} ${MAX_TEXT_JOB_LENGTH} caractères : rien n’a été envoyé.`
}

/** Ajoutée à un toast de succès quand une partie du lot a été laissée de côté. */
function skippedNote(skipped: number): string {
  return skipped > 0
    ? ` ${skipped} ignoré${skipped > 1 ? 's' : ''} (plus de ${MAX_TEXT_JOB_LENGTH} caractères).`
    : ''
}

function LocaleDialogContent({ project }: { project: Project }) {
  const close = () => useUIStore.getState().setShowLocaleDialog(false)
  const locales = project.locales ?? []
  const assistant = useAssistant()

  const [selectedCode, setSelectedCode] = useState(() => locales[0]?.code ?? '')
  const [pendingAddCode, setPendingAddCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

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

  /* Dérivé au rendu, jamais recopié dans un état : la liste se rétrécit d'elle-
     même à mesure que des langues sont ajoutées, sans effet pour la resynchroniser. */
  const usedCodes = new Set(locales.map((entry) => entry.code))
  const availableEntries = LOCALE_CATALOG.filter((entry) => !usedCodes.has(entry.code))
  const addCode = availableEntries.some((entry) => entry.code === pendingAddCode)
    ? pendingAddCode
    : (availableEntries[0]?.code ?? '')

  const sourceCode = project.listing?.language ?? defaultSourceLanguage()

  function setSourceLanguage(language: string) {
    useProjectStore.getState().updateListing({
      appName: '',
      pitch: '',
      direction: 'sobre',
      ...project.listing,
      language,
    })
  }

  function addSelected() {
    setError(null)
    const entry = localeEntry(addCode)
    if (!entry) return
    const outcome = addLocale(entry.code, entry.name, entry.script, fontsForScript(entry.script)[0])
    if (!outcome.committed) {
      setError(
        locales.some((existing) => existing.code === entry.code)
          ? 'Cette langue existe déjà.'
          : `Maximum ${MAX_PROJECT_LOCALES} langues par projet.`,
      )
      return
    }
    setSelectedCode(entry.code)
  }

  const layers = textLayersOf(project)
  const blocked = locale ? localeBlocked(findings) : false
  const unreviewed = locale ? unreviewedCount(project, locale) : 0
  const unavailable = textWriterUnavailable(assistant)
  const provider = aiProvider(assistant.providerId)
  const writerStatus =
    provider.auth === 'none' ? null : assistant.connected ? 'Connecté' : 'À connecter'

  async function translate() {
    if (!locale) return
    setError(null)
    /* Un calque sans entrée compte comme non relu (`unreviewedCount`) : il est
       donc candidat au même titre — sinon un calque ajouté après la langue
       restait hors traduction sans recours. `applyTranslations` lui crée sa
       variante à la reprise plutôt que de l'ignorer. */
    const candidates = layers.filter((layer) => {
      const variant = locale.texts[layer.id]
      return !variant || unreviewed === 0 || !variant.reviewed
    })
    const eligible = candidates.filter((layer) => layer.content.length <= MAX_TEXT_JOB_LENGTH)
    const skipped = candidates.length - eligible.length
    if (eligible.length === 0) {
      setError(tooLongMessage(skipped, 'traduire'))
      return
    }
    setBusy(true)
    try {
      const translated = await runTextJob(
        {
          kind: 'translate',
          source: { code: sourceCode, name: localeName(sourceCode) },
          target: { code: locale.code, name: locale.name, script: locale.script },
        },
        eligible.map((layer) => layer.content),
        { appName: project.listing?.appName, pitch: project.listing?.pitch },
      )
      const proposals = Object.fromEntries(
        eligible.map((layer, index) => [layer.id, translated[index]]),
      )
      const outcome = applyTranslations({ [locale.code]: proposals })
      if (!outcome.committed) {
        setError('Aucune proposition n’a pu être reprise : la langue est restée inchangée.')
        return
      }
      toast(
        `${outcome.value} texte${outcome.value > 1 ? 's' : ''} traduit${outcome.value > 1 ? 's' : ''} en ${locale.name} : à relire.${skippedNote(skipped)}`,
        'success',
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La traduction a échoué.')
    } finally {
      setBusy(false)
    }
  }

  /** Comme `translate`, mais un appel par langue restant à traduire, en
   * parallèle, repris en une seule transaction — tout ou rien, un seul pas
   * d'annulation, comme toute écriture groupée de ce fichier. */
  async function translateAll() {
    const targets = locales.filter((entry) => unreviewedCount(project, entry) > 0)
    if (targets.length === 0) return
    setError(null)
    setBusy(true)
    try {
      const results = await Promise.all(
        targets.map(async (target) => {
          const eligible = layers
            .filter((layer) => !target.texts[layer.id]?.reviewed)
            .filter((layer) => layer.content.length <= MAX_TEXT_JOB_LENGTH)
          if (eligible.length === 0) return [target.code, {}] as const
          const translated = await runTextJob(
            {
              kind: 'translate',
              source: { code: sourceCode, name: localeName(sourceCode) },
              target: { code: target.code, name: target.name, script: target.script },
            },
            eligible.map((layer) => layer.content),
            { appName: project.listing?.appName, pitch: project.listing?.pitch },
          )
          return [
            target.code,
            Object.fromEntries(eligible.map((layer, index) => [layer.id, translated[index]])),
          ] as const
        }),
      )
      const outcome = applyTranslations(Object.fromEntries(results))
      if (!outcome.committed) {
        setError('Aucune proposition n’a pu être reprise : aucune langue n’a changé.')
        return
      }
      toast(
        `${outcome.value} texte${outcome.value > 1 ? 's' : ''} traduit${outcome.value > 1 ? 's' : ''} sur ${targets.length} langue${targets.length > 1 ? 's' : ''}.`,
        'success',
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La traduction a échoué.')
    } finally {
      setBusy(false)
    }
  }

  /** Même geste que `removeRelease` dans `ReleaseDialog` : confirmé, toasté, le
   * retour de la transaction lu plutôt qu'ignoré. */
  function forgetLocale(target: LocaleVariant) {
    if (busy) return
    if (!removeLocale(target.code).committed) return
    setSelectedCode('')
    toast(`Langue « ${target.name} » supprimée.`, 'success')
  }

  async function proofread() {
    setError(null)
    const eligible = layers.filter((layer) => layer.content.length <= MAX_TEXT_JOB_LENGTH)
    const skipped = layers.length - eligible.length
    if (eligible.length === 0) {
      setError(tooLongMessage(skipped, 'relire'))
      return
    }
    setBusy(true)
    try {
      const corrected = await runTextJob(
        { kind: 'proofread', language: { code: sourceCode, name: localeName(sourceCode) } },
        eligible.map((layer) => layer.content),
        { appName: project.listing?.appName, pitch: project.listing?.pitch },
      )
      const proposals = Object.fromEntries(
        eligible.map((layer, index) => [layer.id, corrected[index]]),
      )
      const outcome = applySourceTexts(proposals)
      const note = skippedNote(skipped)
      toast(
        outcome.committed
          ? `${outcome.value} texte${outcome.value > 1 ? 's' : ''} corrigé${outcome.value > 1 ? 's' : ''}.${note}`
          : `Aucune faute trouvée.${note}`,
        outcome.committed ? 'success' : 'info',
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La relecture a échoué.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <DialogShell
      open
      onClose={busy ? () => undefined : close}
      title="Langues"
      description="Chaque langue reprend les mêmes calques avec ses propres textes : traduits par le rédacteur choisi, puis relus ici. L’export et la publication prennent la langue de la version figée."
      size="lg"
      flush
      /* Un seul état à la fois, et il dit ce qui bloque plutôt que de compter.
         L'ancienne phrase juxtaposait « est exportable » et « encore à relire »
         sans dire lequel des deux empêchait de sortir — les deux se lisaient
         comme des conditions, alors qu'une seule l'est. */
      footerNote={
        locale ? localeStatus(locale.name, findings.length, unreviewed, blocked) : undefined
      }
      footer={
        <Button variant="ghost" onClick={close} disabled={busy}>
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

              <SelectField
                id={SOURCE_FIELD_ID}
                label="Langue d’origine des textes"
                aria-label="Langue d’origine des textes"
                value={sourceCode}
                disabled={busy}
                onValueChange={setSourceLanguage}
                items={LOCALE_CATALOG.map((entry) => ({
                  value: entry.code,
                  label: `${entry.name} · ${entry.code}`,
                }))}
              />

              <div className="flex flex-col gap-2 border-t pt-3">
                <SelectField
                  id={ADD_FIELD_ID}
                  label="Langue à ajouter"
                  aria-label="Langue à ajouter"
                  value={addCode}
                  disabled={busy || availableEntries.length === 0}
                  onValueChange={setPendingAddCode}
                  items={availableEntries.map((entry) => ({
                    value: entry.code,
                    label: `${entry.name} · ${entry.code}`,
                  }))}
                />
                <Button
                  variant="default"
                  onClick={addSelected}
                  disabled={busy || locales.length >= MAX_PROJECT_LOCALES || !addCode}
                >
                  <Plus aria-hidden />
                  Ajouter
                </Button>
              </div>

              {locales.length > 0 && (
                <RadioGroup
                  className="gap-1.5 border-t pt-3"
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
                <Button variant="outline" onClick={() => setConfirmingDelete(true)} disabled={busy}>
                  <Trash2 aria-hidden />
                  Supprimer
                </Button>
              </div>

              <details className="rounded-md border px-3 py-2">
                <summary className="flex cursor-pointer select-none items-center gap-2 text-xs font-medium text-foreground marker:text-muted-foreground hover:text-foreground">
                  <span>Qui traduit</span>
                  <span className="font-normal text-muted-foreground">{provider.label}</span>
                  {writerStatus && (
                    <span className="ml-auto font-normal text-muted-foreground">
                      {writerStatus}
                    </span>
                  )}
                </summary>
                <div className="mt-3">
                  <AssistantSetup
                    providerId={assistant.providerId}
                    onProvider={assistant.pickProvider}
                    secret={assistant.secret}
                    onSecret={assistant.setSecret}
                    connection={assistant.connection}
                    onConnect={() => void assistant.connect()}
                    onForget={assistant.forgetSecret}
                    model={assistant.model}
                    onModel={assistant.setModel}
                    busy={busy}
                  />
                </div>
              </details>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="default"
                  onClick={() => void translate()}
                  loading={busy}
                  disabled={busy || Boolean(unavailable) || layers.length === 0}
                >
                  <Languages aria-hidden />
                  {unreviewed > 0
                    ? `Traduire ${unreviewed === 1 ? 'le texte non relu' : `les ${unreviewed} textes non relus`}`
                    : 'Tout retraduire'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void proofread()}
                  loading={busy}
                  disabled={busy || Boolean(unavailable) || layers.length === 0}
                >
                  <SpellCheck aria-hidden />
                  Corriger l’orthographe des textes d’origine
                </Button>
                {locales.length > 1 && (
                  <Button
                    variant="outline"
                    onClick={() => void translateAll()}
                    loading={busy}
                    disabled={busy || Boolean(unavailable) || layers.length === 0}
                  >
                    <Languages aria-hidden />
                    Traduire toutes les langues
                  </Button>
                )}
              </div>
              {unavailable && <p className="text-xs text-muted-foreground">{unavailable}</p>}

              {/* En-tête de colonnes. Sans elle, chaque ligne montrait deux textes
                  — le nom du calque à gauche, l'original en gris à droite, la
                  traduction dans le champ — et rien ne disait lequel était
                  lequel : on relit une traduction sans savoir ce qu'elle traduit. */}
              <div className="flex items-baseline justify-between gap-2 border-t pt-4">
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

      {locale && (
        <ConfirmAction
          open={confirmingDelete}
          onOpenChange={setConfirmingDelete}
          title={`Supprimer la langue « ${locale.name} » ?`}
          description="Toutes ses traductions disparaissent. La mise en page, les captures et les autres langues ne sont pas touchées."
          confirmLabel="Supprimer la langue"
          onConfirm={() => forgetLocale(locale)}
        />
      )}
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
              'flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs',
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
