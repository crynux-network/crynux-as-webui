export function formatCompactNumber(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0'
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n)
}

export function formatExactNumber(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0'
  return new Intl.NumberFormat('en-US').format(n)
}

export function formatExactCredits(value) {
  if (value == null) return '0'
  const raw = typeof value === 'string' ? value : String(value)
  if (!/^-?\d+$/.test(raw)) return raw
  const negative = raw.startsWith('-')
  const digits = negative ? raw.slice(1) : raw
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return negative ? `-${grouped}` : grouped
}

export function formatCompactCredits(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0'
  return formatCompactNumber(n)
}

export function formatSuccessRate(rate) {
  const n = Number(rate)
  if (!Number.isFinite(n)) return '0%'
  return `${(n * 100).toFixed(1)}%`
}

export function formatStatsAxisTime(unixSeconds, range) {
  const date = new Date(Number(unixSeconds) * 1000)
  if (range === '1d' || range === '1h') {
    if (date.getHours() === 0 && date.getMinutes() === 0) {
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    }
    return String(date.getHours())
  }
  if (range === '1m') {
    if (date.getDate() === 1) {
      return date.toLocaleDateString(undefined, {
        month: 'short',
      })
    }
    return String(date.getDate())
  }
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

export function seriesHasData(points, valueKeys = ['value']) {
  if (!Array.isArray(points) || points.length === 0) return false
  return points.some((point) =>
    valueKeys.some((key) => Number(point?.[key] || 0) > 0),
  )
}

export function statsSeriesPointCount(range) {
  switch (range) {
    case '1d':
      return 24
    case '7d':
      return 7
    case '1m':
      return 30
    default:
      return 10
  }
}
