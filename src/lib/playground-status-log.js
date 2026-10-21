const PHASE_LABELS = {
  sending: 'Sending task',
  queued: 'Queued',
  running: 'Running',
  validating: 'Validating',
  uploading: 'Uploading result',
  finalizing: 'Finalizing',
  success: 'Completed',
  failed: 'Failed',
}

export function phaseLabel(phase) {
  if (!phase || typeof phase !== 'string') return 'Unknown'
  return PHASE_LABELS[phase] || phase
}

export function normalizeStatusLog(value) {
  if (!Array.isArray(value)) return []
  return value
    .filter(
      (entry) =>
        entry &&
        typeof entry === 'object' &&
        typeof entry.at === 'string' &&
        typeof entry.phase === 'string',
    )
    .map((entry) => ({
      at: entry.at,
      phase: entry.phase,
      estimatedCompletionAt:
        typeof entry.estimatedCompletionAt === 'string'
          ? entry.estimatedCompletionAt
          : null,
      message: typeof entry.message === 'string' ? entry.message : '',
    }))
}

export function createStatusLogEntry(task) {
  const phase =
    typeof task?.phase === 'string' && task.phase
      ? task.phase
      : task?.status === 'success'
        ? 'success'
        : task?.status === 'failed'
          ? 'failed'
          : 'queued'
  const estimatedCompletionAt =
    phase === 'running' && typeof task?.estimated_completion_at === 'string'
      ? task.estimated_completion_at
      : null
  const message =
    phase === 'failed' &&
    typeof task?.error_message === 'string' &&
    task.error_message.trim()
      ? task.error_message.trim()
      : ''
  return {
    at: new Date().toISOString(),
    phase,
    estimatedCompletionAt,
    message,
  }
}

export function appendStatusLogEntry(log, task) {
  const next = Array.isArray(log) ? [...log] : []
  const entry = createStatusLogEntry(task)
  const last = next[next.length - 1]
  if (last && last.phase === entry.phase) {
    if (
      entry.phase === 'running' &&
      entry.estimatedCompletionAt &&
      entry.estimatedCompletionAt !== last.estimatedCompletionAt
    ) {
      next[next.length - 1] = {
        ...last,
        estimatedCompletionAt: entry.estimatedCompletionAt,
      }
    }
    if (entry.phase === 'failed' && entry.message && entry.message !== last.message) {
      next[next.length - 1] = { ...last, message: entry.message }
    }
    return next
  }
  next.push(entry)
  return next
}

export function formatLocalDateTime(value) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString()
}
