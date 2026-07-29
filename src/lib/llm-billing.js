/** Fallback unit prices when GET /v1/llm/billing_config is unavailable. */
export const DEFAULT_PROMPT_CREDITS_PER_TOKEN = 1
export const DEFAULT_COMPLETION_CREDITS_PER_TOKEN = 1

export const MILLION_TOKENS = 1_000_000

/** Fallback tiers when GET /v1/llm/billing_config is unavailable. */
export const DEFAULT_VRAM_TIERS = [
  { max_vram: 24, ratio: 0.5 },
  { max_vram: 96, ratio: 1.5 },
]

/**
 * Credits charged for one LLM call.
 * Mirrors AS integer formula: (P*R*V*Pp + C*R*V*Cp) / 100
 * where R and V are display ratios stored as display × 10.
 */
export function estimateCredits({
  promptTokens,
  completionTokens,
  tokenRatio,
  vramRatio,
  promptCreditsPerToken = DEFAULT_PROMPT_CREDITS_PER_TOKEN,
  completionCreditsPerToken = DEFAULT_COMPLETION_CREDITS_PER_TOKEN,
}) {
  const storedTokenRatio = Math.round(Number(tokenRatio) * 10)
  const storedVramRatio = Math.round(Number(vramRatio) * 10)
  const numerator =
    Number(promptTokens) *
      storedTokenRatio *
      storedVramRatio *
      promptCreditsPerToken +
    Number(completionTokens) *
      storedTokenRatio *
      storedVramRatio *
      completionCreditsPerToken
  return Math.trunc(numerator / 100)
}

export function creditsPerMillionTokens({
  tokenRatio,
  vramRatio,
  creditsPerToken = DEFAULT_PROMPT_CREDITS_PER_TOKEN,
}) {
  return estimateCredits({
    promptTokens: MILLION_TOKENS,
    completionTokens: 0,
    tokenRatio,
    vramRatio,
    promptCreditsPerToken: creditsPerToken,
    completionCreditsPerToken: creditsPerToken,
  })
}

export function buildPricingRows(
  tiers,
  tokenRatio,
  {
    promptCreditsPerToken = DEFAULT_PROMPT_CREDITS_PER_TOKEN,
    completionCreditsPerToken = DEFAULT_COMPLETION_CREDITS_PER_TOKEN,
  } = {},
) {
  const sorted = [...tiers].sort((a, b) => a.max_vram - b.max_vram)
  return sorted.map((tier, index) => {
    const prevMax = index > 0 ? sorted[index - 1].max_vram : 0
    const isLast = index === sorted.length - 1
    let name
    if (index === 0 && isLast) {
      name = `All models (≤${tier.max_vram} GB tier)`
    } else if (index === 0) {
      name = `≤${tier.max_vram} GB VRAM`
    } else if (isLast) {
      name = `>${prevMax} GB VRAM`
    } else {
      name = `${prevMax + 1}–${tier.max_vram} GB VRAM`
    }
    return {
      id: `vram-${tier.max_vram}`,
      name,
      maxVram: tier.max_vram,
      inputCredits: creditsPerMillionTokens({
        tokenRatio,
        vramRatio: tier.ratio,
        creditsPerToken: promptCreditsPerToken,
      }),
      outputCredits: creditsPerMillionTokens({
        tokenRatio,
        vramRatio: tier.ratio,
        creditsPerToken: completionCreditsPerToken,
      }),
    }
  })
}

export function formatCredits(credits) {
  return new Intl.NumberFormat('en-US').format(credits)
}
