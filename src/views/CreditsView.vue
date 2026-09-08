<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Plus } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import PurchaseDialog from '@/components/credits/PurchaseDialog.vue'
import { accountAPI } from '@/api/v1/account'
import { purchaseAPI } from '@/api/v1/purchase'
import { formatCredits } from '@/lib/llm-billing'
import { formatTokenRatio } from '@/lib/token-ratio'
import {
  PAGE_SIZE,
  creditsErrorMessage,
  explorerTxUrl,
  formatCreditsValue,
  formatRecordTime,
  formatTokenBalance,
  shortTxHash,
} from '@/lib/credits-ui'

const balance = ref('0')
const balanceLoading = ref(false)
const balanceReady = ref(false)

const networks = ref([])
const chainIdByNetwork = computed(() => {
  const map = {}
  for (const network of networks.value) {
    map[network.name] = network.chain_id
  }
  return map
})

const activeTab = ref('charges')
const purchaseOpen = ref(false)

const purchases = ref([])
const purchasesTotal = ref(0)
const purchasesOffset = ref(0)
const purchasesLoading = ref(false)
const purchasesReady = ref(false)

const charges = ref([])
const chargesTotal = ref(0)
const chargesOffset = ref(0)
const chargesLoading = ref(false)
const chargesReady = ref(false)

let pollTimer = null
let pollAttempts = 0
const POLL_MAX_ATTEMPTS = 12
const POLL_INTERVAL_MS = 5000

const purchasesPage = computed(() => Math.floor(purchasesOffset.value / PAGE_SIZE) + 1)
const purchasesPageCount = computed(() =>
  Math.max(1, Math.ceil(purchasesTotal.value / PAGE_SIZE)),
)
const chargesPage = computed(() => Math.floor(chargesOffset.value / PAGE_SIZE) + 1)
const chargesPageCount = computed(() =>
  Math.max(1, Math.ceil(chargesTotal.value / PAGE_SIZE)),
)

async function loadBalance() {
  balanceLoading.value = true
  try {
    const data = await accountAPI.getBalance()
    balance.value = data?.balance ?? '0'
    balanceReady.value = true
  } catch (e) {
    console.error('Failed to load account balance', e)
    toast.error(
      creditsErrorMessage(e, 'Could not load balance. Please try again later.'),
    )
  } finally {
    balanceLoading.value = false
  }
}

async function loadNetworks() {
  try {
    const data = await purchaseAPI.listNetworks()
    networks.value = data?.networks ?? []
  } catch (e) {
    console.error('Failed to load purchase networks for explorer links', e)
  }
}

async function loadPurchases() {
  purchasesLoading.value = true
  try {
    const data = await accountAPI.listPurchases({
      offset: purchasesOffset.value,
      limit: PAGE_SIZE,
    })
    purchases.value = data?.purchases ?? []
    purchasesTotal.value = Number(data?.total ?? 0)
    purchasesReady.value = true
  } catch (e) {
    console.error('Failed to load purchases', e)
    toast.error(
      creditsErrorMessage(e, 'Could not load purchases. Please try again later.'),
    )
  } finally {
    purchasesLoading.value = false
  }
}

async function loadCharges() {
  chargesLoading.value = true
  try {
    const data = await accountAPI.listCharges({
      offset: chargesOffset.value,
      limit: PAGE_SIZE,
    })
    charges.value = data?.charges ?? []
    chargesTotal.value = Number(data?.total ?? 0)
    chargesReady.value = true
  } catch (e) {
    console.error('Failed to load charges', e)
    toast.error(
      creditsErrorMessage(e, 'Could not load usage. Please try again later.'),
    )
  } finally {
    chargesLoading.value = false
  }
}

function stopPolling() {
  if (pollTimer != null) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  pollAttempts = 0
}

function startCreditingPoll(previousBalance) {
  stopPolling()
  pollAttempts = 0
  pollTimer = setInterval(async () => {
    pollAttempts += 1
    try {
      await Promise.all([loadBalance(), loadPurchases()])
      if (balance.value !== previousBalance) {
        toast.success('Credits balance updated.')
        stopPolling()
        return
      }
    } catch (e) {
      console.error('Purchase credit poll failed', e)
    }
    if (pollAttempts >= POLL_MAX_ATTEMPTS) {
      toast.message(
        'Purchase submitted. Credits may take longer to appear while confirmation is processing.',
      )
      stopPolling()
    }
  }, POLL_INTERVAL_MS)
}

function onPurchased() {
  const previousBalance = balance.value
  purchasesOffset.value = 0
  loadBalance()
  loadPurchases()
  startCreditingPoll(previousBalance)
}

function prevPurchases() {
  if (purchasesOffset.value <= 0) return
  purchasesOffset.value = Math.max(0, purchasesOffset.value - PAGE_SIZE)
  loadPurchases()
}

function nextPurchases() {
  if (purchasesOffset.value + PAGE_SIZE >= purchasesTotal.value) return
  purchasesOffset.value += PAGE_SIZE
  loadPurchases()
}

function prevCharges() {
  if (chargesOffset.value <= 0) return
  chargesOffset.value = Math.max(0, chargesOffset.value - PAGE_SIZE)
  loadCharges()
}

function nextCharges() {
  if (chargesOffset.value + PAGE_SIZE >= chargesTotal.value) return
  chargesOffset.value += PAGE_SIZE
  loadCharges()
}

function purchaseTxHref(purchase) {
  return explorerTxUrl(chainIdByNetwork.value[purchase.network], purchase.tx_hash)
}

function formatPurchaseAmount(rawAmount, networkName, tokenName) {
  const network = networks.value.find((n) => n.name === networkName)
  const token = network?.tokens?.find((t) => t.name === tokenName)
  if (!token || rawAmount == null) return '—'
  try {
    return formatTokenBalance(rawAmount, token.decimals)
  } catch {
    return '—'
  }
}

function formatPurchaseCredits(credits) {
  return `+${formatCreditsValue(credits)}`
}

watch(activeTab, (tab) => {
  if (tab === 'charges' && charges.value.length === 0 && !chargesLoading.value) {
    loadCharges()
  }
  if (tab === 'purchases' && purchases.value.length === 0 && !purchasesLoading.value) {
    loadPurchases()
  }
})

onMounted(() => {
  loadBalance()
  loadNetworks()
  loadCharges()
})

onUnmounted(() => {
  stopPolling()
})
</script>

<template>
  <div class="w-full">
    <div class="mb-8">
      <h1 class="text-2xl font-semibold tracking-tight">Credits</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        Account balance, purchases, and usage.
      </p>
    </div>

    <div class="mb-8 rounded-lg border border-border bg-muted/30 px-5 py-5">
      <div class="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div class="min-w-0">
          <p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Current balance
          </p>
          <p v-if="balanceLoading" class="mt-4 text-sm text-muted-foreground">
            Loading…
          </p>
          <div
            v-else-if="balanceReady"
            class="mt-4 flex items-baseline gap-2.5"
          >
            <span class="text-3xl font-semibold tracking-tight tabular-nums text-primary">
              {{ formatCredits(Number(balance) || 0) }}
            </span>
            <span class="text-sm text-muted-foreground">Credits</span>
          </div>
          <p v-else class="mt-4 text-3xl font-semibold tracking-tight text-muted-foreground">
            —
          </p>
        </div>
        <Button size="sm" class="mb-0.5 shrink-0 gap-1.5" @click="purchaseOpen = true">
          <Plus class="size-4" />
          Purchase
        </Button>
      </div>
    </div>

    <Tabs v-model="activeTab" class="flex w-full flex-col gap-4">
      <TabsList variant="line">
        <TabsTrigger value="charges" class="flex-none px-3">Usage</TabsTrigger>
        <TabsTrigger value="purchases" class="flex-none px-3">Purchases</TabsTrigger>
      </TabsList>

      <TabsContent value="purchases" class="mt-0">
        <div class="overflow-x-auto rounded-lg border border-border">
          <table class="w-full min-w-[640px] text-left text-sm">
            <thead class="border-b border-border bg-muted/40 text-muted-foreground">
              <tr>
                <th class="px-4 py-2.5 font-medium">Credits</th>
                <th class="px-4 py-2.5 font-medium">Paid</th>
                <th class="px-4 py-2.5 font-medium">Token</th>
                <th class="px-4 py-2.5 font-medium">Network</th>
                <th class="px-4 py-2.5 font-medium">Tx</th>
                <th class="px-4 py-2.5 font-medium">Time</th>
              </tr>
            </thead>
            <tbody v-if="!purchasesLoading && purchases.length > 0">
              <tr
                v-for="purchase in purchases"
                :key="purchase.id"
                class="border-b border-border last:border-0"
              >
                <td class="px-4 py-2.5 tabular-nums">
                  {{ formatPurchaseCredits(purchase.credits) }}
                </td>
                <td class="px-4 py-2.5 tabular-nums">
                  {{
                    formatPurchaseAmount(
                      purchase.amount,
                      purchase.network,
                      purchase.token,
                    )
                  }}
                </td>
                <td class="px-4 py-2.5 uppercase">{{ purchase.token }}</td>
                <td class="px-4 py-2.5">{{ purchase.network }}</td>
                <td class="px-4 py-2.5">
                  <a
                    v-if="purchaseTxHref(purchase)"
                    :href="purchaseTxHref(purchase)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="underline underline-offset-2"
                  >
                    {{ shortTxHash(purchase.tx_hash) }}
                  </a>
                  <span v-else>{{ shortTxHash(purchase.tx_hash) }}</span>
                </td>
                <td class="px-4 py-2.5 whitespace-nowrap">
                  {{ formatRecordTime(purchase.created_at) }}
                </td>
              </tr>
            </tbody>
          </table>
          <p
            v-if="purchasesLoading"
            class="px-4 py-10 text-center text-sm text-muted-foreground"
          >
            Loading purchases…
          </p>
          <p
            v-else-if="purchasesReady && purchases.length === 0"
            class="px-4 py-10 text-center text-sm text-muted-foreground"
          >
            No purchases yet.
          </p>
        </div>
        <div
          v-if="purchasesTotal > PAGE_SIZE"
          class="mt-3 flex items-center justify-between gap-3"
        >
          <p class="text-xs text-muted-foreground">
            Page {{ purchasesPage }} of {{ purchasesPageCount }}
          </p>
          <div class="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              :disabled="purchasesOffset <= 0 || purchasesLoading"
              @click="prevPurchases"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              :disabled="
                purchasesOffset + PAGE_SIZE >= purchasesTotal || purchasesLoading
              "
              @click="nextPurchases"
            >
              Next
            </Button>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="charges" class="mt-0">
        <div class="overflow-x-auto rounded-lg border border-border">
          <table class="w-full min-w-[860px] text-left text-sm">
            <thead class="border-b border-border bg-muted/40 text-muted-foreground">
              <tr>
                <th class="px-4 py-2.5 font-medium">Time</th>
                <th class="px-4 py-2.5 font-medium">Project</th>
                <th class="px-4 py-2.5 font-medium">Cost Level</th>
                <th class="px-4 py-2.5 font-medium">Model</th>
                <th class="px-4 py-2.5 font-medium">VRAM</th>
                <th class="px-4 py-2.5 font-medium">Input</th>
                <th class="px-4 py-2.5 font-medium">Output</th>
                <th class="px-4 py-2.5 font-medium">Credits</th>
              </tr>
            </thead>
            <tbody v-if="!chargesLoading && charges.length > 0">
              <tr
                v-for="charge in charges"
                :key="charge.id"
                class="border-b border-border last:border-0"
              >
                <td class="px-4 py-2.5 whitespace-nowrap">
                  {{ formatRecordTime(charge.created_at) }}
                </td>
                <td class="px-4 py-2.5 tabular-nums">{{ charge.project_id }}</td>
                <td class="px-4 py-2.5 tabular-nums">
                  <template v-if="Number(charge.token_ratio) > 0">
                    {{ formatTokenRatio(charge.token_ratio) }}×
                  </template>
                  <template v-else>—</template>
                </td>
                <td class="px-4 py-2.5 max-w-[220px] truncate" :title="charge.model">
                  {{ charge.model }}
                </td>
                <td class="px-4 py-2.5 tabular-nums">
                  {{ charge.billed_vram }} GB
                </td>
                <td class="px-4 py-2.5 tabular-nums">
                  {{ formatCredits(charge.prompt_tokens || 0) }}
                </td>
                <td class="px-4 py-2.5 tabular-nums">
                  {{ formatCredits(charge.completion_tokens || 0) }}
                </td>
                <td class="px-4 py-2.5 tabular-nums">
                  {{ formatCreditsValue(charge.credits) }}
                </td>
              </tr>
            </tbody>
          </table>
          <p
            v-if="chargesLoading"
            class="px-4 py-10 text-center text-sm text-muted-foreground"
          >
            Loading usage…
          </p>
          <p
            v-else-if="chargesReady && charges.length === 0"
            class="px-4 py-10 text-center text-sm text-muted-foreground"
          >
            No usage yet.
          </p>
        </div>
        <div
          v-if="chargesTotal > PAGE_SIZE"
          class="mt-3 flex items-center justify-between gap-3"
        >
          <p class="text-xs text-muted-foreground">
            Page {{ chargesPage }} of {{ chargesPageCount }}
          </p>
          <div class="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              :disabled="chargesOffset <= 0 || chargesLoading"
              @click="prevCharges"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              :disabled="
                chargesOffset + PAGE_SIZE >= chargesTotal || chargesLoading
              "
              @click="nextCharges"
            >
              Next
            </Button>
          </div>
        </div>
      </TabsContent>
    </Tabs>

    <PurchaseDialog v-model:open="purchaseOpen" @purchased="onPurchased" />
  </div>
</template>
