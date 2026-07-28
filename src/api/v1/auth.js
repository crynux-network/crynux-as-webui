import BaseAPI from '../base-api'
import v1 from './v1'

class AuthAPI extends BaseAPI {
  login(payload) {
    return v1.post('/auth/login', payload)
  }
}

export const authAPI = new AuthAPI()
