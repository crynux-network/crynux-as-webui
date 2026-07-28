import axios from 'axios'
import ApiError from '../api-error'
import config from '@/config.json'

class V1Client {
  constructor(baseUrl) {
    if (baseUrl === '') {
      baseUrl = window.location.protocol + '//' + window.location.host
    }

    this.baseURL = baseUrl
    this.v1BaseURL = baseUrl + '/v1'

    this.httpClient = axios.create({
      baseURL: this.v1BaseURL,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    this._getAuthToken = () => null

    this.httpClient.interceptors.request.use((cfg) => {
      const token = this._getAuthToken && this._getAuthToken()
      if (token) {
        cfg.headers = cfg.headers || {}
        cfg.headers.Authorization = `Bearer ${token}`
      }
      return cfg
    })

    this.httpClient.interceptors.response.use(
      (response) => {
        if (response.status === 200) {
          return Promise.resolve(response.data.data)
        }
        return Promise.reject(new ApiError(ApiError.Type.Unknown))
      },
      (error) => {
        if (error.response && error.response.status) {
          return this.processErrorStatus(error.response.status, error.response.data)
        }
        if (typeof this.apiUnknownErrorHandler === 'function') {
          this.apiUnknownErrorHandler()
        }
        return Promise.reject(new ApiError(ApiError.Type.Unknown))
      }
    )

    this.apiForbiddenErrorHandler = null
    this.apiUnauthorizedErrorHandler = null
    this.apiServerErrorHandler = null
    this.apiUnknownErrorHandler = null
  }

  getBaseURL() {
    return this.baseURL
  }

  getV1BaseURL() {
    return this.v1BaseURL
  }

  post(url, data, config) {
    return this.httpClient.post(url, data, config)
  }

  get(url, config) {
    return this.httpClient.get(url, config)
  }

  put(url, data, config) {
    return this.httpClient.put(url, data, config)
  }

  delete(url, config) {
    return this.httpClient.delete(url, config)
  }

  processErrorStatus(status, errorData) {
    if (status === 400) {
      const detail = errorData?.data?.message || errorData?.detail || null
      return Promise.reject(new ApiError(ApiError.Type.Validation, detail))
    }
    if (status === 401) {
      if (typeof this.apiUnauthorizedErrorHandler === 'function') {
        this.apiUnauthorizedErrorHandler()
      }
      return Promise.reject(new ApiError(ApiError.Type.Unauthorized))
    }
    if (status === 403) {
      if (typeof this.apiForbiddenErrorHandler === 'function') {
        this.apiForbiddenErrorHandler()
      }
      return Promise.reject(new ApiError(ApiError.Type.Forbidden))
    }
    if (status === 404) {
      return Promise.reject(new ApiError(ApiError.Type.NotFound))
    }
    if (status === 500) {
      if (typeof this.apiServerErrorHandler === 'function') {
        this.apiServerErrorHandler()
      }
      return Promise.reject(new ApiError(ApiError.Type.Server))
    }
    if (typeof this.apiUnknownErrorHandler === 'function') {
      this.apiUnknownErrorHandler()
    }
    return Promise.reject(new ApiError(ApiError.Type.Unknown))
  }

  setAuthTokenGetter(fn) {
    this._getAuthToken = typeof fn === 'function' ? fn : () => null
  }
}

const v1 = new V1Client(config.as_url)

export default v1
