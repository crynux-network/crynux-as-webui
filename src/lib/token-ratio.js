export const DEFAULT_TOKEN_RATIO = 1.0

/** Fallback max cost level before billing_config loads. */
export const DEFAULT_MAX_TOKEN_RATIO = 30

export function buildTokenRatioOptions(maxTokenRatio = DEFAULT_MAX_TOKEN_RATIO) {
  const max = Math.max(2, Math.floor(Number(maxTokenRatio) || DEFAULT_MAX_TOKEN_RATIO))
  return [
    0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0,
    ...Array.from({ length: max - 1 }, (_, i) => i + 2),
  ]
}

export function formatTokenRatio(value) {
  if (value == null || Number.isNaN(Number(value))) return String(value ?? '')
  const n = Number(value)
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

export function tokenRatioToSliderIndex(value, options = buildTokenRatioOptions()) {
  const n = Number(value)
  const exact = options.findIndex((option) => option === n)
  if (exact >= 0) return exact

  let best = 0
  let bestDiff = Number.POSITIVE_INFINITY
  for (let i = 0; i < options.length; i += 1) {
    const diff = Math.abs(options[i] - n)
    if (diff < bestDiff) {
      best = i
      bestDiff = diff
    }
  }
  return best
}

export function sliderIndexToTokenRatio(index, options = buildTokenRatioOptions()) {
  const maxIndex = Math.max(0, options.length - 1)
  const i = Math.min(maxIndex, Math.max(0, Math.round(Number(index) || 0)))
  return options[i]
}
