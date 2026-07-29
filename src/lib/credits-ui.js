import ApiError from '@/api/api-error'
import { formatCredits } from '@/lib/llm-billing'

const PAGE_SIZE = 20

const DEPOSIT_STATUS = {
  0: 'Pending',
  1: 'Processed',
  2: 'Invalid',
}

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

export function formatDepositStatus(status) {
  return DEPOSIT_STATUS[status] ?? String(status)
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
  if (Number(chainId) === 1) return `https://etherscan.io/tx/${txHash}`
  if (Number(chainId) === 8453) return `https://basescan.org/tx/${txHash}`
  return null
}

/**
 * Estimate Credits for a human token amount using integer arithmetic:
 * credits = floor(raw * credits_per_token / 10^decimals)
 * where raw = round(human * 10^decimals)
 */
export function estimateDepositCredits(humanAmount, decimals, creditsPerToken) {
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

export function buildPaymentAsset(network, token) {
  const symbol = String(token.name || '').toUpperCase()
  return {
    network: `eip155:${network.chain_id}`,
    asset: token.address,
    metadata: {
      name: symbol,
      symbol,
      decimals: Number(token.decimals),
    },
  }
}

export function parseHumanAmount(text) {
  const trimmed = String(text ?? '').trim()
  if (!trimmed || !/^\d+(\.\d+)?$/.test(trimmed)) return null
  const n = Number(trimmed)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}
