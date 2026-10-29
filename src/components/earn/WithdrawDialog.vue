<script setup>
import { computed, ref, watch } from 'vue'
import { signMessage } from '@wagmi/core'
import { CheckCircle } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { earnAPI } from '@/api/v1/earn'
import { wagmiConfig } from '@/lib/appkit'
import { formatCnx, parseCnxToWei } from '@/lib/cnx'
import {
  earnErrorMessage,
  isUserRejectedError,
  isZeroAddress,
  shortAddress,
} from '@/lib/earn-ui'
import {
  purchaseNetworkIcon,
  purchaseNetworkLabel,
} from '@/lib/purchase-icons'
import {
  WEI_PER_CNX,
  calculateMaxWithdrawAmountWei,
  calculateWithdrawalFeeWei,
  normalizeWithdrawNetwork,
} from '@/lib/withdraw-config'
import { useAuthStore } from '@/stores/auth'
import { useWalletStore } from '@/stores/wallet'

const open = defineModel('open', { type: Boolean, default: false })

const props = defineProps({
  availableWei: {
    type: String,
    default: '0',
  },
  networks: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['withdrawn'])

const auth = useAuthStore()
const wallet = useWalletStore()

const amountText = ref('')
const selectedNetworkId = ref('')
const submitting = ref(false)
const amountError = ref('')
const benefitAddress = ref('')
const receivingReady = ref(false)

const normalizedNetworks = computed(() =>
  (props.networks || []).map((n) => normalizeWithdrawNetwork(n)).filter(Boolean),
)

const selectedConfig = computed(
  () =>
    normalizedNetworks.value.find((n) => n.id === selectedNetworkId.value) ??
    null,
)

const selectedNetworkIcon = computed(() =>
  purchaseNetworkIcon(selectedNetworkId.value),
)

const operationalAddress = computed(
  () => auth.sessionAddress || wallet.address || '',
)

const destinationAddress = computed(() => {
  const benefit = String(benefitAddress.value || '').trim()
  if (benefit && !isZeroAddress(benefit)) return benefit
  return operationalAddress.value
})

const isBeneficialDestination = computed(() => {
  const benefit = String(benefitAddress.value || '').trim()
  const operational = String(operationalAddress.value || '').trim()
  if (!benefit || isZeroAddress(benefit)) return false
  if (!operational) return true
  return benefit.toLowerCase() !== operational.toLowerCase()
})

const availableDisplay = computed(() => formatCnx(props.availableWei))

const minWithdrawWei = computed(() =>
  selectedConfig.value ? BigInt(selectedConfig.value.withdrawalMinWei) : 0n,
)

const maxWithdrawWei = computed(() =>
  selectedConfig.value
    ? calculateMaxWithdrawAmountWei(selectedConfig.value, props.availableWei)
    : 0n,
)

const isAmountInputDisabled = computed(
  () =>
    submitting.value ||
    !selectedConfig.value ||
    maxWithdrawWei.value < minWithdrawWei.value,
)

const insufficientForMin = computed(
  () =>
    !!selectedConfig.value && maxWithdrawWei.value < minWithdrawWei.value,
)

const parsedAmountWei = computed(() => {
  const trimmed = amountText.value.trim()
  if (!trimmed) return null
  if (!/^\d+$/.test(trimmed)) return null
  try {
    return BigInt(parseCnxToWei(trimmed))
  } catch {
    return null
  }
})

const amountFieldValid = computed(() => {
  if (parsedAmountWei.value == null) return false
  if (parsedAmountWei.value < minWithdrawWei.value) return false
  if (parsedAmountWei.value > maxWithdrawWei.value) return false
  return true
})

const withdrawalFeeWei = computed(() => {
  if (!selectedConfig.value) return 0n
  return calculateWithdrawalFeeWei(selectedConfig.value)
})

const actualDeductionWei = computed(() => {
  if (parsedAmountWei.value == null) return 0n
  return parsedAmountWei.value + withdrawalFeeWei.value
})

function formatWholeCnxWei(wei) {
  return (BigInt(wei) / WEI_PER_CNX)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const canSubmit = computed(
  () => amountFieldValid.value && !submitting.value && !insufficientForMin.value,
)

function networkLabel(network) {
  return network.displayName || purchaseNetworkLabel(network.id) || network.id
}

function validateAmount() {
  if (insufficientForMin.value) {
    amountError.value =
      'Insufficient balance to meet the minimum after fee.'
    return false
  }
  const trimmed = amountText.value.trim()
  if (!trimmed) {
    amountError.value = 'Enter amount'
    return false
  }
  if (!/^\d+$/.test(trimmed)) {
    amountError.value = 'Amount must be an integer'
    return false
  }
  const amountWei = parsedAmountWei.value
  if (amountWei == null) {
    amountError.value = 'Enter a valid CNX amount'
    return false
  }
  if (amountWei < minWithdrawWei.value) {
    amountError.value = `Minimum is ${formatWholeCnxWei(minWithdrawWei.value)} CNX`
    return false
  }
  if (amountWei > maxWithdrawWei.value) {
    amountError.value = 'Exceeds maximum available'
    return false
  }
  amountError.value = ''
  return true
}

function refreshAmountError() {
  if (!amountText.value.trim() && !insufficientForMin.value) {
    amountError.value = ''
    return
  }
  validateAmount()
}

function resetState() {
  amountText.value = ''
  amountError.value = ''
  submitting.value = false
  benefitAddress.value = ''
  receivingReady.value = false
  if (normalizedNetworks.value.length) {
    selectedNetworkId.value = normalizedNetworks.value[0].id
  } else {
    selectedNetworkId.value = ''
  }
  if (insufficientForMin.value) {
    amountError.value =
      'Insufficient balance to meet the minimum after fee.'
  }
}

async function refreshReceivingAddress() {
  const network = selectedNetworkId.value
  const cfg = selectedConfig.value
  receivingReady.value = false
  if (!network || !cfg) {
    benefitAddress.value = ''
    receivingReady.value = true
    return
  }
  try {
    const prep = await earnAPI.prepareWithdrawal({
      amount: String(cfg.withdrawalMinWei),
      network,
    })
    benefitAddress.value = prep.benefit_address || ''
  } catch (e) {
    console.error('Failed to resolve receiving address', e)
    benefitAddress.value = ''
  } finally {
    receivingReady.value = true
  }
}

watch(open, (isOpen) => {
  if (!isOpen) return
  const previousNetworkId = selectedNetworkId.value
  resetState()
  if (selectedNetworkId.value === previousNetworkId) {
    refreshReceivingAddress()
  }
})

watch(
  () => props.networks,
  () => {
    if (!selectedNetworkId.value && normalizedNetworks.value.length) {
      selectedNetworkId.value = normalizedNetworks.value[0].id
    }
  },
  { immediate: true },
)

watch(selectedNetworkId, (networkId, previousNetworkId) => {
  if (!open.value || networkId === previousNetworkId) return
  refreshReceivingAddress()
})

watch([amountText, selectedNetworkId, () => props.availableWei], () => {
  refreshAmountError()
})

function preventOutside(event) {
  if (submitting.value) event.preventDefault()
}

function onAmountInput(value) {
  amountText.value = String(value ?? '').replace(/[^\d]/g, '')
}

async function onSubmit() {
  if (!validateAmount() || !canSubmit.value) return

  const amountWei = parsedAmountWei.value.toString()
  const network = selectedNetworkId.value

  const connected = wallet.address || ''
  const session = auth.sessionAddress || ''
  if (
    !connected ||
    !session ||
    connected.toLowerCase() !== session.toLowerCase()
  ) {
    toast.error('Wallet address does not match the signed-in session.')
    return
  }

  submitting.value = true
  try {
    const prep = await earnAPI.prepareWithdrawal({
      amount: amountWei,
      network,
    })
    const signature = await signMessage(wagmiConfig, {
      message: prep.message,
    })
    await earnAPI.createWithdrawal({
      amount: prep.amount,
      network: prep.network,
      benefit_address: prep.benefit_address,
      timestamp: prep.timestamp,
      signature,
    })
    open.value = false
    emit('withdrawn')
  } catch (e) {
    if (isUserRejectedError(e)) {
      toast.error('Withdrawal cancelled.')
      return
    }
    console.error('Failed to create withdrawal', e)
    toast.error(
      earnErrorMessage(e, 'Failed to create withdrawal. Please try again later.'),
    )
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="gap-6 p-6 sm:max-w-xl"
      @pointer-down-outside="preventOutside"
      @interact-outside="preventOutside"
      @escape-key-down="preventOutside"
    >
      <DialogHeader>
        <DialogTitle class="text-xl">Withdraw</DialogTitle>
      </DialogHeader>

      <form class="grid gap-6" @submit.prevent="onSubmit">
        <div class="grid gap-2.5">
          <Label class="text-sm">Network</Label>
          <Select
            v-model="selectedNetworkId"
            :disabled="submitting || normalizedNetworks.length === 0"
          >
            <SelectTrigger
              class="h-14 w-full px-3.5 text-base data-[size=default]:h-14"
            >
              <SelectValue placeholder="Select network">
                <span
                  v-if="selectedConfig"
                  class="flex items-center gap-3"
                >
                  <img
                    v-if="selectedNetworkIcon"
                    :src="selectedNetworkIcon"
                    alt=""
                    class="size-8 shrink-0 rounded-full"
                  />
                  <span>{{ networkLabel(selectedConfig) }}</span>
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent class="min-w-[var(--reka-select-trigger-width)]">
              <SelectItem
                v-for="network in normalizedNetworks"
                :key="network.id"
                :value="network.id"
                :text-value="networkLabel(network)"
                class="py-3 pl-3 text-base"
              >
                <span class="flex items-center gap-3">
                  <img
                    v-if="purchaseNetworkIcon(network.id)"
                    :src="purchaseNetworkIcon(network.id)"
                    alt=""
                    class="size-8 shrink-0 rounded-full"
                  />
                  <span>{{ networkLabel(network) }}</span>
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="grid gap-2.5">
          <div class="flex items-center justify-between gap-3">
            <Label for="withdraw-amount" class="text-sm">Amount</Label>
            <span class="text-xs text-muted-foreground tabular-nums">
              Available {{ availableDisplay }} CNX
            </span>
          </div>
          <div class="relative">
            <Input
              id="withdraw-amount"
              class="h-14 px-3.5 pr-14 text-base md:text-base"
              :model-value="amountText"
              type="text"
              inputmode="numeric"
              placeholder="Enter amount"
              autocomplete="off"
              :disabled="isAmountInputDisabled"
              @update:model-value="onAmountInput"
            />
            <span
              class="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-muted-foreground"
            >
              CNX
            </span>
          </div>
          <p class="text-xs text-muted-foreground tabular-nums">
            Min: {{ formatWholeCnxWei(minWithdrawWei) }} CNX · Max:
            {{ formatWholeCnxWei(maxWithdrawWei) }} CNX
          </p>
          <p v-if="amountError" class="text-sm text-destructive">
            {{ amountError }}
          </p>
        </div>

        <div class="rounded-xl border border-border bg-muted/30 px-5 py-4">
          <div class="flex items-start justify-between gap-3">
            <span class="pt-0.5 text-sm text-muted-foreground">
              Actual Deduction
            </span>
            <div class="min-w-0 text-right">
              <span class="tabular-nums">
                <span class="text-xl font-semibold text-foreground">
                  {{
                    amountFieldValid
                      ? formatCnx(actualDeductionWei.toString())
                      : '—'
                  }}
                </span>
                <span class="ml-1.5 text-sm font-medium text-muted-foreground">
                  CNX
                </span>
              </span>
              <p
                v-if="amountFieldValid"
                class="mt-1 text-xs text-muted-foreground"
              >
                includes fee {{ formatCnx(withdrawalFeeWei.toString()) }} CNX
              </p>
            </div>
          </div>

          <div
            class="mt-3.5 flex items-center justify-between gap-3 border-t border-border pt-3.5"
          >
            <span class="text-sm text-muted-foreground">Network</span>
            <span class="flex items-center gap-2.5">
              <img
                v-if="selectedNetworkIcon"
                :src="selectedNetworkIcon"
                alt=""
                class="size-5 shrink-0 rounded-full"
              />
              <span class="text-sm font-medium text-foreground">
                {{ selectedConfig ? networkLabel(selectedConfig) : '—' }}
              </span>
            </span>
          </div>

          <div
            class="mt-3.5 flex items-start justify-between gap-3 border-t border-border pt-3.5"
          >
            <span class="pt-0.5 text-sm text-muted-foreground">
              Receiving Address
            </span>
            <div
              v-if="receivingReady"
              class="flex min-w-0 flex-wrap items-center justify-end gap-2"
            >
              <span
                v-if="isBeneficialDestination"
                class="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400"
              >
                <CheckCircle class="size-3" />
                Beneficial
              </span>
              <span class="font-mono text-sm text-foreground">
                {{ shortAddress(destinationAddress) }}
              </span>
            </div>
            <span v-else class="text-sm text-muted-foreground">…</span>
          </div>
        </div>

        <DialogFooter class="gap-3 sm:gap-3">
          <Button
            type="button"
            variant="outline"
            class="h-11 px-5"
            :disabled="submitting"
            @click="open = false"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            class="h-11 px-5"
            :disabled="!canSubmit"
          >
            {{ submitting ? 'Submitting…' : 'Submit' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
