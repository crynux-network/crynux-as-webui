/**
 * Shared billable_gwei helpers for Credits and execution-time examples.
 *
 * billable_gwei = priority_gwei * estimated_node_seconds * vram_weight
 * credits = floor(billable_gwei * G)
 *
 * Live request charging applies max(1, ...) on the server. These helpers
 * are for Credits-per-token example cells and MUST NOT apply that floor.
 */

import {
  formatMinVramLabel,
  modelExecutionDtype,
  modelQuantizationConfig,
  modelReplacedComponents,
  quantizationBitLabel,
  stableQuantizationKey,
} from '@/lib/model-tags'

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

export function imagePixelStepUnits({
  numImages = 1,
  width,
  height,
  steps,
}) {
  return (
    Number(numImages) * Number(width) * Number(height) * Number(steps)
  )
}

export function estimateImageExecutionSeconds({
  overheadSeconds = 0,
  secondsPerSdPixelStep = 0,
  numImages = 1,
  width,
  height,
  steps,
}) {
  const units = imagePixelStepUnits({ numImages, width, height, steps })
  return Number(overheadSeconds) + Number(secondsPerSdPixelStep) * units
}

export function estimateImageCredits({
  priorityGwei,
  minVram,
  baseVram,
  creditsPerGwei,
  overheadSeconds = 0,
  secondsPerSdPixelStep = 0,
  numImages = 1,
  width,
  height,
  steps,
}) {
  const prio = Number(priorityGwei)
  const g = Number(creditsPerGwei)
  if (!(prio > 0) || !(g > 0)) return 0

  const weight = vramWeight(minVram, baseVram)
  if (!(weight > 0)) return 0

  const estimatedNodeSeconds = estimateImageExecutionSeconds({
    overheadSeconds,
    secondsPerSdPixelStep,
    numImages,
    width,
    height,
    steps,
  })
  if (!(estimatedNodeSeconds >= 0)) return 0

  const billableGwei = prio * estimatedNodeSeconds * weight
  return Math.trunc(billableGwei * g)
}

function imageComponentRepoLabels(example) {
  return modelReplacedComponents(example)
    .map((row) => {
      if (row.quantBitLabel) return `${row.repo}-${row.quantBitLabel}`
      return row.repo
    })
    .filter(Boolean)
}

export function buildImageExampleRows({
  examples,
  priorityGwei,
  baseVram,
  creditsPerGwei,
  exampleWidth,
  exampleHeight,
  exampleSteps,
  exampleNumImages,
}) {
  const rows = Array.isArray(examples) ? examples : []
  const width = Number(exampleWidth)
  const height = Number(exampleHeight)
  const steps = Number(exampleSteps)
  const numImages = Number(exampleNumImages)
  return rows.map((example) => {
    const minVram = Number(example.min_vram)
    const overheadSeconds = Number(example.overhead_seconds)
    const secondsPerSdPixelStep = Number(example.seconds_per_sd_pixel_step)
    const executionDtype =
      typeof example.execution_dtype === 'string' && example.execution_dtype
        ? example.execution_dtype
        : modelExecutionDtype(example)
    const quantizationConfig = modelQuantizationConfig(example)
    const componentRepos = imageComponentRepoLabels(example)
    return {
      id: `${example.model}-${minVram}-${executionDtype}-${stableQuantizationKey(quantizationConfig)}-${componentRepos.join('|')}`,
      model: example.model,
      minVram,
      minVramLabel: formatMinVramLabel(minVram),
      executionDtype,
      quantizationLabel: quantizationBitLabel(quantizationConfig),
      componentRepos,
      sizeLabel: `${width}×${height}`,
      steps,
      credits: estimateImageCredits({
        priorityGwei,
        minVram,
        baseVram,
        creditsPerGwei,
        overheadSeconds,
        secondsPerSdPixelStep,
        numImages,
        width,
        height,
        steps,
      }),
      executionSeconds: estimateImageExecutionSeconds({
        overheadSeconds,
        secondsPerSdPixelStep,
        numImages,
        width,
        height,
        steps,
      }),
    }
  })
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
    const executionDtype =
      typeof example.execution_dtype === 'string' && example.execution_dtype
        ? example.execution_dtype
        : modelExecutionDtype(example)
    const quantizationConfig = modelQuantizationConfig(example)
    return {
      id: `${example.model}-${minVram}-${executionDtype}-${stableQuantizationKey(quantizationConfig)}`,
      model: example.model,
      minVram,
      minVramLabel: formatMinVramLabel(minVram),
      executionDtype,
      quantizationLabel: quantizationBitLabel(quantizationConfig),
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

/** One Static Cost Level kgwei unit in Gwei. */
export const PRIORITY_GWEI_PER_KGWEI = 1000

/** Inclusive hard bounds for Static Cost Level priority in Gwei. */
export function parsePriorityBounds(minPriorityGwei, maxPriorityGwei) {
  const min = Number(minPriorityGwei)
  const max = Number(maxPriorityGwei)
  if (!(min > 0) || !(max > 0) || min > max) {
    return { min: PRIORITY_GWEI_PER_KGWEI, max: 1_000_000_000 }
  }
  return { min, max }
}

/** Round a Gwei Cost Level to the nearest integer kgwei for display. */
export function gweiToDisplayKgwei(priorityGwei) {
  const n = Number(priorityGwei)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n / PRIORITY_GWEI_PER_KGWEI)
}

/** Convert a positive integer kgwei input to Gwei. */
export function kgweiToGwei(kgwei) {
  const n = Math.trunc(Number(kgwei))
  if (!Number.isFinite(n) || n <= 0) return null
  return n * PRIORITY_GWEI_PER_KGWEI
}

/** Quantize a Gwei value to the nearest integer kgwei within hard bounds. */
export function quantizePriorityGweiToKgwei(
  value,
  minPriorityGwei,
  maxPriorityGwei,
) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) {
    return clampPriorityGwei(
      PRIORITY_GWEI_PER_KGWEI,
      minPriorityGwei,
      maxPriorityGwei,
    )
  }
  const quantized =
    Math.round(n / PRIORITY_GWEI_PER_KGWEI) * PRIORITY_GWEI_PER_KGWEI
  return clampPriorityGwei(quantized, minPriorityGwei, maxPriorityGwei)
}

function positiveNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Visible log slider axis: pack queue, provider hints, and user with margin,
 * then clamp to hard bounds.
 */
export function computePriorityAxis({
  userPriorityGwei,
  lowestPriorityGwei,
  highestPriorityGwei,
  providerLowestPriorityGwei,
  providerHighestPriorityGwei,
  providerMinPriorityGwei,
  medianPriorityGwei,
  minPriorityGwei,
  maxPriorityGwei,
}) {
  const { min: hardMin, max: hardMax } = parsePriorityBounds(
    minPriorityGwei,
    maxPriorityGwei,
  )
  const user = Math.max(hardMin, Number(userPriorityGwei) || hardMin)
  const points = [user]
  for (const value of [
    lowestPriorityGwei,
    highestPriorityGwei,
    providerLowestPriorityGwei,
    providerHighestPriorityGwei,
    providerMinPriorityGwei,
    medianPriorityGwei,
  ]) {
    const n = positiveNumber(value)
    if (n != null) points.push(n)
  }

  const low = Math.min(...points)
  const high = Math.max(...points)
  let axisMin = low / 2
  let axisMax = high * 2

  axisMin = Math.max(hardMin, axisMin)
  axisMax = Math.min(hardMax, Math.max(axisMax, axisMin))
  if (axisMax <= axisMin) {
    axisMax = Math.min(hardMax, axisMin * 2)
  }
  return { axisMin, axisMax, hardMin, hardMax }
}

/**
 * Visible log slider axis for Auto Max Credits: pack the current value and
 * Provider minimum Credits markers with margin, then clamp to hard bounds.
 */
export function computeCreditsAxis({
  userCredits,
  providerMinCreditsCheapest,
  providerMinCreditsExpensive,
  hardMin = 1,
  hardMax = 10_000,
}) {
  const minBound = Number(hardMin) > 0 ? Number(hardMin) : 1
  const maxBound =
    Number(hardMax) > minBound ? Number(hardMax) : 10_000
  const user = Math.max(minBound, Number(userCredits) || minBound)
  const points = [user]
  for (const value of [
    providerMinCreditsCheapest,
    providerMinCreditsExpensive,
  ]) {
    const point = positiveNumber(value)
    if (point != null) points.push(point)
  }

  const low = Math.min(...points)
  const high = Math.max(...points)
  let axisMin = low / 2
  let axisMax = high * 2

  axisMin = Math.max(minBound, axisMin)
  axisMax = Math.min(maxBound, Math.max(axisMax, axisMin))
  if (axisMax <= axisMin) {
    axisMax = Math.min(maxBound, axisMin * 2)
  }
  return { axisMin, axisMax, hardMin: minBound, hardMax: maxBound }
}

/** Map a live queue low/high pair onto the current log axis. */
export function mapQueueRangeBar({
  lowestPriorityGwei,
  highestPriorityGwei,
  axisMin,
  axisMax,
}) {
  const low = Number(lowestPriorityGwei)
  const high = Number(highestPriorityGwei)
  if (!(low > 0) || !(high > 0)) return null

  const outOfRange =
    (low < axisMin && high < axisMin) || (low > axisMax && high > axisMax)
  const minPercent = priorityToLogPercent(low, axisMin, axisMax)
  const maxPercent = priorityToLogPercent(high, axisMin, axisMax)
  const left = Math.min(minPercent, maxPercent)
  const right = Math.max(minPercent, maxPercent)
  return {
    outOfRange,
    minPercent,
    maxPercent,
    blueLeft: left,
    blueWidth: right - left,
  }
}

export function isProviderAvailableForCostLevel({
  mode,
  priorityGwei,
  autoMaxCreditsPerTask,
  providerMinPriorityGwei,
  providerMinCreditsExpensive,
}) {
  if (String(mode || 'static') === 'auto') {
    const maxCredits = Number(autoMaxCreditsPerTask)
    const expensive = Number(providerMinCreditsExpensive)
    if (!(maxCredits > 0) || !(expensive > 0)) return false
    return maxCredits >= expensive
  }
  const priority = Number(priorityGwei)
  const minPriority = Number(providerMinPriorityGwei)
  if (!(priority > 0) || !(minPriority > 0)) return false
  return priority >= minPriority
}

/** Max Credits coverage for the reference Provider min workload. */
export function providerMaxCreditsCoverage({
  autoMaxCreditsPerTask,
  providerMinCreditsCheapest,
  providerMinCreditsExpensive,
}) {
  const maxCredits = Number(autoMaxCreditsPerTask)
  const cheapest = Number(providerMinCreditsCheapest)
  const expensive = Number(providerMinCreditsExpensive)
  if (!(maxCredits > 0)) return 'none'
  if (expensive > 0 && maxCredits >= expensive) return 'all'
  if (cheapest > 0 && maxCredits >= cheapest) return 'cheapest'
  return 'none'
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
  if (!(min > 0) || !(max > min)) {
    return Math.max(PRIORITY_GWEI_PER_KGWEI, Math.round(min) || PRIORITY_GWEI_PER_KGWEI)
  }
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

/** Parse a positive integer kgwei input and return Gwei, or null. */
export function parseKgweiInput(raw) {
  const kgwei = parsePriorityInput(raw)
  if (kgwei == null) return null
  return kgweiToGwei(kgwei)
}

export function formatCredits(credits) {
  return new Intl.NumberFormat('en-US').format(credits)
}

/** Cost Level example cells: floor may be 0; show <1 instead of 0. */
export function formatExampleCredits(credits) {
  const value = Number(credits)
  if (!Number.isFinite(value) || value <= 0) return '<1'
  return formatCredits(value)
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

/** Format a Gwei Cost Level as an integer kgwei display string. */
export function formatKgwei(value) {
  const kgwei = gweiToDisplayKgwei(value)
  if (kgwei == null) return '—'
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(kgwei)
}

export function defaultAutoMaxCreditsPerTask(defaultFromConfig) {
  const n = Number(defaultFromConfig)
  if (Number.isFinite(n) && n > 0) return Math.trunc(n)
  return 100
}

export function parseCreditsInput(raw) {
  return parsePriorityInput(raw)
}

export function clampCredits(value, fallback = 100) {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n) || n <= 0) {
    const fb = Math.round(Number(fallback))
    return Number.isFinite(fb) && fb > 0 ? fb : 100
  }
  return n
}

export const AUTO_QUEUE_POSITION_MIN = 1
export const AUTO_QUEUE_POSITION_MAX = 99
/** Fixed decorative red margin on each side of the Auto queue-position range bar. */
export const AUTO_QUEUE_POSITION_BAR_MARGIN = 10

export function normalizeAutoQueuePosition(value, fallback = 50) {
  const n = Number(value)
  if (!Number.isFinite(n)) {
    return Math.min(
      AUTO_QUEUE_POSITION_MAX,
      Math.max(AUTO_QUEUE_POSITION_MIN, Math.round(Number(fallback)) || 50),
    )
  }
  return Math.min(
    AUTO_QUEUE_POSITION_MAX,
    Math.max(AUTO_QUEUE_POSITION_MIN, Math.round(n)),
  )
}

/**
 * List-row cost-level position against the live queue (or median band).
 * Color is a discrete palette from the range status and in-range label.
 */
export function getProjectQueuePosition({
  priorityGwei,
  lowestPriorityGwei,
  highestPriorityGwei,
  medianPriorityGwei,
}) {
  const priority = Number(priorityGwei)
  if (!(priority > 0)) return null

  let low = Number(lowestPriorityGwei)
  let high = Number(highestPriorityGwei)
  let usedMedianBand = false
  if (!(low > 0 && high > 0)) {
    const median = Number(medianPriorityGwei)
    if (!(median > 0)) return null
    low = median / 2
    high = median * 2
    usedMedianBand = true
  }
  if (!(high > low)) return null

  const logLow = Math.log(low)
  const logHigh = Math.log(high)
  const raw = (Math.log(priority) - logLow) / (logHigh - logLow)
  const tone = Math.min(1, Math.max(0, raw))

  let inRange
  let rangeStatus
  let label
  if (priority < low) {
    inRange = false
    rangeStatus = 'too_low'
    label = null
  } else if (priority > high) {
    inRange = false
    rangeStatus = 'too_high'
    label = null
  } else {
    inRange = true
    rangeStatus = 'in_range'
    label = queuePositionLabel(tone)
  }

  return {
    tone,
    color: queueStatusColor(rangeStatus, label),
    inRange,
    rangeStatus,
    label,
    usedMedianBand,
  }
}

const QUEUE_POSITION_LABELS = [
  'Slowest',
  'Slower',
  'Balanced',
  'Faster',
  'Fastest',
]

/** Discrete colors: low side red, mid blue, high side yellow. */
const QUEUE_STATUS_COLORS = {
  too_low: 'rgb(185, 28, 28)',
  Slowest: 'rgb(220, 38, 38)',
  Slower: 'rgb(239, 68, 68)',
  Balanced: 'rgb(37, 99, 235)',
  Faster: 'rgb(202, 138, 4)',
  Fastest: 'rgb(234, 179, 8)',
  too_high: 'rgb(245, 158, 11)',
}

function queuePositionLabel(tone) {
  const t = Math.min(1, Math.max(0, Number(tone)))
  if (t < 0.2) return QUEUE_POSITION_LABELS[0]
  if (t < 0.4) return QUEUE_POSITION_LABELS[1]
  if (t < 0.6) return QUEUE_POSITION_LABELS[2]
  if (t < 0.8) return QUEUE_POSITION_LABELS[3]
  return QUEUE_POSITION_LABELS[4]
}

function queueStatusColor(rangeStatus, label) {
  if (rangeStatus === 'too_low') return QUEUE_STATUS_COLORS.too_low
  if (rangeStatus === 'too_high') return QUEUE_STATUS_COLORS.too_high
  if (label && QUEUE_STATUS_COLORS[label]) return QUEUE_STATUS_COLORS[label]
  return QUEUE_STATUS_COLORS.Balanced
}

const QUEUE_IN_RANGE_PHRASES = {
  Slowest: 'near the minimum',
  Slower: 'below the middle',
  Balanced: 'near the middle',
  Faster: 'above the middle',
  Fastest: 'near the maximum',
}

function hasLiveQueueBounds(lowestPriorityGwei, highestPriorityGwei) {
  const low = Number(lowestPriorityGwei)
  const high = Number(highestPriorityGwei)
  return low > 0 && high > 0 && high >= low
}

/** One project-list hint line with independent color styling. */
export function buildQueueHintLine(prefix, position, { empty = false } = {}) {
  if (empty || !position) {
    return {
      text: `${prefix}: empty.`,
      color: null,
      muted: true,
      tone: 'muted',
    }
  }
  if (position.rangeStatus === 'too_low') {
    return {
      text: `${prefix}: below the current range.`,
      color: position.color,
      muted: false,
      tone: 'queue',
    }
  }
  if (position.rangeStatus === 'too_high') {
    return {
      text: `${prefix}: above the current range.`,
      color: position.color,
      muted: false,
      tone: 'queue',
    }
  }
  const phrase = QUEUE_IN_RANGE_PHRASES[position.label] || 'in range'
  return {
    text: `${prefix}: ${phrase}.`,
    color: position.color,
    muted: false,
    tone: 'queue',
  }
}

function providerAvailabilityHintLine(coverage) {
  if (coverage === 'all') {
    return {
      text: 'Provider models are available.',
      color: null,
      muted: false,
      tone: 'ok',
    }
  }
  if (coverage === 'cheapest') {
    return {
      text: 'Cheapest Provider models are available. More expensive Provider models are unavailable because Max Credits is too low.',
      color: null,
      muted: false,
      tone: 'warn',
    }
  }
  return {
    text: 'Provider models are unavailable because Max Credits is too low.',
    color: null,
    muted: false,
    tone: 'warn',
  }
}

/**
 * Project list Cost Level description lines for Auto and Static modes.
 * Each line carries its own color tone for independent styling.
 */
export function buildProjectListCostLevelHints({
  mode,
  priorityGwei,
  autoMaxCreditsPerTask,
  lowestPriorityGwei,
  highestPriorityGwei,
  medianPriorityGwei,
  providerLowestPriorityGwei,
  providerHighestPriorityGwei,
  providerQueueHasJobs,
  providerMinPriorityGwei,
  providerMinCreditsCheapest,
  providerMinCreditsExpensive,
}) {
  const lines = []
  const creditsCoverage = providerMaxCreditsCoverage({
    autoMaxCreditsPerTask,
    providerMinCreditsCheapest,
    providerMinCreditsExpensive,
  })

  if (String(mode || 'static') === 'auto') {
    lines.push(providerAvailabilityHintLine(creditsCoverage))
    return { lines, openSourcePosition: null }
  }

  const openSourceLive = hasLiveQueueBounds(
    lowestPriorityGwei,
    highestPriorityGwei,
  )
  const openSourcePosition = openSourceLive
    ? getProjectQueuePosition({
        priorityGwei,
        lowestPriorityGwei,
        highestPriorityGwei,
        medianPriorityGwei,
      })
    : null

  lines.push(buildQueueHintLine('Open source queue', openSourcePosition))

  const costLevelOk = isProviderAvailableForCostLevel({
    mode: 'static',
    priorityGwei,
    providerMinPriorityGwei,
  })
  const providerEnabled = costLevelOk && creditsCoverage !== 'none'

  if (!costLevelOk) {
    lines.push({
      text: 'Provider models are unavailable because Cost Level is too low.',
      color: null,
      muted: false,
      tone: 'warn',
    })
    return { lines, openSourcePosition }
  }

  if (!providerEnabled) {
    lines.push({
      text: 'Provider models are unavailable because Max Credits is too low.',
      color: null,
      muted: false,
      tone: 'warn',
    })
    return { lines, openSourcePosition }
  }

  const providerLive =
    Boolean(providerQueueHasJobs) &&
    hasLiveQueueBounds(providerLowestPriorityGwei, providerHighestPriorityGwei)
  lines.push(
    buildQueueHintLine(
      'Provider queue',
      providerLive
        ? getProjectQueuePosition({
            priorityGwei,
            lowestPriorityGwei: providerLowestPriorityGwei,
            highestPriorityGwei: providerHighestPriorityGwei,
          })
        : null,
      { empty: !providerLive },
    ),
  )

  if (creditsCoverage === 'cheapest') {
    lines.push({
      text: 'Some expensive Provider models are unavailable because Max Credits is too low.',
      color: null,
      muted: false,
      tone: 'warn',
    })
  }

  return { lines, openSourcePosition }
}
