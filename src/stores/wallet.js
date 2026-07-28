import { defineStore } from 'pinia'
import { getConnection, disconnect, watchConnection } from '@wagmi/core'
import { getAddress } from 'viem'
import { wagmiConfig } from '@/lib/appkit'
import { useAuthStore } from '@/stores/auth'

export const useWalletStore = defineStore('wallet', {
  state: () => ({
    address: null,
    isConnected: false,
    _unwatch: null
  }),
  actions: {
    shortAddress() {
      if (!this.address) return ''
      return this.address.slice(0, 6) + '…' + this.address.slice(-4)
    },
    setAccount(address) {
      this.address = address
      this.isConnected = !!address
    },
    syncFromWagmi() {
      const account = getConnection(wagmiConfig)
      let address = account.address || null
      if (address) {
        try {
          address = getAddress(address)
        } catch {
          address = null
        }
      }

      const auth = useAuthStore()
      const prevAddress = this.address
      const sessionAddr = auth.sessionAddress || null
      const mismatchWithSession = !!(
        address &&
        sessionAddr &&
        sessionAddr.toLowerCase() !== address.toLowerCase()
      )

      this.setAccount(address)

      if (!address || mismatchWithSession) {
        auth.clearSession()
      }

      return {
        address,
        changed: mismatchWithSession || !!(address && prevAddress && address !== prevAddress)
      }
    },
    startWatching() {
      if (this._unwatch) return
      this.syncFromWagmi()
      this._unwatch = watchConnection(wagmiConfig, {
        onChange: () => {
          this.syncFromWagmi()
        }
      })
    },
    stopWatching() {
      if (typeof this._unwatch === 'function') {
        this._unwatch()
      }
      this._unwatch = null
    },
    async disconnectWallet() {
      const auth = useAuthStore()
      try {
        await disconnect(wagmiConfig)
      } catch (e) {
        console.error('Failed to disconnect wallet:', e)
        return { success: false, reason: 'disconnect_failed', error: e }
      }
      auth.clearSession()
      this.setAccount(null)
      return { success: true }
    }
  },
  persist: {
    pick: ['address', 'isConnected']
  }
})
