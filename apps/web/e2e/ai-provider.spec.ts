import { test, expect } from '@playwright/test'
import { waitForApp } from './helpers'

/**
 * Le chemin recommandé reste le chemin par défaut.
 *
 * Ce que la phase doit prouver côté page : le modèle distant existe, est
 * replié, dit où passent les données, échoue en disant quoi faire — et ne coûte
 * jamais à l'utilisateur la génération sans modèle, qui marche sans rien
 * connecter.
 *
 * Le pont n'est pas lancé pendant ce test : c'est justement l'état par défaut
 * d'une machine, et l'erreur qu'il produit est celle que tout le monde verra en
 * premier.
 */

async function openCampaignDialog(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Générer les visuels App Store' }).click()
  await expect(page.getByRole('dialog', { name: 'Générer les visuels App Store' })).toBeVisible()
}

test('le modèle distant est replié, honnête, et jamais bloquant', async ({ page }) => {
  await waitForApp(page)
  await openCampaignDialog(page)

  // Repliée, mais elle dit lequel est actif sans qu'on l'ouvre.
  const disclosure = page.getByRole('button', { name: /Qui écrit les accroches/ })
  await expect(disclosure).toHaveAttribute('aria-expanded', 'false')
  await expect(disclosure).toContainText('ScreenForge seul, sans IA')
  await expect(page.getByRole('radio', { name: /ScreenForge seul/ })).toBeHidden()

  await disclosure.click()
  await expect(disclosure).toHaveAttribute('aria-expanded', 'true')

  // Chaque fournisseur dit où passent les données, à l'endroit du choix.
  await expect(page.getByRole('radio', { name: /ScreenForge seul/ })).toContainText(
    'Rien ne quitte cet onglet',
  )
  const remote = page.getByRole('radio', { name: /Avec Codex/ })
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
  await page.getByRole('radio', { name: /ScreenForge seul/ }).click()
  await page.getByRole('button', { name: /^Proposer \d+ visuels?$/ }).click()
  await expect(page.getByRole('heading', { name: 'À relire avant d’ajouter' })).toBeVisible()
})
