/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Les deux variables du stack Supabase, déclarées facultatives parce
   * qu'elles le sont : sans elles l'application tourne en local pur, sans
   * client, sans compte et sans réseau. Les déclarer ici plutôt que de
   * s'en remettre à l'index générique de `vite/client` fait d'une faute de
   * frappe une erreur de compilation, et non un `undefined` au runtime qui
   * bascule silencieusement en mode local.
   */
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
