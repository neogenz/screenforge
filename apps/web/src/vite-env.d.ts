/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * L'URL du déploiement Convex, déclarée facultative parce qu'elle l'est :
   * sans elle l'application tourne en local pur, sans client, sans compte et
   * sans réseau. La déclarer ici plutôt que de s'en remettre à l'index générique
   * de `vite/client` fait d'une faute de frappe une erreur de compilation, et
   * non un `undefined` au runtime qui bascule silencieusement en mode local.
   */
  readonly VITE_CONVEX_URL?: string
  /** Token public du projet ScreenForge et hôte d'ingestion PostHog Cloud EU. */
  readonly VITE_POSTHOG_KEY?: string
  readonly VITE_POSTHOG_HOST?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
