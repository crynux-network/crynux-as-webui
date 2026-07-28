import { useRouter } from 'vue-router'
import { getConnection, watchConnection } from '@wagmi/core'
import { useAppKit } from '@reown/appkit/vue'
import { useAuthStore } from '@/stores/auth'
import { useWalletStore } from '@/stores/wallet'
import { hasReownProjectId, wagmiConfig } from '@/lib/appkit'

function waitForConnectedAccount(timeoutMs = 120000) {
  return new Promise((resolve) => {
    const current = getConnection(wagmiConfig)
    if (current.isConnected && current.address) {
      resolve(current)
      return
    }

    const timer = setTimeout(() => {
      unwatch()
      resolve(getConnection(wagmiConfig))
    }, timeoutMs)

    const unwatch = watchConnection(wagmiConfig, {
      onChange(data) {
        if (data.isConnected && data.address) {
          clearTimeout(timer)
          unwatch()
          resolve(data)
        }
      }
    })
  })
}

export function useWalletConnect() {
  const router = useRouter()
  const auth = useAuthStore()
  const wallet = useWalletStore()

  async function connect(redirect = null) {
    if (!hasReownProjectId()) {
      return { success: false, reason: 'missing_project_id' }
    }

    try {
      let account = getConnection(wagmiConfig)
      if (!account.isConnected || !account.address) {
        const { open } = useAppKit()
        await open({ view: 'Connect' })
        account = await waitForConnectedAccount()
      }

      if (!account.isConnected || !account.address) {
        return { success: false, reason: 'connect_cancelled' }
      }

      wallet.syncFromWagmi()

      const result = await auth.authenticate()
      if (!result.success) {
        if (result.reason === 'auth_failed') {
          await wallet.disconnectWallet()
        }
        return result
      }

      if (redirect) {
        await router.push(redirect)
      }
      return result
    } catch (e) {
      console.error('Wallet connect error:', e)
      return { success: false, reason: 'connect_failed', error: e }
    }
  }

  return { connect }
}
