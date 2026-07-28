import v1 from '@/api/v1/v1'

export function projectLlmBaseUrl(endpointToken) {
  const base = v1.getBaseURL().replace(/\/$/, '')
  return `${base}/api/${endpointToken}/v1`
}
