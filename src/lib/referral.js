const INVITE_CODE_STORAGE_KEY = 'crynux-as-invite-code'

export function readStoredInviteCode() {
  try {
    return String(sessionStorage.getItem(INVITE_CODE_STORAGE_KEY) || '').trim()
  } catch {
    return ''
  }
}

export function storeInviteCode(code) {
  const value = String(code || '').trim()
  try {
    if (!value) {
      sessionStorage.removeItem(INVITE_CODE_STORAGE_KEY)
      return
    }
    sessionStorage.setItem(INVITE_CODE_STORAGE_KEY, value)
  } catch {
    // Ignore storage failures; login can continue without a persisted code.
  }
}

export function clearStoredInviteCode() {
  storeInviteCode('')
}

export function buildReferralLink(inviteCode) {
  const code = String(inviteCode || '').trim()
  if (!code || typeof window === 'undefined') return ''
  const url = new URL(window.location.origin)
  url.searchParams.set('ref', code)
  return url.toString()
}

export function purchaseTypeLabel(type) {
  switch (type) {
    case 'purchase':
      return 'Purchase'
    case 'signup_bonus':
      return 'Signup bonus'
    case 'invitee_bonus':
      return 'Invitee bonus'
    default:
      return type || '—'
  }
}

export function shortAddress(address) {
  if (!address || address.length < 12) return address || '—'
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export function formatDepositRewardPercent(ratio) {
  const n = Number(ratio)
  if (!Number.isFinite(n) || n < 0) return null
  const pct = n * 100
  if (!Number.isFinite(pct)) return null
  if (Number.isInteger(pct)) return String(pct)
  return String(Number(pct.toFixed(4)).toString())
}

export function nextPurchaseBonusTierMin(priorPurchaseCount, purchaseBonusTiers) {
  const prior = Number(priorPurchaseCount)
  if (!Number.isFinite(prior) || prior < 0) return null
  const tiers = normalizePurchaseBonusTiers(purchaseBonusTiers)
  for (const tier of tiers) {
    if (tier.minPurchases > prior) return tier.minPurchases
  }
  return null
}

export function formatPurchaseProgress(priorPurchaseCount, purchaseBonusTiers) {
  const prior = Number(priorPurchaseCount)
  if (!Number.isFinite(prior) || prior < 0) return '—'
  const next = nextPurchaseBonusTierMin(prior, purchaseBonusTiers)
  if (next == null) return String(prior)
  return `${prior}/${next}`
}

export function normalizePurchaseBonusTiers(purchaseBonusTiers) {
  const tiers = Array.isArray(purchaseBonusTiers) ? [...purchaseBonusTiers] : []
  tiers.sort((a, b) => Number(a?.min_purchases ?? 0) - Number(b?.min_purchases ?? 0))
  const rows = []
  for (const tier of tiers) {
    const minPurchases = Number(tier?.min_purchases)
    const extraPercent = formatDepositRewardPercent(tier?.extra_ratio)
    if (
      !Number.isFinite(minPurchases) ||
      minPurchases <= 0 ||
      extraPercent == null ||
      Number(extraPercent) <= 0
    ) {
      continue
    }
    rows.push({ minPurchases, extraPercent })
  }
  return rows
}

export function buildReferralRulesIntro({
  depositRewardRatio,
  inviteeBonus,
  purchaseBonusTiers,
  formatCreditsValue,
} = {}) {
  const parts = []
  const invitee = Number(inviteeBonus)
  if (Number.isFinite(invitee) && invitee > 0) {
    parts.push(
      `New users who use your link get ${formatCreditsValue(invitee)} extra Credits.`,
    )
  }

  const percent = formatDepositRewardPercent(depositRewardRatio)
  if (percent != null && Number(percent) > 0) {
    parts.push(
      `You earn ${percent}% of the Credits from each of their purchases.`,
    )
  }

  const tiers = normalizePurchaseBonusTiers(purchaseBonusTiers)
  if (tiers.length > 0) {
    parts.push(
      'After enough of their purchases, you also earn extra percentages on each later purchase.',
    )
  }

  return parts.join(' ')
}
