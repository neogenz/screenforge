export type Theme = 'light' | 'dark'

export interface UserSettings {
  theme: Theme
  updatedAt: number
}

const BOOT_THEME_KEY = 'screenforge-theme'
const SETTINGS_PREFIX = 'screenforge-user-settings:'
const ANONYMOUS = 'anonymous'
const DEFAULT_SETTINGS: UserSettings = { theme: 'dark', updatedAt: 0 }

const memory = new Map<string, UserSettings>()
const listeners = new Set<(userId: string | null, settings: UserSettings) => void>()

function key(userId: string | null): string {
  return `${SETTINGS_PREFIX}${encodeURIComponent(userId ?? ANONYMOUS)}`
}

function isUserSettings(value: unknown): value is UserSettings {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<UserSettings>
  return (
    (candidate.theme === 'light' || candidate.theme === 'dark') &&
    typeof candidate.updatedAt === 'number' &&
    Number.isFinite(candidate.updatedAt) &&
    candidate.updatedAt >= 0 &&
    Object.keys(value).every((field) => field === 'theme' || field === 'updatedAt')
  )
}

function store(userId: string | null, settings: UserSettings): void {
  memory.set(key(userId), settings)
  try {
    localStorage.setItem(key(userId), JSON.stringify(settings))
    localStorage.setItem(BOOT_THEME_KEY, settings.theme)
  } catch (error) {
    console.warn('Could not persist user settings.', error)
  }
}

export function readBootTheme(): Theme {
  try {
    const saved = localStorage.getItem(BOOT_THEME_KEY)
    return saved === 'light' || saved === 'dark' ? saved : 'dark'
  } catch (error) {
    console.warn('Could not read the saved theme.', error)
    return 'dark'
  }
}

export function readUserSettings(userId: string | null): UserSettings {
  const cached = memory.get(key(userId))
  if (cached) return cached
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key(userId)) ?? 'null')
    if (isUserSettings(parsed)) {
      memory.set(key(userId), parsed)
      return parsed
    }
  } catch (error) {
    console.warn('Could not read user settings.', error)
  }
  return userId === null ? { theme: readBootTheme(), updatedAt: 0 } : { ...DEFAULT_SETTINGS }
}

export function commitTheme(userId: string | null, theme: Theme): UserSettings {
  const previous = readUserSettings(userId)
  const settings = { theme, updatedAt: Math.max(Date.now(), previous.updatedAt + 1) }
  store(userId, settings)
  for (const listener of listeners) listener(userId, settings)
  return settings
}

/** Installe une valeur réconciliée sans la remettre dans la file de sync. */
export function installUserSettings(userId: string, settings: UserSettings): void {
  store(userId, settings)
}

export function onUserSettingsCommitted(
  listener: (userId: string | null, settings: UserSettings) => void,
): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** La version la plus récente gagne; le serveur départage les égalités. */
export function newerSettings(local: UserSettings, remote: UserSettings | null): UserSettings {
  return remote && remote.updatedAt >= local.updatedAt ? remote : local
}
