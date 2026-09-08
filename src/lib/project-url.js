import v1 from '@/api/v1/v1'

export function projectLlmBaseUrl(endpointToken) {
  const base = v1.getBaseURL().replace(/\/$/, '')
  return `${base}/api/${endpointToken}/v1`
}

export function projectChatCompletionsUrl(endpointToken) {
  return `${projectLlmBaseUrl(endpointToken)}/chat/completions`
}

export function projectResponsesUrl(endpointToken) {
  return `${projectLlmBaseUrl(endpointToken)}/responses`
}

export function projectRawTaskUrl(endpointToken) {
  return `${projectLlmBaseUrl(endpointToken)}/tasks`
}

export const PROJECT_API_DOCS = {
  chat_completions:
    'https://docs.crynux.io/application-development/how-to-run-llm-using-crynux-network',
  responses: null,
  raw_task:
    'https://docs.crynux.io/application-development/execute-tasks',
}
