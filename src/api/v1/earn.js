import BaseAPI from '../base-api'
import v1 from './v1'

class EarnAPI extends BaseAPI {
  getSummary() {
    return v1.get('/earn')
  }

  listProviders() {
    return v1.get('/earn/providers')
  }

  listKeys() {
    return v1.get('/earn/keys')
  }

  createKey(payload) {
    return v1.post('/earn/keys', payload)
  }

  enableKey(keyId) {
    return v1.post(`/earn/keys/${keyId}/enable`)
  }

  disableKey(keyId) {
    return v1.post(`/earn/keys/${keyId}/disable`)
  }

  deleteKey(keyId) {
    return v1.delete(`/earn/keys/${keyId}`)
  }

  listCalls({ beforeId, limit = 20 } = {}) {
    return v1.get('/earn/calls', {
      params: {
        before_id: beforeId || undefined,
        limit,
      },
    })
  }

  listEvents({ beforeId, limit = 20 } = {}) {
    return v1.get('/earn/events', {
      params: {
        before_id: beforeId || undefined,
        limit,
      },
    })
  }

  listWithdrawalNetworks() {
    return v1.get('/earn/withdrawal_networks')
  }

  prepareWithdrawal(payload) {
    return v1.post('/earn/withdrawals/prepare', payload)
  }

  createWithdrawal(payload) {
    return v1.post('/earn/withdrawals', payload)
  }

  listWithdrawals({ beforeId, limit = 20 } = {}) {
    return v1.get('/earn/withdrawals', {
      params: {
        before_id: beforeId || undefined,
        limit,
      },
    })
  }
}

export const earnAPI = new EarnAPI()
