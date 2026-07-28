class ApiError extends Error {
  static Type = {
    Validation: 'validation',
    Unauthorized: 'unauthorized',
    Forbidden: 'forbidden',
    NotFound: 'not_found',
    Server: 'server',
    Unknown: 'unknown'
  }

  constructor(type, detail = null) {
    super(detail || type)
    this.type = type
    this.detail = detail
  }
}

export default ApiError
