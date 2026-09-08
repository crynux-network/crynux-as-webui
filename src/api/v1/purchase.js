import BaseAPI from '../base-api'
import v1 from './v1'

class PurchaseAPI extends BaseAPI {
  listNetworks() {
    return v1.get('/purchase/networks')
  }
}

export const purchaseAPI = new PurchaseAPI()
