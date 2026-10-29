const WEI_PER_CNX = 1000000000000000000n
const DISPLAY_DECIMALS = 4

/**
 * Standard CNX token display format: thousand commas and exactly 4 decimal places.
 * Input is a CNX wei decimal string (18 decimals).
 */
export function formatCnx(value) {
  if (value == null || value === '') {
    return `0.${'0'.repeat(DISPLAY_DECIMALS)}`
  }
  let wei
  try {
    wei = BigInt(value)
  } catch {
    return String(value)
  }
  const negative = wei < 0n
  if (negative) wei = -wei
  const whole = wei / WEI_PER_CNX
  const frac = wei % WEI_PER_CNX
  const wholeText = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const fracText = frac
    .toString()
    .padStart(18, '0')
    .slice(0, DISPLAY_DECIMALS)
    .padEnd(DISPLAY_DECIMALS, '0')
  const formatted = `${wholeText}.${fracText}`
  return negative ? `-${formatted}` : formatted
}

export function parseCnxToWei(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) throw new Error('amount required')
  if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error('invalid amount')
  const [whole, frac = ''] = trimmed.split('.')
  if (frac.length > 18) throw new Error('too many decimals')
  const padded = (frac + '0'.repeat(18)).slice(0, 18)
  return (BigInt(whole || '0') * WEI_PER_CNX + BigInt(padded || '0')).toString()
}
