/*
 * Cibles des liens de la landing. Les URLs de checkout n'existent pas encore :
 * elles relèvent du plan SaaS (Stripe). Tant qu'il n'est pas livré, les CTAs
 * payants basculent sur le contact — une seule constante à modifier au
 * branchement, jamais les composants.
 */
// TODO(checkout): brancher les Payment Links Stripe — voir aidd_docs/tasks/2026_08/2026_08_05_screenforge-saas
export const LINKS = {
  app: '/',
  checkoutMonthly: 'mailto:hello@screenforge.app?subject=ScreenForge%20Monthly',
  checkoutLifetime: 'mailto:hello@screenforge.app?subject=ScreenForge%20Lifetime',
  contact: 'mailto:hello@screenforge.app',
} as const
