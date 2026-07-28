export const DEFAULT_TOKEN_RATIO = 1.0

/** Allowed display values: 0.1..1.0 step 0.1, then 2..10 step 1. */
export const TOKEN_RATIO_OPTIONS = [
  0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0,
  2, 3, 4, 5, 6, 7, 8, 9, 10,
]

export const TOKEN_RATIO_SLIDER_MAX = TOKEN_RATIO_OPTIONS.length - 1

export function formatTokenRatio(value) {
  if (value == null || Number.isNaN(Number(value))) return String(value ?? '')
  const n = Number(value)
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

export function tokenRatioToSliderIndex(value) {
  const n = Number(value)
  const exact = TOKEN_RATIO_OPTIONS.findIndex((option) => option === n)
  if (exact >= 0) return exact

  let best = 0
  let bestDiff = Number.POSITIVE_INFINITY
  for (let i = 0; i < TOKEN_RATIO_OPTIONS.length; i += 1) {
    const diff = Math.abs(TOKEN_RATIO_OPTIONS[i] - n)
    if (diff < bestDiff) {
      best = i
      bestDiff = diff
    }
  }
  return best
}

export function sliderIndexToTokenRatio(index) {
  const i = Math.min(
    TOKEN_RATIO_SLIDER_MAX,
    Math.max(0, Math.round(Number(index) || 0)),
  )
  return TOKEN_RATIO_OPTIONS[i]
}
