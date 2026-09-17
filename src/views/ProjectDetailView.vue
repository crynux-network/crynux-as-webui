<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ApiKeyRevealDialog from '@/components/projects/ApiKeyRevealDialog.vue'
import DeleteProjectDialog from '@/components/projects/DeleteProjectDialog.vue'
import RenameProjectDialog from '@/components/projects/RenameProjectDialog.vue'
import ResetApiKeyDialog from '@/components/projects/ResetApiKeyDialog.vue'
import ProjectUsageSection from '@/components/stats/ProjectUsageSection.vue'
import ProjectRecentRequestsSection from '@/components/stats/ProjectRecentRequestsSection.vue'
import ApiError from '@/api/api-error'
import { llmAPI } from '@/api/v1/llm'
import { projectsAPI } from '@/api/v1/projects'
import {
  PROJECT_API_DOCS,
  projectChatCompletionsUrl,
  projectLlmBaseUrl,
  projectRawTaskUrl,
  projectResponsesUrl,
} from '@/lib/project-url'
import {
  buildExampleRows,
  clampPriorityGwei,
  computePriorityAxis,
  defaultAutoMaxPriorityGwei,
  formatCredits,
  formatGwei,
  formatSeconds,
  formatTokenCount,
  logPercentToPriority,
  normalizeAutoQueuePosition,
  AUTO_QUEUE_POSITION_MIN,
  AUTO_QUEUE_POSITION_MAX,
  AUTO_QUEUE_POSITION_BAR_MARGIN,
  parsePriorityInput,
  priorityToLogPercent,
} from '@/lib/llm-billing'
import {
  copyText,
  projectErrorMessage,
} from '@/lib/project-ui'
import { toast } from 'vue-sonner'

const route = useRoute()
const router = useRouter()

const SLIDER_SCALE = 10
const SLIDER_MAX = 100 * SLIDER_SCALE

const project = ref(null)
const loading = ref(false)
const savingPriority = ref(false)
const costLevelMode = ref('static')
const savedCostLevelMode = ref('static')
const priorityGwei = ref(1)
const savedPriorityGwei = ref(1)
const priorityInput = ref('1')
const sliderPercent = ref([0])
const autoQueuePosition = ref(50)
const savedAutoQueuePosition = ref(50)
const autoPositionSlider = ref([50])
const autoPositionInput = ref('50')
const autoMaxPriorityGwei = ref(1)
const savedAutoMaxPriorityGwei = ref(null)
const autoMaxInput = ref('1')
const autoMaxSliderPercent = ref([0])
const minPriorityGwei = ref(1)
const maxPriorityGwei = ref(1_000_000_000)
const medianPriorityGwei = ref(null)
const baseVram = ref(8)
const creditsPerGwei = ref(1)
const highestPriorityGwei = ref(null)
const lowestPriorityGwei = ref(null)
const pricingExamples = ref([])
const pricingPromptTokens = ref(1_000_000)
const pricingCompletionTokens = ref(1_000_000)
const timePromptTokens = ref(512)
const timeCompletionTokens = ref(2048)
const copiedField = ref('')
let copiedFieldTimer = null
let prioritySaveTimer = null
let syncingPriority = false
let syncingAutoControls = false
const COST_LEVEL_TOAST_ID = 'cost-level-save'
const COST_LEVEL_SAVE_DELAY_MS = 3000

const revealOpen = ref(false)
const revealedApiKey = ref('')
const deleteOpen = ref(false)
const resetOpen = ref(false)
const renameOpen = ref(false)
const costLevelOpen = ref(false)
const apiEndpointsOpen = ref(false)
const apiGuideTab = ref('chat_completions')

const projectId = computed(() => route.params.id)
const endpointToken = computed(() => project.value?.endpoint_token || '')
const llmBaseUrl = computed(() =>
  endpointToken.value ? projectLlmBaseUrl(endpointToken.value) : '',
)
const apiGuideItems = computed(() => {
  const token = endpointToken.value
  return [
    {
      id: 'chat_completions',
      label: 'Chat Completions',
      url: token ? projectChatCompletionsUrl(token) : '',
      docsUrl: PROJECT_API_DOCS.chat_completions,
      description:
        'OpenAI Chat Completions API. Use the OpenAI SDK with this project Base URL, or POST directly to this endpoint with the project API key.',
    },
    {
      id: 'responses',
      label: 'Responses',
      url: token ? projectResponsesUrl(token) : '',
      docsUrl: PROJECT_API_DOCS.responses,
      description:
        'OpenAI Responses API. Use it when you need background execution or response polling instead of a single chat completion call.',
    },
    {
      id: 'raw_task',
      label: 'Raw Task',
      url: token ? projectRawTaskUrl(token) : '',
      docsUrl: PROJECT_API_DOCS.raw_task,
      description:
        'Crynux raw task API. Submit task parameters directly for supported task types such as text-to-image, text-to-text, and fine-tuning, without the OpenAI request format.',
    },
  ]
})

const priorityAxis = computed(() =>
  computePriorityAxis({
    userPriorityGwei:
      costLevelMode.value === 'auto'
        ? autoMaxPriorityGwei.value
        : priorityGwei.value,
    lowestPriorityGwei: lowestPriorityGwei.value,
    highestPriorityGwei: highestPriorityGwei.value,
    medianPriorityGwei: medianPriorityGwei.value,
    minPriorityGwei: minPriorityGwei.value,
    maxPriorityGwei: maxPriorityGwei.value,
  }),
)

const isAutoMode = computed(() => costLevelMode.value === 'auto')

const priorityDirty = computed(() => {
  if (costLevelMode.value !== savedCostLevelMode.value) return true
  if (Number(priorityGwei.value) !== Number(savedPriorityGwei.value)) return true
  if (Number(autoQueuePosition.value) !== Number(savedAutoQueuePosition.value)) {
    return true
  }
  const savedMax =
    savedAutoMaxPriorityGwei.value == null
      ? null
      : Number(savedAutoMaxPriorityGwei.value)
  if (savedMax == null) {
    return costLevelMode.value === 'auto'
  }
  return Number(autoMaxPriorityGwei.value) !== savedMax
})

const examplePriorityGwei = computed(() =>
  isAutoMode.value ? autoMaxPriorityGwei.value : priorityGwei.value,
)

const pricingRows = computed(() =>
  buildExampleRows({
    examples: pricingExamples.value,
    priorityGwei: examplePriorityGwei.value,
    baseVram: baseVram.value,
    creditsPerGwei: creditsPerGwei.value,
    pricingPromptTokens: pricingPromptTokens.value,
    pricingCompletionTokens: pricingCompletionTokens.value,
    timePromptTokens: timePromptTokens.value,
    timeCompletionTokens: timeCompletionTokens.value,
  }),
)

const creditsTableTitle = computed(() =>
  isAutoMode.value
    ? 'Maximum Credits per 1M tokens'
    : 'Credits per 1M tokens',
)

const queueRangeBar = computed(() => {
  const low = Number(lowestPriorityGwei.value)
  const high = Number(highestPriorityGwei.value)
  if (!(low > 0) || !(high > 0)) return null

  const { axisMin, axisMax } = priorityAxis.value
  const outOfRange =
    (low < axisMin && high < axisMin) || (low > axisMax && high > axisMax)

  const minPercent = priorityToLogPercent(low, axisMin, axisMax)
  const maxPercent = priorityToLogPercent(high, axisMin, axisMax)
  const left = Math.min(minPercent, maxPercent)
  const right = Math.max(minPercent, maxPercent)

  return {
    outOfRange,
    minPercent,
    maxPercent,
    blueLeft: left,
    blueWidth: right - left,
  }
})
const showQueueRangeBar = computed(() => queueRangeBar.value != null)

watch(projectId, () => {
  clearPrioritySaveTimer()
  loadProject()
})

watch(
  () => sliderPercent.value?.[0],
  (raw) => {
    if (syncingPriority || !project.value || isAutoMode.value) return
    const percent = Number(raw) / SLIDER_SCALE
    const { axisMin, axisMax } = priorityAxis.value
    const next = clampPriorityGwei(
      logPercentToPriority(percent, axisMin, axisMax),
      minPriorityGwei.value,
      maxPriorityGwei.value,
    )
    if (next === Number(priorityGwei.value)) return
    applyPriorityLocal(next, { syncInput: true, remapSlider: true })
    schedulePrioritySave()
  },
)

watch(
  () => autoPositionSlider.value?.[0],
  (raw) => {
    if (syncingAutoControls || !project.value || !isAutoMode.value) return
    const next = normalizeAutoQueuePosition(raw, autoQueuePosition.value)
    if (next === Number(autoQueuePosition.value)) return
    applyAutoPositionLocal(next, { remapSlider: true })
    schedulePrioritySave()
  },
)

watch(
  () => autoMaxSliderPercent.value?.[0],
  (raw) => {
    if (syncingAutoControls || !project.value || !isAutoMode.value) return
    const percent = Number(raw) / SLIDER_SCALE
    const { axisMin, axisMax } = priorityAxis.value
    const next = clampPriorityGwei(
      logPercentToPriority(percent, axisMin, axisMax),
      minPriorityGwei.value,
      maxPriorityGwei.value,
    )
    if (next === Number(autoMaxPriorityGwei.value)) return
    applyAutoMaxLocal(next, { syncInput: true, remapSlider: true })
    schedulePrioritySave()
  },
)

function clearPrioritySaveTimer() {
  if (prioritySaveTimer) {
    clearTimeout(prioritySaveTimer)
    prioritySaveTimer = null
  }
}

function schedulePrioritySave() {
  clearPrioritySaveTimer()
  if (!priorityDirty.value) return
  prioritySaveTimer = setTimeout(() => {
    prioritySaveTimer = null
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

function sliderUnitsFromPriority(value) {
  const { axisMin, axisMax } = priorityAxis.value
  return Math.round(
    priorityToLogPercent(value, axisMin, axisMax) * SLIDER_SCALE,
  )
}

function applyPriorityLocal(value, { syncInput = true, remapSlider = true } = {}) {
  const next = clampPriorityGwei(
    value,
    minPriorityGwei.value,
    maxPriorityGwei.value,
  )
  syncingPriority = true
  priorityGwei.value = next
  if (syncInput) {
    priorityInput.value = String(next)
  }
  if (remapSlider) {
    sliderPercent.value = [sliderUnitsFromPriority(next)]
  }
  syncingPriority = false
}

function applyAutoPositionLocal(value, { syncInput = true, remapSlider = true } = {}) {
  const next = normalizeAutoQueuePosition(value, 50)
  syncingAutoControls = true
  autoQueuePosition.value = next
  if (syncInput) {
    autoPositionInput.value = String(next)
  }
  if (remapSlider) {
    autoPositionSlider.value = [next]
  }
  syncingAutoControls = false
}

function applyAutoMaxLocal(value, { syncInput = true, remapSlider = true } = {}) {
  const next = clampPriorityGwei(
    value,
    minPriorityGwei.value,
    maxPriorityGwei.value,
  )
  syncingAutoControls = true
  autoMaxPriorityGwei.value = next
  if (syncInput) {
    autoMaxInput.value = String(next)
  }
  if (remapSlider) {
    autoMaxSliderPercent.value = [sliderUnitsFromPriority(next)]
  }
  syncingAutoControls = false
}

function ensureAutoMaxInitialized() {
  if (
    savedAutoMaxPriorityGwei.value != null &&
    Number(savedAutoMaxPriorityGwei.value) > 0
  ) {
    applyAutoMaxLocal(savedAutoMaxPriorityGwei.value)
    return
  }
  const next = defaultAutoMaxPriorityGwei({
    highestPriorityGwei: highestPriorityGwei.value,
    minPriorityGwei: minPriorityGwei.value,
  })
  applyAutoMaxLocal(next)
}

async function loadBillingConfig() {
  try {
    const data = await llmAPI.getBillingConfig()
    const nextBaseVram = Number(data?.base_vram)
    if (Number.isFinite(nextBaseVram) && nextBaseVram > 0) {
      baseVram.value = nextBaseVram
    }
    const nextCreditsPerGwei = Number(data?.credits_per_gwei)
    if (Number.isFinite(nextCreditsPerGwei) && nextCreditsPerGwei > 0) {
      creditsPerGwei.value = nextCreditsPerGwei
    }
    const nextMin = Number(data?.min_priority_gwei)
    const nextMax = Number(data?.max_priority_gwei)
    if (Number.isFinite(nextMin) && nextMin > 0) {
      minPriorityGwei.value = nextMin
    }
    if (Number.isFinite(nextMax) && nextMax > 0) {
      maxPriorityGwei.value = nextMax
    }
    const nextMedian = Number(data?.median_priority_gwei)
    if (Number.isFinite(nextMedian) && nextMedian > 0) {
      medianPriorityGwei.value = nextMedian
    } else {
      medianPriorityGwei.value = null
    }
    if (data?.highest_priority_gwei != null && data?.lowest_priority_gwei != null) {
      highestPriorityGwei.value = String(data.highest_priority_gwei)
      lowestPriorityGwei.value = String(data.lowest_priority_gwei)
    } else {
      highestPriorityGwei.value = null
      lowestPriorityGwei.value = null
    }
    if (project.value) {
      applyPriorityLocal(priorityGwei.value)
      applyAutoMaxLocal(autoMaxPriorityGwei.value)
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
  const mode =
    String(data.cost_level_mode || 'static') === 'auto' ? 'auto' : 'static'
  costLevelMode.value = mode
  savedCostLevelMode.value = mode

  const raw = Number(data.priority_gwei)
  const fallback =
    Number(medianPriorityGwei.value) > 0
      ? Number(medianPriorityGwei.value)
      : minPriorityGwei.value
  const next = clampPriorityGwei(
    Number.isFinite(raw) && raw > 0 ? raw : fallback,
    minPriorityGwei.value,
    maxPriorityGwei.value,
  )
  savedPriorityGwei.value = next
  applyPriorityLocal(next)

  const position = normalizeAutoQueuePosition(data.auto_queue_position, 50)
  savedAutoQueuePosition.value = position
  applyAutoPositionLocal(position)

  const rawMax = Number(data.auto_max_priority_gwei)
  if (Number.isFinite(rawMax) && rawMax > 0) {
    const maxValue = clampPriorityGwei(
      rawMax,
      minPriorityGwei.value,
      maxPriorityGwei.value,
    )
    savedAutoMaxPriorityGwei.value = maxValue
    applyAutoMaxLocal(maxValue)
  } else {
    savedAutoMaxPriorityGwei.value = null
    ensureAutoMaxInitialized()
  }
}

async function onCopyField(field, value) {
  if (!value) return
  try {
    await copyText(value)
    copiedField.value = field
    if (copiedFieldTimer) clearTimeout(copiedFieldTimer)
    copiedFieldTimer = setTimeout(() => {
      copiedField.value = ''
      copiedFieldTimer = null
    }, 2000)
  } catch (e) {
    console.error('Failed to copy URL', e)
  }
}

function onSelectUrl(event) {
  const el = event?.target
  if (el && typeof el.select === 'function') {
    el.select()
  }
}

function onPriorityInput() {
  const parsed = parsePriorityInput(priorityInput.value)
  if (parsed == null) return
  applyPriorityLocal(parsed, { syncInput: false, remapSlider: true })
  schedulePrioritySave()
}

function onPriorityInputBlur() {
  const parsed = parsePriorityInput(priorityInput.value)
  if (parsed == null) {
    priorityInput.value = String(priorityGwei.value)
    return
  }
  applyPriorityLocal(parsed)
  schedulePrioritySave()
}

function onAutoPositionInput() {
  const parsed = Number(String(autoPositionInput.value).trim())
  if (!Number.isFinite(parsed)) return
  applyAutoPositionLocal(parsed, { syncInput: false, remapSlider: true })
  schedulePrioritySave()
}

function onAutoPositionInputBlur() {
  const parsed = Number(String(autoPositionInput.value).trim())
  if (!Number.isFinite(parsed)) {
    autoPositionInput.value = String(autoQueuePosition.value)
    return
  }
  applyAutoPositionLocal(parsed)
  schedulePrioritySave()
}

function onAutoMaxInput() {
  const parsed = parsePriorityInput(autoMaxInput.value)
  if (parsed == null) return
  applyAutoMaxLocal(parsed, { syncInput: false, remapSlider: true })
  schedulePrioritySave()
}

function onAutoMaxInputBlur() {
  const parsed = parsePriorityInput(autoMaxInput.value)
  if (parsed == null) {
    autoMaxInput.value = String(autoMaxPriorityGwei.value)
    return
  }
  applyAutoMaxLocal(parsed)
  schedulePrioritySave()
}

function onSelectCostLevelMode(mode) {
  if (mode !== 'static' && mode !== 'auto') return
  if (mode === costLevelMode.value) return
  costLevelMode.value = mode
  if (mode === 'auto') {
    ensureAutoMaxInitialized()
    applyAutoPositionLocal(autoQueuePosition.value)
  } else {
    applyPriorityLocal(priorityGwei.value)
  }
  schedulePrioritySave()
}

async function saveCostLevel() {
  if (!project.value || !priorityDirty.value) return
  if (savingPriority.value) {
    schedulePrioritySave()
    return
  }

  const payload = {
    cost_level_mode: costLevelMode.value,
    priority_gwei: String(priorityGwei.value),
    auto_queue_position: Number(autoQueuePosition.value),
    auto_max_priority_gwei: String(autoMaxPriorityGwei.value),
  }
  const modeToSave = costLevelMode.value
  const priorityToSave = priorityGwei.value
  const positionToSave = autoQueuePosition.value
  const maxToSave = autoMaxPriorityGwei.value
  savingPriority.value = true
  try {
    const data = await projectsAPI.update(project.value.id, payload)
    applyProject(data)
    if (
      costLevelMode.value !== modeToSave ||
      Number(priorityGwei.value) !== Number(priorityToSave) ||
      Number(autoQueuePosition.value) !== Number(positionToSave) ||
      Number(autoMaxPriorityGwei.value) !== Number(maxToSave)
    ) {
      schedulePrioritySave()
    }
    showCostLevelToast('success', 'Cost level saved')
  } catch (e) {
    console.error('Failed to update cost setting', e)
    showCostLevelToast(
      'error',
      projectErrorMessage(e, 'Could not save cost level. Please try again later.'),
    )
    if (project.value) {
      applyProject(project.value)
    }
  } finally {
    savingPriority.value = false
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
  clearPrioritySaveTimer()
  if (copiedFieldTimer) {
    clearTimeout(copiedFieldTimer)
    copiedFieldTimer = null
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
              Private project endpoint. Use the Base URL and API key below with
              the APIs listed in this section.
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

        <div
          class="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
        >
          <div class="grid min-w-0 gap-2">
            <Label class="text-muted-foreground">Base URL</Label>
            <div class="flex min-w-0 items-center gap-2">
              <Input
                :model-value="llmBaseUrl"
                readonly
                class="min-w-0 flex-1 truncate bg-background font-mono text-xs"
                @focus="onSelectUrl"
                @click="onSelectUrl"
              />
              <Button
                variant="outline"
                size="icon"
                class="shrink-0 bg-background"
                :aria-label="
                  copiedField === 'base' ? 'Copied' : 'Copy base URL'
                "
                @click="onCopyField('base', llmBaseUrl)"
              >
                <Check v-if="copiedField === 'base'" class="size-4" />
                <Copy v-else class="size-4" />
              </Button>
            </div>
          </div>

          <div
            class="border-t border-border pt-5 sm:border-l-2 sm:border-t-0 sm:pl-6 sm:pt-0"
          >
            <Button
              variant="outline"
              size="sm"
              class="h-8 bg-background"
              @click="resetOpen = true"
            >
              Reset API Key
            </Button>
          </div>
        </div>

        <div class="mt-6 border-t border-border pt-5">
          <button
            type="button"
            class="flex w-full items-center justify-between gap-3 text-left"
            :aria-expanded="apiEndpointsOpen"
            :aria-label="
              apiEndpointsOpen ? 'Hide API endpoints' : 'Show API endpoints'
            "
            @click="apiEndpointsOpen = !apiEndpointsOpen"
          >
            <div class="min-w-0">
              <h2 class="text-sm font-semibold tracking-tight text-foreground">
                API endpoints
              </h2>
              <p class="mt-1 text-sm text-muted-foreground">
                Full endpoint URLs for the APIs available on this project.
              </p>
            </div>
            <ChevronDown
              class="size-5 shrink-0 text-muted-foreground transition-transform"
              :class="apiEndpointsOpen ? 'rotate-180' : 'rotate-0'"
            />
          </button>

          <div v-if="apiEndpointsOpen" class="mt-6">
            <Tabs v-model="apiGuideTab" class="flex w-full flex-col gap-4">
              <TabsList variant="line">
                <TabsTrigger
                  v-for="item in apiGuideItems"
                  :key="item.id"
                  :value="item.id"
                  class="flex-none px-3"
                >
                  {{ item.label }}
                </TabsTrigger>
              </TabsList>

              <TabsContent
                v-for="item in apiGuideItems"
                :key="item.id"
                :value="item.id"
                class="mt-0"
              >
                <div class="rounded-lg border border-border bg-background p-4">
                  <div class="grid gap-2">
                    <Label class="text-muted-foreground">Endpoint URL</Label>
                    <div class="flex min-w-0 items-center gap-2">
                      <Input
                        :model-value="item.url"
                        readonly
                        class="min-w-0 flex-1 truncate font-mono text-xs"
                        @focus="onSelectUrl"
                        @click="onSelectUrl"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        class="shrink-0"
                        :aria-label="
                          copiedField === item.id
                            ? 'Copied'
                            : `Copy ${item.label} URL`
                        "
                        @click="onCopyField(item.id, item.url)"
                      >
                        <Check v-if="copiedField === item.id" class="size-4" />
                        <Copy v-else class="size-4" />
                      </Button>
                    </div>
                  </div>

                  <p class="mt-4 text-sm leading-relaxed text-muted-foreground">
                    {{ item.description }}
                  </p>

                  <a
                    v-if="item.docsUrl"
                    :href="item.docsUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    View documentation
                    <ExternalLink class="size-3.5" />
                  </a>
                  <p
                    v-else
                    class="mt-4 text-sm text-muted-foreground"
                  >
                    Documentation will be available soon.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
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
            class="flex min-w-0 items-center gap-2.5"
          >
            <span
              class="inline-flex shrink-0 items-center rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-foreground"
            >
              {{ isAutoMode ? 'Auto' : 'Static' }}
            </span>
            <span
              class="truncate font-mono text-2xl font-semibold tabular-nums text-primary"
            >
              <template v-if="isAutoMode">
                {{ autoQueuePosition }}% · {{ formatGwei(autoMaxPriorityGwei) }}
              </template>
              <template v-else>
                {{ formatGwei(priorityGwei) }}
              </template>
            </span>
          </span>
        </button>

        <div v-if="costLevelOpen" class="border-t border-border px-5 pb-5 pt-4">
          <div class="mb-10 space-y-3 text-sm text-muted-foreground">
            <p>
              Cost Level controls how many Credits each request spends and how
              long tasks wait in the queue.
            </p>
            <p v-if="!isAutoMode">
              Lower cost levels spend fewer Credits but jobs may wait longer in
              the network queue. Higher cost levels spend more Credits and sit
              higher in the queue. The bar under the slider shows the current
              queue range.
            </p>
          </div>

          <div class="mb-20 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              class="rounded-xl border px-4 py-3 text-left transition-colors"
              :class="
                isAutoMode
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-accent/40'
              "
              @click="onSelectCostLevelMode('auto')"
            >
              <p class="text-sm font-semibold text-foreground">Auto</p>
              <p class="mt-1 text-xs leading-relaxed text-muted-foreground">
                The system adjusts Cost Level to your chosen queue position.
                Credits for the same task can change, but they never exceed your
                set maximum.
              </p>
            </button>
            <button
              type="button"
              class="rounded-xl border px-4 py-3 text-left transition-colors"
              :class="
                !isAutoMode
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-accent/40'
              "
              @click="onSelectCostLevelMode('static')"
            >
              <p class="text-sm font-semibold text-foreground">Static</p>
              <p class="mt-1 text-xs leading-relaxed text-muted-foreground">
                Use a fixed Cost Level. The same task always spends the same
                Credits, but tasks may wait too long in the queue.
              </p>
            </button>
          </div>

          <div
            v-if="!isAutoMode"
            class="mb-20 flex items-center gap-x-3"
          >
            <div
              class="flex h-20 w-36 shrink-0 items-center justify-center rounded-lg border border-input bg-background focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-3"
            >
              <Input
                v-model="priorityInput"
                inputmode="numeric"
                autocomplete="off"
                aria-label="Cost level"
                class="h-auto w-full border-0 bg-transparent py-0 text-center font-mono text-2xl font-semibold leading-none text-primary tabular-nums shadow-none focus-visible:border-transparent focus-visible:ring-0 md:text-2xl"
                @input="onPriorityInput"
                @blur="onPriorityInputBlur"
              />
            </div>
            <div class="flex min-w-0 flex-1 justify-center">
              <div
                class="grid w-[80%] min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 gap-y-1.5"
              >
              <span
                class="flex h-8 items-center text-xs text-muted-foreground"
              >
                Cheaper
              </span>
              <div class="flex h-8 items-center">
                <Slider
                  v-model="sliderPercent"
                  :min="0"
                  :max="SLIDER_MAX"
                  :step="1"
                  class="w-full"
                />
              </div>
              <span
                class="flex h-8 items-center text-xs text-muted-foreground"
              >
                Faster
              </span>
              <div
                v-if="showQueueRangeBar"
                class="relative col-start-2 w-full"
                aria-hidden="true"
              >
                <div class="relative h-4">
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
                    class="absolute top-0 h-4 w-0 -translate-x-1/2"
                    :style="{ left: `${queueRangeBar.minPercent}%` }"
                  >
                    <div class="mx-auto h-4 w-0.5 bg-foreground/80" />
                  </div>
                  <div
                    class="absolute top-0 h-4 w-0 -translate-x-1/2"
                    :style="{ left: `${queueRangeBar.maxPercent}%` }"
                  >
                    <div class="mx-auto h-4 w-0.5 bg-foreground/80" />
                  </div>
                </div>
                <div class="relative mt-0.5 h-2.5">
                  <span
                    class="absolute top-0 -translate-x-1/2 whitespace-nowrap text-[10px] leading-none text-muted-foreground"
                    :style="{ left: `${queueRangeBar.minPercent}%` }"
                  >
                    Current queue min
                  </span>
                  <span
                    class="absolute top-0 -translate-x-1/2 whitespace-nowrap text-[10px] leading-none text-muted-foreground"
                    :style="{ left: `${queueRangeBar.maxPercent}%` }"
                  >
                    Current queue max
                  </span>
                </div>
              </div>
              </div>
            </div>
          </div>

          <div v-else class="mb-20 space-y-10">
            <div class="rounded-xl border border-border bg-muted/20 p-4 sm:p-5">
              <div class="mb-4">
                <p class="text-sm font-semibold text-foreground">
                  Queue position
                </p>
                <p class="mt-1 text-xs text-muted-foreground">
                  When each task is sent, the system reads the current queue min
                  and max Cost Level, then sets this request's Cost Level from
                  the position configured here.
                </p>
              </div>
              <div class="flex items-center gap-x-3">
                <div
                  class="flex h-20 w-36 shrink-0 items-center justify-center rounded-lg border border-input bg-background focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-3"
                >
                  <Input
                    v-model="autoPositionInput"
                    inputmode="numeric"
                    autocomplete="off"
                    aria-label="Queue position percent"
                    class="h-auto w-full border-0 bg-transparent py-0 text-center font-mono text-2xl font-semibold leading-none text-primary tabular-nums shadow-none focus-visible:border-transparent focus-visible:ring-0 md:text-2xl"
                    @input="onAutoPositionInput"
                    @blur="onAutoPositionInputBlur"
                  />
                </div>
                <div class="flex min-w-0 flex-1 justify-center">
                  <div class="flex w-[80%] min-w-0 flex-col gap-y-1.5">
                    <div
                      class="flex h-8 items-center"
                      :style="{
                        paddingLeft: `${AUTO_QUEUE_POSITION_BAR_MARGIN}%`,
                        paddingRight: `${AUTO_QUEUE_POSITION_BAR_MARGIN}%`,
                      }"
                    >
                      <Slider
                        v-model="autoPositionSlider"
                        :min="AUTO_QUEUE_POSITION_MIN"
                        :max="AUTO_QUEUE_POSITION_MAX"
                        :step="1"
                        class="w-full"
                      />
                    </div>
                    <div class="relative w-full" aria-hidden="true">
                      <div class="relative h-4">
                        <div
                          class="absolute inset-x-0 top-1.5 h-1.5 overflow-hidden rounded-full bg-red-500"
                        >
                          <div
                            class="absolute inset-y-0 bg-blue-500"
                            :style="{
                              left: `${AUTO_QUEUE_POSITION_BAR_MARGIN}%`,
                              width: `${100 - AUTO_QUEUE_POSITION_BAR_MARGIN * 2}%`,
                            }"
                          />
                        </div>
                        <div
                          class="absolute top-0 h-4 w-0 -translate-x-1/2"
                          :style="{ left: `${AUTO_QUEUE_POSITION_BAR_MARGIN}%` }"
                        >
                          <div class="mx-auto h-4 w-0.5 bg-foreground/80" />
                        </div>
                        <div
                          class="absolute top-0 h-4 w-0 -translate-x-1/2"
                          :style="{
                            left: `${100 - AUTO_QUEUE_POSITION_BAR_MARGIN}%`,
                          }"
                        >
                          <div class="mx-auto h-4 w-0.5 bg-foreground/80" />
                        </div>
                      </div>
                      <div class="relative mt-0.5 h-2.5">
                        <span
                          class="absolute top-0 -translate-x-1/2 whitespace-nowrap text-[10px] leading-none text-muted-foreground"
                          :style="{ left: `${AUTO_QUEUE_POSITION_BAR_MARGIN}%` }"
                        >
                          Queue min
                        </span>
                        <span
                          class="absolute top-0 -translate-x-1/2 whitespace-nowrap text-[10px] leading-none text-muted-foreground"
                          :style="{
                            left: `${100 - AUTO_QUEUE_POSITION_BAR_MARGIN}%`,
                          }"
                        >
                          Queue max
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="rounded-xl border border-border bg-muted/20 p-4 sm:p-5">
              <div class="mb-4">
                <p class="text-sm font-semibold text-foreground">
                  Max Cost Level
                </p>
                <p class="mt-1 text-xs text-muted-foreground">
                  Upper cap for Auto. Credits for each request never exceed this
                  Cost Level.
                </p>
              </div>
              <div class="flex items-center gap-x-3">
                <div
                  class="flex h-20 w-36 shrink-0 items-center justify-center rounded-lg border border-input bg-background focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-3"
                >
                  <Input
                    v-model="autoMaxInput"
                    inputmode="numeric"
                    autocomplete="off"
                    aria-label="Max cost level"
                    class="h-auto w-full border-0 bg-transparent py-0 text-center font-mono text-2xl font-semibold leading-none text-primary tabular-nums shadow-none focus-visible:border-transparent focus-visible:ring-0 md:text-2xl"
                    @input="onAutoMaxInput"
                    @blur="onAutoMaxInputBlur"
                  />
                </div>
                <div class="flex min-w-0 flex-1 justify-center">
                  <div
                    class="grid w-[80%] min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 gap-y-1.5"
                  >
                    <span
                      class="flex h-8 items-center text-xs text-muted-foreground"
                    >
                      Cheaper
                    </span>
                    <div class="flex h-8 items-center">
                      <Slider
                        v-model="autoMaxSliderPercent"
                        :min="0"
                        :max="SLIDER_MAX"
                        :step="1"
                        class="w-full"
                      />
                    </div>
                    <span
                      class="flex h-8 items-center text-xs text-muted-foreground"
                    >
                      Faster
                    </span>
                    <div
                      v-if="showQueueRangeBar"
                      class="relative col-start-2 w-full"
                      aria-hidden="true"
                    >
                      <div class="relative h-4">
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
                          class="absolute top-0 h-4 w-0 -translate-x-1/2"
                          :style="{ left: `${queueRangeBar.minPercent}%` }"
                        >
                          <div class="mx-auto h-4 w-0.5 bg-foreground/80" />
                        </div>
                        <div
                          class="absolute top-0 h-4 w-0 -translate-x-1/2"
                          :style="{ left: `${queueRangeBar.maxPercent}%` }"
                        >
                          <div class="mx-auto h-4 w-0.5 bg-foreground/80" />
                        </div>
                      </div>
                      <div class="relative mt-0.5 h-2.5">
                        <span
                          class="absolute top-0 -translate-x-1/2 whitespace-nowrap text-[10px] leading-none text-muted-foreground"
                          :style="{ left: `${queueRangeBar.minPercent}%` }"
                        >
                          Current queue min
                        </span>
                        <span
                          class="absolute top-0 -translate-x-1/2 whitespace-nowrap text-[10px] leading-none text-muted-foreground"
                          :style="{ left: `${queueRangeBar.maxPercent}%` }"
                        >
                          Current queue max
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="grid gap-4 lg:grid-cols-2">
            <div class="overflow-hidden rounded-xl border border-border bg-muted/30">
              <div class="border-b border-border px-4 py-3">
                <p class="text-sm font-medium text-foreground">
                  {{ creditsTableTitle }}
                </p>
                <p class="mt-0.5 text-xs text-muted-foreground">
                  <template v-if="isAutoMode">
                    Estimated at the configured max Cost Level. Actual charges
                    may be lower when the live queue position resolves below the
                    max.
                  </template>
                  <template v-else>
                    Estimates only. Actual charges may differ.
                  </template>
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

      <ProjectUsageSection
        v-if="project?.id"
        :project-id="project.id"
      />
      <ProjectRecentRequestsSection
        v-if="project?.id"
        :project-id="project.id"
      />
    </template>

    <RenameProjectDialog
      v-model:open="renameOpen"
      :project-id="project?.id"
      :project-name="project?.name"
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
