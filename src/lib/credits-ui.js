import ApiError from '@/api/api-error'
import config from '@/config.json'
import { resolveTxExplorerBase } from '@/lib/appkit-networks'
import { formatCredits } from '@/lib/llm-billing'

const PAGE_SIZE = 20

export { PAGE_SIZE }

export function creditsErrorMessage(error, fallback) {
  if (error instanceof ApiError) {
    if (error.type === ApiError.Type.Validation && error.detail) {
      return error.detail
    }
    if (error.type === ApiError.Type.Unauthorized) {
      return 'Session expired. Please sign in again.'
    }
  }
  return fallback
}

export function formatCreditsValue(value) {
  if (value == null || value === '') return '0'
  const n = Number(value)
  if (!Number.isFinite(n)) return String(value)
  return formatCredits(n)
}

export function formatRecordTime(value) {
  if (value == null || value === '') return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString()
}

export function shortTxHash(hash) {
  if (!hash || hash.length < 12) return hash || '—'
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`
}

export function explorerTxUrl(chainId, txHash) {
  if (!txHash) return null
  const entry = config.networks?.find((network) => Number(network.id) === Number(chainId))
  const base = resolveTxExplorerBase(chainId, entry)
  if (!base) return null
  return `${base}/${txHash}`
}

/**
 * Estimate Credits for a human token amount using integer arithmetic:
 * credits = floor(raw * credits_per_token / 10^decimals)
 * where raw = round(human * 10^decimals)
 */
export function estimatePurchaseCredits(humanAmount, decimals, creditsPerToken) {
  const text = String(humanAmount ?? '').trim()
  if (!text || !/^\d+(\.\d+)?$/.test(text)) return null

  const [wholePart, fracPart = ''] = text.split('.')
  if (fracPart.length > decimals) return null

  const paddedFrac = fracPart.padEnd(decimals, '0')
  const rawStr = `${wholePart}${paddedFrac}`.replace(/^0+(?=\d)/, '') || '0'
  const raw = BigInt(rawStr)
  const scale = 10n ** BigInt(decimals)
  const credits = (raw * BigInt(creditsPerToken)) / scale
  return credits.toString()
}

export function integerTokenToRaw(amount, decimals) {
  return BigInt(amount) * 10n ** BigInt(decimals)
}

export function isUserRejectedError(error) {
  const code = error?.code ?? error?.cause?.code ?? error?.cause?.cause?.code
  if (code === 4001 || code === 'ACTION_REJECTED' || code === '4001') return true
  const name = String(error?.name || error?.cause?.name || '')
  if (name === 'UserRejectedRequestError') return true
  const message = String(
    error?.shortMessage || error?.message || error?.cause?.message || '',
  ).toLowerCase()
  return (
    message.includes('user rejected') ||
    message.includes('user denied') ||
    message.includes('rejected the request')
  )
}

export function parseIntegerAmount(text) {
  const trimmed = String(text ?? '').trim()
  if (!trimmed || !/^\d+$/.test(trimmed)) return null
  const amount = BigInt(trimmed)
  if (amount <= 0n) return null
  return amount
}

export function formatTokenBalance(rawAmount, decimals) {
  const scale = 10n ** BigInt(decimals)
  const raw = BigInt(rawAmount)
  const whole = raw / scale
  const frac = raw % scale

  let cents
  if (decimals <= 2) {
    cents = Number(frac) * 10 ** (2 - decimals)
  } else {
    const drop = 10n ** BigInt(decimals - 2)
    cents = Number(frac / drop)
  }

  const wholeText = whole.toLocaleString('en-US')
  return `${wholeText}.${String(cents).padStart(2, '0')}`
}
