<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { getConnection, readContract, switchChain, waitForTransactionReceipt, writeContract } from '@wagmi/core'
import { Check, Copy } from 'lucide-vue-next'
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
import {
  purchaseNetworkIcon,
  purchaseNetworkLabel,
  purchaseTokenIcon,
  purchaseTokenLabel,
} from '@/lib/purchase-icons'
import config from '@/config.json'
import { copyText } from '@/lib/project-ui'

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
const submitPhase = ref('')
const errorMessage = ref('')
const walletTokenBalanceRaw = ref(null)
const walletTokenBalance = ref(null)
const loadingWalletBalance = ref(false)
const depositAddressCopied = ref(false)
let walletBalanceRequestId = 0
let depositAddressCopiedTimer = null

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
  return `${walletTokenBalance.value} ${purchaseTokenLabel(selectedToken.value.name)}`
})

const amountLabel = computed(() => {
  if (!selectedToken.value) return 'Amount'
  return `${purchaseTokenLabel(selectedToken.value.name)} Amount`
})

const selectedNetworkIcon = computed(() =>
  purchaseNetworkIcon(selectedNetwork.value?.name),
)

const selectedTokenIcon = computed(() =>
  purchaseTokenIcon(selectedToken.value?.name),
)

const depositAddress = computed(
  () => selectedNetwork.value?.receiving_address ?? '',
)

const submitStatusText = computed(() => {
  if (submitPhase.value === 'confirming') return 'Confirming…'
  if (submitting.value) return 'Waiting for wallet…'
  return 'Purchase'
})

const creditPriceText = computed(() => {
  if (!selectedToken.value) return '—'
  const creditsPerToken = Number(selectedToken.value.credits_per_token)
  if (!Number.isFinite(creditsPerToken) || creditsPerToken <= 0) return '—'
  const tokenLabel = purchaseTokenLabel(selectedToken.value.name)
  const creditsLabel = creditsPerToken === 1 ? 'Credit' : 'Credits'
  return `1 ${tokenLabel} = ${creditsPerToken.toLocaleString('en-US')} ${creditsLabel}`
})

const summaryPayText = computed(() => {
  if (
    parsedAmount.value == null ||
    amountError.value ||
    !selectedToken.value
  ) {
    return '—'
  }
  return `${parsedAmount.value.toLocaleString('en-US')} ${purchaseTokenLabel(selectedToken.value.name)}`
})

const summaryCreditsText = computed(() => {
  if (estimatedCredits.value == null) return '—'
  return formatCreditsValue(estimatedCredits.value)
})

watch(open, async (isOpen) => {
  if (!isOpen) {
    submitting.value = false
    submitPhase.value = ''
    depositAddressCopied.value = false
    if (depositAddressCopiedTimer) {
      clearTimeout(depositAddressCopiedTimer)
      depositAddressCopiedTimer = null
    }
    return
  }
  amountText.value = ''
  errorMessage.value = ''
  submitting.value = false
  submitPhase.value = ''
  depositAddressCopied.value = false
  networksReady.value = false
  walletTokenBalanceRaw.value = null
  walletTokenBalance.value = null
  await loadNetworks()
})

async function onCopyDepositAddress() {
  if (!depositAddress.value) return
  try {
    await copyText(depositAddress.value)
    depositAddressCopied.value = true
    if (depositAddressCopiedTimer) clearTimeout(depositAddressCopiedTimer)
    depositAddressCopiedTimer = setTimeout(() => {
      depositAddressCopied.value = false
      depositAddressCopiedTimer = null
    }, 2000)
  } catch (e) {
    console.error('Failed to copy deposit address', e)
    toast.error('Could not copy address. Please try again later.')
  }
}

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
  submitPhase.value = 'wallet'
  await nextTick()
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

    submitPhase.value = 'confirming'
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
    submitPhase.value = ''
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="gap-6 p-6 sm:max-w-xl"
      @pointer-down-outside="(event) => event.preventDefault()"
      @interact-outside="(event) => event.preventDefault()"
      @escape-key-down="(event) => event.preventDefault()"
    >
      <DialogHeader>
        <DialogTitle class="text-xl">
          {{ submitting ? 'Confirm Transfer' : 'Purchase Credits' }}
        </DialogTitle>
      </DialogHeader>

      <div v-if="loadingNetworks" class="text-sm text-muted-foreground">
        Loading networks…
      </div>

      <div
        v-else-if="networksReady && submitting"
        class="grid gap-6"
      >
        <p class="text-sm text-muted-foreground">
          <template v-if="submitPhase === 'confirming'">
            Transaction submitted. Waiting for on-chain confirmation…
          </template>
          <template v-else>
            Complete the transfer in the wallet popup that just opened.
          </template>
        </p>

        <div class="rounded-xl border border-border bg-muted/30 px-5 py-5">
          <div class="flex items-start justify-between gap-4">
            <span class="pt-1 text-sm text-muted-foreground">You pay</span>
            <div class="min-w-0 text-right">
              <div class="flex items-center justify-end gap-2.5">
                <img
                  v-if="selectedTokenIcon"
                  :src="selectedTokenIcon"
                  alt=""
                  class="size-7 shrink-0 rounded-full border border-border bg-white object-cover"
                />
                <span class="text-2xl font-semibold tabular-nums text-foreground">
                  {{ summaryPayText }}
                </span>
              </div>
              <div
                v-if="selectedNetwork"
                class="mt-2 flex items-center justify-end gap-2 text-sm text-muted-foreground"
              >
                <img
                  v-if="selectedNetworkIcon"
                  :src="selectedNetworkIcon"
                  alt=""
                  class="size-4 shrink-0 rounded-full"
                />
                <span>{{ purchaseNetworkLabel(selectedNetwork.name) }}</span>
              </div>
            </div>
          </div>
          <div
            class="mt-5 flex items-baseline justify-between gap-4 border-t border-border pt-5"
          >
            <span class="text-sm text-muted-foreground">You receive</span>
            <span class="tabular-nums">
              <span class="text-2xl font-semibold text-foreground">
                {{ summaryCreditsText }}
              </span>
              <span class="ml-1.5 text-sm font-medium text-muted-foreground">
                Credits
              </span>
            </span>
          </div>
        </div>

        <div class="rounded-xl border border-primary/25 bg-primary/5 px-5 py-5">
          <div class="text-sm font-medium text-foreground">
            Crynux AS Deposit Address
          </div>
          <div class="mt-3 flex items-stretch gap-2">
            <code
              class="min-w-0 flex-1 break-all rounded-lg border border-border bg-background px-3 py-3 font-mono text-xs leading-relaxed text-foreground"
            >{{ depositAddress }}</code>
            <Button
              type="button"
              variant="outline"
              size="icon"
              class="size-11 shrink-0"
              :disabled="!depositAddress"
              :aria-label="
                depositAddressCopied ? 'Copied' : 'Copy deposit address'
              "
              @click="onCopyDepositAddress"
            >
              <Check v-if="depositAddressCopied" class="size-4" />
              <Copy v-else class="size-4" />
            </Button>
          </div>
          <p class="mt-3 text-sm text-muted-foreground">
            Cross-check this address in
            <a
              :href="config.discord_url"
              target="_blank"
              rel="noopener noreferrer"
              class="font-medium text-foreground underline underline-offset-4"
            >Crynux Discord</a>
            before confirming the transfer.
          </p>
        </div>

        <DialogFooter>
          <Button type="button" class="h-11 px-5" disabled>
            {{ submitStatusText }}
          </Button>
        </DialogFooter>
      </div>

      <form
        v-else-if="networksReady"
        class="grid gap-6"
        @submit.prevent="onSubmit"
      >
        <div class="grid gap-2.5">
          <Label class="text-sm">Network</Label>
          <Select v-model="selectedNetworkName">
            <SelectTrigger
              class="h-14 w-full px-3.5 text-base data-[size=default]:h-14"
            >
              <SelectValue placeholder="Select network">
                <span
                  v-if="selectedNetwork"
                  class="flex items-center gap-3"
                >
                  <img
                    v-if="selectedNetworkIcon"
                    :src="selectedNetworkIcon"
                    alt=""
                    class="size-8 shrink-0 rounded-full"
                  />
                  <span>{{ purchaseNetworkLabel(selectedNetwork.name) }}</span>
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent class="min-w-[var(--reka-select-trigger-width)]">
              <SelectItem
                v-for="network in networks"
                :key="network.name"
                :value="network.name"
                :text-value="purchaseNetworkLabel(network.name)"
                class="py-3 pl-3 text-base"
              >
                <span class="flex items-center gap-3">
                  <img
                    v-if="purchaseNetworkIcon(network.name)"
                    :src="purchaseNetworkIcon(network.name)"
                    alt=""
                    class="size-8 shrink-0 rounded-full"
                  />
                  <span>{{ purchaseNetworkLabel(network.name) }}</span>
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="grid gap-2.5">
          <Label class="text-sm">Token</Label>
          <Select
            v-model="selectedTokenName"
            :disabled="tokens.length === 0"
          >
            <SelectTrigger
              class="h-14 w-full px-3.5 text-base data-[size=default]:h-14"
            >
              <SelectValue placeholder="Select token">
                <span
                  v-if="selectedToken"
                  class="flex items-center gap-3"
                >
                  <img
                    v-if="selectedTokenIcon"
                    :src="selectedTokenIcon"
                    alt=""
                    class="size-8 shrink-0 rounded-full border border-border bg-white object-cover"
                  />
                  <span>{{ purchaseTokenLabel(selectedToken.name) }}</span>
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent class="min-w-[var(--reka-select-trigger-width)]">
              <SelectItem
                v-for="token in tokens"
                :key="token.name"
                :value="token.name"
                :text-value="purchaseTokenLabel(token.name)"
                class="py-3 pl-3 text-base"
              >
                <span class="flex items-center gap-3">
                  <img
                    v-if="purchaseTokenIcon(token.name)"
                    :src="purchaseTokenIcon(token.name)"
                    alt=""
                    class="size-8 shrink-0 rounded-full border border-border bg-white object-cover"
                  />
                  <span>{{ purchaseTokenLabel(token.name) }}</span>
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          <p v-if="selectedToken" class="text-sm text-muted-foreground">
            Wallet balance:
            <span class="font-medium text-foreground">{{ walletBalanceText }}</span>
          </p>
        </div>

        <div class="grid gap-2.5">
          <Label for="purchase-amount" class="text-sm">{{ amountLabel }}</Label>
          <Input
            id="purchase-amount"
            class="h-14 px-3.5 text-base md:text-base"
            :model-value="amountText"
            type="text"
            inputmode="numeric"
            placeholder="1"
            autocomplete="off"
            @update:model-value="onAmountInput"
          />
          <Slider
            v-model="amountSlider"
            :min="0"
            :max="sliderMax > 0 ? sliderMax : 1"
            :step="1"
            :disabled="sliderDisabled"
            class="mt-3 w-full"
          />
          <p v-if="amountError" class="text-sm text-destructive">
            {{ amountError }}
          </p>
        </div>

        <div class="rounded-xl border border-border bg-muted/30 px-5 py-4">
          <div class="flex items-center justify-between gap-3">
            <span class="text-sm text-muted-foreground">Credit Price</span>
            <span class="flex items-center gap-2.5">
              <img
                v-if="selectedTokenIcon && creditPriceText !== '—'"
                :src="selectedTokenIcon"
                alt=""
                class="size-5 shrink-0 rounded-full border border-border bg-white object-cover"
              />
              <span class="text-sm font-medium tabular-nums text-foreground">
                {{ creditPriceText }}
              </span>
            </span>
          </div>
          <div
            class="mt-3.5 flex items-center justify-between gap-3 border-t border-border pt-3.5"
          >
            <span class="text-sm text-muted-foreground">You pay</span>
            <span class="flex items-center gap-2.5">
              <img
                v-if="selectedTokenIcon && summaryPayText !== '—'"
                :src="selectedTokenIcon"
                alt=""
                class="size-5 shrink-0 rounded-full border border-border bg-white object-cover"
              />
              <span class="text-base font-medium tabular-nums text-foreground">
                {{ summaryPayText }}
              </span>
            </span>
          </div>
          <div
            class="mt-3.5 flex items-baseline justify-between gap-3 border-t border-border pt-3.5"
          >
            <span class="text-sm text-muted-foreground">You receive</span>
            <span class="tabular-nums">
              <span class="text-xl font-semibold text-foreground">
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

        <DialogFooter class="gap-3 sm:gap-3">
          <Button
            type="button"
            variant="outline"
            class="h-11 px-5"
            @click="open = false"
          >
            Cancel
          </Button>
          <Button type="submit" class="h-11 px-5" :disabled="!canSubmit">
            Purchase
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
