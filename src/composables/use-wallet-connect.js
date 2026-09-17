import { useRouter } from 'vue-router'
import { getConnection, watchConnection } from '@wagmi/core'
import { useAuthStore } from '@/stores/auth'
import { useWalletStore } from '@/stores/wallet'
import { hasReownProjectId, initAppKit, wagmiConfig } from '@/lib/appkit'

function waitForConnectedAccount(appKit, timeoutMs = 120000) {
  return new Promise((resolve) => {
    const current = getConnection(wagmiConfig)
    if (current.isConnected && current.address) {
      resolve(current)
      return
    }

    let settled = false
    let sawModalOpen = appKit.getState().open === true

    const finish = (account) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      unwatchConn()
      unsubModal()
      resolve(account)
    }

    const timer = setTimeout(() => {
      finish(getConnection(wagmiConfig))
    }, timeoutMs)

    const unwatchConn = watchConnection(wagmiConfig, {
      onChange(data) {
        if (data.isConnected && data.address) {
          finish(data)
          return
        }

        if (
          sawModalOpen &&
          !appKit.getState().open &&
          !data.isConnecting &&
          !data.isReconnecting
        ) {
          finish(data)
        }
      }
    })

    const unsubModal = appKit.subscribeState((state) => {
      if (state.open) {
        sawModalOpen = true
        return
      }
      if (!sawModalOpen) return

      const account = getConnection(wagmiConfig)
      if (account.isConnected && account.address) {
        finish(account)
        return
      }
      if (account.isConnecting || account.isReconnecting) {
        return
      }
      finish(account)
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
        const appKit = initAppKit()
        await appKit.open({ view: 'Connect' })
        account = await waitForConnectedAccount(appKit)
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
