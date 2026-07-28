import BaseAPI from '../base-api'
import v1 from './v1'

class LlmAPI extends BaseAPI {
  getVramRatios() {
    return v1.get('/llm/vram_ratios')
  }
}

export const llmAPI = new LlmAPI()
