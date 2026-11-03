let loadPromise = null

export function loadTurnstile() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Turnstile requires a browser environment'))
  }
  if (window.turnstile) {
    return Promise.resolve(window.turnstile)
  }
  if (loadPromise) {
    return loadPromise
  }

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[data-crynux-turnstile="1"]',
    )
    if (existing) {
      existing.addEventListener('load', () => {
        if (window.turnstile) resolve(window.turnstile)
        else reject(new Error('Turnstile failed to initialize'))
      })
      existing.addEventListener('error', () => {
        loadPromise = null
        reject(new Error('Failed to load Turnstile script'))
      })
      return
    }

    const script = document.createElement('script')
    script.src =
      'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.dataset.crynuxTurnstile = '1'
    script.onload = () => {
      if (window.turnstile) resolve(window.turnstile)
      else {
        loadPromise = null
        reject(new Error('Turnstile failed to initialize'))
      }
    }
    script.onerror = () => {
      loadPromise = null
      reject(new Error('Failed to load Turnstile script'))
    }
    document.head.appendChild(script)
  })

  return loadPromise
}
