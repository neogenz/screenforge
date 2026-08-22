import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  AlertCircle,
  Check,
  ChevronRight,
  History,
  Loader,
  Package,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import {
  addRelease,
  countChanges,
  diffSnapshots,
  freezeRelease,
  removeRelease,
  renderReleaseFiles,
  restoreRelease,
  snapshotOf,
  verifyRelease,
  type LayerChange,
  type ReleaseCheck,
  type RenderProgress,
  type StructuralDiff,
} from '@/lib/release'
import { MAX_PROJECT_RELEASES, MAX_RELEASE_NAME_LENGTH } from '@/lib/project-validation'
import { localeBlocked, localizedLayoutLayers, localizedScreens, reviewLocale } from '@/lib/locale'
import { saveCurrentProject } from '@/lib/storage'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { AsyncPanel, type AsyncState } from '@/components/patterns/async-panel'
import { DialogShell } from '@/components/patterns/dialog-shell'
import { DialogColumns } from '@/components/patterns/dialog-columns'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Hint } from '@/components/patterns/hint'
import { SelectField } from '@/components/patterns/select-field'
import { useProjectStore } from '@/stores/project.store'
import { useUIStore } from '@/stores/ui.store'
import { toast } from '@/stores/toast.store'
import type { Project, Release } from '@/types'

const RELEASE_NAME_FIELD_ID = 'sf-release-name'

/**
 * Les lots livrés, et ce qui a bougé depuis.
 *
 * Une campagne ne se juge pas planche par planche mais d'une release à
 * l'autre : ce qui a changé, ce qui n'aurait pas dû, ce qui doit repartir. La
 * boîte fige un lot (rendu complet, empreintes, instantané cloné), le vérifie
 * en le rejouant, et affiche le diff structurel entre l'instantané et le projet
 * d'aujourd'hui.
 */
export function ReleaseDialog() {
  const showReleaseDialog = useUIStore((state) => state.showReleaseDialog)
  const project = useProjectStore((state) => state.project)

  if (!showReleaseDialog || !project) return null
  return <ReleaseDialogContent project={project} />
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ReleaseDialogContent({ project }: { project: Project }) {
  const close = () => useUIStore.getState().setShowReleaseDialog(false)
  const releases = project.releases ?? []
  const [name, setName] = useState('')
  const [selectedId, setSelectedId] = useState<string | undefined>(
    () => releases[releases.length - 1]?.id,
  )
  /* Vide = la langue du projet. Une release porte la langue qu'elle a rendue :
     sans elle, publier consiste à viser une fiche allemande avec des planches
     dont rien ne dit ce qu'elles contiennent. */
  const [localeCode, setLocaleCode] = useState('')
  const [progress, setProgress] = useState<RenderProgress | null>(null)
  /* Lequel des deux rendus tourne. `progress` dit qu'il s'en fait un, jamais
     lequel : le bouton « Figer » se mettait donc à tourner pendant qu'on
     vérifiait, et le bouton cliqué, lui, ne montrait rien. Un retour d'action
     posé ailleurs que sous le doigt ne se lit pas comme un retour d'action. */
  const [running, setRunning] = useState<'freeze' | 'verify' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [checks, setChecks] = useState<{ releaseId: string; results: ReleaseCheck[] } | null>(null)
  /* Le rapport de vérification est la seule chose de cette boîte qui se
     calcule vraiment (un rendu réseau-bound) : lui seul porte un état
     d'échec distinct, retentable sans perdre le reste de la boîte. */
  const [verifyError, setVerifyError] = useState<string | null>(null)

  const selected =
    releases.find((release) => release.id === selectedId) ?? releases[releases.length - 1]
  const busy = progress !== null

  /* Dérivé de son propre lot, pas vérifié par un rendu : un diff structurel
     est une comparaison pure entre deux instantanés déjà en mémoire, donc
     calculable pour chaque lot de la liste sans coût réseau — à la différence
     du bouton « Vérifier », qui rejoue vraiment le rendu. */
  const releaseDiffs = useMemo(() => {
    const current = snapshotOf(project)
    return new Map(
      (project.releases ?? []).map((release) => [
        release.id,
        diffSnapshots(release.snapshot, current),
      ]),
    )
  }, [project])

  /* Ce que la dernière vérification a dit de CE lot-ci, ou rien.
     Le verdict vit aussi longtemps que le rapport qu'il résume : changer de
     lot dans la liste le remet à zéro, puisque `checks` porte l'identifiant
     du lot vérifié. Rien à minuter, rien à nettoyer. */
  const verdict: Verdict =
    checks && selected && checks.releaseId === selected.id
      ? checks.results.every((result) => result.status === 'ok')
        ? 'ok'
        : 'drift'
      : null

  const verifyState: AsyncState =
    running === 'verify'
      ? 'pending'
      : verifyError
        ? 'failed'
        : checks && selected && checks.releaseId === selected.id
          ? 'ready'
          : 'idle'

  const diff: StructuralDiff | null = selected ? (releaseDiffs.get(selected.id) ?? null) : null

  async function freeze() {
    if (busy) return
    setError(null)
    setChecks(null)
    const locale = (project.locales ?? []).find((entry) => entry.code === localeCode)
    /* Un lot ne se fige pas sur une langue qui déborde : ce qui est figé finit
       chez Apple, et une accroche hors cadre y arrive telle quelle. */
    if (locale && localeBlocked(reviewLocale(project, locale))) {
      setError(`« ${locale.name} » a des textes à corriger : figez-la depuis « Langues ».`)
      return
    }
    setRunning('freeze')
    const snapshot = locale
      ? snapshotOf({
          ...project,
          screens: localizedScreens(project, locale),
          layoutLayers: localizedLayoutLayers(project, locale),
        })
      : snapshotOf(project)
    try {
      const files = await renderReleaseFiles(snapshot, setProgress)
      const release = freezeRelease(
        crypto.randomUUID(),
        name.trim() || `Lot du ${formatDate(Date.now())}`,
        snapshot,
        files,
        Date.now(),
        locale?.code,
      )
      const outcome = addRelease(release)
      if (!outcome.committed) {
        setError(`Maximum de ${MAX_PROJECT_RELEASES} releases atteint pour ce projet.`)
        return
      }
      setSelectedId(release.id)
      setName('')
      /* Durable avant d'être annoncé. L'autosave attend deux secondes ; un
         rechargement dans cet intervalle effacerait un rendu que l'utilisateur
         vient d'attendre, et une release perdue n'est pas une modification
         perdue — c'est le fait daté sur lequel tout le reste s'appuie. */
      await saveCurrentProject()
      toast(
        `Release « ${release.name} » figée : ${files.length} écran${files.length > 1 ? 's' : ''}.`,
        'success',
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Le rendu de la release a échoué.')
    } finally {
      setProgress(null)
      setRunning(null)
    }
  }

  async function verify(release: Release) {
    if (busy) return
    setError(null)
    setVerifyError(null)
    setChecks(null)
    setRunning('verify')
    try {
      const results = await verifyRelease(release, setProgress)
      setChecks({ releaseId: release.id, results })
    } catch (cause) {
      setVerifyError(cause instanceof Error ? cause.message : 'La vérification a échoué.')
    } finally {
      setProgress(null)
      setRunning(null)
    }
  }

  function forget(release: Release) {
    if (busy) return
    if (!removeRelease(release.id).committed) return
    setChecks(null)
    setSelectedId(undefined)
    toast(`Release « ${release.name} » retirée.`, 'success')
  }

  /* Reprendre, pas restaurer : le mot « restaurer » promet un retour dans le
     temps, or les autres lots, les langues et l'historique restent là. Un seul
     pas d'annulation, comme toute écriture qui passe par la transaction — c'est
     ce qui rend le geste essayable plutôt qu'engageant. */
  function resume(release: Release) {
    if (busy) return
    const outcome = restoreRelease(release)
    if (!outcome.committed) {
      setError('Cette release ne contient aucun écran : rien à reprendre.')
      return
    }
    setError(null)
    toast(`Projet repris sur « ${release.name} ». ⌘Z pour revenir.`, 'success')
  }

  return (
    <DialogShell
      open
      onClose={busy ? () => undefined : close}
      title="Releases"
      size="lg"
      flush
      headerActions={
        /* « 0/20 » se lit comme un score de test. Le compteur dit ce qu'il
           compte, et le lecteur d'écran en entend la phrase entière. */
        <span
          className="tabular-nums text-xs text-muted-foreground px-1"
          aria-label={`${releases.length} release${releases.length > 1 ? 's' : ''} sur ${MAX_PROJECT_RELEASES}`}
        >
          {releases.length} release{releases.length > 1 ? 's' : ''} sur {MAX_PROJECT_RELEASES}
        </span>
      }
      footerNote="Une release figée ne change plus : c’est elle que « Publier chez Apple » envoie, et elle que « Reprendre » ramène."
      footer={
        <Button variant="outline" onClick={close} disabled={busy}>
          Fermer
        </Button>
      }
    >
      <DialogColumns
        railLabel="Releases figées"
        contentLabel="Détail de la release"
        rail={
          <>
            <div className="flex flex-col gap-1.5">
              <Field className="gap-1.5">
                <FieldLabel htmlFor={RELEASE_NAME_FIELD_ID}>Nom de la release</FieldLabel>
                <Input
                  id={RELEASE_NAME_FIELD_ID}
                  value={name}
                  maxLength={MAX_RELEASE_NAME_LENGTH}
                  placeholder="1.4.0"
                  disabled={busy}
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>
              <SelectField
                aria-label="Langue de la release"
                label="Langue"
                value={localeCode}
                disabled={busy}
                onValueChange={setLocaleCode}
                items={[
                  { value: '', label: 'Langue du projet' },
                  ...(project.locales ?? []).map((entry) => ({
                    value: entry.code,
                    label: entry.name,
                  })),
                ]}
              />
              <Button
                variant="default"
                onClick={() => void freeze()}
                loading={running === 'freeze'}
                disabled={busy || releases.length >= MAX_PROJECT_RELEASES}
              >
                <Package size={12} aria-hidden />
                Figer une release
              </Button>
              {/* Ce que le bouton produit, au moment de l'appuyer. Le rendu
                  complet prend plusieurs secondes : savoir ce qu'on attend
                  change ce qu'on comprend de l'attente. */}
              <p className="text-xs text-muted-foreground">
                {project.screens.length > 1
                  ? `Rend les ${project.screens.length} écrans et retient leurs empreintes.`
                  : 'Rend l’écran et retient son empreinte.'}
              </p>
            </div>

            {releases.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucune release figée pour l’instant.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {[...releases].reverse().map((release) => {
                  const current = release.id === selected?.id
                  const identical = releaseDiffs.get(release.id)?.identical ?? false
                  return (
                    <li key={release.id}>
                      <Card
                        render={
                          <button
                            type="button"
                            onClick={() => setSelectedId(release.id)}
                            aria-current={current}
                          />
                        }
                        className={cn(
                          'w-full gap-1 p-3 text-start shadow-none outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          current ? 'border-foreground bg-muted' : 'hover:border-input',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate text-sm text-foreground">
                            {release.name}
                          </span>
                          {/* Dérivé du projet vivant, jamais du rendu propre à la
                              release — c'est un diff structurel, pas ce que
                              « Vérifier » répond. */}
                          <Badge variant={identical ? 'success' : 'outline'} size="sm">
                            {identical ? 'à jour' : 'dérivé'}
                          </Badge>
                        </div>
                        <span className="tabular-nums text-xs text-muted-foreground">
                          {formatDate(release.createdAt)} · {release.files.length} écrans
                          {release.locale ? ` · ${release.locale}` : ''}
                        </span>
                      </Card>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        }
      >
        {progress && (
          <div className="mb-4" aria-live="polite">
            <div className="mb-2 flex items-center gap-2">
              <Loader size={13} className="animate-spin text-foreground" aria-hidden />
              <span className="text-xs text-foreground">{progress.label}</span>
              <span className="tabular-nums ml-auto text-xs text-muted-foreground">
                {progress.current}/{progress.total}
              </span>
            </div>
            <div className="h-0.5 overflow-hidden bg-border">
              <div
                className="h-full bg-foreground transition-[width] duration-300 ease-out"
                style={{ width: `${(progress.current / Math.max(1, progress.total)) * 100}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <Alert variant="error" className="mb-4">
            <AlertCircle aria-hidden />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!selected ? (
          <WhyFreeze open />
        ) : (
          <div className="flex flex-col gap-4">
            <WhyFreeze />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-medium">{selected.name}</h3>
                <p className="tabular-nums mt-1 text-xs text-muted-foreground">
                  {formatDate(selected.createdAt)} · {selected.files.length} écrans
                  {selected.watermarked ? ' · filigrané' : ''}
                </p>
              </div>
              {/* Enroulable, et non `shrink-0` : à trois boutons, la rangée
                  demandait plus que les ~300px utiles d'une fenêtre de 375, et
                  un groupe qui refuse de rétrécir déborde au lieu de passer à
                  la ligne. */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Le résultat revient sur le bouton, pas seulement plus bas.
                    Le rapport existait déjà et disait vrai ; il apparaissait à
                    deux cents pixels du doigt, pour une opération qui dure
                    moins d'une seconde — cliquer ne produisait rien là où l'œil
                    se trouvait. L'écusson devient une coche verte, et le
                    libellé nomme ce qui vient d'être appris. */}
                <Hint
                  content={
                    verdict === 'ok'
                      ? 'Cette release vient de se rejouer à l’identique. Cliquez pour recommencer.'
                      : 'Rejoue l’instantané figé et recompare les empreintes, pour savoir si cette release se rend encore à l’identique.'
                  }
                >
                  <Button
                    variant="outline"
                    onClick={() => void verify(selected)}
                    loading={running === 'verify'}
                    disabled={busy}
                  >
                    {running !== 'verify' && <VerdictIcon verdict={verdict} />}
                    {verdict === 'ok' ? 'Vérifié' : verdict === 'drift' ? 'A dérivé' : 'Vérifier'}
                  </Button>
                </Hint>
                <Hint
                  content={
                    diff?.identical
                      ? 'Le projet est déjà dans cet état.'
                      : 'Ramène les écrans et les réglages du projet dans l’état de cette release. La release, elle, ne bouge pas.'
                  }
                >
                  <Button
                    variant="outline"
                    onClick={() => resume(selected)}
                    disabled={busy || diff?.identical}
                  >
                    <RotateCcw size={12} aria-hidden />
                    Reprendre
                  </Button>
                </Hint>
                <Button variant="outline" onClick={() => forget(selected)} disabled={busy}>
                  <Trash2 size={12} aria-hidden />
                  Retirer
                </Button>
              </div>
            </div>

            {/* Ce que « Vérifier » répond, et ce qu'il ne garde pas.
                Le bouton nommait son mécanisme sans nommer sa question, et la
                question est la seule chose qu'on ne peut pas deviner : un lot
                figé ne bouge pas, mais ce qui le fabrique, si — une police
                Google qui ne se charge plus, un cadre d'appareil remplacé par
                une mise à jour, une capture perdue de la base locale. Rien de
                tout cela ne se voit dans le projet.

                La deuxième phrase est le fait qui manquait vraiment : publier
                refait ce contrôle et refuse un lot qui a dérivé. « Vérifier »
                ne verrouille donc rien — il permet de l'apprendre maintenant
                plutôt qu'au moment de l'envoi, et sur un lot qu'on n'a pas
                l'intention de publier aujourd'hui. Le taire laissait croire à
                une étape obligatoire dont personne ne voyait l'effet. */}
            <p className="text-xs text-muted-foreground">
              «&nbsp;Vérifier&nbsp;» refabrique les {selected.files.length} écrans de cette release
              et recompare leurs empreintes : c’est ce qui dit si une police disparue ou un cadre
              d’appareil remplacé l’a changé depuis. Publier refait ce contrôle et refuse une
              release qui a dérivé — vérifier sert à l’apprendre avant.
            </p>

            {/* `idle` : personne n'a encore cliqué « Vérifier » sur ce lot — rien
                à montrer, le bouton au-dessus porte déjà l'explication. */}
            <AsyncPanel
              state={verifyState}
              failedTitle="La vérification n’a pas pu se rejouer."
              failedMessage={verifyError ?? undefined}
              onRetry={() => void verify(selected)}
              retryLabel="Reprendre la vérification"
            >
              {checks && checks.releaseId === selected.id && (
                <VerifyReport results={checks.results} />
              )}
            </AsyncPanel>
            {diff && <DiffReport diff={diff} />}
          </div>
        )}
      </DialogColumns>
    </DialogShell>
  )
}

/** Ce qu'une vérification a conclu sur le lot affiché, ou rien tant qu'aucune n'a tourné. */
type Verdict = 'ok' | 'drift' | null

/**
 * L'écusson du bouton « Vérifier », qui devient le verdict.
 *
 * La coche entre en fondu-échelle : un changement d'icône sans transition se
 * lit comme un défaut d'affichage, alors que l'entrée dit « ceci vient
 * d'arriver, à cause de votre clic ». Le mouvement tombe sous
 * `prefers-reduced-motion`, où `animate-mark` se réduit au fondu — le sens
 * est porté par la couleur *et* par le libellé, jamais par l'animation.
 */
function VerdictIcon({ verdict }: { verdict: Verdict }) {
  if (verdict === 'ok') {
    return <Check size={12} aria-hidden className="animate-mark text-success" />
  }
  if (verdict === 'drift') {
    return <AlertCircle size={12} aria-hidden className="animate-mark text-warning" />
  }
  return <ShieldCheck size={12} aria-hidden />
}

/**
 * À quoi sert de figer, écrit une fois et lisible depuis les deux états.
 *
 * La boîte montrait le geste (« Figer ») sans jamais montrer ce qu'il ouvrait :
 * le figement seul ressemble à une archive morte, et rien n'y disait que
 * publier consomme une release, ni qu'on peut y revenir. Les quatre lignes sont
 * les quatre choses qu'une release permet, dans l'ordre où on les rencontre.
 */
/**
 * La même explication, à un seul endroit et repliable.
 *
 * Elle ne vivait que dans la branche vide, et la boîte sélectionne toujours une
 * release à l'ouverture : quiconque en avait déjà figé une ne l'a jamais lue,
 * ce qui est très exactement la question qu'on nous a reposée avec une capture
 * à l'appui. Un `details` natif plutôt qu'un état : refermé, il ne coûte qu'une
 * ligne à qui sait déjà, et il n'a rien à resynchroniser quand on change de
 * release. Ouvert tant qu'aucune release n'existe, replié ensuite.
 */
function WhyFreeze({ open }: { open?: boolean }) {
  return (
    <details className="group/why" {...(open ? { open: true } : {})}>
      <summary className="flex list-none items-center gap-1.5 text-xs text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground [&::-webkit-details-marker]:hidden">
        <ChevronRight
          size={12}
          strokeWidth={1.75}
          aria-hidden
          className="shrink-0 transition-transform duration-150 ease-out group-open/why:rotate-90"
        />
        À quoi sert de figer une release
      </summary>
      <div className="mt-3">
        <FreezeReasons />
      </div>
    </details>
  )
}

function FreezeReasons() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Un projet bouge tous les jours ; une livraison App Store, non. Une release est la photo
        datée de ce que vous avez décidé de livrer — le projet continue de vivre à côté, sans jamais
        la modifier.
      </p>
      <ul className="flex flex-col gap-2">
        <ReasonLine>
          <strong className="text-foreground">Publier ce que vous avez relu.</strong> «&nbsp;Publier
          chez Apple&nbsp;» part d’une release, jamais du projet vivant : ce qui monte est ce que
          vous avez vu, même si vous avez déplacé un titre entre-temps.
        </ReasonLine>
        <ReasonLine>
          <strong className="text-foreground">Vérifier plus tard qu’elle tient.</strong> La release
          est rejouée et ses empreintes recomparées. Une police qui ne se charge plus, un cadre
          d’appareil remplacé : ça se voit avant l’envoi, pas après.
        </ReasonLine>
        <ReasonLine>
          <strong className="text-foreground">Voir ce qui a bougé depuis.</strong> Écran par écran,
          calque par calque, propriété par propriété — pour décider ce qui mérite une nouvelle
          livraison.
        </ReasonLine>
        <ReasonLine>
          <strong className="text-foreground">Y revenir.</strong> «&nbsp;Reprendre&nbsp;» ramène le
          projet dans l’état de la release, en un seul pas d’annulation. Deux semaines d’essais se
          défont sans compter les ⌘Z.
        </ReasonLine>
      </ul>
    </div>
  )
}

/**
 * Une raison de figer.
 *
 * Sans puce : le citron dit « vous êtes ici » — écran courant, calque
 * sélectionné, anneau de focus — et le point du rapport de diff le tient
 * encore, puisqu'il marque ce qui a changé. Quatre points identiques sous une
 * explication qui ne change jamais n'est plus un état, c'est un ornement, et
 * c'est exactement ce que la règle du marqueur interdit. La phrase en gras
 * ouvre chaque ligne : elle suffit à les faire scanner.
 */
function ReasonLine({ children }: { children: ReactNode }) {
  return <li className="text-xs text-muted-foreground">{children}</li>
}

/**
 * Ce que la vérification a trouvé.
 *
 * Une release qui se rejoue à l'identique n'a rien à raconter — une ligne
 * suffit. Ce qui mérite d'être lu est ce qui a changé, donc seules ces
 * planches-là sont listées.
 */
function VerifyReport({ results }: { results: ReleaseCheck[] }) {
  const broken = results.filter((result) => result.status !== 'ok')

  return (
    <div className="border-t border-border pt-4" aria-live="polite">
      <h3 className="text-sm font-medium">Vérification</h3>
      {broken.length === 0 ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-foreground">
          <Check size={13} className="text-success" aria-hidden />
          Les {results.length} écrans se rejouent à l’identique : cette release est encore publiable
          telle quelle.
        </p>
      ) : (
        <>
          <ul className="mt-2 flex flex-col gap-1.5">
            {broken.map((result) => (
              <li key={result.path} className="flex items-start gap-2 text-xs text-warning">
                <AlertCircle size={13} className="mt-px shrink-0" aria-hidden />
                <span className="min-w-0">
                  <span className="tabular-nums">{result.path}</span>
                  {' — '}
                  {result.status === 'changed' ? 'empreinte différente' : 'rendu impossible'}
                  {result.detail ? ` (${result.detail})` : ''}
                </span>
              </li>
            ))}
          </ul>
          {/* Le constat sans la suite laissait l'utilisateur devant deux
              empreintes tronquées. Ce qu'il lui faut savoir tient en deux
              faits : l'envoi est fermé pour ce lot, et un lot n'est jamais
              réparé — il est remplacé, puisque sa date est ce qu'il atteste. */}
          <p className="mt-2 text-xs text-muted-foreground">
            Publier refusera cette release. Une release ne se répare pas : reprenez-la si vous
            voulez retrouver cet état, puis figez-en une nouvelle.
          </p>
        </>
      )}
    </div>
  )
}

/** Le vocabulaire du modèle, dit en français quand il en existe un. */
const PROP_LABELS: Record<string, string> = {
  x: 'position X',
  y: 'position Y',
  width: 'largeur',
  height: 'hauteur',
  rotation: 'rotation',
  opacity: 'opacité',
  visible: 'visibilité',
  locked: 'verrouillage',
  zIndex: 'ordre',
  name: 'nom',
  content: 'texte',
  textAlign: 'alignement',
  fontFamily: 'police',
  fontSize: 'corps',
  fontWeight: 'graisse',
  color: 'couleur',
  fill: 'remplissage',
  screenshotAssetId: 'capture',
  screenshotSize: 'taille de capture',
  placement: 'cadrage',
  slot: 'rôle',
  deviceModel: 'modèle',
  deviceColor: 'teinte',
  assetId: 'image',
  iconId: 'icône',
  shapeType: 'forme',
}

function propLabel(prop: string): string {
  return PROP_LABELS[prop] ?? prop
}

function LayerLine({ change }: { change: LayerChange }) {
  const verb = change.kind === 'added' ? 'ajouté' : change.kind === 'removed' ? 'retiré' : 'modifié'
  return (
    <li className="flex items-baseline gap-2 text-xs text-muted-foreground">
      <span
        aria-hidden
        className={cn(
          'size-1.5 shrink-0 translate-y-px rounded-full',
          change.kind === 'removed' ? 'bg-destructive' : 'bg-marker',
        )}
      />
      <span className="min-w-0">
        <span className="text-foreground">{change.name}</span> {verb}
        {change.props.length > 0 ? ` : ${change.props.map(propLabel).join(', ')}` : ''}
      </span>
    </li>
  )
}

function DiffReport({ diff }: { diff: StructuralDiff }) {
  const total = countChanges(diff)

  return (
    <div className="border-t border-border pt-4">
      <h3 className="text-sm font-medium">Depuis cette release</h3>
      {diff.identical ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-foreground">
          <History size={13} aria-hidden />
          Le projet est exactement dans l’état figé.
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs text-muted-foreground">
            {total} changement{total > 1 ? 's' : ''} structurel{total > 1 ? 's' : ''}.
          </p>
          <div className="mt-3 flex flex-col gap-3">
            {diff.projectRenamed && (
              <p className="text-xs text-muted-foreground">
                Projet renommé : {diff.projectRenamed.from} → {diff.projectRenamed.to}
              </p>
            )}
            {diff.screens.map((screen) => (
              <div key={screen.screenId}>
                <p className="text-sm text-foreground">
                  {screen.name}
                  {screen.added && ' — ajouté'}
                  {screen.removed && ' — retiré'}
                  {screen.renamedFrom && ` — renommé depuis « ${screen.renamedFrom} »`}
                  {screen.backgroundChanged && ' — fond modifié'}
                </p>
                {screen.layers.length > 0 && (
                  <ul className="mt-1 flex flex-col gap-1">
                    {screen.layers.map((change) => (
                      <LayerLine key={change.layerId} change={change} />
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {diff.layoutLayers.length > 0 && (
              <div>
                <p className="text-sm text-foreground">Calques partagés</p>
                <ul className="mt-1 flex flex-col gap-1">
                  {diff.layoutLayers.map((change) => (
                    <LayerLine key={change.layerId} change={change} />
                  ))}
                </ul>
              </div>
            )}
            {diff.globals.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Réglages globaux : {diff.globals.map(propLabel).join(', ')}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
