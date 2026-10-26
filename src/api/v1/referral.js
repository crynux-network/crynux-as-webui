import BaseAPI from '../base-api'
import v1 from './v1'

class ReferralAPI extends BaseAPI {
  getReferral() {
    return v1.get('/account/referral')
  }

  resetInviteCode() {
    return v1.post('/account/referral/code/reset')
  }

  listRewards({ offset = 0, limit = 20 } = {}) {
    return v1.get('/account/referral/rewards', {
      params: { offset, limit },
    })
  }
}

export const referralAPI = new ReferralAPI()
