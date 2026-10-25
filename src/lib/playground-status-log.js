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

const PHASE_EXPLANATIONS = {
  sending: {
    icon: 'send',
    text: 'Submitting the task.',
  },
  queued: {
    icon: 'clock',
    text: 'Waiting in queue.',
  },
  running: {
    icon: 'cpu',
    text: 'Running on a node.',
  },
  validating: {
    icon: 'shield',
    text: 'Verifying the result on the network.',
  },
  uploading: {
    icon: 'upload',
    text: 'Finishing the task.',
  },
  finalizing: {
    icon: 'download',
    text: 'Getting the result.',
  },
  success: {
    icon: 'check',
    text: 'Completed.',
  },
  failed: {
    icon: 'alert',
    text: 'Failed.',
  },
}

const ERROR_MESSAGE_LABELS = {
  timeout: 'Timed out',
  model_download_failed: 'Model unavailable',
  incorrect_result: 'Failed',
  task_fee_too_low: 'Fee too low',
  group_timeout: 'Failed',
  error_reported: 'Node error',
  creator_cancelled: 'Cancelled',
  creator_validation_timeout: 'Timed out',
  result_upload_timeout: 'Timed out',
  node_slashed: 'Failed',
  group_refund: 'Failed',
  parameters_validation_failed: 'Invalid parameters',
  failed: 'Failed',
}

const ERROR_MESSAGE_EXPLANATIONS = {
  timeout: 'Timed out.',
  model_download_failed: 'Could not load the model.',
  incorrect_result: 'Task failed.',
  task_fee_too_low: 'Task fee was too low.',
  group_timeout: 'Task failed.',
  error_reported: 'The node reported an error.',
  creator_cancelled: 'Cancelled.',
  creator_validation_timeout: 'Timed out.',
  result_upload_timeout: 'Timed out.',
  node_slashed: 'Task failed.',
  group_refund: 'Task failed.',
  parameters_validation_failed: 'Invalid parameters.',
  failed: 'Task failed.',
}

export function phaseLabel(phase) {
  if (!phase || typeof phase !== 'string') return 'Unknown'
  return PHASE_LABELS[phase] || phase
}

export function phaseExplanation(phase) {
  if (!phase || typeof phase !== 'string') {
    return { phase: 'unknown', icon: 'clock', text: 'Unknown status.' }
  }
  const known = PHASE_EXPLANATIONS[phase]
  if (known) {
    return { phase, icon: known.icon, text: known.text }
  }
  return { phase, icon: 'clock', text: phase }
}

export function errorMessageLabel(message) {
  if (!message || typeof message !== 'string') return ''
  const key = message.trim()
  if (!key) return ''
  return ERROR_MESSAGE_LABELS[key] || key
}

export function errorMessageExplanation(message) {
  if (!message || typeof message !== 'string') return ''
  const key = message.trim()
  if (!key) return ''
  return ERROR_MESSAGE_EXPLANATIONS[key] || key
}

export function requestStatusSecondaryLine(request) {
  if (!request || typeof request !== 'object') return null
  if (request.status === 'queued' || request.status === 'in_progress') {
    return phaseExplanation(request.phase || 'queued')
  }
  if (request.status === 'failed') {
    const text = errorMessageExplanation(request.error_message)
    if (!text) return null
    return { phase: 'failed', icon: 'alert', text }
  }
  return null
}

export function statusLogLineExplanation(entry) {
  if (!entry || typeof entry !== 'object') return null
  if (entry.phase === 'failed') {
    const text =
      errorMessageExplanation(entry.message) ||
      phaseExplanation('failed').text
    return { phase: 'failed', icon: 'alert', text }
  }
  return phaseExplanation(entry.phase)
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
