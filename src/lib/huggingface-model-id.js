const HUGGING_FACE_MODEL_ID_PATTERN =
  /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?(\/[a-z0-9]([a-z0-9._-]*[a-z0-9])?)*$/

export function normalizeHuggingFaceModelID(model) {
  return String(model ?? '')
    .trim()
    .toLowerCase()
}

export function validateHuggingFaceModelID(model) {
  const normalized = normalizeHuggingFaceModelID(model)
  if (!normalized) {
    return 'Model name is required.'
  }
  if (
    normalized.includes('://') ||
    normalized.startsWith('http://') ||
    normalized.startsWith('https://')
  ) {
    return 'Enter a Hugging Face model id, not a URL.'
  }
  if (/\s/.test(normalized)) {
    return 'Enter a Hugging Face model id such as org/model-name.'
  }
  if (!HUGGING_FACE_MODEL_ID_PATTERN.test(normalized)) {
    return 'Enter a Hugging Face model id such as org/model-name.'
  }
  return null
}
