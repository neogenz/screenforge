import { test, expect } from '@playwright/test'
import { waitForApp } from './helpers'

/**
 * Le chemin recommandé reste le chemin par défaut.
 *
 * Ce que la phase doit prouver côté page : l'assistance distante existe, est
 * repliée, dit où passent les données, échoue en disant quoi faire — et ne coûte
 * jamais à l'utilisateur la composition locale, qui marche sans rien connecter.
 *
 * Le pont n'est pas lancé pendant ce test : c'est justement l'état par défaut
 * d'une machine, et l'erreur qu'il produit est celle que tout le monde verra en
 * premier.
 */

async function openCampaignDialog(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Composer une campagne' }).click()
  await expect(page.getByRole('dialog', { name: 'Composer une campagne' })).toBeVisible()
}

test('l’assistance distante est repliée, honnête, et jamais bloquante', async ({ page }) => {
  await waitForApp(page)
  await openCampaignDialog(page)

  // Repliée, mais elle dit lequel est actif sans qu'on l'ouvre.
  const disclosure = page.getByRole('button', { name: /Assistance/ })
  await expect(disclosure).toHaveAttribute('aria-expanded', 'false')
  await expect(disclosure).toContainText('Composition locale')
  await expect(page.getByRole('radio', { name: /Composition locale/ })).toBeHidden()

  await disclosure.click()
  await expect(disclosure).toHaveAttribute('aria-expanded', 'true')

  // Chaque fournisseur dit où passent les données, à l'endroit du choix.
  await expect(page.getByRole('radio', { name: /Composition locale/ })).toContainText(
    'Rien ne quitte cet onglet',
  )
  const remote = page.getByRole('radio', { name: /Codex, via le pont local/ })
  await expect(remote).toContainText('aucune image ne traverse le pont')

  await remote.click()
  await expect(page.getByLabel('Jeton d’appairage')).toBeVisible()

  // Pont éteint : le message dit quoi lancer, pas « échec réseau ».
  await page.getByLabel('Jeton d’appairage').fill('jeton-inexistant')
  await page.getByRole('button', { name: 'Connecter' }).click()
  await expect(page.getByRole('alert')).toContainText('bridge run start')

  // Le jeton n'est écrit nulle part : ni stockage local, ni session.
  const persisted = await page.evaluate(() => {
    const dump = [
      ...Object.keys(localStorage).map((key) => localStorage.getItem(key) ?? ''),
      ...Object.keys(sessionStorage).map((key) => sessionStorage.getItem(key) ?? ''),
    ].join('\n')
    return dump.includes('jeton-inexistant')
  })
  expect(persisted).toBe(false)

  // Et la voie recommandée reste à un clic, sans reconnexion ni redémarrage.
  await page.getByRole('radio', { name: /Composition locale/ }).click()
  await page.getByRole('button', { name: 'Proposer un plan' }).click()
  await expect(page.getByText('Plan proposé')).toBeVisible()
})
