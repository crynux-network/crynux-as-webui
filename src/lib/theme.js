const STORAGE_KEY = 'crynux-as-theme'

export function getStoredTheme() {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (value === 'light' || value === 'dark') return value
  } catch (_) {
    // ignore storage errors
  }
  return null
}

export function getSystemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function resolveTheme(stored = getStoredTheme()) {
  return stored || getSystemTheme()
}

export function applyTheme(theme) {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
  root.dataset.theme = theme
}

export function setTheme(theme) {
  if (theme !== 'light' && theme !== 'dark') return resolveTheme()
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch (_) {
    // ignore storage errors
  }
  applyTheme(theme)
  return theme
}

export function toggleTheme() {
  const next = resolveTheme() === 'dark' ? 'light' : 'dark'
  return setTheme(next)
}

export function initTheme() {
  const theme = resolveTheme()
  applyTheme(theme)
  return theme
}

export function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
