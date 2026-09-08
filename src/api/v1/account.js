import BaseAPI from '../base-api'
import v1 from './v1'

class AccountAPI extends BaseAPI {
  getBalance() {
    return v1.get('/account')
  }

  listPurchases({ offset = 0, limit = 20 } = {}) {
    return v1.get('/account/purchases', {
      params: { offset, limit },
    })
  }

  listCharges({ offset = 0, limit = 20 } = {}) {
    return v1.get('/account/charges', {
      params: { offset, limit },
    })
  }
}

export const accountAPI = new AccountAPI()
