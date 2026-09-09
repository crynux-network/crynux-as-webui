import BaseAPI from '../base-api'
import v1 from './v1'

class ProjectsAPI extends BaseAPI {
  list() {
    return v1.get('/projects')
  }

  create(payload) {
    return v1.post('/projects', payload)
  }

  get(projectId) {
    return v1.get(`/projects/${projectId}`)
  }

  update(projectId, payload) {
    return v1.put(`/projects/${projectId}`, payload)
  }

  remove(projectId) {
    return v1.delete(`/projects/${projectId}`)
  }

  resetApiKey(projectId) {
    return v1.post(`/projects/${projectId}/api_key/reset`)
  }

  getStats(projectId, range = '1d') {
    return v1.get(`/projects/${projectId}/stats`, {
      params: { range },
    })
  }

  getCompletionDurationStats(projectId, range = '1d') {
    return v1.get(`/projects/${projectId}/stats/completion-duration`, {
      params: { range },
    })
  }

  getModelStats(projectId, range = '1d') {
    return v1.get(`/projects/${projectId}/stats/models`, {
      params: { range },
    })
  }

  listRequests(projectId) {
    return v1.get(`/projects/${projectId}/requests`)
  }
}

export const projectsAPI = new ProjectsAPI()
