import BaseAPI from '../base-api'
import v1 from './v1'

class LlmAPI extends BaseAPI {
  getBillingConfig() {
    return v1.get('/llm/billing_config')
  }
}

export const llmAPI = new LlmAPI()
