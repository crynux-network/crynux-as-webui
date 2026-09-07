/**
 * Shared billable_gwei helpers for Credits and execution-time examples.
 *
 * billable_gwei = Pref * R * estimated_node_seconds * vram_weight
 * credits = floor(billable_gwei * G)
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
  tokenRatio,
  minVram,
  baseVram,
  referencePriorityGwei,
  creditsPerGwei,
  constantSeconds = 0,
  secondsPerInputToken = 0,
  secondsPerOutputToken = 0,
}) {
  const pref = Number(referencePriorityGwei)
  const g = Number(creditsPerGwei)
  const r = Number(tokenRatio)
  if (!(pref > 0) || !(g > 0) || !(r > 0)) return 0

  const weight = vramWeight(minVram, baseVram)
  if (!(weight > 0)) return 0

  const estimatedNodeSeconds =
    Number(constantSeconds) +
    Number(secondsPerInputToken) * Number(promptTokens) +
    Number(secondsPerOutputToken) * Number(completionTokens)

  if (!(estimatedNodeSeconds >= 0)) return 0

  const billableGwei = pref * r * estimatedNodeSeconds * weight
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
  tokenRatio,
  baseVram,
  referencePriorityGwei,
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
        tokenRatio,
        minVram,
        baseVram,
        referencePriorityGwei,
        creditsPerGwei,
        constantSeconds: 0,
        secondsPerInputToken,
        secondsPerOutputToken: 0,
      }),
      outputCredits: estimateCredits({
        promptTokens: 0,
        completionTokens: pricingCompletionTokens,
        tokenRatio,
        minVram,
        baseVram,
        referencePriorityGwei,
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

export function effectivePriorityGwei(referencePriorityGwei, tokenRatio) {
  const pref = Number(referencePriorityGwei)
  const r = Number(tokenRatio)
  if (!(pref > 0) || !(r > 0)) return 0
  return pref * r
}

export function queuePositionRatio(referencePriorityGwei, tokenRatio, medianPriorityGwei) {
  const effective = effectivePriorityGwei(referencePriorityGwei, tokenRatio)
  const median = Number(medianPriorityGwei)
  if (!(median > 0) || !(effective > 0)) return null
  return effective / median
}

/** Maps a queue priority to the matching cost level: priority / Pref. */
export function priorityToCostLevel(priorityGwei, referencePriorityGwei) {
  const pref = Number(referencePriorityGwei)
  const priority = Number(priorityGwei)
  if (!(pref > 0) || !(priority > 0)) return null
  return priority / pref
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
    maximumFractionDigits: 4,
  }).format(n)
}

export function formatQueueRatio(ratio) {
  if (ratio == null || !Number.isFinite(ratio)) return '—'
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(ratio)
}
