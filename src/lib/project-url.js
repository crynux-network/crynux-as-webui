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

export function projectImagesGenerationsUrl(endpointToken) {
  return `${projectLlmBaseUrl(endpointToken)}/images/generations`
}

export function projectRawTaskCreateUrl(endpointToken) {
  return `${projectLlmBaseUrl(endpointToken)}/inference_tasks`
}

export function projectRawTaskStatusUrl(endpointToken) {
  return `${projectRawTaskCreateUrl(endpointToken)}/:client_task_id`
}

export function projectRawTaskLlmResultUrl(endpointToken) {
  return `${projectRawTaskStatusUrl(endpointToken)}/llm`
}

export function projectRawTaskImageResultUrl(endpointToken) {
  return `${projectRawTaskStatusUrl(endpointToken)}/images/:index`
}

export function projectRawTaskBatchCreateUrl(endpointToken) {
  return `${projectRawTaskCreateUrl(endpointToken)}/batch`
}

export function projectRawTaskBatchStatusUrl(endpointToken) {
  return `${projectRawTaskBatchCreateUrl(endpointToken)}/status`
}

export function projectModelsUrl(endpointToken) {
  return `${projectLlmBaseUrl(endpointToken)}/models`
}

export function projectImageModelsUrl(endpointToken) {
  return `${projectModelsUrl(endpointToken)}/image`
}

export const PROJECT_API_DOCS = {
  chat_completions:
    'https://docs.crynux.io/application-development/how-to-run-llm-using-crynux-network',
  responses:
    'https://docs.crynux.io/application-development/how-to-run-llm-using-crynux-network/responses-api',
  raw_task:
    'https://docs.crynux.io/application-development/execute-tasks',
  models:
    'https://docs.crynux.io/application-development/how-to-run-llm-using-crynux-network/supported-models',
}
