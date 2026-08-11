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
  /**
   * L'ouverture commerciale, indépendante du déploiement : un compte peut
   * exister avant que la vente n'ouvre — voir `lib/commercial-launch.ts`.
   */
  readonly VITE_COMMERCIAL_LAUNCH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
