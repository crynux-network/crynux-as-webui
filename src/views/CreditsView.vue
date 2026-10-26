<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { Check, Copy, Plus, RefreshCw } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import PurchaseDialog from '@/components/credits/PurchaseDialog.vue'
import ResetInviteCodeDialog from '@/components/credits/ResetInviteCodeDialog.vue'
import UsageModelCell from '@/components/stats/UsageModelCell.vue'
import UsageWorkloadCell from '@/components/stats/UsageWorkloadCell.vue'
import { accountAPI } from '@/api/v1/account'
import { purchaseAPI } from '@/api/v1/purchase'
import { referralAPI } from '@/api/v1/referral'
import { formatCredits, formatGwei } from '@/lib/llm-billing'
import {
  PAGE_SIZE,
  creditsErrorMessage,
  explorerTxUrl,
  formatCreditsValue,
  formatRecordTime,
  formatTokenBalance,
  shortTxHash,
} from '@/lib/credits-ui'
import { copyText } from '@/lib/project-ui'
import {
  buildReferralLink,
  buildReferralRulesIntro,
  formatDepositRewardPercent,
  formatPurchaseProgress,
  normalizePurchaseBonusTiers,
  purchaseTypeLabel,
  shortAddress,
} from '@/lib/referral'

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

const inviteCode = ref('')
const referralLink = computed(() => buildReferralLink(inviteCode.value))
const depositRewardRatio = ref('')
const inviteeBonus = ref(0)
const purchaseBonusTiers = ref([])
const referralRulesIntro = computed(() =>
  buildReferralRulesIntro({
    depositRewardRatio: depositRewardRatio.value,
    inviteeBonus: inviteeBonus.value,
    purchaseBonusTiers: purchaseBonusTiers.value,
    formatCreditsValue,
  }),
)
const referralBonusTierRows = computed(() =>
  normalizePurchaseBonusTiers(purchaseBonusTiers.value),
)
const referralBonusTiersOpen = ref(false)
const referralLoading = ref(false)
const referralReady = ref(false)
const resetCodeLoading = ref(false)
const resetInviteCodeOpen = ref(false)
const referralLinkCopied = ref(false)
let referralLinkCopiedTimer = null

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

const rewards = ref([])
const rewardsTotal = ref(0)
const rewardsOffset = ref(0)
const rewardsLoading = ref(false)
const rewardsReady = ref(false)

const purchasesPage = computed(() => Math.floor(purchasesOffset.value / PAGE_SIZE) + 1)
const purchasesPageCount = computed(() =>
  Math.max(1, Math.ceil(purchasesTotal.value / PAGE_SIZE)),
)
const chargesPage = computed(() => Math.floor(chargesOffset.value / PAGE_SIZE) + 1)
const chargesPageCount = computed(() =>
  Math.max(1, Math.ceil(chargesTotal.value / PAGE_SIZE)),
)
const rewardsPage = computed(() => Math.floor(rewardsOffset.value / PAGE_SIZE) + 1)
const rewardsPageCount = computed(() =>
  Math.max(1, Math.ceil(rewardsTotal.value / PAGE_SIZE)),
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

async function loadReferral() {
  referralLoading.value = true
  try {
    const data = await referralAPI.getReferral()
    inviteCode.value = data?.invite_code ?? ''
    depositRewardRatio.value = data?.deposit_reward_ratio ?? ''
    inviteeBonus.value = Number(data?.invitee_bonus ?? 0)
    purchaseBonusTiers.value = Array.isArray(data?.purchase_bonus_tiers)
      ? data.purchase_bonus_tiers
      : []
    referralReady.value = true
  } catch (e) {
    console.error('Failed to load referral settings', e)
    toast.error(
      creditsErrorMessage(e, 'Could not load referral link. Please try again later.'),
    )
  } finally {
    referralLoading.value = false
  }
}

async function copyReferralLink() {
  if (!referralLink.value) return
  try {
    await copyText(referralLink.value)
    referralLinkCopied.value = true
    if (referralLinkCopiedTimer) clearTimeout(referralLinkCopiedTimer)
    referralLinkCopiedTimer = setTimeout(() => {
      referralLinkCopied.value = false
      referralLinkCopiedTimer = null
    }, 1500)
  } catch (e) {
    console.error('Failed to copy referral link', e)
    toast.error('Could not copy referral link. Please try again later.')
  }
}

async function confirmResetInviteCode() {
  resetCodeLoading.value = true
  try {
    const data = await referralAPI.resetInviteCode()
    inviteCode.value = data?.invite_code ?? ''
    resetInviteCodeOpen.value = false
    toast.success('Invite code reset.')
  } catch (e) {
    console.error('Failed to reset invite code', e)
    toast.error(
      creditsErrorMessage(e, 'Could not reset invite code. Please try again later.'),
    )
  } finally {
    resetCodeLoading.value = false
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

async function loadRewards() {
  rewardsLoading.value = true
  try {
    const data = await referralAPI.listRewards({
      offset: rewardsOffset.value,
      limit: PAGE_SIZE,
    })
    rewards.value = data?.rewards ?? []
    rewardsTotal.value = Number(data?.total ?? 0)
    rewardsReady.value = true
  } catch (e) {
    console.error('Failed to load referral rewards', e)
    toast.error(
      creditsErrorMessage(e, 'Could not load referrals. Please try again later.'),
    )
  } finally {
    rewardsLoading.value = false
  }
}

function onPurchased() {
  purchasesOffset.value = 0
  loadBalance()
  loadPurchases()
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

function prevRewards() {
  if (rewardsOffset.value <= 0) return
  rewardsOffset.value = Math.max(0, rewardsOffset.value - PAGE_SIZE)
  loadRewards()
}

function nextRewards() {
  if (rewardsOffset.value + PAGE_SIZE >= rewardsTotal.value) return
  rewardsOffset.value += PAGE_SIZE
  loadRewards()
}

function purchaseTxHref(purchase) {
  if (!purchase?.network || !purchase?.tx_hash) return null
  return explorerTxUrl(chainIdByNetwork.value[purchase.network], purchase.tx_hash)
}

function formatPurchaseAmount(rawAmount, networkName, tokenName) {
  if (rawAmount == null || !networkName || !tokenName) return '—'
  const network = networks.value.find((n) => n.name === networkName)
  const token = network?.tokens?.find((t) => t.name === tokenName)
  if (!token) return '—'
  try {
    return formatTokenBalance(rawAmount, token.decimals)
  } catch {
    return '—'
  }
}

function formatPurchaseCredits(credits) {
  return `+${formatCreditsValue(credits)}`
}

function formatChargeCredits(credits) {
  return formatCreditsValue(credits)
}

function formatRewardCredits(credits) {
  return `+${formatCreditsValue(credits)}`
}

function formatRewardPurchases(reward) {
  return formatPurchaseProgress(
    reward?.prior_purchase_count,
    purchaseBonusTiers.value,
  )
}

function formatRewardExtraPercent(reward) {
  const percent = formatDepositRewardPercent(reward?.extra_ratio)
  if (percent == null || Number(percent) <= 0) return '—'
  return `${percent}%`
}

function formatRewardExtraCredits(reward) {
  const amount = reward?.extra_amount
  if (amount == null || amount === '' || amount === '0') return '—'
  try {
    if (BigInt(String(amount)) <= 0n) return '—'
  } catch {
    return '—'
  }
  return `+${formatCreditsValue(amount)}`
}

watch(activeTab, (tab) => {
  if (tab === 'charges' && charges.value.length === 0 && !chargesLoading.value) {
    loadCharges()
  }
  if (tab === 'purchases' && purchases.value.length === 0 && !purchasesLoading.value) {
    loadPurchases()
  }
  if (tab === 'referrals' && rewards.value.length === 0 && !rewardsLoading.value) {
    loadRewards()
  }
})

onMounted(() => {
  loadBalance()
  loadNetworks()
  loadReferral()
  loadCharges()
})
</script>

<template>
  <div class="w-full">
    <div class="mb-8">
      <h1 class="text-2xl font-semibold tracking-tight">Credits</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        Account balance, purchases, usage, and referrals.
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

      <div class="mt-6 border-t border-border pt-5">
        <p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Referral link
        </p>
        <p class="mt-2 text-sm text-muted-foreground">
          Invite others to sign up. When they purchase Credits, you earn a reward.
          New users who use your link also get extra Credits.
        </p>
        <p v-if="referralLoading" class="mt-3 text-sm text-muted-foreground">
          Loading…
        </p>
        <div v-else-if="referralReady" class="mt-3 flex flex-col gap-3">
          <div class="flex flex-wrap items-center gap-2">
            <div
              class="flex min-w-0 flex-1 items-stretch overflow-hidden rounded-md border border-border bg-background"
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                class="h-auto shrink-0 rounded-none border-r border-border px-3"
                :disabled="!referralLink"
                :aria-label="
                  referralLinkCopied ? 'Copied' : 'Copy referral link'
                "
                @click="copyReferralLink"
              >
                <Check v-if="referralLinkCopied" class="size-4" />
                <Copy v-else class="size-4" />
              </Button>
              <Input
                :model-value="referralLink || '—'"
                readonly
                class="h-9 min-w-0 flex-1 rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0"
                :title="referralLink"
                @focus="($event) => $event.target.select()"
                @click="($event) => $event.target.select()"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              class="gap-1.5"
              :disabled="resetCodeLoading"
              @click="resetInviteCodeOpen = true"
            >
              <RefreshCw class="size-4" />
              Reset invite code
            </Button>
          </div>
          <div
            v-if="referralRulesIntro || referralBonusTierRows.length > 0"
            class="flex flex-col gap-2"
          >
            <p
              v-if="referralRulesIntro"
              class="text-xs leading-relaxed text-muted-foreground"
            >
              {{ referralRulesIntro }}
              <button
                v-if="referralBonusTierRows.length > 0"
                type="button"
                class="ml-1 text-xs text-foreground underline underline-offset-2 hover:text-foreground/80"
                :aria-expanded="referralBonusTiersOpen"
                @click="referralBonusTiersOpen = !referralBonusTiersOpen"
              >
                {{ referralBonusTiersOpen ? 'Hide details' : 'View details' }}
              </button>
            </p>
            <div
              v-if="referralBonusTiersOpen && referralBonusTierRows.length > 0"
              class="w-fit overflow-hidden rounded-md border border-border"
            >
              <table class="text-left text-xs">
                <thead class="border-b border-border bg-muted/40 text-muted-foreground">
                  <tr>
                    <th class="px-3 py-1.5 font-medium">After purchases</th>
                    <th class="px-3 py-1.5 font-medium">Extra reward</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="tier in referralBonusTierRows"
                    :key="tier.minPurchases"
                    class="border-b border-border last:border-b-0"
                  >
                    <td class="px-3 py-1.5 tabular-nums">{{ tier.minPurchases }}</td>
                    <td class="px-3 py-1.5 tabular-nums">+{{ tier.extraPercent }}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

    <Tabs v-model="activeTab" class="flex w-full flex-col gap-4">
      <TabsList variant="line">
        <TabsTrigger value="charges" class="flex-none px-3">Usage</TabsTrigger>
        <TabsTrigger value="purchases" class="flex-none px-3">Purchases</TabsTrigger>
        <TabsTrigger value="referrals" class="flex-none px-3">Referrals</TabsTrigger>
      </TabsList>

      <TabsContent value="purchases" class="mt-0">
        <div class="overflow-x-auto rounded-lg border border-border">
          <table class="w-full min-w-[720px] text-left text-sm">
            <thead class="border-b border-border bg-muted/40 text-muted-foreground">
              <tr>
                <th class="px-4 py-2.5 font-medium">Type</th>
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
                <td class="px-4 py-2.5">
                  {{ purchaseTypeLabel(purchase.type) }}
                </td>
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
                <td class="px-4 py-2.5 uppercase">
                  {{ purchase.token || '—' }}
                </td>
                <td class="px-4 py-2.5">
                  {{ purchase.network || '—' }}
                </td>
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
            No purchases or bonuses yet.
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
                <th class="px-4 py-2.5 font-medium">Credits</th>
                <th class="px-4 py-2.5 font-medium">Project</th>
                <th class="px-4 py-2.5 font-medium">Model</th>
                <th class="px-4 py-2.5 font-medium">VRAM</th>
                <th class="px-4 py-2.5 font-medium">Usage</th>
                <th class="px-4 py-2.5 font-medium">Cost Level</th>
                <th class="px-4 py-2.5 font-medium">Time</th>
              </tr>
            </thead>
            <tbody v-if="!chargesLoading && charges.length > 0">
              <tr
                v-for="charge in charges"
                :key="charge.id"
                class="border-b border-border last:border-0"
              >
                <td class="px-4 py-2.5 tabular-nums">
                  {{ formatChargeCredits(charge.credits) }}
                </td>
                <td class="px-4 py-2.5 max-w-[180px] truncate">
                  {{ charge.project_name || '—' }}
                </td>
                <td class="px-4 py-2.5 max-w-[260px]">
                  <UsageModelCell
                    :model="charge.model"
                    :quantization-config="charge.quantization_config"
                    :components="charge.components"
                    :show-titles="false"
                  />
                </td>
                <td class="px-4 py-2.5 tabular-nums">
                  {{ charge.billed_vram }} GB
                </td>
                <td class="px-4 py-2.5">
                  <UsageWorkloadCell
                    :task-type="charge.task_type || 'llm'"
                    :prompt-tokens="charge.prompt_tokens"
                    :completion-tokens="charge.completion_tokens"
                    :image-width="charge.image_width"
                    :image-height="charge.image_height"
                    :image-steps="charge.image_steps"
                    :image-count="charge.image_count"
                    variant="request"
                  />
                </td>
                <td class="px-4 py-2.5 tabular-nums">
                  <template v-if="Number(charge.priority_gwei) > 0">
                    {{ formatGwei(charge.priority_gwei) }}
                  </template>
                  <template v-else>—</template>
                </td>
                <td class="px-4 py-2.5 whitespace-nowrap">
                  {{ formatRecordTime(charge.created_at) }}
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

      <TabsContent value="referrals" class="mt-0">
        <div class="overflow-x-auto rounded-lg border border-border">
          <table class="w-full min-w-[720px] text-left text-sm">
            <thead class="border-b border-border bg-muted/40 text-muted-foreground">
              <tr>
                <th class="px-4 py-2.5 font-medium">Credits earned</th>
                <th class="px-4 py-2.5 font-medium">Purchases</th>
                <th class="px-4 py-2.5 font-medium">Extra %</th>
                <th class="px-4 py-2.5 font-medium">Extra Credits</th>
                <th class="px-4 py-2.5 font-medium">Invitee</th>
                <th class="px-4 py-2.5 font-medium">Time</th>
              </tr>
            </thead>
            <tbody v-if="!rewardsLoading && rewards.length > 0">
              <tr
                v-for="reward in rewards"
                :key="reward.id"
                class="border-b border-border last:border-0"
              >
                <td class="px-4 py-2.5 tabular-nums">
                  {{ formatRewardCredits(reward.amount) }}
                </td>
                <td class="px-4 py-2.5 tabular-nums">
                  {{ formatRewardPurchases(reward) }}
                </td>
                <td class="px-4 py-2.5 tabular-nums">
                  {{ formatRewardExtraPercent(reward) }}
                </td>
                <td class="px-4 py-2.5 tabular-nums">
                  {{ formatRewardExtraCredits(reward) }}
                </td>
                <td class="px-4 py-2.5 font-mono text-xs">
                  {{ shortAddress(reward.invitee_address) }}
                </td>
                <td class="px-4 py-2.5 whitespace-nowrap">
                  {{ formatRecordTime(reward.created_at) }}
                </td>
              </tr>
            </tbody>
          </table>
          <p
            v-if="rewardsLoading"
            class="px-4 py-10 text-center text-sm text-muted-foreground"
          >
            Loading referrals…
          </p>
          <p
            v-else-if="rewardsReady && rewards.length === 0"
            class="px-4 py-10 text-center text-sm text-muted-foreground"
          >
            No referral rewards yet.
          </p>
        </div>
        <div
          v-if="rewardsTotal > PAGE_SIZE"
          class="mt-3 flex items-center justify-between gap-3"
        >
          <p class="text-xs text-muted-foreground">
            Page {{ rewardsPage }} of {{ rewardsPageCount }}
          </p>
          <div class="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              :disabled="rewardsOffset <= 0 || rewardsLoading"
              @click="prevRewards"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              :disabled="
                rewardsOffset + PAGE_SIZE >= rewardsTotal || rewardsLoading
              "
              @click="nextRewards"
            >
              Next
            </Button>
          </div>
        </div>
      </TabsContent>
    </Tabs>

    <PurchaseDialog v-model:open="purchaseOpen" @purchased="onPurchased" />
    <ResetInviteCodeDialog
      v-model:open="resetInviteCodeOpen"
      :busy="resetCodeLoading"
      @confirm="confirmResetInviteCode"
    />
  </div>
</template>
