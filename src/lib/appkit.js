import { createAppKit } from '@reown/appkit/vue'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { defineChain } from '@reown/appkit/networks'
import config from '@/config.json'
import { explorerSiteUrl, getAppKitNetwork } from '@/lib/appkit-networks'

const projectId = import.meta.env.VITE_REOWN_PROJECT_ID || ''

const metadata = {
  name: 'Crynux AI Services',
  description: 'Crynux AI Services dashboard',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://localhost',
  icons: [typeof window !== 'undefined' ? `${window.location.origin}/favicon.svg` : '']
}

function applyExplorer(network, entry) {
  const explorerUrl = explorerSiteUrl(entry.tx_explorer)
  if (!explorerUrl) return network
  return {
    ...network,
    blockExplorers: {
      default: {
        name: network.blockExplorers?.default?.name || `${network.name} Explorer`,
        url: explorerUrl,
        ...(network.blockExplorers?.default?.apiUrl
          ? { apiUrl: network.blockExplorers.default.apiUrl }
          : {})
      }
    }
  }
}

function applyRpcUrls(network, entry) {
  if (!Array.isArray(entry.rpc_urls) || entry.rpc_urls.length === 0) return network
  return {
    ...network,
    rpcUrls: {
      default: {
        http: entry.rpc_urls
      }
    }
  }
}

function customNetworkFromConfig(entry) {
  if (!entry.name || !entry.native_currency || !Array.isArray(entry.rpc_urls) || entry.rpc_urls.length === 0) {
    throw new Error(
      `config.json networks entry for chain id ${entry.id} is not in AppKit presets and MUST include name, native_currency, and rpc_urls`
    )
  }
  const explorerUrl = explorerSiteUrl(entry.tx_explorer)
  return defineChain({
    id: entry.id,
    caipNetworkId: `eip155:${entry.id}`,
    chainNamespace: 'eip155',
    name: entry.name,
    nativeCurrency: {
      name: entry.native_currency.name,
      symbol: entry.native_currency.symbol,
      decimals: entry.native_currency.decimals
    },
    rpcUrls: {
      default: {
        http: entry.rpc_urls
      }
    },
    ...(explorerUrl
      ? {
          blockExplorers: {
            default: {
              name: `${entry.name} Explorer`,
              url: explorerUrl
            }
          }
        }
      : {})
  })
}

function networksFromConfig(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('config.json networks MUST contain at least one EVM network')
  }
  return entries.map((entry) => {
    const preset = getAppKitNetwork(entry.id)
    if (preset) {
      return applyExplorer(applyRpcUrls(preset, entry), entry)
    }
    return customNetworkFromConfig(entry)
  })
}

const networks = networksFromConfig(config.networks)

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
