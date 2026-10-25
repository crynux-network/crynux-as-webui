import baseNetworkIcon from '@/assets/purchase/networks/base.svg'
import ethereumNetworkIcon from '@/assets/purchase/networks/ethereum.svg'
import cnxTokenIcon from '@/assets/purchase/tokens/cnx.png'
import usdcTokenIcon from '@/assets/purchase/tokens/usdc.png'
import usdtTokenIcon from '@/assets/purchase/tokens/usdt.png'

const NETWORK_ICONS = {
  ethereum: ethereumNetworkIcon,
  base: baseNetworkIcon,
}

const TOKEN_ICONS = {
  cnx: cnxTokenIcon,
  usdc: usdcTokenIcon,
  usdt: usdtTokenIcon,
}

const NETWORK_LABELS = {
  ethereum: 'Ethereum',
  base: 'Base',
}

export function purchaseNetworkIcon(name) {
  if (!name) return null
  return NETWORK_ICONS[String(name).toLowerCase()] ?? null
}

export function purchaseTokenIcon(name) {
  if (!name) return null
  return TOKEN_ICONS[String(name).toLowerCase()] ?? null
}

export function purchaseNetworkLabel(name) {
  if (!name) return ''
  const key = String(name).toLowerCase()
  return NETWORK_LABELS[key] ?? String(name)
}

export function purchaseTokenLabel(name) {
  if (!name) return ''
  return String(name).toUpperCase()
}
