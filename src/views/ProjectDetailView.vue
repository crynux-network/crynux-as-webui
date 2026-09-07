<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import ApiKeyRevealDialog from '@/components/projects/ApiKeyRevealDialog.vue'
import DeleteProjectDialog from '@/components/projects/DeleteProjectDialog.vue'
import RenameProjectDialog from '@/components/projects/RenameProjectDialog.vue'
import ResetApiKeyDialog from '@/components/projects/ResetApiKeyDialog.vue'
import ApiError from '@/api/api-error'
import { llmAPI } from '@/api/v1/llm'
import { projectsAPI } from '@/api/v1/projects'
import { projectLlmBaseUrl } from '@/lib/project-url'
import {
  DEFAULT_MAX_TOKEN_RATIO,
  buildTokenRatioOptions,
  formatTokenRatio,
  sliderIndexToTokenRatio,
  tokenRatioToSliderIndex,
} from '@/lib/token-ratio'
import {
  buildExampleRows,
  formatCredits,
  formatSeconds,
  formatTokenCount,
  priorityToCostLevel,
} from '@/lib/llm-billing'
import {
  copyText,
  projectErrorMessage,
} from '@/lib/project-ui'
import { toast } from 'vue-sonner'

const route = useRoute()
const router = useRouter()

const project = ref(null)
const loading = ref(false)
const savingRatio = ref(false)
const maxTokenRatio = ref(DEFAULT_MAX_TOKEN_RATIO)
const tokenRatioOptions = computed(() =>
  buildTokenRatioOptions(maxTokenRatio.value),
)
const tokenRatioSliderMax = computed(() =>
  Math.max(0, tokenRatioOptions.value.length - 1),
)
const sliderIndex = ref([
  tokenRatioToSliderIndex(1, buildTokenRatioOptions(DEFAULT_MAX_TOKEN_RATIO)),
])
const savedTokenRatio = ref(1)
const baseVram = ref(8)
const referencePriorityGwei = ref('1')
const creditsPerGwei = ref(1)
const highestPriorityGwei = ref(null)
const lowestPriorityGwei = ref(null)
const pricingExamples = ref([])
const pricingPromptTokens = ref(1_000_000)
const pricingCompletionTokens = ref(1_000_000)
const timePromptTokens = ref(512)
const timeCompletionTokens = ref(2048)
const urlCopied = ref(false)
let urlCopiedTimer = null
let ratioSaveTimer = null
let syncingSlider = false
const COST_LEVEL_TOAST_ID = 'cost-level-save'
const COST_LEVEL_SAVE_DELAY_MS = 3000

const revealOpen = ref(false)
const revealedApiKey = ref('')
const deleteOpen = ref(false)
const resetOpen = ref(false)
const renameOpen = ref(false)
const costLevelOpen = ref(false)

const projectId = computed(() => route.params.id)
const llmBaseUrl = computed(() =>
  project.value?.endpoint_token
    ? projectLlmBaseUrl(project.value.endpoint_token)
    : '',
)
const currentTokenRatio = computed(() =>
  sliderIndexToTokenRatio(sliderIndex.value[0], tokenRatioOptions.value),
)
const ratioDirty = computed(
  () =>
    formatTokenRatio(currentTokenRatio.value) !==
    formatTokenRatio(savedTokenRatio.value),
)
const pricingRows = computed(() =>
  buildExampleRows({
    examples: pricingExamples.value,
    tokenRatio: currentTokenRatio.value,
    baseVram: baseVram.value,
    referencePriorityGwei: referencePriorityGwei.value,
    creditsPerGwei: creditsPerGwei.value,
    pricingPromptTokens: pricingPromptTokens.value,
    pricingCompletionTokens: pricingCompletionTokens.value,
    timePromptTokens: timePromptTokens.value,
    timeCompletionTokens: timeCompletionTokens.value,
  }),
)
const queueRangeBar = computed(() => {
  const options = tokenRatioOptions.value
  const sliderMax = tokenRatioSliderMax.value
  const lowLevel = priorityToCostLevel(
    lowestPriorityGwei.value,
    referencePriorityGwei.value,
  )
  const highLevel = priorityToCostLevel(
    highestPriorityGwei.value,
    referencePriorityGwei.value,
  )
  if (lowLevel == null || highLevel == null) return null

  const minCostLevel = options[0]
  const maxCostLevel = options[sliderMax]
  const outOfRange =
    (lowLevel < minCostLevel && highLevel < minCostLevel) ||
    (lowLevel > maxCostLevel && highLevel > maxCostLevel)

  const minIndex = tokenRatioToSliderIndex(lowLevel, options)
  const maxIndex = tokenRatioToSliderIndex(highLevel, options)
  const leftIndex = Math.min(minIndex, maxIndex)
  const rightIndex = Math.max(minIndex, maxIndex)

  return {
    outOfRange,
    minPercent: (minIndex / sliderMax) * 100,
    maxPercent: (maxIndex / sliderMax) * 100,
    blueLeft: (leftIndex / sliderMax) * 100,
    blueWidth: ((rightIndex - leftIndex) / sliderMax) * 100,
  }
})
const showQueueRangeBar = computed(() => queueRangeBar.value != null)

watch(projectId, () => {
  clearRatioSaveTimer()
  loadProject()
})

watch(
  () => sliderIndex.value?.[0],
  () => {
    if (syncingSlider || !project.value) return
    scheduleRatioSave()
  },
)

function clearRatioSaveTimer() {
  if (ratioSaveTimer) {
    clearTimeout(ratioSaveTimer)
    ratioSaveTimer = null
  }
}

function scheduleRatioSave() {
  clearRatioSaveTimer()
  if (!ratioDirty.value) return
  ratioSaveTimer = setTimeout(() => {
    ratioSaveTimer = null
    saveCostLevel()
  }, COST_LEVEL_SAVE_DELAY_MS)
}

function showCostLevelToast(type, message) {
  if (type === 'success') {
    toast.success(message, { id: COST_LEVEL_TOAST_ID })
  } else {
    toast.error(message, { id: COST_LEVEL_TOAST_ID })
  }
}

function setSliderFromRatio(tokenRatio) {
  syncingSlider = true
  sliderIndex.value = [
    tokenRatioToSliderIndex(tokenRatio, tokenRatioOptions.value),
  ]
  syncingSlider = false
}

async function loadBillingConfig() {
  try {
    const data = await llmAPI.getBillingConfig()
    const nextBaseVram = Number(data?.base_vram)
    if (Number.isFinite(nextBaseVram) && nextBaseVram > 0) {
      baseVram.value = nextBaseVram
    }
    if (data?.reference_priority_gwei) {
      referencePriorityGwei.value = String(data.reference_priority_gwei)
    }
    const nextCreditsPerGwei = Number(data?.credits_per_gwei)
    if (Number.isFinite(nextCreditsPerGwei) && nextCreditsPerGwei > 0) {
      creditsPerGwei.value = nextCreditsPerGwei
    }
    const nextMaxTokenRatio = Number(data?.max_token_ratio)
    if (Number.isFinite(nextMaxTokenRatio) && nextMaxTokenRatio >= 2) {
      maxTokenRatio.value = Math.floor(nextMaxTokenRatio)
      if (project.value) {
        setSliderFromRatio(savedTokenRatio.value)
      }
    }
    if (data?.highest_priority_gwei != null && data?.lowest_priority_gwei != null) {
      highestPriorityGwei.value = String(data.highest_priority_gwei)
      lowestPriorityGwei.value = String(data.lowest_priority_gwei)
    } else {
      highestPriorityGwei.value = null
      lowestPriorityGwei.value = null
    }
  } catch (e) {
    console.error('Failed to load LLM billing config', e)
  }
}

async function loadPricingExamples() {
  try {
    const data = await llmAPI.getPricingExamples()
    pricingExamples.value = Array.isArray(data?.examples) ? data.examples : []
    const nextPricingPrompt = Number(data?.pricing_prompt_tokens)
    const nextPricingCompletion = Number(data?.pricing_completion_tokens)
    const nextTimePrompt = Number(data?.time_prompt_tokens)
    const nextTimeCompletion = Number(data?.time_completion_tokens)
    if (Number.isFinite(nextPricingPrompt) && nextPricingPrompt > 0) {
      pricingPromptTokens.value = nextPricingPrompt
    }
    if (Number.isFinite(nextPricingCompletion) && nextPricingCompletion > 0) {
      pricingCompletionTokens.value = nextPricingCompletion
    }
    if (Number.isFinite(nextTimePrompt) && nextTimePrompt > 0) {
      timePromptTokens.value = nextTimePrompt
    }
    if (Number.isFinite(nextTimeCompletion) && nextTimeCompletion > 0) {
      timeCompletionTokens.value = nextTimeCompletion
    }
  } catch (e) {
    console.error('Failed to load LLM pricing examples', e)
    pricingExamples.value = []
  }
}

async function loadProject() {
  loading.value = true
  try {
    const data = await projectsAPI.get(projectId.value)
    applyProject(data)
  } catch (e) {
    console.error('Failed to load project', e)
    if (e instanceof ApiError && e.type === ApiError.Type.NotFound) {
      router.replace({ name: 'projects' })
      return
    }
    toast.error(
      projectErrorMessage(e, 'Could not load project. Please try again later.'),
    )
  } finally {
    loading.value = false
  }
}

function applyProject(data) {
  project.value = data
  savedTokenRatio.value = Number(data.token_ratio)
  setSliderFromRatio(data.token_ratio)
}

async function onCopyUrl() {
  if (!llmBaseUrl.value) return
  try {
    await copyText(llmBaseUrl.value)
    urlCopied.value = true
    if (urlCopiedTimer) clearTimeout(urlCopiedTimer)
    urlCopiedTimer = setTimeout(() => {
      urlCopied.value = false
      urlCopiedTimer = null
    }, 2000)
  } catch (e) {
    console.error('Failed to copy LLM base URL', e)
  }
}

function onSelectUrl(event) {
  const el = event?.target
  if (el && typeof el.select === 'function') {
    el.select()
  }
}

async function saveCostLevel() {
  if (!project.value || !ratioDirty.value) return
  if (savingRatio.value) {
    scheduleRatioSave()
    return
  }

  const ratioToSave = currentTokenRatio.value
  savingRatio.value = true
  try {
    const data = await projectsAPI.update(project.value.id, {
      name: project.value.name,
      token_ratio: ratioToSave,
    })
    project.value = data
    savedTokenRatio.value = Number(data.token_ratio)
    if (
      formatTokenRatio(currentTokenRatio.value) ===
      formatTokenRatio(ratioToSave)
    ) {
      setSliderFromRatio(data.token_ratio)
    } else {
      scheduleRatioSave()
    }
    showCostLevelToast('success', 'Cost level saved')
  } catch (e) {
    console.error('Failed to update cost setting', e)
    showCostLevelToast(
      'error',
      projectErrorMessage(e, 'Could not save cost level. Please try again later.'),
    )
    setSliderFromRatio(savedTokenRatio.value)
  } finally {
    savingRatio.value = false
  }
}

function onReset(data) {
  if (project.value && data?.api_key_prefix) {
    project.value = {
      ...project.value,
      api_key_prefix: data.api_key_prefix,
    }
  }
  revealedApiKey.value = data?.api_key || ''
  revealOpen.value = true
}

function onRevealDone() {
  revealedApiKey.value = ''
}

function onRenamed(data) {
  applyProject(data)
}

function onDeleted() {
  router.push({ name: 'projects' })
}

onMounted(() => {
  loadBillingConfig()
  loadPricingExamples()
  loadProject()
})

onUnmounted(() => {
  clearRatioSaveTimer()
  if (urlCopiedTimer) {
    clearTimeout(urlCopiedTimer)
    urlCopiedTimer = null
  }
})
</script>

<template>
  <div class="w-full">
    <Button
      variant="ghost"
      size="sm"
      class="mb-4 gap-1.5"
      @click="router.push({ name: 'projects' })"
    >
      <ArrowLeft class="size-4" />
      Projects
    </Button>

    <div v-if="loading && !project" class="text-sm text-muted-foreground">
      Loading project…
    </div>

    <template v-else-if="project">
      <!-- 1. LLM API credentials -->
      <section class="mb-8 rounded-xl border border-border bg-muted/40 p-5">
        <div class="mb-5 flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h1 class="truncate text-xl font-semibold tracking-tight">
              {{ project.name }}
            </h1>
            <p class="mt-1 text-sm text-muted-foreground">
              Private OpenAI-compatible LLM endpoint for this project.
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button
                variant="outline"
                size="icon"
                class="shrink-0"
                aria-label="Project actions"
              >
                <MoreHorizontal class="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-auto min-w-40">
              <DropdownMenuItem @click="renameOpen = true">
                <Pencil class="size-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" @click="deleteOpen = true">
                <Trash2 class="size-4" />
                Delete project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div class="grid gap-5">
          <div class="grid gap-2">
            <Label class="text-muted-foreground">Base URL</Label>
            <div class="flex w-fit max-w-md items-center gap-2">
              <Input
                :model-value="llmBaseUrl"
                readonly
                class="min-w-0 w-80 truncate bg-background font-mono text-xs"
                @focus="onSelectUrl"
                @click="onSelectUrl"
              />
              <Button
                variant="outline"
                size="icon"
                class="shrink-0 bg-background"
                :aria-label="urlCopied ? 'Copied' : 'Copy base URL'"
                @click="onCopyUrl"
              >
                <Check v-if="urlCopied" class="size-4" />
                <Copy v-else class="size-4" />
              </Button>
            </div>
          </div>

          <div class="grid gap-2">
            <Label class="text-muted-foreground">API key</Label>
            <div>
              <Button
                variant="outline"
                size="sm"
                class="h-8 bg-background"
                @click="resetOpen = true"
              >
                Reset
              </Button>
            </div>
          </div>
        </div>
      </section>

      <!-- 2. Cost Level -->
      <section class="mb-8 rounded-xl border border-border">
        <button
          type="button"
          class="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
          :aria-expanded="costLevelOpen"
          @click="costLevelOpen = !costLevelOpen"
        >
          <span class="flex items-center gap-2">
            <ChevronDown
              class="size-4 shrink-0 text-muted-foreground transition-transform"
              :class="costLevelOpen ? 'rotate-0' : '-rotate-90'"
            />
            <span class="text-base font-semibold tracking-tight">
              Cost Level
            </span>
          </span>
          <span
            v-if="!costLevelOpen"
            class="font-mono text-2xl font-semibold tabular-nums text-primary"
          >
            {{ formatTokenRatio(currentTokenRatio) }}×
          </span>
        </button>

        <div v-if="costLevelOpen" class="border-t border-border px-5 pb-5 pt-4">
          <div class="mb-5 max-w-3xl space-y-3 text-sm text-muted-foreground">
            <p>
              Every LLM call spends Credits from your account. The charge depends
              on model execution time, VRAM weight, and this project cost level.
            </p>
            <p>
              Lower cost levels spend fewer Credits but jobs may wait longer in
              the network queue. Higher cost levels spend more Credits and sit
              higher in the queue. The bar under the slider shows the current
              queue range between Min and Max.
            </p>
          </div>

          <div
            class="mb-6 grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2"
          >
            <span
              class="shrink-0 font-mono text-2xl font-semibold tabular-nums text-primary"
            >
              {{ formatTokenRatio(currentTokenRatio) }}×
            </span>
            <span class="shrink-0 text-xs text-muted-foreground">Cheaper</span>
              <Slider
                v-model="sliderIndex"
                :min="0"
                :max="tokenRatioSliderMax"
                :step="1"
                class="w-full"
              />
            <span class="shrink-0 text-xs text-muted-foreground">Faster</span>
            <div
              v-if="showQueueRangeBar"
              class="relative col-start-3 h-8"
              aria-hidden="true"
            >
              <div
                class="absolute inset-x-0 top-1.5 h-1.5 overflow-hidden rounded-full bg-red-500"
              >
                <div
                  v-if="!queueRangeBar.outOfRange"
                  class="absolute inset-y-0 bg-blue-500"
                  :style="{
                    left: `${queueRangeBar.blueLeft}%`,
                    width: `${Math.max(queueRangeBar.blueWidth, 0.5)}%`,
                  }"
                />
              </div>
              <div
                class="absolute top-0 flex w-0 -translate-x-1/2 flex-col items-center"
                :style="{ left: `${queueRangeBar.minPercent}%` }"
              >
                <div class="h-4 w-0.5 bg-foreground/80" />
                <span class="mt-0.5 text-[10px] leading-none text-muted-foreground">
                  Min
                </span>
              </div>
              <div
                class="absolute top-0 flex w-0 -translate-x-1/2 flex-col items-center"
                :style="{ left: `${queueRangeBar.maxPercent}%` }"
              >
                <div class="h-4 w-0.5 bg-foreground/80" />
                <span class="mt-0.5 text-[10px] leading-none text-muted-foreground">
                  Max
                </span>
              </div>
            </div>
          </div>

          <div class="grid gap-4 lg:grid-cols-2">
            <div class="overflow-hidden rounded-xl border border-border bg-muted/30">
              <div class="border-b border-border px-4 py-3">
                <p class="text-sm font-medium text-foreground">
                  Credits per 1M tokens
                </p>
                <p class="mt-0.5 text-xs text-muted-foreground">
                  Estimates only. Actual charges may differ.
                </p>
              </div>
              <table class="w-full text-left text-sm">
                <thead>
                  <tr class="border-b border-border text-muted-foreground">
                    <th class="px-4 py-3 font-medium">Model</th>
                    <th class="px-4 py-3 text-right font-medium">1M Input</th>
                    <th class="px-4 py-3 text-right font-medium">1M Output</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in pricingRows"
                    :key="`credits-${row.id}`"
                    class="border-b border-border last:border-b-0"
                  >
                    <td class="px-4 py-3.5 text-foreground">
                      <div>{{ row.model }}</div>
                      <div class="text-xs text-muted-foreground">
                        {{ row.minVram }} GB
                      </div>
                    </td>
                    <td class="px-4 py-3.5 text-right tabular-nums text-foreground">
                      <span class="font-semibold">{{ formatCredits(row.inputCredits) }}</span>
                      <span class="ml-1 text-xs font-normal text-muted-foreground">Credits</span>
                    </td>
                    <td class="px-4 py-3.5 text-right tabular-nums text-foreground">
                      <span class="font-semibold">{{ formatCredits(row.outputCredits) }}</span>
                      <span class="ml-1 text-xs font-normal text-muted-foreground">Credits</span>
                    </td>
                  </tr>
                  <tr v-if="pricingRows.length === 0">
                    <td
                      colspan="3"
                      class="px-4 py-3.5 text-muted-foreground"
                    >
                      No model examples available.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="overflow-hidden rounded-xl border border-border bg-muted/30">
              <div class="border-b border-border px-4 py-3">
                <p class="text-sm font-medium text-foreground">
                  Execution time examples
                </p>
                <p class="mt-0.5 text-xs text-muted-foreground">
                  Actual execution time only. Does not include queue wait, and
                  does not change with cost level.
                </p>
              </div>
              <table class="w-full text-left text-sm">
                <thead>
                  <tr class="border-b border-border text-muted-foreground">
                    <th class="px-4 py-3 font-medium">Model</th>
                    <th class="px-4 py-3 text-right font-medium">Input</th>
                    <th class="px-4 py-3 text-right font-medium">Output</th>
                    <th class="px-4 py-3 text-right font-medium">Seconds</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in pricingRows"
                    :key="`time-${row.id}`"
                    class="border-b border-border last:border-b-0"
                  >
                    <td class="px-4 py-3.5 text-foreground">
                      <div>{{ row.model }}</div>
                      <div class="text-xs text-muted-foreground">
                        {{ row.minVram }} GB
                      </div>
                    </td>
                    <td class="px-4 py-3.5 text-right tabular-nums text-foreground">
                      {{ formatTokenCount(timePromptTokens) }}
                    </td>
                    <td class="px-4 py-3.5 text-right tabular-nums text-foreground">
                      {{ formatTokenCount(timeCompletionTokens) }}
                    </td>
                    <td class="px-4 py-3.5 text-right font-semibold tabular-nums text-foreground">
                      {{ formatSeconds(row.executionSeconds) }}
                    </td>
                  </tr>
                  <tr v-if="pricingRows.length === 0">
                    <td
                      colspan="4"
                      class="px-4 py-3.5 text-muted-foreground"
                    >
                      No model examples available.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </template>

    <RenameProjectDialog
      v-model:open="renameOpen"
      :project-id="project?.id"
      :project-name="project?.name"
      :token-ratio="savedTokenRatio"
      @renamed="onRenamed"
    />
    <ResetApiKeyDialog
      v-model:open="resetOpen"
      :project-id="project?.id"
      @reset="onReset"
    />
    <ApiKeyRevealDialog
      v-model:open="revealOpen"
      :api-key="revealedApiKey"
      @done="onRevealDone"
    />
    <DeleteProjectDialog
      v-model:open="deleteOpen"
      :project-id="project?.id"
      :project-name="project?.name"
      @deleted="onDeleted"
    />
  </div>
</template>
