<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Plus } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import DepositDialog from '@/components/credits/DepositDialog.vue'
import { accountAPI } from '@/api/v1/account'
import { depositAPI } from '@/api/v1/deposit'
import { formatCredits } from '@/lib/llm-billing'
import { formatTokenRatio } from '@/lib/token-ratio'
import {
  PAGE_SIZE,
  creditsErrorMessage,
  explorerTxUrl,
  formatCreditsValue,
  formatDepositStatus,
  formatRecordTime,
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
const depositOpen = ref(false)

const deposits = ref([])
const depositsTotal = ref(0)
const depositsOffset = ref(0)
const depositsLoading = ref(false)
const depositsReady = ref(false)

const charges = ref([])
const chargesTotal = ref(0)
const chargesOffset = ref(0)
const chargesLoading = ref(false)
const chargesReady = ref(false)

let pollTimer = null
let pollAttempts = 0
const POLL_MAX_ATTEMPTS = 12
const POLL_INTERVAL_MS = 5000

const depositsPage = computed(() => Math.floor(depositsOffset.value / PAGE_SIZE) + 1)
const depositsPageCount = computed(() =>
  Math.max(1, Math.ceil(depositsTotal.value / PAGE_SIZE)),
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
    const data = await depositAPI.listNetworks()
    networks.value = data?.networks ?? []
  } catch (e) {
    console.error('Failed to load deposit networks for explorer links', e)
  }
}

async function loadDeposits() {
  depositsLoading.value = true
  try {
    const data = await accountAPI.listDeposits({
      offset: depositsOffset.value,
      limit: PAGE_SIZE,
    })
    deposits.value = data?.deposits ?? []
    depositsTotal.value = Number(data?.total ?? 0)
    depositsReady.value = true
  } catch (e) {
    console.error('Failed to load deposits', e)
    toast.error(
      creditsErrorMessage(e, 'Could not load top-ups. Please try again later.'),
    )
  } finally {
    depositsLoading.value = false
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
      await Promise.all([loadBalance(), loadDeposits()])
      if (balance.value !== previousBalance) {
        toast.success('Credits balance updated.')
        stopPolling()
        return
      }
    } catch (e) {
      console.error('Deposit credit poll failed', e)
    }
    if (pollAttempts >= POLL_MAX_ATTEMPTS) {
      toast.message(
        'Payment was submitted. Credits may take longer to appear while the deposit is scanned.',
      )
      stopPolling()
    }
  }, POLL_INTERVAL_MS)
}

function onDeposited() {
  const previousBalance = balance.value
  depositsOffset.value = 0
  loadBalance()
  loadDeposits()
  startCreditingPoll(previousBalance)
}

function prevDeposits() {
  if (depositsOffset.value <= 0) return
  depositsOffset.value = Math.max(0, depositsOffset.value - PAGE_SIZE)
  loadDeposits()
}

function nextDeposits() {
  if (depositsOffset.value + PAGE_SIZE >= depositsTotal.value) return
  depositsOffset.value += PAGE_SIZE
  loadDeposits()
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

function depositTxHref(deposit) {
  return explorerTxUrl(chainIdByNetwork.value[deposit.network], deposit.tx_hash)
}

function formatTokenAmount(rawAmount, networkName, tokenName) {
  const network = networks.value.find((n) => n.name === networkName)
  const token = network?.tokens?.find((t) => t.name === tokenName)
  if (!token || rawAmount == null) return String(rawAmount ?? '—')
  try {
    const raw = BigInt(String(rawAmount))
    const decimals = Number(token.decimals)
    const scale = 10n ** BigInt(decimals)
    const whole = raw / scale
    const frac = raw % scale
    if (frac === 0n) return whole.toString()
    const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '')
    return `${whole.toString()}.${fracStr}`
  } catch {
    return String(rawAmount)
  }
}

watch(activeTab, (tab) => {
  if (tab === 'charges' && charges.value.length === 0 && !chargesLoading.value) {
    loadCharges()
  }
  if (tab === 'deposits' && deposits.value.length === 0 && !depositsLoading.value) {
    loadDeposits()
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
        Account balance, top-ups, and usage.
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
        <Button size="sm" class="mb-0.5 shrink-0 gap-1.5" @click="depositOpen = true">
          <Plus class="size-4" />
          Top up
        </Button>
      </div>
    </div>

    <Tabs v-model="activeTab" class="flex w-full flex-col gap-4">
      <TabsList variant="line">
        <TabsTrigger value="charges" class="flex-none px-3">Usage</TabsTrigger>
        <TabsTrigger value="deposits" class="flex-none px-3">Top-ups</TabsTrigger>
      </TabsList>

      <TabsContent value="deposits" class="mt-0">
        <div class="overflow-x-auto rounded-lg border border-border">
          <table class="w-full min-w-[640px] text-left text-sm">
            <thead class="border-b border-border bg-muted/40 text-muted-foreground">
              <tr>
                <th class="px-4 py-2.5 font-medium">Time</th>
                <th class="px-4 py-2.5 font-medium">Network</th>
                <th class="px-4 py-2.5 font-medium">Token</th>
                <th class="px-4 py-2.5 font-medium">Amount</th>
                <th class="px-4 py-2.5 font-medium">Credits</th>
                <th class="px-4 py-2.5 font-medium">Status</th>
                <th class="px-4 py-2.5 font-medium">Tx</th>
              </tr>
            </thead>
            <tbody v-if="!depositsLoading && deposits.length > 0">
              <tr
                v-for="deposit in deposits"
                :key="deposit.id"
                class="border-b border-border last:border-0"
              >
                <td class="px-4 py-2.5 whitespace-nowrap">
                  {{ formatRecordTime(deposit.created_at) }}
                </td>
                <td class="px-4 py-2.5">{{ deposit.network }}</td>
                <td class="px-4 py-2.5 uppercase">{{ deposit.token }}</td>
                <td class="px-4 py-2.5 tabular-nums">
                  {{
                    formatTokenAmount(
                      deposit.amount,
                      deposit.network,
                      deposit.token,
                    )
                  }}
                </td>
                <td class="px-4 py-2.5 tabular-nums">
                  {{ formatCreditsValue(deposit.credits) }}
                </td>
                <td class="px-4 py-2.5">
                  {{ formatDepositStatus(deposit.status) }}
                </td>
                <td class="px-4 py-2.5">
                  <a
                    v-if="depositTxHref(deposit)"
                    :href="depositTxHref(deposit)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="underline underline-offset-2"
                  >
                    {{ shortTxHash(deposit.tx_hash) }}
                  </a>
                  <span v-else>{{ shortTxHash(deposit.tx_hash) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
          <p
            v-if="depositsLoading"
            class="px-4 py-10 text-center text-sm text-muted-foreground"
          >
            Loading top-ups…
          </p>
          <p
            v-else-if="depositsReady && deposits.length === 0"
            class="px-4 py-10 text-center text-sm text-muted-foreground"
          >
            No top-ups yet.
          </p>
        </div>
        <div
          v-if="depositsTotal > PAGE_SIZE"
          class="mt-3 flex items-center justify-between gap-3"
        >
          <p class="text-xs text-muted-foreground">
            Page {{ depositsPage }} of {{ depositsPageCount }}
          </p>
          <div class="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              :disabled="depositsOffset <= 0 || depositsLoading"
              @click="prevDeposits"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              :disabled="
                depositsOffset + PAGE_SIZE >= depositsTotal || depositsLoading
              "
              @click="nextDeposits"
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

    <DepositDialog v-model:open="depositOpen" @deposited="onDeposited" />
  </div>
</template>
