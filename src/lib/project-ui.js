import ApiError from '@/api/api-error'

export function projectErrorMessage(error, fallback) {
  if (error instanceof ApiError) {
    if (error.type === ApiError.Type.Validation && error.detail) {
      return error.detail
    }
    if (error.type === ApiError.Type.NotFound) {
      return 'Project not found.'
    }
    if (error.type === ApiError.Type.Unauthorized) {
      return 'Session expired. Please sign in again.'
    }
  }
  return fallback
}

export function projectStatusLabel(status) {
  if (status === 0) return 'Active'
  if (status === 1) return 'Disabled'
  return String(status)
}

export function formatProjectCreatedAt(unixSeconds) {
  if (unixSeconds == null) return '—'
  const date = new Date(Number(unixSeconds) * 1000)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString()
}

export async function copyText(text) {
  await navigator.clipboard.writeText(text)
}
