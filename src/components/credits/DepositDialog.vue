<script setup>
import { computed, ref, watch } from 'vue'
import { pay } from '@reown/appkit-pay'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { depositAPI } from '@/api/v1/deposit'
import { useAuthStore } from '@/stores/auth'
import { useWalletStore } from '@/stores/wallet'
import {
  buildPaymentAsset,
  creditsErrorMessage,
  estimateDepositCredits,
  formatCreditsValue,
  parseHumanAmount,
} from '@/lib/credits-ui'

const open = defineModel('open', { type: Boolean, default: false })

const emit = defineEmits(['deposited'])

const auth = useAuthStore()
const wallet = useWalletStore()

const networks = ref([])
const loadingNetworks = ref(false)
const networksReady = ref(false)
const selectedNetworkName = ref('')
const selectedTokenName = ref('')
const amountText = ref('')
const submitting = ref(false)
const errorMessage = ref('')

const selectedNetwork = computed(() =>
  networks.value.find((n) => n.name === selectedNetworkName.value) ?? null,
)

const tokens = computed(() => selectedNetwork.value?.tokens ?? [])

const selectedToken = computed(() =>
  tokens.value.find((t) => t.name === selectedTokenName.value) ?? null,
)

const estimatedCredits = computed(() => {
  if (!selectedToken.value) return null
  return estimateDepositCredits(
    amountText.value,
    selectedToken.value.decimals,
    selectedToken.value.credits_per_token,
  )
})

watch(open, async (isOpen) => {
  if (!isOpen) return
  amountText.value = ''
  errorMessage.value = ''
  submitting.value = false
  networksReady.value = false
  await loadNetworks()
})

watch(selectedNetworkName, () => {
  const first = tokens.value[0]
  selectedTokenName.value = first?.name ?? ''
})

async function loadNetworks() {
  loadingNetworks.value = true
  try {
    const data = await depositAPI.listNetworks()
    networks.value = data?.networks ?? []
    if (networks.value.length > 0) {
      selectedNetworkName.value = networks.value[0].name
      selectedTokenName.value = networks.value[0].tokens?.[0]?.name ?? ''
      networksReady.value = true
    } else {
      selectedNetworkName.value = ''
      selectedTokenName.value = ''
      networksReady.value = false
      toast.error('No deposit networks are configured.')
    }
  } catch (e) {
    console.error('Failed to load deposit networks', e)
    networks.value = []
    networksReady.value = false
    toast.error(
      creditsErrorMessage(
        e,
        'Could not load deposit networks. Please try again later.',
      ),
    )
  } finally {
    loadingNetworks.value = false
  }
}

async function onSubmit() {
  errorMessage.value = ''

  if (!selectedNetwork.value || !selectedToken.value) {
    errorMessage.value = 'Select a network and token.'
    return
  }

  const amount = parseHumanAmount(amountText.value)
  if (amount == null) {
    errorMessage.value = 'Enter a valid deposit amount greater than zero.'
    return
  }

  if (estimatedCredits.value == null) {
    errorMessage.value = `Amount has too many decimal places for ${selectedToken.value.name.toUpperCase()}.`
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

  submitting.value = true
  try {
    const result = await pay({
      recipient: selectedNetwork.value.receiving_address,
      amount,
      paymentAsset: buildPaymentAsset(selectedNetwork.value, selectedToken.value),
    })

    if (!result?.success) {
      const payError = result?.error
      console.error('AppKit Pay deposit failed', payError)
      toast.error(
        typeof payError === 'string'
          ? payError
          : payError?.message || 'Deposit payment failed or was cancelled.',
      )
      return
    }

    open.value = false
    toast.success('Payment submitted. Credits will appear after the deposit is confirmed.')
    emit('deposited', {
      network: selectedNetwork.value.name,
      token: selectedToken.value.name,
      amount,
    })
  } catch (e) {
    console.error('AppKit Pay deposit error', e)
    toast.error(
      e?.message || 'Could not start the deposit payment. Please try again later.',
    )
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Deposit Credits</DialogTitle>
        <DialogDescription>
          Transfer a supported ERC20 token from your signed-in wallet to purchase Credits.
        </DialogDescription>
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
        </div>

        <div class="grid gap-2">
          <Label for="deposit-amount">Amount</Label>
          <Input
            id="deposit-amount"
            v-model="amountText"
            type="text"
            inputmode="decimal"
            placeholder="0.00"
            :disabled="submitting"
            autocomplete="off"
          />
        </div>

        <p class="text-sm text-muted-foreground">
          Estimated Credits:
          <span class="font-medium text-foreground">
            {{
              estimatedCredits == null
                ? '—'
                : formatCreditsValue(estimatedCredits)
            }}
          </span>
        </p>

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
          <Button type="submit" :disabled="submitting">
            {{ submitting ? 'Waiting for wallet…' : 'Deposit' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
