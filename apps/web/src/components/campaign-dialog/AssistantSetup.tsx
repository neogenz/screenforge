import { useEffect, useState } from 'react'
import { AlertCircle, Check, ExternalLink, Plug, RefreshCw, Trash2 } from 'lucide-react'
import { probeBridge } from '@/lib/bridge-client'
import { AI_PROVIDERS, BRIDGE_COMMAND, aiProvider, bridgeReachable } from '@/lib/ai/providers'
import type { AiProvider, ProviderId } from '@/lib/ai/providers'
import type { AssistantConnection } from '@/lib/ai/session'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { SetupCommand, SetupFlow, SetupProgress, SetupStep } from '@/components/ui/setup-flow'

/**
 * Brancher un modèle, marche par marche.
 *
 * Ce qui existait avant : un paragraphe qui nommait une commande, un champ
 * « jeton », un bouton. Trois choses vraies, aucune séquence. L'utilisateur
 * collait un jeton qu'il n'avait pas pour apprendre, par un message d'erreur,
 * qu'un pont qu'il ne connaissait pas n'était pas lancé.
 *
 * Trois principes, et chacun corrige une de ces trois choses :
 *
 * **Ce qui peut être constaté n'est pas demandé.** `hello` répond sans jeton :
 * la page sait donc si le pont tourne et quels assistants la machine porte,
 * avant que quiconque ne colle quoi que ce soit. L'étape 1 est un état, pas une
 * consigne — et son bouton relit cet état plutôt que de faire recharger la page.
 *
 * **Une seule étape est active à la fois.** Les suivantes sont visibles et
 * inertes : voir qu'il y en aura trois vaut mieux que les découvrir une à une,
 * mais un champ « jeton » actif avant que le pont ne tourne ne peut rien faire
 * d'autre qu'échouer.
 *
 * **Le coût est annoncé avant l'installation, pas après.** Les deux chemins du
 * pont ne demandent aucune clé et rien ne quitte la machine ; les deux chemins
 * à clé ne demandent rien à installer et facturent le brief. C'est la seule
 * chose qui décide vraiment, donc elle est lisible au moment du choix.
 */

const SECRET_FIELD_ID = 'sf-assistant-secret'
const MODEL_FIELD_ID = 'sf-assistant-model'

/**
 * Au-delà de ce compte, la liste se filtre au lieu de se parcourir.
 *
 * Anthropic rend une dizaine de modèles, qui tiennent dans une liste déroulante
 * qu'on lit d'un coup d'œil. OpenRouter en rend plusieurs centaines : la même
 * liste devient un mur qu'il faut faire défiler en connaissant déjà le nom
 * cherché, ce qui est exactement ce qu'un champ de saisie avec autocomplétion
 * fait mieux.
 */
const BROWSABLE_MODELS = 40

const PROVIDER_NAMES: Record<ProviderId, string> = {
  local: 'Sans IA',
  'claude-bridge': 'Claude Code',
  anthropic: 'Anthropic',
  openrouter: 'OpenRouter',
}

/** Ce que le pont dit de lui-même : constaté, jamais demandé. */
type BridgeProbe = { state: 'up'; engines: string[] } | { state: 'down'; message: string }

/** Le sondage réduit à ce que la marche affiche : joignable, et avec quoi. */
function readProbe(answer: Awaited<ReturnType<typeof probeBridge>>): BridgeProbe {
  return answer.state === 'up'
    ? { state: 'up', engines: answer.hello.engines.map((entry) => entry.id) }
    : { state: 'down', message: answer.message }
}

interface AssistantSetupProps {
  providerId: ProviderId
  onProvider: (id: ProviderId) => void
  secret: string
  onSecret: (value: string) => void
  connection: AssistantConnection
  onConnect: () => void
  /** Retire le secret d'ici et du disque. */
  onForget: () => void
  model: string
  onModel: (value: string) => void
  busy: boolean
}

/** Une adresse à ouvrir, jamais un tutoriel recopié qui se périmera ici. */
function Away({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
    >
      {children}
      <ExternalLink size={10} aria-hidden />
    </a>
  )
}

function ProviderChoice({
  entry,
  active,
  disabled,
  unavailable,
  onPick,
}: {
  entry: AiProvider
  active: boolean
  disabled: boolean
  unavailable?: string
  onPick: () => void
}) {
  const meta =
    entry.transport === 'in-process'
      ? 'Local · sans compte'
      : entry.transport === 'local-bridge'
        ? 'Sur cet ordinateur · sans clé'
        : 'En ligne · votre clé'

  return (
    <label
      className={cn(
        'relative flex cursor-pointer flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md border px-3 py-1.5 text-left text-2xs transition-colors',
        'has-[:focus-visible]:outline-none has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-ring',
        disabled && 'cursor-not-allowed opacity-50',
        active ? 'border-foreground bg-muted' : 'border-border hover:border-input',
      )}
    >
      <input
        type="radio"
        name="screenforge-ai-provider"
        aria-label={entry.label}
        value={entry.id}
        checked={active}
        disabled={disabled}
        onChange={onPick}
        className="absolute inset-0 size-full cursor-pointer opacity-0 outline-none disabled:cursor-not-allowed"
      />
      <span className="flex items-center gap-1.5 text-foreground">
        {active && <Check size={11} aria-hidden />}
        {PROVIDER_NAMES[entry.id]}
        {entry.recommended && <span className="text-muted-foreground">· par défaut</span>}
      </span>
      <span className="ml-auto shrink-0 text-muted-foreground">{meta}</span>
      {unavailable && (
        <span className="flex basis-full items-start gap-1 text-warning">
          <AlertCircle size={11} className="mt-0.5 shrink-0" aria-hidden />
          {unavailable}
        </span>
      )}
    </label>
  )
}

export function AssistantSetup({
  providerId,
  onProvider,
  secret,
  onSecret,
  connection,
  onConnect,
  onForget,
  model,
  onModel,
  busy,
}: AssistantSetupProps) {
  const active = aiProvider(providerId)
  const viaBridge = active.transport === 'local-bridge'
  const reachable = bridgeReachable()

  /**
   * Le résultat du sondage, marqué du fournisseur auquel il répond.
   *
   * Marqué et non remis à zéro : « en cours » est alors *dérivé* au rendu — un
   * résultat qui ne porte pas le fournisseur affiché n'est plus une réponse.
   * L'alternative, écrire `checking` dans l'effet, fait un rendu en cascade que
   * React signale à juste titre, et laisse une fenêtre pendant laquelle la page
   * affirme avoir trouvé un autre état alors qu'on vient de demander Claude Code.
   */
  const [probe, setProbe] = useState<{ for: ProviderId; result: BridgeProbe } | null>(null)
  const found = probe?.for === providerId ? probe.result : null

  /**
   * Le pont est sondé dès qu'un fournisseur qui en dépend est choisi.
   *
   * Sans jeton, sans coût et sans effet de bord : `hello` ne fait qu'annoncer.
   * C'est ce qui permet à la première marche d'afficher un résultat au moment où
   * l'utilisateur la lit, plutôt qu'après qu'il a tenté quelque chose.
   */
  useEffect(() => {
    if (!viaBridge || !reachable) return
    let cancelled = false
    void probeBridge().then((answer) => {
      if (!cancelled) setProbe({ for: providerId, result: readProbe(answer) })
    })
    return () => {
      cancelled = true
    }
  }, [viaBridge, reachable, providerId])

  function recheck() {
    setProbe(null)
    void probeBridge().then((answer) => setProbe({ for: providerId, result: readProbe(answer) }))
  }

  const engineFound = found?.state === 'up' && found.engines.includes(active.engine ?? 'claude')
  /* La première marche est franchie quand ce qu'elle installe répond : le pont
     ET le moteur pour lui, une clé simplement créée pour les services — que la
     clé soit bonne, seule la deuxième marche peut le dire. */
  const readyToPair = viaBridge ? engineFound : true
  const connected = connection.state === 'ready'

  function bridgeStatusLine() {
    if (!found) return 'Recherche du pont…'
    if (found.state === 'down') return found.message
    if (engineFound) return `Pont détecté, avec « ${active.engine} ».`
    return `Pont détecté, mais « ${active.engine} » est introuvable sur cette machine.`
  }

  const bridgeStep = engineFound ? 'done' : found ? 'error' : 'active'
  const connectionStep = connected
    ? 'done'
    : !readyToPair
      ? 'waiting'
      : connection.state === 'error'
        ? 'error'
        : 'active'
  const modelStep = connected ? (model ? 'done' : 'active') : 'waiting'
  const stepCount = viaBridge ? 3 : 2
  const completedSteps = (viaBridge && engineFound ? 1 : 0) + (connected ? 1 : 0) + (model ? 1 : 0)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1" role="radiogroup" aria-label="Qui écrit les accroches">
        {AI_PROVIDERS.map((entry) => (
          <ProviderChoice
            key={entry.id}
            entry={entry}
            active={entry.id === providerId}
            disabled={busy}
            unavailable={
              entry.transport === 'local-bridge' && !reachable
                ? 'Indisponible depuis cette adresse : le pont n’accepte que ScreenForge ouvert en local.'
                : undefined
            }
            onPick={() => onProvider(entry.id)}
          />
        ))}
      </div>

      <SetupFlow>
        <div className="px-3 py-2.5">
          <p className="max-w-[65ch] text-xs text-muted-foreground">{active.summary}</p>
        </div>

        {active.setup && (viaBridge ? reachable : true) && (
          <div className="flex flex-col gap-3 border-t border-border px-3 py-3">
            <SetupProgress
              label={`Configuration de ${active.label}`}
              value={completedSteps}
              max={stepCount}
            />

            {viaBridge && (
              <SetupStep
                rank={1}
                title="Lancez le pont sur votre ordinateur"
                state={bridgeStep}
                result={`Pont détecté, avec « ${active.engine} ».`}
              >
                {/* Où, et pas seulement quoi. La commande était donnée seule, donc
                  copiée puis collée dans le terminal tel qu'il était ouvert :
                  `--filter` ne trouve aucun paquet « bridge » hors de cet espace
                  de travail, et l'échec ressemble à un pont cassé. */}
                <p className="text-2xs text-muted-foreground">
                  Dans un terminal, depuis le dossier où vous avez cloné ScreenForge :
                </p>
                <SetupCommand command={BRIDGE_COMMAND} />
                <p
                  role={found && !engineFound ? 'alert' : 'status'}
                  className={cn(
                    'flex items-start gap-1.5 text-2xs',
                    engineFound ? 'text-muted-foreground' : 'text-warning',
                  )}
                >
                  {found && !engineFound && (
                    <AlertCircle size={11} className="mt-0.5 shrink-0" aria-hidden />
                  )}
                  {bridgeStatusLine()}
                </p>
                {found?.state === 'up' && !engineFound && (
                  <p className="text-2xs text-muted-foreground">
                    {active.setup.requirement}{' '}
                    <Away href={active.setup.requirementHref}>Comment l’installer</Away>
                  </p>
                )}
                <div>
                  <Button variant="default" onClick={recheck} loading={!found} disabled={busy}>
                    <RefreshCw size={12} aria-hidden />
                    Vérifier
                  </Button>
                </div>
              </SetupStep>
            )}

            <SetupStep
              rank={viaBridge ? 2 : 1}
              title={viaBridge ? 'Collez le jeton affiché par le pont' : 'Collez votre clé'}
              state={connectionStep}
              result={
                connection.state === 'ready' ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span role="status">{connection.detail}</span>
                    {active.auth === 'api-key' && secret !== '' && (
                      <Button variant="ghost" size="sm" onClick={onForget} disabled={busy}>
                        <Trash2 size={12} aria-hidden />
                        Oublier cette clé
                      </Button>
                    )}
                  </div>
                ) : undefined
              }
            >
              {!viaBridge && (
                <p className="text-2xs text-muted-foreground">
                  {active.setup.requirement}{' '}
                  <Away href={active.setup.requirementHref}>Ouvrir la page des clés</Away>
                </p>
              )}
              <p className="text-2xs text-muted-foreground">{active.setup.secretHelp}</p>
              <div className="flex items-end gap-2">
                <Field
                  id={SECRET_FIELD_ID}
                  label={active.setup.secretLabel}
                  className="min-w-0 flex-1"
                >
                  <Input
                    id={SECRET_FIELD_ID}
                    font="sans"
                    type="password"
                    autoComplete="off"
                    value={secret}
                    disabled={busy || !readyToPair}
                    placeholder={active.setup.secretPlaceholder}
                    onChange={(event) => onSecret(event.target.value)}
                  />
                </Field>
                <Button
                  variant="default"
                  onClick={onConnect}
                  disabled={busy || !readyToPair || secret.trim().length === 0}
                  loading={connection.state === 'checking'}
                >
                  <Plug size={12} aria-hidden />
                  Connecter
                </Button>
              </div>
              {connection.state === 'error' && (
                <p role="alert" className="flex items-start gap-1.5 text-2xs text-destructive">
                  <AlertCircle size={12} className="mt-0.5 shrink-0" aria-hidden />
                  {connection.message}
                </p>
              )}
              {/* Le retrait n'apparaît que là où il y a quelque chose à retirer :
                seuls les fournisseurs à clé enregistrent, et seulement une clé
                non vide. L'afficher en permanence promettrait un effacement à
                qui n'a rien laissé. */}
              {active.auth === 'api-key' && secret !== '' && (
                <div>
                  <Button variant="ghost" onClick={onForget} disabled={busy}>
                    <Trash2 size={12} aria-hidden />
                    Oublier cette clé
                  </Button>
                </div>
              )}
            </SetupStep>

            <SetupStep
              rank={viaBridge ? 3 : 2}
              title="Choisissez le modèle"
              state={modelStep}
              result={model}
            >
              {connection.state === 'ready' && connection.models.length > BROWSABLE_MODELS ? (
                <>
                  <Field id={MODEL_FIELD_ID} label="Modèle">
                    <Input
                      id={MODEL_FIELD_ID}
                      font="sans"
                      list={`${MODEL_FIELD_ID}-options`}
                      autoComplete="off"
                      value={model}
                      disabled={busy}
                      placeholder="Tapez pour filtrer, ex. anthropic/"
                      onChange={(event) => onModel(event.target.value)}
                    />
                  </Field>
                  <datalist id={`${MODEL_FIELD_ID}-options`}>
                    {connection.models.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.displayName}
                      </option>
                    ))}
                  </datalist>
                  <p className="text-2xs text-muted-foreground">
                    {connection.models.length} modèles disponibles. Tous ne savent pas rendre du
                    JSON strict : en cas d’échec, essayez-en un autre avant de conclure.
                  </p>
                </>
              ) : (
                <Select
                  aria-label="Modèle"
                  label="Modèle"
                  value={model}
                  disabled={busy || !connected}
                  onChange={(event) => onModel(event.target.value)}
                >
                  {connection.state === 'ready' ? (
                    connection.models.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.displayName}
                      </option>
                    ))
                  ) : (
                    <option value="">Après la connexion</option>
                  )}
                </Select>
              )}
            </SetupStep>
          </div>
        )}

        <details
          key={active.id}
          className="border-t border-border px-3 py-2 text-2xs text-muted-foreground"
        >
          <summary className="cursor-pointer select-none font-medium marker:text-muted-foreground hover:text-foreground">
            Données et confidentialité
          </summary>
          <p className="mt-1 max-w-[65ch] pl-3">{active.dataPath}</p>
        </details>
      </SetupFlow>
    </div>
  )
}
