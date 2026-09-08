import * as appkitNetworks from '@reown/appkit/networks'

function appkitNetworkScore(exportName) {
  let score = 0
  if (/Preconf$/i.test(exportName)) score -= 100
  score -= exportName.length
  return score
}

function buildAppKitNetworkIndex() {
  const byId = new Map()
  for (const [exportName, value] of Object.entries(appkitNetworks)) {
    if (!value || typeof value !== 'object' || typeof value.id !== 'number') continue
    if (!value.rpcUrls?.default?.http?.length) continue
    const current = byId.get(value.id)
    if (!current || appkitNetworkScore(exportName) > appkitNetworkScore(current.exportName)) {
      byId.set(value.id, { exportName, network: value })
    }
  }
  return byId
}

const appKitNetworksById = buildAppKitNetworkIndex()

export function getAppKitNetwork(chainId) {
  return appKitNetworksById.get(Number(chainId))?.network || null
}

export function explorerSiteUrl(txExplorer) {
  if (!txExplorer) return undefined
  return txExplorer.replace(/\/tx\/?$/, '')
}

/** Returns `…/tx` base without trailing slash, or null. */
export function resolveTxExplorerBase(chainId, entry) {
  if (entry?.tx_explorer) {
    return entry.tx_explorer.replace(/\/$/, '')
  }
  const site = getAppKitNetwork(chainId)?.blockExplorers?.default?.url
  if (!site) return null
  return `${site.replace(/\/$/, '')}/tx`
}
