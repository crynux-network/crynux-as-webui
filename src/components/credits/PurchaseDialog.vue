<script setup>
import { computed, ref, watch } from 'vue'
import { getConnection, readContract, switchChain, waitForTransactionReceipt, writeContract } from '@wagmi/core'
import { erc20Abi } from 'viem'
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
import { Slider } from '@/components/ui/slider'
import { purchaseAPI } from '@/api/v1/purchase'
import { wagmiConfig } from '@/lib/appkit'
import { useAuthStore } from '@/stores/auth'
import { useWalletStore } from '@/stores/wallet'
import {
  creditsErrorMessage,
  estimatePurchaseCredits,
  formatCreditsValue,
  formatTokenBalance,
  integerTokenToRaw,
  isUserRejectedError,
  parseIntegerAmount,
} from '@/lib/credits-ui'

const open = defineModel('open', { type: Boolean, default: false })

const emit = defineEmits(['purchased'])

const auth = useAuthStore()
const wallet = useWalletStore()

const MIN_AMOUNT = 1n

const networks = ref([])
const loadingNetworks = ref(false)
const networksReady = ref(false)
const selectedNetworkName = ref('')
const selectedTokenName = ref('')
const amountText = ref('')
const submitting = ref(false)
const errorMessage = ref('')
const walletTokenBalanceRaw = ref(null)
const walletTokenBalance = ref(null)
const loadingWalletBalance = ref(false)
let walletBalanceRequestId = 0

const selectedNetwork = computed(() =>
  networks.value.find((n) => n.name === selectedNetworkName.value) ?? null,
)

const tokens = computed(() => selectedNetwork.value?.tokens ?? [])

const selectedToken = computed(() =>
  tokens.value.find((t) => t.name === selectedTokenName.value) ?? null,
)

const maxAmount = computed(() => {
  if (walletTokenBalanceRaw.value == null || !selectedToken.value) return null
  const scale = 10n ** BigInt(selectedToken.value.decimals)
  return walletTokenBalanceRaw.value / scale
})

const parsedAmount = computed(() => parseIntegerAmount(amountText.value))

const sliderMax = computed(() => {
  if (maxAmount.value == null) return 0
  const n = Number(maxAmount.value)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.min(Math.floor(n), Number.MAX_SAFE_INTEGER)
})

const amountSlider = computed({
  get() {
    if (parsedAmount.value == null) return [0]
    const n = Number(parsedAmount.value)
    if (!Number.isFinite(n) || n < 0) return [0]
    return [Math.min(Math.floor(n), sliderMax.value)]
  },
  set(value) {
    const next = Array.isArray(value) ? Number(value[0]) : Number(value)
    if (!Number.isFinite(next) || next <= 0) {
      amountText.value = ''
      errorMessage.value = ''
      return
    }
    const clamped = Math.min(Math.floor(next), sliderMax.value)
    amountText.value = clamped > 0 ? String(clamped) : ''
    errorMessage.value = ''
  },
})

const sliderDisabled = computed(
  () => submitting.value || loadingWalletBalance.value || sliderMax.value <= 0,
)

const amountError = computed(() => {
  const text = amountText.value.trim()
  if (!text) return ''
  if (parsedAmount.value == null) return 'Enter a whole number greater than zero.'
  if (parsedAmount.value < MIN_AMOUNT) return 'Amount must be at least 1.'
  if (maxAmount.value == null) return ''
  if (parsedAmount.value > maxAmount.value) {
    return `Amount must be at most ${maxAmount.value.toLocaleString('en-US')}.`
  }
  return ''
})

const canSubmit = computed(() => {
  if (submitting.value) return false
  if (!selectedNetwork.value || !selectedToken.value) return false
  if (loadingWalletBalance.value) return false
  if (maxAmount.value == null) return false
  if (parsedAmount.value == null) return false
  if (amountError.value) return false
  return true
})

const estimatedCredits = computed(() => {
  if (!selectedToken.value || parsedAmount.value == null || amountError.value) {
    return null
  }
  return estimatePurchaseCredits(
    parsedAmount.value.toString(),
    selectedToken.value.decimals,
    selectedToken.value.credits_per_token,
  )
})

const walletBalanceText = computed(() => {
  if (loadingWalletBalance.value) return 'Loading…'
  if (walletTokenBalance.value == null || !selectedToken.value) return '—'
  return `${walletTokenBalance.value} ${selectedToken.value.name.toUpperCase()}`
})

const amountLabel = computed(() => {
  if (!selectedToken.value) return 'Amount'
  return `${selectedToken.value.name.toUpperCase()} Amount`
})

const summaryPayText = computed(() => {
  if (
    parsedAmount.value == null ||
    amountError.value ||
    !selectedToken.value
  ) {
    return '—'
  }
  return `${parsedAmount.value.toLocaleString('en-US')} ${selectedToken.value.name.toUpperCase()}`
})

const summaryCreditsText = computed(() => {
  if (estimatedCredits.value == null) return '—'
  return formatCreditsValue(estimatedCredits.value)
})

watch(open, async (isOpen) => {
  if (!isOpen) return
  amountText.value = ''
  errorMessage.value = ''
  submitting.value = false
  networksReady.value = false
  walletTokenBalanceRaw.value = null
  walletTokenBalance.value = null
  await loadNetworks()
})

watch(selectedNetworkName, () => {
  const first = tokens.value[0]
  selectedTokenName.value = first?.name ?? ''
})

watch(
  [open, selectedNetwork, selectedToken, () => wallet.address],
  () => {
    loadWalletTokenBalance()
  },
)

function onAmountInput(value) {
  amountText.value = String(value ?? '').replace(/\D/g, '')
  errorMessage.value = ''
}

async function loadNetworks() {
  loadingNetworks.value = true
  try {
    const data = await purchaseAPI.listNetworks()
    networks.value = data?.networks ?? []
    if (networks.value.length > 0) {
      selectedNetworkName.value = networks.value[0].name
      selectedTokenName.value = networks.value[0].tokens?.[0]?.name ?? ''
      networksReady.value = true
    } else {
      selectedNetworkName.value = ''
      selectedTokenName.value = ''
      networksReady.value = false
      toast.error('No purchase networks are configured.')
    }
  } catch (e) {
    console.error('Failed to load purchase networks', e)
    networks.value = []
    networksReady.value = false
    toast.error(
      creditsErrorMessage(
        e,
        'Could not load purchase networks. Please try again later.',
      ),
    )
  } finally {
    loadingNetworks.value = false
  }
}

async function loadWalletTokenBalance() {
  const requestId = ++walletBalanceRequestId

  if (
    !open.value ||
    !selectedNetwork.value ||
    !selectedToken.value ||
    !wallet.address
  ) {
    walletTokenBalanceRaw.value = null
    walletTokenBalance.value = null
    loadingWalletBalance.value = false
    return
  }

  loadingWalletBalance.value = true
  walletTokenBalanceRaw.value = null
  walletTokenBalance.value = null

  try {
    const raw = await readContract(wagmiConfig, {
      address: selectedToken.value.address,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [wallet.address],
      chainId: Number(selectedNetwork.value.chain_id),
    })

    if (requestId !== walletBalanceRequestId) return

    walletTokenBalanceRaw.value = raw
    walletTokenBalance.value = formatTokenBalance(
      raw,
      selectedToken.value.decimals,
    )
  } catch (e) {
    if (requestId !== walletBalanceRequestId) return
    console.error('Failed to load wallet token balance', e)
    walletTokenBalanceRaw.value = null
    walletTokenBalance.value = null
    toast.error('Could not load wallet balance. Please try again later.')
  } finally {
    if (requestId === walletBalanceRequestId) {
      loadingWalletBalance.value = false
    }
  }
}

async function onSubmit() {
  errorMessage.value = ''

  if (!canSubmit.value) return

  const amount = parsedAmount.value
  if (
    amount == null ||
    !selectedNetwork.value ||
    !selectedToken.value ||
    maxAmount.value == null
  ) {
    return
  }

  const sessionAddress = auth.sessionAddress
  const walletAddress = wallet.address
  if (
    !sessionAddress ||
    !walletAddress ||
    sessionAddress.toLowerCase() !== walletAddress.toLowerCase()
  ) {
    errorMessage.value =
      'Connected wallet must match the signed-in account. Reconnect with the same wallet.'
    return
  }

  const chainId = Number(selectedNetwork.value.chain_id)
  const recipient = selectedNetwork.value.receiving_address
  const rawAmount = integerTokenToRaw(amount, selectedToken.value.decimals)

  submitting.value = true
  try {
    const connection = getConnection(wagmiConfig)
    if (connection.chainId !== chainId) {
      await switchChain(wagmiConfig, { chainId })
    }

    const hash = await writeContract(wagmiConfig, {
      address: selectedToken.value.address,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [recipient, rawAmount],
      chainId,
      account: walletAddress,
    })

    await waitForTransactionReceipt(wagmiConfig, { hash, chainId })

    open.value = false
    toast.success('Purchase submitted. Credits will appear after confirmation.')
    emit('purchased', {
      network: selectedNetwork.value.name,
      token: selectedToken.value.name,
      amount: Number(amount),
    })
  } catch (e) {
    if (isUserRejectedError(e)) {
      toast.error('Purchase cancelled.')
      return
    }
    console.error('Purchase transfer failed', e)
    toast.error(
      e?.shortMessage ||
        e?.message ||
        'Could not complete the purchase. Please try again later.',
    )
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="sm:max-w-md"
      @pointer-down-outside="(event) => event.preventDefault()"
      @interact-outside="(event) => event.preventDefault()"
      @escape-key-down="(event) => event.preventDefault()"
    >
      <DialogHeader>
        <DialogTitle>Purchase</DialogTitle>
      </DialogHeader>

      <div v-if="loadingNetworks" class="text-sm text-muted-foreground">
        Loading networks…
      </div>

      <form v-else-if="networksReady" class="grid gap-4" @submit.prevent="onSubmit">
        <div class="grid gap-2">
          <Label>Network</Label>
          <Select v-model="selectedNetworkName" :disabled="submitting">
            <SelectTrigger class="w-full">
              <SelectValue placeholder="Select network" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="network in networks"
                :key="network.name"
                :value="network.name"
              >
                {{ network.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="grid gap-2">
          <Label>Token</Label>
          <Select
            v-model="selectedTokenName"
            :disabled="submitting || tokens.length === 0"
          >
            <SelectTrigger class="w-full">
              <SelectValue placeholder="Select token" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="token in tokens"
                :key="token.name"
                :value="token.name"
              >
                {{ token.name.toUpperCase() }}
              </SelectItem>
            </SelectContent>
          </Select>
          <p v-if="selectedToken" class="text-sm text-muted-foreground">
            Wallet balance:
            <span class="font-medium text-foreground">{{ walletBalanceText }}</span>
          </p>
        </div>

        <div class="grid gap-2">
          <Label for="purchase-amount">{{ amountLabel }}</Label>
          <Input
            id="purchase-amount"
            :model-value="amountText"
            type="text"
            inputmode="numeric"
            placeholder="1"
            :disabled="submitting"
            autocomplete="off"
            @update:model-value="onAmountInput"
          />
          <Slider
            v-model="amountSlider"
            :min="0"
            :max="sliderMax > 0 ? sliderMax : 1"
            :step="1"
            :disabled="sliderDisabled"
            class="mt-4 w-full"
          />
          <p v-if="amountError" class="text-sm text-destructive">
            {{ amountError }}
          </p>
        </div>

        <div class="mt-4 rounded-lg border border-border bg-muted/30 px-4 py-3.5">
          <div class="flex items-baseline justify-between gap-3">
            <span class="text-sm text-muted-foreground">You pay</span>
            <span class="text-sm font-medium tabular-nums text-foreground">
              {{ summaryPayText }}
            </span>
          </div>
          <div
            class="mt-3 flex items-baseline justify-between gap-3 border-t border-border pt-3"
          >
            <span class="text-sm text-muted-foreground">You receive</span>
            <span class="tabular-nums">
              <span class="text-lg font-semibold text-foreground">
                {{ summaryCreditsText }}
              </span>
              <span class="ml-1.5 text-sm font-medium text-muted-foreground">
                Credits
              </span>
            </span>
          </div>
        </div>

        <p v-if="errorMessage" class="text-sm text-destructive">
          {{ errorMessage }}
        </p>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            :disabled="submitting"
            @click="open = false"
          >
            Cancel
          </Button>
          <Button type="submit" :disabled="!canSubmit">
            {{ submitting ? 'Waiting for wallet…' : 'Purchase' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
