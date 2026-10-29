import baseNetworkIcon from '@/assets/purchase/networks/base.svg'
import ethereumNetworkIcon from '@/assets/purchase/networks/ethereum.svg'
import robinhoodNetworkIcon from '@/assets/purchase/networks/robinhood.svg'
import cnxTokenIcon from '@/assets/purchase/tokens/cnx.png'
import usdcTokenIcon from '@/assets/purchase/tokens/usdc.png'
import usdgTokenIcon from '@/assets/purchase/tokens/usdg.png'
import usdtTokenIcon from '@/assets/purchase/tokens/usdt.png'

const NETWORK_ICONS = {
  ethereum: ethereumNetworkIcon,
  base: baseNetworkIcon,
  robinhood: robinhoodNetworkIcon,
}

const TOKEN_ICONS = {
  cnx: cnxTokenIcon,
  usdc: usdcTokenIcon,
  usdt: usdtTokenIcon,
  usdg: usdgTokenIcon,
}

const NETWORK_LABELS = {
  ethereum: 'Ethereum',
  base: 'Base',
  robinhood: 'Robinhood',
}

const NETWORK_TAG_CLASSES = {
  ethereum: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  base: 'bg-violet-500/10 text-violet-700 dark:text-violet-400',
  robinhood: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400',
}

const DEFAULT_NETWORK_TAG_CLASS =
  'border border-border bg-muted/50 text-foreground'

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

export function networkTagClass(name) {
  if (!name) return DEFAULT_NETWORK_TAG_CLASS
  const key = String(name).toLowerCase()
  return NETWORK_TAG_CLASSES[key] ?? DEFAULT_NETWORK_TAG_CLASS
}

export function purchaseTokenLabel(name) {
  if (!name) return ''
  return String(name).toUpperCase()
}
