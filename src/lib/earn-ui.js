import ApiError from '@/api/api-error'
import config from '@/config.json'
import { resolveTxExplorerBase } from '@/lib/appkit-networks'

export { formatCnx, parseCnxToWei } from '@/lib/cnx'

export function earnErrorMessage(error, fallback) {
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

export function formatRecordTime(value) {
  if (value == null || value === '') return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString()
}

export function formatDurationMs(ms) {
  const n = Number(ms)
  if (!Number.isFinite(n) || n < 0) return '—'
  if (n < 1000) return `${Math.round(n)} ms`
  return `${(n / 1000).toFixed(n < 10_000 ? 2 : 1)} s`
}

export function shortAddress(address) {
  if (!address || address.length < 12) return address || '—'
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export function isZeroAddress(address) {
  if (!address) return true
  return /^0x0{40}$/i.test(String(address).trim())
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

export function providerDisplayName(providers, id) {
  const match = (providers || []).find((p) => p.id === id)
  return match?.display_name || id || '—'
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
