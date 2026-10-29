import { parseCnxToWei } from '@/lib/cnx'

const WEI_PER_CNX = 1000000000000000000n

/**
 * Normalize a withdrawal network row from GET /v1/earn/withdrawal_networks
 * into BigInt wei fields for client-side fee and max calculations.
 */
export function normalizeWithdrawNetwork(network) {
  if (!network) return null
  return {
    id: network.id,
    displayName: network.display_name || network.id,
    chainId: network.chain_id,
    asset: network.asset || 'CNX',
    decimals: network.decimals ?? 18,
    fixedFeeWei: parseCnxToWei(network.fixed_withdrawal_fee_cnx || '0'),
    withdrawalMinWei: parseCnxToWei(network.withdrawal_min_cnx || '0'),
    raw: network,
  }
}

/** Fee is the network fixed fee only. */
export function calculateWithdrawalFeeWei(config) {
  if (!config) return 0n
  return BigInt(config.fixedFeeWei || '0')
}

/**
 * Largest whole-CNX amount such that amount + fixedFee <= availableWei.
 */
export function calculateMaxWithdrawAmountWei(config, availableWei) {
  if (!config) return 0n
  const bal = BigInt(availableWei || '0')
  const fixed = BigInt(config.fixedFeeWei || '0')
  if (bal <= fixed) return 0n
  const candidate = ((bal - fixed) / WEI_PER_CNX) * WEI_PER_CNX
  return candidate > 0n ? candidate : 0n
}

export { WEI_PER_CNX }
