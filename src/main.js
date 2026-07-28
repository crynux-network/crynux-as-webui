import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { WagmiPlugin } from '@wagmi/vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import App from './App.vue'
import router from './router'
import v1 from '@/api/v1/v1'
import { useAuthStore } from '@/stores/auth'
import { useWalletStore } from '@/stores/wallet'
import { initAppKit, wagmiConfig } from '@/lib/appkit'

import '@/assets/index.css'
import 'vue-sonner/style.css'

initAppKit()

const app = createApp(App)

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)
app.use(pinia)
app.use(router)

const queryClient = new QueryClient()
app.use(WagmiPlugin, { config: wagmiConfig })
app.use(VueQueryPlugin, { queryClient })

v1.setAuthTokenGetter(() => {
  try {
    const auth = useAuthStore()
    if (!auth || !auth.isAuthenticated) return null
    return auth.sessionToken
  } catch (_) {
    return null
  }
})

const handleUnauthorized = () => {
  try {
    const auth = useAuthStore()
    if (auth && auth.clearSession) auth.clearSession()
  } catch (e) {
    console.error('Failed to clear auth store:', e)
  }
  try {
    const wallet = useWalletStore()
    if (wallet && wallet.setAccount) wallet.setAccount(null)
  } catch (e) {
    console.error('Failed to clear wallet store:', e)
  }
  try {
    router.push('/')
  } catch (e) {
    console.error('Failed to navigate home:', e)
  }
}

v1.apiUnauthorizedErrorHandler = handleUnauthorized

const defaultErrorHandler = () => {
  console.error('Unexpected server error. Please try again later.')
}
v1.apiServerErrorHandler = defaultErrorHandler
v1.apiUnknownErrorHandler = defaultErrorHandler

try {
  useWalletStore().startWatching()
} catch (e) {
  console.error('Failed to start wallet watcher:', e)
}

app.mount('#app')
