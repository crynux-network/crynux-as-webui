import { defineStore } from 'pinia'
import { getConnection, signMessage } from '@wagmi/core'
import { getAddress } from 'viem'
import { authAPI } from '@/api/v1/auth'
import { wagmiConfig } from '@/lib/appkit'
import { useWalletStore } from '@/stores/wallet'

function buildLoginMessage(address, timestamp) {
  return `Crynux AS\nAction: Login\nAddress: ${address}\nTimestamp: ${timestamp}`
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    sessionToken: null,
    sessionExpiresAt: 0,
    sessionAddress: null,
    _isAuthenticating: false
  }),
  getters: {
    isAuthenticated(state) {
      return (
        !!state.sessionToken &&
        Number(state.sessionExpiresAt) > Math.floor(Date.now() / 1000)
      )
    },
    isAuthenticating(state) {
      return state._isAuthenticating
    }
  },
  actions: {
    setSession(token, expiresAt, address) {
      this.sessionToken = token
      this.sessionExpiresAt = Number(expiresAt || 0)
      if (address) this.sessionAddress = address
    },
    clearSession() {
      this.sessionToken = null
      this.sessionExpiresAt = 0
      this.sessionAddress = null
    },
    async authenticate() {
      if (this._isAuthenticating) {
        return { success: false, reason: 'already_authenticating' }
      }

      const wallet = useWalletStore()
      const account = getConnection(wagmiConfig)
      if (!account.address) {
        return { success: false, reason: 'not_connected' }
      }

      this._isAuthenticating = true

      try {
        const address = getAddress(account.address)
        wallet.setAccount(address)

        const timestamp = Math.floor(Date.now() / 1000)
        const message = buildLoginMessage(address, timestamp)
        const signature = await signMessage(wagmiConfig, { message })

        const resp = await authAPI.login({ address, signature, timestamp })
        this.setSession(resp.token, resp.expires_at, address)

        return { success: true, address }
      } catch (e) {
        console.error('Authentication error:', e)
        this.clearSession()
        return { success: false, reason: 'auth_failed', error: e }
      } finally {
        this._isAuthenticating = false
      }
    }
  },
  persist: {
    pick: ['sessionToken', 'sessionExpiresAt', 'sessionAddress']
  }
})
