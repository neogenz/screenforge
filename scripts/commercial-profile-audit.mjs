import { readFileSync } from 'node:fs'

const profile = process.argv[2]
if (profile !== 'prelaunch' && profile !== 'launch') {
  throw new Error('usage: commercial-profile-audit.mjs <prelaunch|launch>')
}

const html = readFileSync('apps/web/dist/landing-fr.html', 'utf8')
const expected =
  profile === 'launch'
    ? [
        'Les offres payantes sont ouvertes',
        'Acheter la Licence',
        '/?offers=open',
        'Les copies déjà présentes sur vos machines y restent',
      ]
    : ['Pas encore ouvert', 'Être prévenu à l’ouverture', 'Exports propres illimités et ZIP groupé']
const forbidden =
  profile === 'launch'
    ? ['Pas encore ouvert', 'Être prévenu à l’ouverture']
    : ['Les offres payantes sont ouvertes', 'Acheter la Licence']

for (const value of expected) {
  if (!html.includes(value)) throw new Error(`${profile}: contenu absent : ${value}`)
}
for (const value of forbidden) {
  if (html.includes(value)) throw new Error(`${profile}: contenu contradictoire : ${value}`)
}

const preorders = html.match(/schema.org\/PreOrder/g)?.length ?? 0
if (preorders !== (profile === 'launch' ? 0 : 2)) {
  throw new Error(`${profile}: ${preorders} offre(s) en précommande`)
}

console.log(`profil commercial ${profile} : landing pré-rendue cohérente`)
