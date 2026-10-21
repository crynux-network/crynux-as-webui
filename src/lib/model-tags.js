function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function modelExecutionDtype(model) {
  return typeof model?.execution_dtype === 'string'
    ? model.execution_dtype.trim().toLowerCase()
    : ''
}

export function modelQuantizationConfig(model) {
  if (model?.quantization_config == null) return null
  if (!isPlainObject(model.quantization_config)) return null
  return model.quantization_config
}

function formatBitLabel(bits) {
  const n = Number(bits)
  if (!Number.isFinite(n) || n <= 0) return ''
  return `${Math.trunc(n)}bit`
}

function bitsFromTruthyFlag(value, bits) {
  if (value === true || value === 1 || value === '1' || value === 'true') {
    return bits
  }
  return null
}

function bitsFromNumericField(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.trunc(value)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase()
    const match = trimmed.match(/^(\d+)\s*bit$/)
    if (match) return Number(match[1])
    if (/^\d+$/.test(trimmed)) {
      const n = Number(trimmed)
      if (n > 0) return n
    }
  }
  return null
}

function bitsFromMethodName(method) {
  if (typeof method !== 'string') return null
  const m = method.trim().toLowerCase()
  if (!m) return null
  if (m === 'fp8' || m.includes('fp8') || m.includes('int8')) return 8
  if (
    m.includes('fp4') ||
    m.includes('nf4') ||
    m.includes('nvfp4') ||
    m.includes('int4') ||
    m === 'awq' ||
    m === 'gptq' ||
    m === 'gptqmodel'
  ) {
    return 4
  }
  const match = m.match(/(\d+)\s*bit/)
  if (match) return Number(match[1])
  return null
}

function bitsFromObjectFields(obj) {
  if (!isPlainObject(obj)) return null

  const from4 = bitsFromTruthyFlag(obj.load_in_4bit, 4)
  if (from4 != null) return from4
  const from8 = bitsFromTruthyFlag(obj.load_in_8bit, 8)
  if (from8 != null) return from8

  for (const key of [
    'bits',
    'num_bits',
    'weight_bits',
    'w_bit',
    'bits_per_weight',
    'n_bits',
  ]) {
    const bits = bitsFromNumericField(obj[key])
    if (bits != null) return bits
  }

  if (typeof obj.bnb_4bit_quant_type === 'string' && obj.bnb_4bit_quant_type) {
    return 4
  }

  return null
}

function collectBitCandidates(value, out, depth = 0) {
  if (depth > 6 || value == null) return
  if (Array.isArray(value)) {
    for (const item of value) collectBitCandidates(item, out, depth + 1)
    return
  }
  if (!isPlainObject(value)) return

  const direct = bitsFromObjectFields(value)
  if (direct != null) out.push(direct)

  for (const child of Object.values(value)) {
    collectBitCandidates(child, out, depth + 1)
  }
}

export function quantizationBitWidth(quantizationConfig) {
  if (quantizationConfig == null || !isPlainObject(quantizationConfig)) {
    return null
  }

  const method = quantizationConfig.quant_method
  const kwargs = isPlainObject(quantizationConfig.quant_kwargs)
    ? quantizationConfig.quant_kwargs
    : null

  const fromKwargs = bitsFromObjectFields(kwargs)
  if (fromKwargs != null) return fromKwargs

  const fromTop = bitsFromObjectFields(quantizationConfig)
  if (fromTop != null) return fromTop

  const fromMethod = bitsFromMethodName(method)
  if (fromMethod != null) return fromMethod

  const candidates = []
  collectBitCandidates(quantizationConfig, candidates)
  if (candidates.length > 0) return candidates[0]

  return null
}

export function quantizationTagLabel(quantizationConfig) {
  if (quantizationConfig == null || !isPlainObject(quantizationConfig)) {
    return ''
  }
  const method =
    typeof quantizationConfig.quant_method === 'string'
      ? quantizationConfig.quant_method.trim()
      : ''
  const bitLabel = formatBitLabel(quantizationBitWidth(quantizationConfig))
  if (method && bitLabel) return `${method}-${bitLabel}`
  if (bitLabel) return bitLabel
  if (method) return method
  return ''
}

export function stableQuantizationKey(quantizationConfig) {
  if (quantizationConfig == null) return 'null'
  try {
    return JSON.stringify(quantizationConfig)
  } catch {
    return 'null'
  }
}

export function modelSelectionKey(model) {
  if (!model?.id) return ''
  return [
    String(model.id),
    modelExecutionDtype(model),
    stableQuantizationKey(modelQuantizationConfig(model)),
    model.isCustom ? '1' : '0',
  ].join('\0')
}

export function catalogToModelSelection(model) {
  return {
    id: String(model.id || ''),
    min_vram: Number(model.min_vram) || 0,
    on_disk_node_count: Number(model.on_disk_node_count) || 0,
    execution_dtype: modelExecutionDtype(model),
    quantization_config: modelQuantizationConfig(model),
    isCustom: false,
  }
}

export function normalizeSelectedModel(value) {
  if (!isPlainObject(value) || typeof value.id !== 'string' || !value.id.trim()) {
    return null
  }
  return {
    id: String(value.id),
    min_vram: Number(value.min_vram) || 0,
    on_disk_node_count: Number(value.on_disk_node_count) || 0,
    execution_dtype: modelExecutionDtype(value),
    quantization_config: modelQuantizationConfig(value),
    isCustom: Boolean(value.isCustom),
  }
}
