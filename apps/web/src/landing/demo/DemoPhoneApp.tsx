/*
 * L'app à l'intérieur du cadre — trois écrans, pas un.
 *
 * C'était six rectangles gris, puis un seul écran répété sur toutes les
 * planches. Les deux versions ratent la même chose : une planche App Store
 * réelle montre une app qui a l'air finie, et un jeu de planches montre des
 * écrans *différents* qui partagent un traitement. Un même écran dix fois dit
 * exactement l'inverse de ce que le produit fait.
 *
 * Trois écrans d'une même app de sommeil, donc, avec une coque commune (barre
 * d'état, barre d'onglets) et trois corps distincts : le tableau de bord, la
 * liste des nuits, l'objectif. Tout est dimensionné en `cqw`, 1 % de la largeur
 * du cadre : la maquette reste nette et proportionnée que le téléphone fasse
 * 60 px sur un portable ou 120 px sur un grand écran, sans un point de rupture.
 *
 * Une seule échelle verticale, trois pas de rapport 2 : 7cqw sépare deux blocs
 * — c'est le retrait latéral, donc un seul module pour les deux axes —, 3.5cqw
 * sépare deux frères d'une pile, 1.75cqw lie les deux lignes d'un même objet.
 * Avant, les quatre écarts inter-blocs valaient tous 3.5cqw contre 2 à 3cqw en
 * intra-bloc : un rapport de 1,17, donc un seul pas plat où l'écart censé
 * séparer deux blocs ne séparait presque rien, pendant qu'un quart de l'écran
 * restait blanc. Le bloc titre prend le plus petit des trois : à
 * `lineHeight: 0.86` le grand nombre ne porte que 1,5cqw de blanc au-dessus de
 * ses capitales, pas les 2,3 qu'on lui prêtait, et 1,5cqw fait 2,7 px sur un
 * cadre rendu 178 — le sur-titre touchait le chiffre. Écrire 1,75 porte
 * l'écart optique à 3,25cqw, donc sous le pas frère : les deux lignes restent
 * un seul objet, elles cessent de se toucher.
 *
 * Le budget est fermé par le bas et il n'est écrit nulle part ailleurs : le
 * cadre déborde volontairement de la planche (`DEVICE_HEIGHT_PCT` = 74 centré à
 * 74 %, `demo-script.ts`), la coupe tombe à ≈194cqw sous le haut de l'écran
 * (bezel et liseré de dalle déduits, `DemoBoard`), donc il reste ≈181cqw sous
 * le haut du corps une fois la barre d'état déduite, et la barre d'onglets est
 * encore dessous, à 0 % visible. Les trois corps ont été réglés pour atterrir
 * vers 160cqw, quand le cadre était plus petit et coupé plus haut : la
 * vingtaine de cqw d'air qui les sépare maintenant de la coupe est le bas
 * d'un écran d'app, pas un vide à combler. Qui touche à ces deux constantes —
 * ou à la hauteur de la barre d'état — déplace les trois atterrissages.
 *
 * Trois blocs par écran, jamais cinq. Le tableau de bord en portait cinq : un
 * sélecteur de période, une barre de phases, deux lignes de liste génériques
 * en plus du nombre et de la courbe. Sous une coupe fixe, cinq blocs ne se
 * règlent pas en resserrant les écarts, ils se règlent en enlevant des blocs —
 * et la courbe, qui est le sujet, est passée de 29 % du budget à plus de la
 * moitié.
 *
 * Pas de boîte grise autour d'une ligne de liste. Les rangées des Nuits et
 * des Réglages étaient chacune un rectangle `#f7f8fb` contenant une pastille,
 * deux barres de squelette et une valeur : c'est le dessin d'un wireframe,
 * et le hero le montrait en premier. Une liste iOS est un filet entre deux
 * rangées ; une carte n'existe que quand elle porte un chiffre qui se lit
 * (les deux tuiles Coucher / Réveil, le résumé de la semaine). Le graphe est
 * une courbe lissée à aire dégradée, en SVG, et non des barres : sept
 * capsules ancrées en bas laissaient tout le haut gauche du bloc vide et
 * lisaient comme un motif de piles, là où une courbe occupe son cadre et dit
 * « tendance » au premier regard. Aucun libellé en capitales espacées : à
 * cette taille un sur-titre en petites capitales est du bruit, une phrase en
 * bas de casse reste un mot. Le grand nombre écrit ses unités : « 7h 42m »,
 * chiffres en gras et unités en clair, comme Santé, plutôt qu'un « 7h42 »
 * serré qui se lisait comme un code.
 *
 * Ce qui reste abstrait l'est par décision, pas par paresse : à la taille où le
 * cadre est réellement rendu, un mot de six lettres fait quatre pixels de haut
 * et devient une tache. Les libellés qui comptent — le titre, le grand nombre,
 * les initiales des jours — sont écrits ; le reste est de la matière typée à
 * la bonne densité, ce qu'un œil lit comme du texte sans essayer de le lire.
 *
 * L'indigo est délibérément étranger à la palette du site. Ce qui est dans le
 * cadre appartient au client, pas à ScreenForge : lui donner le citron de la
 * marque ferait lire la capture comme une capture de nous.
 */
import { useId, type ReactNode } from 'react'

const INK = '#12131a'
const MUTED = '#8a8fa3'
const ACCENT = '#5b5bd6'
const ACCENT_SOFT = '#e8e8fb'
const RULE = '#eceef4'
const FILL = '#e4e5ee'

/* Sept nuits, la dernière en cours. Des hauteurs écrites à la main plutôt que
   générées : une courbe crédible n'est pas aléatoire, elle a un week-end. */
const NIGHTS = [52, 64, 47, 71, 58, 88, 76]
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/* La courbe : sept points, une bézier par segment dont les poignées sont à
   mi-chemin horizontal — le lissage classique d'un graphe d'aire, sans
   dépassement entre deux points. Le viewBox a le rapport de la boîte rendue
   (86cqw de large, 60 de haut), donc le trait s'épaissit avec le téléphone
   comme tout le reste, sans `preserveAspectRatio: none` qui l'écraserait. */
const CHART_W = 86
const CHART_H = 60
const CHART_POINTS = NIGHTS.map((night, index) => ({
  x: (index * CHART_W) / (NIGHTS.length - 1),
  y: CHART_H - night * 0.58,
}))
const CHART_LINE = CHART_POINTS.map((point, index) => {
  if (index === 0) return `M${point.x},${point.y}`
  const prev = CHART_POINTS[index - 1]
  const mid = (prev.x + point.x) / 2
  return `C${mid},${prev.y} ${mid},${point.y} ${point.x},${point.y}`
}).join(' ')
const CHART_AREA = `${CHART_LINE} L${CHART_W},${CHART_H} L0,${CHART_H} Z`
/* Quatre nuits, quatre durées. Des valeurs distinctes plutôt qu'un motif :
   une liste dont toutes les lignes portent le même nombre est un gabarit. */
const ENTRIES = [
  { day: 'Sat', value: '8h04', fill: 88 },
  { day: 'Fri', value: '6h51', fill: 58 },
  { day: 'Thu', value: '7h32', fill: 71 },
  { day: 'Wed', value: '5h58', fill: 47 },
  { day: 'Tue', value: '7h11', fill: 64 },
  { day: 'Mon', value: '6h24', fill: 52 },
]

/* Deux mesures sous la courbe : l'heure du coucher, celle du réveil. Deux
   tuiles qui portent un chiffre lisible, là où la barre de phases empilée et
   sa légende à trois entrées faisaient quatre objets pour une information. */
const STATS = [
  { label: 'Bedtime', value: '23:14' },
  { label: 'Wake up', value: '06:56' },
]

/* Un bloc de « texte » : une barre à la chasse et à la graisse d'une ligne
   réelle. À 1 % de la largeur du cadre par unité, 2,4cqw est la hauteur d'une
   capitale de corps courant — la barre se lit comme une ligne, pas comme un
   séparateur. */
function TextBar({
  width,
  color = FILL,
  height = 2.4,
}: {
  width: number
  color?: string
  height?: number
}) {
  return (
    <span
      style={{
        display: 'block',
        width: `${width}%`,
        height: `${height}cqw`,
        borderRadius: '99px',
        background: color,
      }}
    />
  )
}

function StatusBar() {
  return (
    /* Une hauteur, pas un retrait. La boîte mesurait 7,5cqw (3,5 de retrait +
       4 de glyphes) quand iOS en donne 13,7 pour la même largeur, et l'encoche
       de `DemoBoard` descend à 12,1cqw : le premier mot de chaque écran
       démarrait 2,4cqw sous elle, d'où le haut écrasé. À 13 les glyphes se
       centrent dans la bande de l'encoche — comme l'heure à côté de l'îlot sur
       un vrai téléphone — et le corps commence à 20cqw. Les cinq cqw et demi
       que ça prend sont rendus par les trois écrans, pas empruntés à la coupe. */
    <div
      className="flex shrink-0 items-center justify-between"
      style={{ height: '13cqw', padding: '0 7cqw', gap: '4cqw' }}
    >
      {/* À cette échelle « 9:41 » ne serait pas un texte mais une tache. */}
      <span style={{ width: '13cqw', height: '2.5cqw', borderRadius: '99px', background: INK }} />
      <span className="flex items-end" style={{ gap: '1cqw' }}>
        {[2, 3, 4].map((bar) => (
          <span
            key={bar}
            style={{
              width: '1.4cqw',
              height: `${bar}cqw`,
              borderRadius: '0.5cqw',
              background: INK,
            }}
          />
        ))}
        <span
          style={{
            marginLeft: '1.5cqw',
            width: '7cqw',
            height: '3.4cqw',
            borderRadius: '1cqw',
            background: INK,
          }}
        />
      </span>
    </div>
  )
}

/* La barre d'onglets porte trois glyphes distincts, pas trois pastilles :
   trois ronds identiques disent « emplacement réservé », trois formes
   différentes disent « app ». Elles sont dessinées en CSS — un jeu d'icônes
   importé ici ferait entrer les icônes de ScreenForge dans la capture du
   client. */
function TabBar({ active }: { active: number }) {
  return (
    <div
      className="flex shrink-0 items-end justify-around border-t"
      style={{ borderColor: RULE, padding: '3.5cqw 0 4.5cqw', height: '14cqw' }}
    >
      {[0, 1, 2].map((tab) => {
        const color = tab === active ? ACCENT : '#c7cad8'
        return (
          <span key={tab} className="flex items-end" style={{ gap: '0.9cqw', height: '6cqw' }}>
            {tab === 0 ? (
              <span
                style={{
                  width: '6cqw',
                  height: '5cqw',
                  borderRadius: '1.4cqw 1.4cqw 1cqw 1cqw',
                  background: color,
                }}
              />
            ) : null}
            {tab === 1
              ? [3, 5.5, 4.2].map((bar, index) => (
                  <span
                    key={index}
                    style={{
                      width: '1.5cqw',
                      height: `${bar}cqw`,
                      borderRadius: '0.6cqw',
                      background: color,
                    }}
                  />
                ))
              : null}
            {tab === 2 ? (
              <span
                style={{
                  width: '5.4cqw',
                  height: '5.4cqw',
                  borderRadius: '99px',
                  border: `1.4cqw solid ${color}`,
                }}
              />
            ) : null}
          </span>
        )
      })}
    </div>
  )
}

/* La ligne de titre commune aux trois écrans : un grand titre à gauche, un
   bouton carré à droite. Le tableau de bord la partage désormais aussi — son
   anneau vide en haut à droite ne désignait rien, le même carré que les deux
   autres écrans dit « même app ». */
function ScreenTitle({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full shrink-0 items-center justify-between">
      <span
        style={{
          color: INK,
          fontSize: '9cqw',
          lineHeight: 1,
          fontWeight: 700,
          letterSpacing: '-0.03em',
        }}
      >
        {children}
      </span>
      <span
        style={{ width: '8cqw', height: '8cqw', borderRadius: '2.4cqw', background: '#f1f2f7' }}
      />
    </div>
  )
}

/* Un chiffre qui se lit, avec son étiquette au-dessus : la seule forme de
   carte que ces écrans s'autorisent. */
function StatTile({
  label,
  value,
  tone = 'soft',
}: {
  label: string
  value: string
  tone?: 'soft' | 'accent'
}) {
  const accent = tone === 'accent'
  return (
    <span
      className="flex flex-1 flex-col"
      style={{
        gap: '1.75cqw',
        padding: '4cqw 4.5cqw',
        borderRadius: '3.5cqw',
        background: accent ? ACCENT : '#f4f5fa',
      }}
    >
      <span
        style={{
          color: accent ? 'rgba(255,255,255,0.78)' : MUTED,
          fontSize: '4.4cqw',
          lineHeight: 1,
          fontWeight: 500,
        }}
      >
        {label}
      </span>
      <span
        style={{
          color: accent ? '#ffffff' : INK,
          fontSize: '8cqw',
          lineHeight: 1,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
    </span>
  )
}

/* Écran 1 — le tableau de bord. Le grand nombre avec ses unités, son écart
   par rapport à la semaine, la courbe, puis les deux heures qui bornent la
   nuit. */
function Dashboard({ label }: { label: string }) {
  const gradientId = useId()
  const last = CHART_POINTS[CHART_POINTS.length - 1]
  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      style={{ padding: '7cqw 7cqw 0', gap: '7cqw' }}
    >
      <div className="flex shrink-0 items-start justify-between">
        <span className="flex flex-col" style={{ gap: '2.4cqw' }}>
          <span style={{ color: MUTED, fontSize: '5.4cqw', lineHeight: 1, fontWeight: 500 }}>
            {label}
          </span>
          <span className="flex items-baseline" style={{ gap: '2.4cqw' }}>
            <span
              className="flex items-baseline"
              style={{
                color: INK,
                fontSize: '19cqw',
                lineHeight: 0.9,
                fontWeight: 700,
                letterSpacing: '-0.03em',
              }}
            >
              7
              <span style={{ color: MUTED, fontSize: '8cqw', fontWeight: 500, letterSpacing: 0 }}>
                h
              </span>
              <span style={{ marginLeft: '1.2cqw' }}>42</span>
              <span style={{ color: MUTED, fontSize: '8cqw', fontWeight: 500, letterSpacing: 0 }}>
                m
              </span>
            </span>
            {/* L'écart : le détail qui fait la différence entre un nombre et
                une mesure. Vert parce qu'un delta positif est vert dans toutes
                les apps de suivi, y compris celles d'Apple. */}
            <span
              style={{
                color: '#127a4b',
                background: '#d8f3e4',
                fontSize: '4.8cqw',
                lineHeight: 1,
                fontWeight: 600,
                padding: '1.4cqw 2.2cqw',
                borderRadius: '99px',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              +24m
            </span>
          </span>
        </span>
        <span
          style={{ width: '8cqw', height: '8cqw', borderRadius: '2.4cqw', background: '#f1f2f7' }}
        />
      </div>

      {/* Sept nuits en courbe, la dernière pointée, les initiales des jours
          dessous. Un graphe sans axe est un motif ; l'axe est ce qui en fait
          une donnée. */}
      <div className="flex flex-col" style={{ gap: '2.5cqw' }}>
        <svg
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          style={{ display: 'block', width: '100%', height: 'auto', overflow: 'visible' }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={ACCENT} stopOpacity="0.28" />
              <stop offset="1" stopColor={ACCENT} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={CHART_AREA} fill={`url(#${gradientId})`} />
          <line x1="0" y1={CHART_H} x2={CHART_W} y2={CHART_H} stroke={RULE} strokeWidth="0.6" />
          <line
            x1={last.x}
            y1={last.y}
            x2={last.x}
            y2={CHART_H}
            stroke={ACCENT}
            strokeWidth="0.5"
            strokeDasharray="1.2 1.2"
            opacity="0.6"
          />
          <path
            d={CHART_LINE}
            fill="none"
            stroke={ACCENT}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx={last.x}
            cy={last.y}
            r="2.2"
            fill="#ffffff"
            stroke={ACCENT}
            strokeWidth="1.5"
          />
        </svg>
        <div className="flex justify-between">
          {DAYS.map((day, index) => (
            <span
              key={index}
              className="text-center"
              style={{
                width: '6cqw',
                color: index === DAYS.length - 1 ? INK : '#a9adbe',
                fontSize: '4.4cqw',
                lineHeight: 1,
                fontWeight: index === DAYS.length - 1 ? 700 : 500,
              }}
            >
              {day}
            </span>
          ))}
        </div>
      </div>

      <div className="flex shrink-0" style={{ gap: '3.5cqw' }}>
        {STATS.map((stat) => (
          <StatTile key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </div>
    </div>
  )
}

/* Écran 2 — la liste des nuits. Le résumé de la semaine en carte, puis six
   rangées à filet, chacune un jour, une jauge et une durée : la densité qu'un
   écran de liste a réellement, sans boîte autour de chaque ligne. */
function Nights() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      style={{ padding: '7cqw 7cqw 0', gap: '7cqw' }}
    >
      <ScreenTitle>Nights</ScreenTitle>
      <div className="flex shrink-0" style={{ gap: '3.5cqw' }}>
        <StatTile label="This week" value="7h02" tone="accent" />
        <StatTile label="Best night" value="8h04" />
      </div>
      <div className="flex shrink-0 flex-col">
        {ENTRIES.map((entry, row) => (
          <span
            key={entry.day}
            className="flex items-center"
            style={{
              gap: '3.5cqw',
              padding: '4.2cqw 0',
              borderBottom: row === ENTRIES.length - 1 ? 'none' : `0.4cqw solid ${RULE}`,
            }}
          >
            <span
              style={{
                width: '11cqw',
                color: row === 0 ? INK : '#6c7186',
                fontSize: '4.8cqw',
                lineHeight: 1,
                fontWeight: 600,
              }}
            >
              {entry.day}
            </span>
            {/* La jauge : la même durée, dite deux fois — en chiffres et en
                longueur. C'est ce que fait une ligne de liste utile. */}
            <span
              style={{
                display: 'block',
                flex: 1,
                height: '2.4cqw',
                borderRadius: '99px',
                background: '#eef0f6',
              }}
            >
              <span
                style={{
                  display: 'block',
                  width: `${entry.fill}%`,
                  height: '100%',
                  borderRadius: '99px',
                  background: row === 0 ? ACCENT : '#b9baee',
                }}
              />
            </span>
            <span
              style={{
                width: '13cqw',
                textAlign: 'right',
                color: row === 0 ? INK : '#6c7186',
                fontSize: '5.2cqw',
                lineHeight: 1,
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {entry.value}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

/* Écran 3 — l'objectif. Un anneau de progression, sa valeur au centre,
   l'action pleine largeur, puis deux réglages à filet : la forme que prend le
   troisième écran de presque toutes les planches publiées. */
function Goal() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col items-center overflow-hidden"
      style={{ padding: '7cqw 7cqw 0', gap: '7cqw' }}
    >
      {/* La même ligne de titre que « Nights ». Sans elle l'anneau démarrait à
          7cqw du haut du corps, donc juste sous l'encoche : le seul des trois
          écrans dont le sujet touchait le bord haut. */}
      <ScreenTitle>Goal</ScreenTitle>
      <span
        className="flex items-center justify-center"
        style={{
          width: '68cqw',
          height: '68cqw',
          borderRadius: '99px',
          /* L'anneau : un dégradé conique coupé à 78 %, donc une vraie
             progression et pas un cercle plein. */
          background: `conic-gradient(${ACCENT} 0turn 0.78turn, ${ACCENT_SOFT} 0.78turn 1turn)`,
        }}
      >
        <span
          className="flex flex-col items-center justify-center"
          style={{
            width: '52cqw',
            height: '52cqw',
            borderRadius: '99px',
            background: '#ffffff',
            gap: '1.75cqw',
          }}
        >
          <span
            style={{
              color: INK,
              fontSize: '15cqw',
              lineHeight: 1,
              fontWeight: 700,
              letterSpacing: '-0.04em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            78%
          </span>
          <TextBar width={52} color="#c3c7d6" height={2} />
        </span>
      </span>
      <span
        className="flex w-full shrink-0 items-center justify-center"
        style={{ height: '13cqw', borderRadius: '3.4cqw', background: ACCENT }}
      >
        <TextBar width={38} color="#ffffff" height={2.6} />
      </span>

      <div className="flex w-full shrink-0 flex-col">
        {[0, 1].map((row) => (
          <span
            key={row}
            className="flex items-center"
            style={{
              gap: '3.5cqw',
              padding: '4cqw 0',
              borderBottom: row === 0 ? `0.4cqw solid ${RULE}` : 'none',
            }}
          >
            {/* Le glyphe du réglage : un carré teinté portant un point de
                l'accent, dessiné en CSS pour la même raison que la barre
                d'onglets. */}
            <span
              className="flex items-center justify-center"
              style={{
                width: '7.5cqw',
                height: '7.5cqw',
                borderRadius: '2.2cqw',
                background: ACCENT_SOFT,
              }}
            >
              <span
                style={{ width: '3cqw', height: '3cqw', borderRadius: '99px', background: ACCENT }}
              />
            </span>
            <span className="flex flex-1 flex-col" style={{ gap: '1.75cqw' }}>
              <TextBar width={[58, 46][row]} color="#c3c7d6" />
              <TextBar width={[34, 40][row]} color="#e0e2eb" height={2} />
            </span>
            {/* Un interrupteur : le seul contrôle que porte un écran de
                réglages, et il dit « app » plus vite qu'une barre de plus. */}
            <span
              className="flex items-center"
              style={{
                width: '11cqw',
                height: '6.4cqw',
                borderRadius: '99px',
                background: row === 0 ? ACCENT : '#dcdfea',
                justifyContent: row === 0 ? 'flex-end' : 'flex-start',
                padding: '0.9cqw',
              }}
            >
              <span
                style={{
                  width: '4.6cqw',
                  height: '4.6cqw',
                  borderRadius: '99px',
                  background: '#ffffff',
                }}
              />
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

export function DemoPhoneApp({ label, variant = 0 }: { label: string; variant?: number }) {
  return (
    <div
      aria-hidden
      className="flex h-full flex-col justify-between bg-white"
      /* La police de l'app est celle du système, pas celle du site : sur un
         Mac ou un iPhone c'est SF, et une capture qui rend en SF ressemble à
         une capture. Inter, la fonte du site, faisait lire l'écran comme une
         maquette de la vitrine. */
      style={{
        containerType: 'inline-size',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <StatusBar />
      {variant === 1 ? <Nights /> : variant === 2 ? <Goal /> : <Dashboard label={label} />}
      <TabBar active={variant} />
    </div>
  )
}
