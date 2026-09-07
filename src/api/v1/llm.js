import BaseAPI from '../base-api'
import v1 from './v1'

class LlmAPI extends BaseAPI {
  getBillingConfig() {
    return v1.get('/llm/billing_config')
  }

  getPricingExamples() {
    return v1.get('/llm/pricing_examples')
  }
}

export const llmAPI = new LlmAPI()
