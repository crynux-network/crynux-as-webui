import { createAppKit } from '@reown/appkit/vue'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { mainnet, base } from '@reown/appkit/networks'

const projectId = import.meta.env.VITE_REOWN_PROJECT_ID || ''

const metadata = {
  name: 'Crynux AI Services',
  description: 'Crynux AI Services dashboard',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://localhost',
  icons: [typeof window !== 'undefined' ? `${window.location.origin}/favicon.svg` : '']
}

const networks = [mainnet, base]

export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId
})

export const wagmiConfig = wagmiAdapter.wagmiConfig

let appKit = null

export function initAppKit() {
  if (appKit) return appKit
  if (!projectId) {
    console.warn(
      'VITE_REOWN_PROJECT_ID is not set. WalletConnect features will not work. Get a project ID from https://dashboard.reown.com'
    )
  }
  appKit = createAppKit({
    adapters: [wagmiAdapter],
    networks,
    projectId: projectId || '00000000000000000000000000000000',
    metadata,
    features: {
      analytics: false
    }
  })
  return appKit
}

export function hasReownProjectId() {
  return Boolean(projectId)
}
