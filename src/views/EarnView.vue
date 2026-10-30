<script setup>
import { computed, onMounted, ref } from 'vue'
import { CircleCheck, CircleMinus, CircleOff, Plus, Timer } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import AddKeyDialog from '@/components/earn/AddKeyDialog.vue'
import ConfirmActionDialog from '@/components/earn/ConfirmActionDialog.vue'
import LimitKeyDialog from '@/components/earn/LimitKeyDialog.vue'
import ProviderIcon from '@/components/earn/ProviderIcon.vue'
import WithdrawDialog from '@/components/earn/WithdrawDialog.vue'
import NetworkTag from '@/components/NetworkTag.vue'
import { earnAPI } from '@/api/v1/earn'
import {
  earnErrorMessage,
  explorerTxUrl,
  formatCnx,
  formatDurationMs,
  formatKeyTokenUsage,
  formatRecordTime,
  isKeyUnavailable,
  keyStatusKind,
  providerDisplayName,
  shortTxHash,
} from '@/lib/earn-ui'

// Temporary preview data for Shared Key usage UI. Set to false before shipping.
const USE_MOCK_SHARED_KEYS = true
const MOCK_SHARED_API_KEYS = [
  {
    id: 'key_mock_unlimited',
    service_provider: 'openai',
    masked_suffix: 'u9k2',
    owner_enabled: true,
    used_input_tokens: 128450,
    used_output_tokens: 18420,
    max_input_tokens: null,
    max_output_tokens: null,
    cooldown_until: null,
  },
  {
    id: 'key_mock_under',
    service_provider: 'anthropic',
    masked_suffix: 'a3f1',
    owner_enabled: true,
    used_input_tokens: 245000,
    used_output_tokens: 52000,
    max_input_tokens: 2000000,
    max_output_tokens: 500000,
    cooldown_until: null,
  },
  {
    id: 'key_mock_near',
    service_provider: 'google',
    masked_suffix: 'g7m4',
    owner_enabled: true,
    used_input_tokens: 980000,
    used_output_tokens: 195000,
    max_input_tokens: 1000000,
    max_output_tokens: 200000,
    cooldown_until: null,
  },
  {
    id: 'key_mock_input_hit',
    service_provider: 'openai',
    masked_suffix: 'i0ut',
    owner_enabled: true,
    used_input_tokens: 1000000,
    used_output_tokens: 12000,
    max_input_tokens: 1000000,
    max_output_tokens: 200000,
    cooldown_until: null,
  },
  {
    id: 'key_mock_output_hit',
    service_provider: 'anthropic',
    masked_suffix: 'o9ut',
    owner_enabled: true,
    used_input_tokens: 80000,
    used_output_tokens: 250000,
    max_input_tokens: 2000000,
    max_output_tokens: 250000,
    cooldown_until: null,
  },
  {
    id: 'key_mock_cooldown',
    service_provider: 'openai',
    masked_suffix: 'c0ld',
    owner_enabled: true,
    used_input_tokens: 42000,
    used_output_tokens: 8000,
    max_input_tokens: 2000000,
    max_output_tokens: 500000,
    cooldown_until: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
  },
  {
    id: 'key_mock_disabled',
    service_provider: 'google',
    masked_suffix: 'd1s2',
    owner_enabled: false,
    used_input_tokens: 0,
    used_output_tokens: 0,
    max_input_tokens: 500000,
    max_output_tokens: 100000,
    cooldown_until: null,
  },
]

const summary = ref(null)
const keys = ref([])
const providers = ref([])
const calls = ref([])
const withdrawals = ref([])
const networks = ref([])

const loading = ref(false)
const summaryReady = ref(false)
const keysReady = ref(false)
const callsReady = ref(false)
const withdrawalsReady = ref(false)

const activeTab = ref('calls')
const withdrawOpen = ref(false)
const addKeyOpen = ref(false)
const limitKeyOpen = ref(false)
const limitKey = ref(null)

const confirmOpen = ref(false)
const confirmBusy = ref(false)
const confirmAction = ref(null)
const confirmKey = ref(null)

const availableWei = computed(() => summary.value?.available ?? '0')
const availableDisplay = computed(() => formatCnx(availableWei.value))

const confirmTitle = computed(() => {
  if (confirmAction.value === 'enable') return 'Enable key'
  if (confirmAction.value === 'disable') return 'Disable key'
  if (confirmAction.value === 'delete') return 'Delete key'
  if (confirmAction.value === 'reset') return 'Reset usage'
  return 'Confirm'
})

const confirmDescription = computed(() => {
  const key = confirmKey.value
  const label = key
    ? `${providerDisplayName(providers.value, key.service_provider)} ···${key.masked_suffix}`
    : 'this key'
  if (confirmAction.value === 'enable') {
    return [
      `Enable ${label} for new task assignment.`,
    ]
  }
  if (confirmAction.value === 'disable') {
    return [
      `Disable ${label}.`,
      'No new tasks will be assigned to this key until you enable it again. The key will not\u00a0be\u00a0deleted.',
    ]
  }
  if (confirmAction.value === 'delete') {
    return [
      `Delete ${label}.`,
      'The key secret will be removed. Usage history will\u00a0be\u00a0kept.',
    ]
  }
  if (confirmAction.value === 'reset') {
    return [
      `Clear used input and output token counters for ${label}.`,
      'Token limits will stay the same.',
    ]
  }
  return []
})

const confirmLabel = computed(() => {
  if (confirmAction.value === 'enable') return 'Enable'
  if (confirmAction.value === 'disable') return 'Disable'
  if (confirmAction.value === 'delete') return 'Delete'
  if (confirmAction.value === 'reset') return 'Reset usage'
  return 'Confirm'
})

const confirmBusyLabel = computed(() => {
  if (confirmAction.value === 'enable') return 'Enabling…'
  if (confirmAction.value === 'disable') return 'Disabling…'
  if (confirmAction.value === 'delete') return 'Deleting…'
  if (confirmAction.value === 'reset') return 'Resetting…'
  return 'Working…'
})

const confirmVariant = computed(() =>
  confirmAction.value === 'delete' ? 'destructive' : 'default',
)

async function loadSummary() {
  try {
    summary.value = await earnAPI.getSummary()
    summaryReady.value = true
  } catch (e) {
    console.error('Failed to load earn summary', e)
    toast.error(
      earnErrorMessage(e, 'Could not load Available CNX. Please try again later.'),
    )
  }
}

async function loadKeys() {
  if (USE_MOCK_SHARED_KEYS) {
    keys.value = MOCK_SHARED_API_KEYS
    keysReady.value = true
    return
  }
  try {
    keys.value = (await earnAPI.listKeys()) || []
    keysReady.value = true
  } catch (e) {
    console.error('Failed to load Shared API Keys', e)
    toast.error(
      earnErrorMessage(e, 'Could not load Shared API Keys. Please try again later.'),
    )
  }
}

async function loadProviders() {
  if (USE_MOCK_SHARED_KEYS) {
    providers.value = [
      { id: 'openai', display_name: 'OpenAI', configured_model_count: 3 },
      { id: 'anthropic', display_name: 'Anthropic', configured_model_count: 2 },
      { id: 'google', display_name: 'Google', configured_model_count: 2 },
    ]
  }
  try {
    const list = (await earnAPI.listProviders()) || []
    if (list.length) {
      providers.value = list
    }
  } catch (e) {
    if (USE_MOCK_SHARED_KEYS && providers.value.length) {
      return
    }
    console.error('Failed to load earn providers', e)
    toast.error(
      earnErrorMessage(e, 'Could not load providers. Please try again later.'),
    )
  }
}

async function loadCalls() {
  try {
    const data = await earnAPI.listCalls({ limit: 20 })
    calls.value = data?.items || []
    callsReady.value = true
  } catch (e) {
    console.error('Failed to load earn calls', e)
    toast.error(
      earnErrorMessage(e, 'Could not load recent calls. Please try again later.'),
    )
  }
}

async function loadWithdrawals() {
  try {
    const data = await earnAPI.listWithdrawals({ limit: 20 })
    withdrawals.value = data?.items || []
    withdrawalsReady.value = true
  } catch (e) {
    console.error('Failed to load withdrawals', e)
    toast.error(
      earnErrorMessage(e, 'Could not load withdrawals. Please try again later.'),
    )
  }
}

async function loadNetworks() {
  try {
    networks.value = (await earnAPI.listWithdrawalNetworks()) || []
  } catch (e) {
    console.error('Failed to load withdrawal networks', e)
    toast.error(
      earnErrorMessage(
        e,
        'Could not load withdrawal networks. Please try again later.',
      ),
    )
  }
}

async function loadAll() {
  loading.value = true
  await Promise.all([
    loadSummary(),
    loadKeys(),
    loadProviders(),
    loadCalls(),
    loadWithdrawals(),
    loadNetworks(),
  ])
  loading.value = false
}

function openConfirm(action, key) {
  confirmAction.value = action
  confirmKey.value = key
  confirmOpen.value = true
}

function openLimit(key) {
  limitKey.value = key
  limitKeyOpen.value = true
}

function onKeyLimitsUpdated() {
  loadKeys()
}

function onRequestResetUsage(key) {
  openConfirm('reset', key)
}

async function onConfirmAction() {
  const action = confirmAction.value
  const key = confirmKey.value
  if (!action || !key || confirmBusy.value) return
  confirmBusy.value = true
  try {
    if (action === 'enable') {
      await earnAPI.enableKey(key.id)
      await loadKeys()
    } else if (action === 'disable') {
      await earnAPI.disableKey(key.id)
      await loadKeys()
    } else if (action === 'delete') {
      await earnAPI.deleteKey(key.id)
      await loadKeys()
    } else if (action === 'reset') {
      if (USE_MOCK_SHARED_KEYS) {
        const target = keys.value.find((item) => item.id === key.id)
        if (target) {
          target.used_input_tokens = 0
          target.used_output_tokens = 0
        }
      } else {
        await earnAPI.resetKeyUsage(key.id)
        await loadKeys()
      }
    }
    confirmOpen.value = false
  } catch (e) {
    console.error(`Failed to ${action} Shared API Key`, e)
    toast.error(
      earnErrorMessage(
        e,
        action === 'reset'
          ? 'Failed to reset usage. Please try again later.'
          : `Failed to ${action} Shared API Key. Please try again later.`,
      ),
    )
  } finally {
    confirmBusy.value = false
  }
}

async function onKeyCreated() {
  await loadKeys()
}

async function onWithdrawn() {
  await Promise.all([loadSummary(), loadWithdrawals()])
  activeTab.value = 'withdraw'
}

function callStatusClass(status) {
  if (status === 'success') return 'text-emerald-600 dark:text-emerald-400'
  if (status === 'failed') return 'text-destructive'
  return 'text-muted-foreground'
}

function withdrawalStatusClass(status) {
  if (status === 'success') return 'text-emerald-600 dark:text-emerald-400'
  if (status === 'failed') return 'text-destructive'
  if (status === 'pending') return 'text-amber-600 dark:text-amber-400'
  return 'text-muted-foreground'
}

function networkDisplayName(networkId) {
  const match = networks.value.find((n) => n.id === networkId)
  return match?.display_name || networkId || '—'
}

function withdrawalToType(item) {
  const benefit = String(item?.benefit_address || '').trim()
  const operational = String(item?.address || '').trim()
  if (
    benefit !== '' &&
    operational !== '' &&
    benefit.toLowerCase() !== operational.toLowerCase()
  ) {
    return 'Beneficial'
  }
  return 'Operational'
}

function withdrawalToTypeClass(item) {
  return withdrawalToType(item) === 'Beneficial'
    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
    : 'bg-red-500/10 text-red-700 dark:text-red-400'
}

function withdrawalTxHref(item) {
  return explorerTxUrl(item.chain_id, item.tx_hash)
}

function isZeroCnxWei(value) {
  try {
    return BigInt(value || '0') === 0n
  } catch {
    return true
  }
}

onMounted(loadAll)
</script>

<template>
  <div class="w-full">
    <div class="mb-8">
      <h1 class="text-2xl font-semibold tracking-tight">Shared Keys</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        Share unused quota from your OpenAI, Anthropic, or Google API
        subscriptions to earn CNX.
      </p>
    </div>

    <div class="mb-8 rounded-lg border border-border bg-muted/30 px-5 py-5">
      <div class="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div class="min-w-0">
          <p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Available
          </p>
          <p v-if="loading && !summaryReady" class="mt-4 text-sm text-muted-foreground">
            Loading…
          </p>
          <div
            v-else-if="summaryReady"
            class="mt-4 flex items-baseline gap-2.5"
          >
            <span class="text-3xl font-semibold tracking-tight tabular-nums text-primary">
              {{ availableDisplay }}
            </span>
            <span class="text-sm text-muted-foreground">CNX</span>
          </div>
          <p v-else class="mt-4 text-3xl font-semibold tracking-tight text-muted-foreground">
            —
          </p>
        </div>
        <Button
          size="sm"
          class="mb-0.5 shrink-0"
          :disabled="!summaryReady"
          @click="withdrawOpen = true"
        >
          Withdraw
        </Button>
      </div>
    </div>

    <section class="mb-10">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-lg font-medium">Shared API Keys</h2>
        <Button size="sm" class="gap-1.5" @click="addKeyOpen = true">
          <Plus class="size-4" />
          Add
        </Button>
      </div>

      <div class="overflow-x-auto rounded-lg border border-border">
        <table class="w-full min-w-[720px] text-left text-sm">
          <thead class="border-b border-border bg-muted/40 text-muted-foreground">
            <tr>
              <th class="px-4 py-2.5 font-medium">Provider</th>
              <th class="px-4 py-2.5 font-medium">Key</th>
              <th class="px-4 py-2.5 font-medium">Usage</th>
              <th class="w-0 px-4 py-2.5 text-right font-medium whitespace-nowrap">
                Actions
              </th>
            </tr>
          </thead>
          <tbody v-if="keysReady && keys.length > 0">
            <tr
              v-for="key in keys"
              :key="key.id"
              class="border-b border-border last:border-0"
            >
              <td class="px-4 py-2.5">
                <span
                  class="inline-flex items-center gap-2 whitespace-nowrap"
                  :class="
                    isKeyUnavailable(key) ? 'text-muted-foreground' : ''
                  "
                >
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <span class="inline-flex shrink-0">
                          <CircleMinus
                            v-if="keyStatusKind(key) === 'disabled'"
                            class="size-4"
                            aria-label="Disabled"
                          />
                          <Timer
                            v-else-if="keyStatusKind(key) === 'cooldown'"
                            class="size-4 text-sky-600 dark:text-sky-400"
                            aria-label="In cooldown"
                          />
                          <CircleOff
                            v-else-if="keyStatusKind(key) === 'limit'"
                            class="size-4 text-amber-600 dark:text-amber-400"
                            aria-label="Token limit reached"
                          />
                          <CircleCheck
                            v-else
                            class="size-4 text-emerald-600 dark:text-emerald-400"
                            aria-label="Enabled"
                          />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <template v-if="keyStatusKind(key) === 'disabled'">
                          Disabled. This key will not receive new tasks until you
                          enable it again.
                        </template>
                        <template v-else-if="keyStatusKind(key) === 'cooldown'">
                          In cooldown until
                          {{ formatRecordTime(key.cooldown_until) }}. AS paused
                          this key after repeated unavailable responses.
                        </template>
                        <template v-else-if="keyStatusKind(key) === 'limit'">
                          Token limit reached. Reset usage or raise the limit to
                          make this key available again.
                        </template>
                        <template v-else>
                          Enabled. This key can receive new tasks.
                        </template>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <ProviderIcon :provider-id="key.service_provider" />
                  {{ providerDisplayName(providers, key.service_provider) }}
                </span>
              </td>
              <td
                class="px-4 py-2.5 font-mono whitespace-nowrap"
                :class="isKeyUnavailable(key) ? 'text-muted-foreground' : ''"
              >
                ···{{ key.masked_suffix }}
              </td>
              <td
                class="px-4 py-2.5 font-mono text-xs whitespace-nowrap"
                :class="isKeyUnavailable(key) ? 'text-muted-foreground' : ''"
              >
                <div>
                  in
                  {{
                    formatKeyTokenUsage(
                      key.used_input_tokens,
                      key.max_input_tokens,
                    )
                  }}
                </div>
                <div class="mt-0.5">
                  out
                  {{
                    formatKeyTokenUsage(
                      key.used_output_tokens,
                      key.max_output_tokens,
                    )
                  }}
                </div>
              </td>
              <td class="w-0 px-4 py-2.5 text-right whitespace-nowrap">
                <div class="inline-flex gap-2">
                  <Button
                    v-if="!key.owner_enabled"
                    size="sm"
                    @click="openConfirm('enable', key)"
                  >
                    Enable
                  </Button>
                  <Button
                    v-else
                    variant="secondary"
                    size="sm"
                    @click="openConfirm('disable', key)"
                  >
                    Disable
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    @click="openLimit(key)"
                  >
                    Limit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    @click="openConfirm('delete', key)"
                  >
                    Delete
                  </Button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <p
          v-if="loading && !keysReady"
          class="px-4 py-10 text-center text-sm text-muted-foreground"
        >
          Loading keys…
        </p>
        <p
          v-else-if="keysReady && keys.length === 0"
          class="px-4 py-10 text-center text-sm text-muted-foreground"
        >
          No Shared API Keys yet.
        </p>
      </div>
    </section>

    <Tabs v-model="activeTab" class="flex w-full flex-col gap-4">
      <TabsList variant="line">
        <TabsTrigger value="calls" class="flex-none px-3">
          Recent Calls
        </TabsTrigger>
        <TabsTrigger value="withdraw" class="flex-none px-3">
          Withdrawals
        </TabsTrigger>
      </TabsList>

      <TabsContent value="calls" class="mt-0">
        <div class="overflow-x-auto rounded-lg border border-border">
          <table class="w-full min-w-[860px] text-left text-sm">
            <thead class="border-b border-border bg-muted/40 text-muted-foreground">
              <tr>
                <th class="px-4 py-2.5 font-medium">Earning</th>
                <th class="px-4 py-2.5 font-medium">Provider</th>
                <th class="px-4 py-2.5 font-medium">Model</th>
                <th class="px-4 py-2.5 font-medium">Key</th>
                <th class="px-4 py-2.5 font-medium">Status</th>
                <th class="px-4 py-2.5 font-medium">Tokens</th>
                <th class="px-4 py-2.5 font-medium">Duration</th>
                <th class="px-4 py-2.5 font-medium">Time</th>
              </tr>
            </thead>
            <tbody v-if="callsReady && calls.length > 0">
              <tr
                v-for="call in calls"
                :key="call.id"
                class="border-b border-border last:border-0"
              >
                <td class="px-4 py-2.5 tabular-nums whitespace-nowrap">
                  <span
                    v-if="isZeroCnxWei(call.earning_wei)"
                    class="text-muted-foreground"
                  >—</span>
                  <span v-else class="text-primary">
                    +{{ formatCnx(call.earning_wei) }}
                  </span>
                </td>
                <td class="px-4 py-2.5">
                  <span class="inline-flex items-center gap-2 whitespace-nowrap">
                    <ProviderIcon :provider-id="call.service_provider" />
                    {{ providerDisplayName(providers, call.service_provider) }}
                  </span>
                </td>
                <td class="px-4 py-2.5 whitespace-nowrap">
                  {{ call.model }}
                </td>
                <td class="px-4 py-2.5 font-mono whitespace-nowrap">
                  ···{{ call.key_masked_suffix }}
                </td>
                <td
                  class="px-4 py-2.5 capitalize whitespace-nowrap"
                  :class="callStatusClass(call.status)"
                >
                  {{ call.status }}
                </td>
                <td class="px-4 py-2.5 tabular-nums whitespace-nowrap">
                  {{ call.prompt_tokens }}/{{ call.completion_tokens }}
                </td>
                <td class="px-4 py-2.5 whitespace-nowrap">
                  {{ formatDurationMs(call.duration_ms) }}
                </td>
                <td class="px-4 py-2.5 whitespace-nowrap">
                  {{ formatRecordTime(call.accepted_at || call.completed_at) }}
                </td>
              </tr>
            </tbody>
          </table>
          <p
            v-if="loading && !callsReady"
            class="px-4 py-10 text-center text-sm text-muted-foreground"
          >
            Loading calls…
          </p>
          <p
            v-else-if="callsReady && calls.length === 0"
            class="px-4 py-10 text-center text-sm text-muted-foreground"
          >
            No call records yet.
          </p>
        </div>
      </TabsContent>

      <TabsContent value="withdraw" class="mt-0">
        <div class="overflow-x-auto rounded-lg border border-border">
          <table class="w-full min-w-[860px] text-left text-sm">
            <thead class="border-b border-border bg-muted/40 text-muted-foreground">
              <tr>
                <th class="px-4 py-2.5 font-medium">Created At</th>
                <th class="px-4 py-2.5 font-medium">Amount</th>
                <th class="px-4 py-2.5 font-medium">Fee</th>
                <th class="px-4 py-2.5 font-medium">Network</th>
                <th class="px-4 py-2.5 font-medium">To Address</th>
                <th class="px-4 py-2.5 font-medium">Status</th>
                <th class="px-4 py-2.5 font-medium">Tx Hash</th>
              </tr>
            </thead>
            <tbody v-if="withdrawalsReady && withdrawals.length > 0">
              <tr
                v-for="item in withdrawals"
                :key="item.id"
                class="border-b border-border last:border-0"
              >
                <td class="px-4 py-2.5 whitespace-nowrap">
                  {{ formatRecordTime(item.created_at) }}
                </td>
                <td class="px-4 py-2.5 tabular-nums whitespace-nowrap">
                  {{ formatCnx(item.amount) }}
                </td>
                <td class="px-4 py-2.5 tabular-nums whitespace-nowrap">
                  {{ formatCnx(item.withdrawal_fee) }}
                </td>
                <td class="px-4 py-2.5 whitespace-nowrap">
                  <NetworkTag
                    :network-id="item.network"
                    :label="networkDisplayName(item.network)"
                  />
                </td>
                <td class="px-4 py-2.5 whitespace-nowrap">
                  <span
                    class="inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-medium"
                    :class="withdrawalToTypeClass(item)"
                  >
                    {{ withdrawalToType(item) }}
                  </span>
                </td>
                <td
                  class="px-4 py-2.5 capitalize whitespace-nowrap"
                  :class="withdrawalStatusClass(item.status)"
                >
                  {{ item.status }}
                </td>
                <td class="px-4 py-2.5 whitespace-nowrap">
                  <a
                    v-if="withdrawalTxHref(item)"
                    :href="withdrawalTxHref(item)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="underline underline-offset-2"
                  >
                    {{ shortTxHash(item.tx_hash) }}
                  </a>
                  <span v-else-if="item.tx_hash">{{ shortTxHash(item.tx_hash) }}</span>
                  <span v-else class="text-muted-foreground">—</span>
                </td>
              </tr>
            </tbody>
          </table>
          <p
            v-if="loading && !withdrawalsReady"
            class="px-4 py-10 text-center text-sm text-muted-foreground"
          >
            Loading withdrawals…
          </p>
          <p
            v-else-if="withdrawalsReady && withdrawals.length === 0"
            class="px-4 py-10 text-center text-sm text-muted-foreground"
          >
            No withdrawals yet.
          </p>
        </div>
      </TabsContent>
    </Tabs>

    <WithdrawDialog
      v-model:open="withdrawOpen"
      :available-wei="availableWei"
      :networks="networks"
      @withdrawn="onWithdrawn"
    />
    <AddKeyDialog
      v-model:open="addKeyOpen"
      :providers="providers"
      @created="onKeyCreated"
    />
    <LimitKeyDialog
      v-model:open="limitKeyOpen"
      :api-key="limitKey"
      @updated="onKeyLimitsUpdated"
      @request-reset="onRequestResetUsage"
    />
    <ConfirmActionDialog
      v-model:open="confirmOpen"
      :title="confirmTitle"
      :description="confirmDescription"
      :confirm-label="confirmLabel"
      :busy-label="confirmBusyLabel"
      :confirm-variant="confirmVariant"
      :busy="confirmBusy"
      @confirm="onConfirmAction"
    />
  </div>
</template>
