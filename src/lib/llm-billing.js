/**
 * Shared billable_gwei helpers for Credits and execution-time examples.
 *
 * billable_gwei = priority_gwei * estimated_node_seconds * vram_weight
 * credits = floor(billable_gwei * G)
 *
 * Live request charging applies max(1, ...) on the server. These helpers
 * are for Credits-per-token example cells and MUST NOT apply that floor.
 */

export function vramWeight(minVram, baseVram) {
  const v = Number(minVram)
  const b = Number(baseVram)
  if (!(b > 0) || !(v > 0)) return 0
  return Math.max(v, b) / b
}

export function estimateCredits({
  promptTokens = 0,
  completionTokens = 0,
  priorityGwei,
  minVram,
  baseVram,
  creditsPerGwei,
  constantSeconds = 0,
  secondsPerInputToken = 0,
  secondsPerOutputToken = 0,
}) {
  const prio = Number(priorityGwei)
  const g = Number(creditsPerGwei)
  if (!(prio > 0) || !(g > 0)) return 0

  const weight = vramWeight(minVram, baseVram)
  if (!(weight > 0)) return 0

  const estimatedNodeSeconds =
    Number(constantSeconds) +
    Number(secondsPerInputToken) * Number(promptTokens) +
    Number(secondsPerOutputToken) * Number(completionTokens)

  if (!(estimatedNodeSeconds >= 0)) return 0

  const billableGwei = prio * estimatedNodeSeconds * weight
  return Math.trunc(billableGwei * g)
}

export function estimateExecutionSeconds({
  promptTokens,
  completionTokens,
  constantSeconds = 0,
  secondsPerInputToken = 0,
  secondsPerOutputToken = 0,
}) {
  return (
    Number(constantSeconds) +
    Number(secondsPerInputToken) * Number(promptTokens) +
    Number(secondsPerOutputToken) * Number(completionTokens)
  )
}

export function buildExampleRows({
  examples,
  priorityGwei,
  baseVram,
  creditsPerGwei,
  pricingPromptTokens,
  pricingCompletionTokens,
  timePromptTokens,
  timeCompletionTokens,
}) {
  const rows = Array.isArray(examples) ? examples : []
  return rows.map((example) => {
    const minVram = Number(example.min_vram)
    const constantSeconds = Number(example.constant_seconds)
    const secondsPerInputToken = Number(example.seconds_per_input_token)
    const secondsPerOutputToken = Number(example.seconds_per_output_token)
    return {
      id: `${example.model}-${minVram}`,
      model: example.model,
      minVram,
      inputCredits: estimateCredits({
        promptTokens: pricingPromptTokens,
        completionTokens: 0,
        priorityGwei,
        minVram,
        baseVram,
        creditsPerGwei,
        constantSeconds: 0,
        secondsPerInputToken,
        secondsPerOutputToken: 0,
      }),
      outputCredits: estimateCredits({
        promptTokens: 0,
        completionTokens: pricingCompletionTokens,
        priorityGwei,
        minVram,
        baseVram,
        creditsPerGwei,
        constantSeconds: 0,
        secondsPerInputToken: 0,
        secondsPerOutputToken,
      }),
      executionSeconds: estimateExecutionSeconds({
        promptTokens: timePromptTokens,
        completionTokens: timeCompletionTokens,
        constantSeconds,
        secondsPerInputToken,
        secondsPerOutputToken,
      }),
    }
  })
}

/** Inclusive hard bounds for Cost Level priority. */
export function parsePriorityBounds(minPriorityGwei, maxPriorityGwei) {
  const min = Number(minPriorityGwei)
  const max = Number(maxPriorityGwei)
  if (!(min > 0) || !(max > 0) || min > max) {
    return { min: 1, max: 1_000_000_000 }
  }
  return { min, max }
}

/**
 * Visible log slider axis: pack queue and user with margin, then clamp to hard bounds.
 */
export function computePriorityAxis({
  userPriorityGwei,
  lowestPriorityGwei,
  highestPriorityGwei,
  medianPriorityGwei,
  minPriorityGwei,
  maxPriorityGwei,
}) {
  const { min: hardMin, max: hardMax } = parsePriorityBounds(
    minPriorityGwei,
    maxPriorityGwei,
  )
  const user = Math.max(1, Number(userPriorityGwei) || hardMin)
  const low = Number(lowestPriorityGwei)
  const high = Number(highestPriorityGwei)
  const median = Number(medianPriorityGwei)

  let axisMin
  let axisMax
  if (low > 0 && high > 0) {
    axisMin = Math.min(low, user) / 2
    axisMax = Math.max(high, user) * 2
  } else if (median > 0) {
    axisMin = Math.min(median, user) / 2
    axisMax = Math.max(median, user) * 2
  } else {
    axisMin = user / 2
    axisMax = user * 2
  }

  axisMin = Math.max(hardMin, axisMin)
  axisMax = Math.min(hardMax, Math.max(axisMax, axisMin))
  if (axisMax <= axisMin) {
    axisMax = Math.min(hardMax, axisMin * 2)
  }
  return { axisMin, axisMax, hardMin, hardMax }
}

export function priorityToLogPercent(priorityGwei, axisMin, axisMax) {
  const value = Number(priorityGwei)
  const min = Number(axisMin)
  const max = Number(axisMax)
  if (!(value > 0) || !(min > 0) || !(max > min)) return 0
  const logMin = Math.log(min)
  const logMax = Math.log(max)
  const clamped = Math.min(max, Math.max(min, value))
  return ((Math.log(clamped) - logMin) / (logMax - logMin)) * 100
}

export function logPercentToPriority(percent, axisMin, axisMax) {
  const min = Number(axisMin)
  const max = Number(axisMax)
  if (!(min > 0) || !(max > min)) return Math.round(min) || 1
  const t = Math.min(100, Math.max(0, Number(percent))) / 100
  const logMin = Math.log(min)
  const logMax = Math.log(max)
  const value = Math.exp(logMin + t * (logMax - logMin))
  return Math.max(1, Math.round(value))
}

export function clampPriorityGwei(value, minPriorityGwei, maxPriorityGwei) {
  const { min, max } = parsePriorityBounds(minPriorityGwei, maxPriorityGwei)
  const n = Math.round(Number(value))
  if (!Number.isFinite(n) || n <= 0) return min
  return Math.min(max, Math.max(min, n))
}

export function parsePriorityInput(raw) {
  const cleaned = String(raw ?? '').trim()
  if (!/^\d+$/.test(cleaned)) return null
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.trunc(n)
}

export function formatCredits(credits) {
  return new Intl.NumberFormat('en-US').format(credits)
}

export function formatTokenCount(tokens) {
  const value = Number(tokens)
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US').format(value)
}

export function formatSeconds(seconds) {
  const value = Number(seconds)
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatGwei(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(n)
}
