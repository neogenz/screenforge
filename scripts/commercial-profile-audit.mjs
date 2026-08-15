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
        'Choisir Local',
        'Choisir Cloud',
        '/?offers=open',
        'Vos données cloud restent lisibles et supprimables',
      ]
    : [
        'Pas encore ouvert',
        'Être prévenu à l’ouverture',
        'exports propres illimités et le ZIP groupé',
      ]
const forbidden =
  profile === 'launch'
    ? ['Pas encore ouvert', 'Être prévenu à l’ouverture']
    : ['Les offres payantes sont ouvertes', 'Choisir Local']

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

const offers = html.match(/"@type":"Offer"/g)?.length ?? 0
if (offers !== 2 || html.includes('"name":"Free"') || html.includes('"name":"Licence"')) {
  throw new Error(`${profile}: le catalogue structuré doit contenir seulement Local et Cloud`)
}

console.log(`profil commercial ${profile} : landing pré-rendue cohérente`)
