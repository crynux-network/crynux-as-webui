import { normalizeSelectedModel } from '@/lib/model-tags'
import { normalizeStatusLog } from '@/lib/playground-status-log'

const STORAGE_PREFIX = 'crynux-as-webui:playground:v1:'

function storageKey(projectId) {
  return `${STORAGE_PREFIX}${projectId}`
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeInFlightTaskId(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) return null
  return n
}

function normalizeInFlightStartedAt(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value)
  }
  if (typeof value === 'string' && value) {
    const parsed = Date.parse(value)
    if (!Number.isNaN(parsed) && parsed > 0) return parsed
  }
  return null
}

function normalizeMessages(value) {
  if (!Array.isArray(value)) return []
  return value
    .filter(
      (message) =>
        isPlainObject(message) &&
        (message.role === 'user' || message.role === 'assistant') &&
        typeof message.content === 'string',
    )
    .map((message) => {
      const next = {
        role: message.role,
        content: message.content,
      }
      if (
        message.role === 'assistant' &&
        typeof message.durationSeconds === 'number' &&
        Number.isFinite(message.durationSeconds)
      ) {
        next.durationSeconds = Math.max(0, Math.floor(message.durationSeconds))
      }
      return next
    })
}

function normalizeChat(value) {
  if (!isPlainObject(value)) {
    return {
      selectedModel: null,
      messages: [],
      statusLog: [],
      inFlightTaskId: null,
      inFlightStartedAt: null,
    }
  }
  return {
    selectedModel: normalizeSelectedModel(value.selectedModel),
    messages: normalizeMessages(value.messages),
    statusLog: normalizeStatusLog(value.statusLog),
    inFlightTaskId: normalizeInFlightTaskId(value.inFlightTaskId),
    inFlightStartedAt: normalizeInFlightStartedAt(value.inFlightStartedAt),
  }
}

function normalizeImage(value) {
  if (!isPlainObject(value)) {
    return {
      selectedModel: null,
      prompt: '',
      negativePrompt: '',
      steps: 4,
      imageDataUrl: null,
      elapsedSeconds: 0,
      showElapsed: false,
      statusLog: [],
      inFlightTaskId: null,
      inFlightStartedAt: null,
    }
  }
  const steps = Number(value.steps)
  const elapsedSeconds = Number(value.elapsedSeconds)
  const imageDataUrl =
    typeof value.imageDataUrl === 'string' &&
    value.imageDataUrl.startsWith('data:image/')
      ? value.imageDataUrl
      : null
  return {
    selectedModel: normalizeSelectedModel(value.selectedModel, {
      requireCacheHash: true,
    }),
    prompt: typeof value.prompt === 'string' ? value.prompt : '',
    negativePrompt:
      typeof value.negativePrompt === 'string' ? value.negativePrompt : '',
    steps:
      Number.isInteger(steps) && steps >= 1 && steps <= 50 ? steps : 4,
    imageDataUrl,
    elapsedSeconds:
      Number.isFinite(elapsedSeconds) && elapsedSeconds >= 0
        ? Math.floor(elapsedSeconds)
        : 0,
    showElapsed: Boolean(value.showElapsed) && Boolean(imageDataUrl || elapsedSeconds > 0),
    statusLog: normalizeStatusLog(value.statusLog),
    inFlightTaskId: normalizeInFlightTaskId(value.inFlightTaskId),
    inFlightStartedAt: normalizeInFlightStartedAt(value.inFlightStartedAt),
  }
}

function normalizeState(value) {
  if (!isPlainObject(value)) {
    return {
      chat: normalizeChat(null),
      image: normalizeImage(null),
    }
  }
  return {
    chat: normalizeChat(value.chat),
    image: normalizeImage(value.image),
  }
}

export function loadPlaygroundState(projectId) {
  if (projectId == null || projectId === '') {
    return normalizeState(null)
  }
  try {
    const raw = localStorage.getItem(storageKey(projectId))
    if (!raw) return normalizeState(null)
    return normalizeState(JSON.parse(raw))
  } catch (error) {
    console.error('Failed to load playground state', error)
    return normalizeState(null)
  }
}

export function savePlaygroundState(projectId, patch) {
  if (projectId == null || projectId === '') return
  try {
    const current = loadPlaygroundState(projectId)
    const next = normalizeState({
      chat: isPlainObject(patch?.chat)
        ? { ...current.chat, ...patch.chat }
        : current.chat,
      image: isPlainObject(patch?.image)
        ? { ...current.image, ...patch.image }
        : current.image,
    })
    localStorage.setItem(storageKey(projectId), JSON.stringify(next))
  } catch (error) {
    console.error('Failed to save playground state', error)
  }
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }
      reject(new Error('Failed to convert image blob'))
    }
    reader.onerror = () => reject(reader.error || new Error('Failed to read image blob'))
    reader.readAsDataURL(blob)
  })
}
