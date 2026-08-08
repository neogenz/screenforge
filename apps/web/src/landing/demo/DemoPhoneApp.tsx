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
 * restait blanc. Le bloc titre, lui, n'écrit rien : à `lineHeight: 0.86` le
 * grand nombre porte déjà 2,3cqw de blanc dans sa boîte, donc tout écart écrit
 * y rendrait plus large que le pas frère et se lirait comme une séparation.
 *
 * Le budget est fermé par le bas et il n'est écrit nulle part ailleurs : le
 * cadre déborde volontairement de la planche (`DEVICE_HEIGHT_PCT` = 66 centré à
 * 82 %, `demo-script.ts`), il reste 165cqw sous le haut du corps avant le bord,
 * et la barre d'onglets est déjà dessous, à 0 % visible. Qui touche à ces deux
 * constantes déplace les trois atterrissages.
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

/* Les trois phases d'une nuit, en proportions qui font 100. La barre empilée
   est ce qu'une app de sommeil met sous sa courbe, et c'est le bloc qui porte
   le contenu jusqu'à la coupe. */
const STAGES = [
  { label: 'Deep', share: 26, color: '#3f3fb0' },
  { label: 'Light', share: 52, color: ACCENT },
  { label: 'REM', share: 22, color: '#a5a5ec' },
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
    <div
      className="flex shrink-0 items-center justify-between"
      style={{ padding: '3.5cqw 7cqw 0', gap: '4cqw' }}
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

/* Écran 1 — le tableau de bord. Le grand nombre, son écart par rapport à la
   semaine, le sélecteur de période et la courbe. */
function Dashboard({ label }: { label: string }) {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      style={{ padding: '7cqw 7cqw 0', gap: '7cqw' }}
    >
      <div className="flex shrink-0 items-center justify-between">
        <span className="flex flex-col">
          <span
            style={{
              color: MUTED,
              fontSize: '6.4cqw',
              lineHeight: 1,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {label}
          </span>
          <span className="flex items-end" style={{ gap: '2.4cqw' }}>
            <span
              style={{
                color: INK,
                fontSize: '21cqw',
                lineHeight: 0.86,
                fontWeight: 700,
                letterSpacing: '-0.045em',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              7h42
            </span>
            {/* L'écart : le détail qui fait la différence entre un nombre et
                une mesure. Vert parce qu'un delta positif est vert dans toutes
                les apps de suivi, y compris celles d'Apple. */}
            <span
              style={{
                marginBottom: '1.6cqw',
                color: '#127a4b',
                background: '#d8f3e4',
                fontSize: '5.4cqw',
                lineHeight: 1,
                fontWeight: 700,
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
          style={{
            width: '11cqw',
            height: '11cqw',
            borderRadius: '99px',
            background: ACCENT_SOFT,
            border: `0.8cqw solid ${ACCENT}`,
          }}
        />
      </div>

      {/* Sélecteur de période : trois segments dans une gouttière, le premier
          actif. Un contrôle que toute app de suivi porte. */}
      <span
        className="flex"
        style={{ background: '#f1f2f7', borderRadius: '2.4cqw', padding: '1cqw', gap: '1cqw' }}
      >
        {[0, 1, 2].map((segment) => (
          <span
            key={segment}
            className="flex flex-1 items-center justify-center"
            style={{
              height: '7cqw',
              borderRadius: '1.8cqw',
              background: segment === 0 ? '#ffffff' : 'transparent',
              boxShadow: segment === 0 ? '0 0.4cqw 1cqw rgba(18,19,26,0.12)' : 'none',
            }}
          >
            <TextBar width={segment === 0 ? 52 : 44} color={segment === 0 ? INK : '#b9bdcc'} />
          </span>
        ))}
      </span>

      {/* La courbe : sept nuits, la dernière accentuée, les initiales des jours
          sous les barres. Un graphe sans axe est un motif ; l'axe est ce qui en
          fait une donnée. */}
      <div className="flex flex-col" style={{ gap: '1.75cqw' }}>
        <div className="flex items-end justify-between" style={{ height: '46cqw', gap: '2cqw' }}>
          {NIGHTS.map((height, night) => (
            <span
              key={night}
              style={{
                flex: 1,
                height: `${height}%`,
                borderRadius: '1.2cqw',
                background: night === NIGHTS.length - 1 ? ACCENT : FILL,
              }}
            />
          ))}
        </div>
        <div className="flex justify-between" style={{ gap: '2cqw' }}>
          {DAYS.map((day, index) => (
            <span
              key={index}
              className="flex-1 text-center"
              style={{
                color: index === DAYS.length - 1 ? INK : '#a9adbe',
                fontSize: '4.6cqw',
                lineHeight: 1,
                fontWeight: 600,
              }}
            >
              {day}
            </span>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 flex-col" style={{ gap: '1.75cqw' }}>
        <span className="flex overflow-hidden" style={{ height: '4cqw', borderRadius: '99px' }}>
          {STAGES.map((stage) => (
            <span key={stage.label} style={{ width: `${stage.share}%`, background: stage.color }} />
          ))}
        </span>
        <span className="flex justify-between">
          {STAGES.map((stage) => (
            <span key={stage.label} className="flex items-center" style={{ gap: '1.4cqw' }}>
              <span
                style={{
                  width: '2.4cqw',
                  height: '2.4cqw',
                  borderRadius: '99px',
                  background: stage.color,
                }}
              />
              <span
                style={{ color: '#6c7186', fontSize: '4.4cqw', lineHeight: 1, fontWeight: 600 }}
              >
                {stage.label}
              </span>
            </span>
          ))}
        </span>
      </div>

      {/* Deux lignes, pas trois. Une ligne générique — pastille, deux barres, une
          valeur — est le remplissage d'une maquette : la troisième n'ajoutait
          aucune information, elle prenait la place que le reste de l'écran
          réclamait pour respirer. */}
      <div className="flex shrink-0 flex-col" style={{ gap: '7cqw' }}>
        {[0, 1].map((row) => (
          <span key={row} className="flex items-center" style={{ gap: '3cqw' }}>
            <span
              style={{
                width: '11cqw',
                height: '11cqw',
                borderRadius: '3cqw',
                background: row === 0 ? ACCENT_SOFT : '#f1f2f7',
              }}
            />
            <span className="flex flex-1 flex-col" style={{ gap: '1.75cqw' }}>
              <TextBar width={[68, 54, 61][row]} color="#c3c7d6" />
              <TextBar width={[40, 46, 33][row]} color="#e0e2eb" height={2} />
            </span>
            <TextBar width={9} color="#c3c7d6" height={2.2} />
          </span>
        ))}
      </div>
    </div>
  )
}

/* Écran 2 — la liste des nuits. Quatre lignes portant chacune un jour, une
   durée et une jauge : la densité qu'un écran de liste a réellement. */
function Nights() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      style={{ padding: '7cqw 7cqw 0', gap: '7cqw' }}
    >
      <div className="flex shrink-0 items-center justify-between">
        <span
          style={{
            color: INK,
            fontSize: '9cqw',
            lineHeight: 1,
            fontWeight: 700,
            letterSpacing: '-0.03em',
          }}
        >
          Nights
        </span>
        <span
          style={{ width: '8cqw', height: '8cqw', borderRadius: '2.4cqw', background: '#f1f2f7' }}
        />
      </div>
      <div className="flex shrink-0 flex-col" style={{ gap: '7cqw' }}>
        {ENTRIES.map((entry, row) => (
          <span
            key={entry.day}
            className="flex items-center"
            style={{
              gap: '3cqw',
              /* L'air de cette liste est entre les lignes, pas dedans : à
                 `4.5cqw` de retrait interne les six lignes débordaient la coupe
                 de 6,8cqw et la dernière était tranchée en deux. Le retrait
                 revient au pas frère, l'écart inter-ligne garde le pas de bloc,
                 et la pile atterrit sous le bord comme les deux autres écrans. */
              padding: '3.5cqw',
              borderRadius: '3cqw',
              background: row === 0 ? ACCENT_SOFT : '#f7f8fb',
            }}
          >
            <span
              className="flex items-center justify-center"
              style={{
                width: '10cqw',
                height: '10cqw',
                borderRadius: '2.8cqw',
                background: row === 0 ? ACCENT : '#dcdfea',
                color: row === 0 ? '#ffffff' : '#6c7186',
                fontSize: '4.2cqw',
                fontWeight: 700,
              }}
            >
              {entry.day[0]}
            </span>
            <span className="flex flex-1 flex-col" style={{ gap: '1.75cqw' }}>
              <TextBar width={row === 0 ? 62 : 50} color={row === 0 ? ACCENT : '#c3c7d6'} />
              {/* La jauge : la même durée, dite deux fois — en chiffres et en
                  longueur. C'est ce que fait une ligne de liste utile. */}
              <span
                style={{
                  display: 'block',
                  width: '100%',
                  height: '1.8cqw',
                  borderRadius: '99px',
                  background: '#e6e8f0',
                }}
              >
                <span
                  style={{
                    display: 'block',
                    width: `${entry.fill}%`,
                    height: '100%',
                    borderRadius: '99px',
                    background: row === 0 ? ACCENT : '#b9bdcc',
                  }}
                />
              </span>
            </span>
            <span
              style={{
                color: row === 0 ? INK : '#6c7186',
                fontSize: '5.4cqw',
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

/* Écran 3 — l'objectif. Un anneau de progression, sa valeur au centre, et
   l'action pleine largeur : la forme que prend le troisième écran de presque
   toutes les planches publiées. */
function Goal() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col items-center overflow-hidden"
      style={{ padding: '7cqw 7cqw 0', gap: '7cqw' }}
    >
      <span
        className="flex items-center justify-center"
        style={{
          width: '58cqw',
          height: '58cqw',
          borderRadius: '99px',
          /* L'anneau : un dégradé conique coupé à 78 %, donc une vraie
             progression et pas un cercle plein. */
          background: `conic-gradient(${ACCENT} 0turn 0.78turn, ${ACCENT_SOFT} 0.78turn 1turn)`,
        }}
      >
        <span
          className="flex flex-col items-center justify-center"
          style={{
            width: '43cqw',
            height: '43cqw',
            borderRadius: '99px',
            background: '#ffffff',
            gap: '1.75cqw',
          }}
        >
          <span
            style={{
              color: INK,
              fontSize: '13cqw',
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
      <span className="flex w-full flex-col items-center" style={{ gap: '1.75cqw' }}>
        <TextBar width={68} color={INK} height={3} />
        <TextBar width={46} color="#c3c7d6" height={2.2} />
      </span>
      <span
        className="flex w-full shrink-0 items-center justify-center"
        style={{ height: '13cqw', borderRadius: '3.4cqw', background: ACCENT }}
      >
        <TextBar width={38} color="#ffffff" height={2.6} />
      </span>

      <div className="flex w-full shrink-0 flex-col" style={{ gap: '7cqw' }}>
        {[0, 1, 2].map((row) => (
          <span
            key={row}
            className="flex items-center"
            style={{
              gap: '3cqw',
              padding: '3.5cqw 3cqw',
              borderRadius: '3cqw',
              background: '#f7f8fb',
            }}
          >
            <span
              style={{
                width: '7cqw',
                height: '7cqw',
                borderRadius: '2.2cqw',
                background: '#dcdfea',
              }}
            />
            <span className="flex flex-1 flex-col" style={{ gap: '1.75cqw' }}>
              <TextBar width={[58, 46, 66][row]} color="#c3c7d6" />
              <TextBar width={[34, 40, 28][row]} color="#e0e2eb" height={2} />
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
      style={{ containerType: 'inline-size' }}
    >
      <StatusBar />
      {variant === 1 ? <Nights /> : variant === 2 ? <Goal /> : <Dashboard label={label} />}
      <TabBar active={variant} />
    </div>
  )
}
