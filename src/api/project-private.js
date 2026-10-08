import axios from 'axios'
import ApiError from './api-error'
import { projectLlmBaseUrl } from '@/lib/project-url'

const CHAT_TIMEOUT_MS = 11 * 60 * 1000
const DEFAULT_TIMEOUT_MS = 30000

class ProjectPrivateClient {
  constructor() {
    this._getAuthToken = () => null
    this.apiUnauthorizedErrorHandler = null
  }

  setAuthTokenGetter(fn) {
    this._getAuthToken = typeof fn === 'function' ? fn : () => null
  }

  _authHeaders() {
    const token = this._getAuthToken && this._getAuthToken()
    const headers = { 'Content-Type': 'application/json' }
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
    return headers
  }

  _client(endpointToken, timeout = DEFAULT_TIMEOUT_MS) {
    return axios.create({
      baseURL: projectLlmBaseUrl(endpointToken),
      timeout,
      headers: this._authHeaders(),
    })
  }

  async _request(endpointToken, method, path, options = {}) {
    const { data, timeout, responseType } = options
    try {
      const client = this._client(endpointToken, timeout)
      const response = await client.request({
        method,
        url: path,
        data,
        responseType,
      })
      return response.data
    } catch (error) {
      return this._rejectError(error)
    }
  }

  _rejectError(error) {
    if (!error.response || !error.response.status) {
      return Promise.reject(new ApiError(ApiError.Type.Unknown))
    }
    const status = error.response.status
    if (status === 401) {
      if (typeof this.apiUnauthorizedErrorHandler === 'function') {
        this.apiUnauthorizedErrorHandler()
      }
      return Promise.reject(new ApiError(ApiError.Type.Unauthorized))
    }
    if (status === 402) {
      return Promise.reject(
        new ApiError(ApiError.Type.Validation, 'Insufficient Credits'),
      )
    }
    if (status === 403) {
      return Promise.reject(new ApiError(ApiError.Type.Forbidden))
    }
    if (status === 404) {
      return Promise.reject(new ApiError(ApiError.Type.NotFound))
    }
    if (status >= 500) {
      return Promise.reject(new ApiError(ApiError.Type.Server))
    }
    const detail =
      error.response.data?.error?.message ||
      error.response.data?.message ||
      null
    return Promise.reject(new ApiError(ApiError.Type.Validation, detail))
  }

  async listModels(endpointToken) {
    const body = await this._request(endpointToken, 'get', '/models')
    return Array.isArray(body?.data) ? body.data : []
  }

  async listImageModels(endpointToken) {
    const body = await this._request(endpointToken, 'get', '/models/image')
    return Array.isArray(body?.data) ? body.data : []
  }

  chatCompletions(endpointToken, payload) {
    return this._request(endpointToken, 'post', '/chat/completions', {
      data: payload,
      timeout: CHAT_TIMEOUT_MS,
    })
  }

  async createInferenceTask(endpointToken, payload) {
    const body = await this._request(endpointToken, 'post', '/inference_tasks', {
      data: payload,
    })
    return body?.data ?? body
  }

  async getInferenceTask(endpointToken, taskId) {
    const body = await this._request(
      endpointToken,
      'get',
      `/inference_tasks/${taskId}`,
    )
    return body?.data ?? body
  }

  async getImageBlob(endpointToken, taskId, index = 0) {
    try {
      const client = this._client(endpointToken)
      const response = await client.get(
        `/inference_tasks/${taskId}/images/${index}`,
        { responseType: 'blob' },
      )
      return response.data
    } catch (error) {
      return this._rejectError(error)
    }
  }
}

export const projectPrivateAPI = new ProjectPrivateClient()
