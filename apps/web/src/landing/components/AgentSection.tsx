import { useLang } from '../i18n'
import { AgentSession } from './AgentSession'
import { SectionHeading } from './SectionHeading'

/*
 * La moitié IA du produit, en pleine section. Elle vivait en quatrième onglet
 * des fonctionnalités, entre « Actualiser » et « Exporter », et s'y lisait
 * comme un détail de l'éditeur : c'est pourtant la seule chose que personne
 * d'autre ne propose — un agent qui compose la fiche dans l'éditeur ouvert.
 *
 * Trois voies, dans l'ordre où le produit les tient : l'agent par MCP (la
 * vitrine), le brief depuis l'éditeur (Claude Code, clé Anthropic ou
 * OpenRouter), et sans IA du tout — qui reste le défaut de l'éditeur, et la
 * section le dit plutôt que de le taire. La marche à suivre tient en trois
 * lignes parce qu'elle tient vraiment en trois lignes ; le reste est dans le
 * README de `apps/mcp`.
 */

/* Même valeur que `MCP_COMMAND` dans `lib/mcp/client.ts`. Importer le client
   tirerait les stores de l'éditeur dans la vitrine ; la ligne est courte et
   `landing-copy.test.ts` la tient en phase. */
const COMMAND = 'pnpm --filter mcp run start'

function withCommand(text: string) {
  const at = text.indexOf(COMMAND)
  if (at < 0) return text
  return (
    <>
      {text.slice(0, at)}
      <code className="rounded-sm bg-card px-1.5 py-0.5 font-mono text-xs text-foreground">
        {COMMAND}
      </code>
      {text.slice(at + COMMAND.length)}
    </>
  )
}

export function AgentSection() {
  const { t } = useLang()
  const a = t.agent

  return (
    <section
      id="agent"
      aria-labelledby="agent-title"
      className="scroll-mt-20 border-b border-border/60 bg-background px-5 py-20 md:px-14 md:py-28"
    >
      <div className="mx-auto max-w-7xl">
        <SectionHeading id="agent-title">{a.heading}</SectionHeading>
        <p className="mx-auto mt-6 max-w-[65ch] text-center text-[15px] leading-6 text-muted-foreground">
          {a.sub}
        </p>

        <div className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start lg:gap-16">
          {/* La figure colle sous la barre pendant que la colonne de droite
              défile : elle est deux fois moins haute que ce qu'elle illustre,
              et une session qui rejoue hors champ ne prouve rien. */}
          <div className="lg:sticky lg:top-24">
            <AgentSession />
          </div>

          <div>
            <ol className="flex flex-col divide-y divide-border/60 border-y border-border/60">
              {a.ways.map((way, i) => (
                <li key={way.title} className="grid gap-2 py-5 sm:grid-cols-[2.5rem_minmax(0,1fr)]">
                  <span aria-hidden className="font-mono text-2xs text-marker">
                    0{i + 1}
                  </span>
                  <div>
                    <h3 className="text-base font-medium">{way.title}</h3>
                    <p className="mt-2 text-sm leading-5 text-muted-foreground">{way.body}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-8">
              <h3 className="text-base font-medium">{a.setupTitle}</h3>
              <ol className="mt-3 flex flex-col gap-2 text-sm leading-5">
                {a.setupSteps.map((step, i) => (
                  <li key={step} className="flex gap-3">
                    <span className="tabular w-4 shrink-0 font-mono text-2xs text-muted-foreground">
                      {i + 1}
                    </span>
                    <span>{withCommand(step)}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-xs leading-4 text-muted-foreground">{a.setupNote}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
