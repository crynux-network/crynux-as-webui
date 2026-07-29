import BaseAPI from '../base-api'
import v1 from './v1'

class DepositAPI extends BaseAPI {
  listNetworks() {
    return v1.get('/deposit/networks')
  }
}

export const depositAPI = new DepositAPI()
