<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
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
import CostLevelRangeBar from '@/components/projects/CostLevelRangeBar.vue'
import PricingExampleModelCell from '@/components/projects/PricingExampleModelCell.vue'
import ProjectPlaygroundSection from '@/components/projects/ProjectPlaygroundSection.vue'
import ProjectUsageSection from '@/components/stats/ProjectUsageSection.vue'
import ProjectRecentRequestsSection from '@/components/stats/ProjectRecentRequestsSection.vue'
import ApiError from '@/api/api-error'
import { llmAPI } from '@/api/v1/llm'
import { projectsAPI } from '@/api/v1/projects'
import {
  PROJECT_API_DOCS,
  projectChatCompletionsUrl,
  projectImageModelsUrl,
  projectImagesEditsUrl,
  projectImagesGenerationsUrl,
  projectLlmBaseUrl,
  projectModelsUrl,
  projectRawTaskAbortUrl,
  projectRawTaskBatchAbortUrl,
  projectRawTaskBatchCreateUrl,
  projectRawTaskBatchStatusUrl,
  projectRawTaskCreateUrl,
  projectRawTaskImageResultUrl,
  projectRawTaskLlmResultUrl,
  projectRawTaskStatusUrl,
  projectResponsesUrl,
} from '@/lib/project-url'
import {
  buildExampleRows,
  buildImageExampleRows,
  clampCredits,
  clampPriorityGwei,
  computeCreditsAxis,
  computePriorityAxis,
  defaultAutoMaxCreditsPerTask,
  formatCredits,
  formatExampleCredits,
  formatGwei,
  formatSeconds,
  formatTokenCount,
  isProviderAvailableForCostLevel,
  logPercentToPriority,
  mapQueueRangeBar,
  providerMaxCreditsCoverage,
  normalizeAutoQueuePosition,
  AUTO_QUEUE_POSITION_MIN,
  AUTO_QUEUE_POSITION_MAX,
  AUTO_QUEUE_POSITION_BAR_MARGIN,
  parseCreditsInput,
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
const autoMaxCreditsPerTask = ref(100)
const savedAutoMaxCreditsPerTask = ref(null)
const autoMaxCreditsInput = ref('100')
const autoMaxCreditsSlider = ref([0])
const defaultAutoMaxCredits = ref(100)
const CREDITS_HARD_MAX = 10_000
const minPriorityGwei = ref(1)
const maxPriorityGwei = ref(1_000_000_000)
const medianPriorityGwei = ref(null)
const baseVram = ref(8)
const creditsPerGwei = ref(1)
const highestPriorityGwei = ref(null)
const lowestPriorityGwei = ref(null)
const providerMinPriorityGwei = ref(null)
const providerMinCreditsCheapest = ref(null)
const providerMinCreditsExpensive = ref(null)
const providerMinReferenceInputTokens = ref(10)
const providerMinReferenceOutputTokens = ref(50)
const providerHighestPriorityGwei = ref(null)
const providerLowestPriorityGwei = ref(null)
const providerQueueHasJobs = ref(false)
const pricingExamples = ref([])
const pricingPromptTokens = ref(1_000_000)
const pricingCompletionTokens = ref(1_000_000)
const timePromptTokens = ref(512)
const timeCompletionTokens = ref(2048)
const costLevelExampleTab = ref('chat')
const imagePricingExamples = ref([])
const imageExampleWidth = ref(512)
const imageExampleHeight = ref(512)
const imageExampleSteps = ref(20)
const imageExampleNumImages = ref(1)
const copiedFields = ref(new Set())
const copiedFieldTimers = new Map()
let prioritySaveTimer = null
let syncingPriority = false
let syncingAutoControls = false
let suppressCostLevelAutosave = false
const COST_LEVEL_TOAST_ID = 'cost-level-save'
const COST_LEVEL_SAVE_DELAY_MS = 3000

async function beginCostLevelHydration() {
  suppressCostLevelAutosave = true
  clearPrioritySaveTimer()
}

async function endCostLevelHydration() {
  await nextTick()
  await nextTick()
  suppressCostLevelAutosave = false
}
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
      label: 'OpenAI Chat Completions',
      endpoints: [
        {
          id: 'chat_completions',
          method: 'POST',
          url: token ? projectChatCompletionsUrl(token) : '',
          purpose: 'Create a chat completion.',
        },
      ],
      docsUrl: PROJECT_API_DOCS.chat_completions,
      description:
        'OpenAI Chat Completions API. POST to this endpoint with the project API key, or derive the OpenAI client base URL from the project panel above.',
    },
    {
      id: 'responses',
      label: 'OpenAI Responses',
      endpoints: [
        {
          id: 'responses',
          method: 'POST',
          url: token ? projectResponsesUrl(token) : '',
          purpose: 'Create an OpenAI-compatible response.',
        },
      ],
      docsUrl: PROJECT_API_DOCS.responses,
      description:
        'OpenAI Responses API. Use it when you need background execution or response polling instead of a single chat completion call.',
    },
    {
      id: 'images',
      label: 'OpenAI Images',
      endpoints: [
        {
          id: 'images_generations',
          method: 'POST',
          url: token ? projectImagesGenerationsUrl(token) : '',
          purpose: 'Image generation: create images from a text prompt.',
        },
        {
          id: 'images_edits',
          method: 'POST',
          url: token ? projectImagesEditsUrl(token) : '',
          purpose: 'Image edit: create images from input images and a text prompt.',
        },
      ],
      docsUrl: PROJECT_API_DOCS.images,
      description:
        'OpenAI Images generations and edits APIs. POST to these endpoints with the project API key. Only b64_json PNG responses are supported.',
    },
    {
      id: 'raw_task',
      label: 'Raw Task',
      endpoints: [
        {
          id: 'raw_task_create',
          method: 'POST',
          url: token ? projectRawTaskCreateUrl(token) : '',
          purpose: 'Create one LLM or Image task.',
        },
        {
          id: 'raw_task_status',
          method: 'GET',
          url: token ? projectRawTaskStatusUrl(token) : '',
          purpose: 'Get one task status.',
        },
        {
          id: 'raw_task_abort',
          method: 'POST',
          url: token ? projectRawTaskAbortUrl(token) : '',
          purpose: 'Abort one queued task that has not started execution.',
        },
        {
          id: 'raw_task_llm_result',
          method: 'GET',
          url: token ? projectRawTaskLlmResultUrl(token) : '',
          purpose: 'Download the JSON result of a successful LLM task.',
        },
        {
          id: 'raw_task_image_result',
          method: 'GET',
          url: token ? projectRawTaskImageResultUrl(token) : '',
          purpose: 'Download one PNG result of a successful Image task.',
        },
        {
          id: 'raw_task_batch_create',
          method: 'POST',
          url: token ? projectRawTaskBatchCreateUrl(token) : '',
          purpose: 'Create up to 100 tasks in request order.',
        },
        {
          id: 'raw_task_batch_status',
          method: 'POST',
          url: token ? projectRawTaskBatchStatusUrl(token) : '',
          purpose: 'Get task statuses in request order.',
        },
        {
          id: 'raw_task_batch_abort',
          method: 'POST',
          url: token ? projectRawTaskBatchAbortUrl(token) : '',
          purpose: 'Abort up to 100 queued tasks in request order.',
        },
      ],
      docsUrl: PROJECT_API_DOCS.raw_task,
      description:
        'Submit canonical task arguments directly for LLM and Image execution without the OpenAI request format.',
    },
    {
      id: 'models',
      label: 'Models',
      endpoints: [
        {
          id: 'llm_models',
          method: 'GET',
          url: token ? projectModelsUrl(token) : '',
          purpose: 'List currently loaded LLM models.',
          note: 'OpenAI-compatible endpoint.',
        },
        {
          id: 'image_models',
          method: 'GET',
          url: token ? projectImageModelsUrl(token) : '',
          purpose: 'List currently loaded Image models.',
        },
      ],
      docsUrl: PROJECT_API_DOCS.models,
      description:
        'The LLM and Image catalogs are separate. Each endpoint returns only its corresponding model type.',
    },
  ]
})

const priorityAxis = computed(() =>
  computePriorityAxis({
    userPriorityGwei: priorityGwei.value,
    lowestPriorityGwei: lowestPriorityGwei.value,
    highestPriorityGwei: highestPriorityGwei.value,
    providerLowestPriorityGwei: providerLowestPriorityGwei.value,
    providerHighestPriorityGwei: providerHighestPriorityGwei.value,
    providerMinPriorityGwei: providerMinPriorityGwei.value,
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
    savedAutoMaxCreditsPerTask.value == null
      ? null
      : Number(savedAutoMaxCreditsPerTask.value)
  if (savedMax == null) {
    return true
  }
  return Number(autoMaxCreditsPerTask.value) !== savedMax
})

const examplePriorityGwei = computed(() => {
  if (!isAutoMode.value) return priorityGwei.value
  const high = Number(highestPriorityGwei.value)
  if (high > 0) return Math.round(high)
  const median = Number(medianPriorityGwei.value)
  if (median > 0) return Math.round(median)
  return minPriorityGwei.value
})

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

const creditsTableTitle = computed(() => 'Credits per 1M tokens')

const imagePricingRows = computed(() =>
  buildImageExampleRows({
    examples: imagePricingExamples.value,
    priorityGwei: examplePriorityGwei.value,
    baseVram: baseVram.value,
    creditsPerGwei: creditsPerGwei.value,
    exampleWidth: imageExampleWidth.value,
    exampleHeight: imageExampleHeight.value,
    exampleSteps: imageExampleSteps.value,
    exampleNumImages: imageExampleNumImages.value,
  }),
)

const imageCreditsTableTitle = computed(() => 'Credits per image')

const imageExampleSizeLabel = computed(
  () => `${imageExampleWidth.value}×${imageExampleHeight.value}`,
)

const imageExampleWorkloadNote = computed(() => {
  const n = Number(imageExampleNumImages.value)
  const unit = n === 1 ? 'image' : 'images'
  return `${n} ${unit}`
})

const crynuxQueueRangeBar = computed(() =>
  mapQueueRangeBar({
    lowestPriorityGwei: lowestPriorityGwei.value,
    highestPriorityGwei: highestPriorityGwei.value,
    axisMin: priorityAxis.value.axisMin,
    axisMax: priorityAxis.value.axisMax,
  }),
)

const providerQueueRangeBar = computed(() => {
  if (!providerQueueHasJobs.value) return null
  return mapQueueRangeBar({
    lowestPriorityGwei: providerLowestPriorityGwei.value,
    highestPriorityGwei: providerHighestPriorityGwei.value,
    axisMin: priorityAxis.value.axisMin,
    axisMax: priorityAxis.value.axisMax,
  })
})

const creditsAxis = computed(() =>
  computeCreditsAxis({
    userCredits: autoMaxCreditsPerTask.value,
    providerMinCreditsCheapest: providerMinCreditsCheapest.value,
    providerMinCreditsExpensive: providerMinCreditsExpensive.value,
    hardMin: 1,
    hardMax: CREDITS_HARD_MAX,
  }),
)

const providerMinCreditsMarkers = computed(() => {
  const { axisMin, axisMax } = creditsAxis.value
  const markers = []
  const cheapest = Number(providerMinCreditsCheapest.value)
  const expensive = Number(providerMinCreditsExpensive.value)
  if (cheapest > 0) {
    markers.push({
      percent: priorityToLogPercent(cheapest, axisMin, axisMax),
      label: 'Provider min - cheapest',
      title: `Cheapest Provider models need about ${formatCredits(cheapest)} Credits for the reference ${providerMinReferenceLabel.value} workload`,
    })
  }
  if (expensive > 0 && expensive !== cheapest) {
    markers.push({
      percent: priorityToLogPercent(expensive, axisMin, axisMax),
      label: 'Provider min - expensive',
      title: `Most expensive Provider models need about ${formatCredits(expensive)} Credits for the reference ${providerMinReferenceLabel.value} workload`,
    })
  }
  return markers
})

const providerMinReferenceLabel = computed(
  () =>
    `${formatTokenCount(providerMinReferenceInputTokens.value)} input / ${formatTokenCount(providerMinReferenceOutputTokens.value)} output`,
)

const providerMinCostLevelMarkers = computed(() => {
  const min = Number(providerMinPriorityGwei.value)
  if (!(min > 0)) return []
  const { axisMin, axisMax } = priorityAxis.value
  const cheapest = formatCredits(providerMinCreditsCheapest.value || 0)
  const expensive = formatCredits(providerMinCreditsExpensive.value || 0)
  return [
    {
      percent: priorityToLogPercent(min, axisMin, axisMax),
      label: 'Provider min',
      title: `Shared Provider min Cost Level ${formatGwei(min)} for ${providerMinReferenceLabel.value}. At this Cost Level that workload needs about ${cheapest} Credits for the cheapest models and ${expensive} Credits for the most expensive models.`,
    },
  ]
})

const staticProviderAvailable = computed(() =>
  isProviderAvailableForCostLevel({
    mode: 'static',
    priorityGwei: priorityGwei.value,
    autoMaxCreditsPerTask: autoMaxCreditsPerTask.value,
    providerMinPriorityGwei: providerMinPriorityGwei.value,
    providerMinCreditsExpensive: providerMinCreditsExpensive.value,
  }),
)

const maxCreditsCoverage = computed(() =>
  providerMaxCreditsCoverage({
    autoMaxCreditsPerTask: autoMaxCreditsPerTask.value,
    providerMinCreditsCheapest: providerMinCreditsCheapest.value,
    providerMinCreditsExpensive: providerMinCreditsExpensive.value,
  }),
)

const staticProviderAvailabilityHint = computed(() => {
  const cheapest = formatCredits(providerMinCreditsCheapest.value || 0)
  const expensive = formatCredits(providerMinCreditsExpensive.value || 0)
  if (staticProviderAvailable.value) {
    return `Provider models such as OpenAI, Google, and Anthropic are available at this Cost Level for the reference ${providerMinReferenceLabel.value} workload. At this Cost Level that workload needs about ${cheapest} Credits for the cheapest models and ${expensive} Credits for the most expensive models. Larger real requests stay available at this Cost Level and cost more.`
  }
  return `Open source models are available. Requests to Provider models such as OpenAI, Google, and Anthropic will be rejected for the reference ${providerMinReferenceLabel.value} workload. Raise Cost Level to Provider min or higher. At Provider min that workload needs about ${cheapest} Credits for the cheapest models and ${expensive} Credits for the most expensive models.`
})

const maxCreditsProviderAvailabilityHint = computed(() => {
  const cheapest = formatCredits(providerMinCreditsCheapest.value || 0)
  const expensive = formatCredits(providerMinCreditsExpensive.value || 0)
  if (maxCreditsCoverage.value === 'all') {
    return `All Provider models such as OpenAI, Google, and Anthropic are available at this Max Credits for the reference ${providerMinReferenceLabel.value} workload. That workload needs about ${cheapest} Credits for the cheapest models and ${expensive} Credits for the most expensive models. Larger real requests cost more and may still be rejected if they exceed Max Credits.`
  }
  if (maxCreditsCoverage.value === 'cheapest') {
    return `Cheapest Provider models are available at this Max Credits for the reference ${providerMinReferenceLabel.value} workload (about ${cheapest} Credits). More expensive Provider models still need about ${expensive} Credits for that reference workload. Raise Max Credits to Provider min - expensive or higher to cover them.`
  }
  return `Open source models are available. Requests to Provider models such as OpenAI, Google, and Anthropic will be rejected for the reference ${providerMinReferenceLabel.value} workload. Raise Max Credits to Provider min - cheapest (${cheapest} Credits) or higher; Provider min - expensive is about ${expensive} Credits.`
})

const staticProviderAvailabilityClass = computed(() =>
  staticProviderAvailable.value
    ? 'text-emerald-700 dark:text-emerald-400'
    : 'text-amber-700 dark:text-amber-400',
)

const maxCreditsProviderAvailabilityClass = computed(() => {
  if (maxCreditsCoverage.value === 'all') {
    return 'text-emerald-700 dark:text-emerald-400'
  }
  if (maxCreditsCoverage.value === 'cheapest') {
    return 'text-amber-700 dark:text-amber-400'
  }
  return 'text-amber-700 dark:text-amber-400'
})

watch(projectId, async () => {
  clearPrioritySaveTimer()
  await beginCostLevelHydration()
  try {
    await loadProject()
  } finally {
    await endCostLevelHydration()
  }
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
  () => autoMaxCreditsSlider.value?.[0],
  (raw) => {
    if (syncingAutoControls || !project.value) return
    const percent = Number(raw) / SLIDER_SCALE
    const { axisMin, axisMax } = creditsAxis.value
    const next = clampCredits(
      logPercentToPriority(percent, axisMin, axisMax),
      defaultAutoMaxCredits.value,
    )
    if (next === Number(autoMaxCreditsPerTask.value)) return
    applyAutoMaxCreditsLocal(next, { syncInput: true, remapSlider: true })
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
  if (suppressCostLevelAutosave) return
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

function sliderUnitsFromCredits(value) {
  const { axisMin, axisMax } = creditsAxis.value
  return Math.round(
    priorityToLogPercent(value, axisMin, axisMax) * SLIDER_SCALE,
  )
}

function applyAutoMaxCreditsLocal(
  value,
  { syncInput = true, remapSlider = true } = {},
) {
  const next = Math.min(
    CREDITS_HARD_MAX,
    clampCredits(value, defaultAutoMaxCredits.value),
  )
  syncingAutoControls = true
  autoMaxCreditsPerTask.value = next
  if (syncInput) {
    autoMaxCreditsInput.value = String(next)
  }
  if (remapSlider) {
    autoMaxCreditsSlider.value = [sliderUnitsFromCredits(next)]
  }
  syncingAutoControls = false
}

function ensureAutoMaxCreditsInitialized() {
  if (
    savedAutoMaxCreditsPerTask.value != null &&
    Number(savedAutoMaxCreditsPerTask.value) > 0
  ) {
    applyAutoMaxCreditsLocal(savedAutoMaxCreditsPerTask.value)
    return
  }
  applyAutoMaxCreditsLocal(
    defaultAutoMaxCreditsPerTask(defaultAutoMaxCredits.value),
  )
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
    const nextDefaultAutoMax = Number(data?.default_auto_max_credits_per_task)
    if (Number.isFinite(nextDefaultAutoMax) && nextDefaultAutoMax > 0) {
      defaultAutoMaxCredits.value = Math.trunc(nextDefaultAutoMax)
    }
    const nextProviderMinPriority = Number(data?.provider_min_priority_gwei)
    providerMinPriorityGwei.value =
      Number.isFinite(nextProviderMinPriority) && nextProviderMinPriority > 0
        ? String(data.provider_min_priority_gwei)
        : null
    const nextCheapestCredits = Number(data?.provider_min_credits_cheapest)
    providerMinCreditsCheapest.value =
      Number.isFinite(nextCheapestCredits) && nextCheapestCredits > 0
        ? String(data.provider_min_credits_cheapest)
        : null
    const nextExpensiveCredits = Number(data?.provider_min_credits_expensive)
    providerMinCreditsExpensive.value =
      Number.isFinite(nextExpensiveCredits) && nextExpensiveCredits > 0
        ? String(data.provider_min_credits_expensive)
        : null
    const nextReferenceInput = Number(data?.provider_min_reference_input_tokens)
    providerMinReferenceInputTokens.value =
      Number.isFinite(nextReferenceInput) && nextReferenceInput > 0
        ? Math.trunc(nextReferenceInput)
        : 10
    const nextReferenceOutput = Number(data?.provider_min_reference_output_tokens)
    providerMinReferenceOutputTokens.value =
      Number.isFinite(nextReferenceOutput) && nextReferenceOutput > 0
        ? Math.trunc(nextReferenceOutput)
        : 50
    providerQueueHasJobs.value = Boolean(data?.provider_queue_has_jobs)
    if (
      providerQueueHasJobs.value &&
      data?.provider_highest_priority_gwei != null &&
      data?.provider_lowest_priority_gwei != null
    ) {
      providerHighestPriorityGwei.value = String(data.provider_highest_priority_gwei)
      providerLowestPriorityGwei.value = String(data.provider_lowest_priority_gwei)
    } else {
      providerHighestPriorityGwei.value = null
      providerLowestPriorityGwei.value = null
      providerQueueHasJobs.value = false
    }
    if (project.value) {
      const alreadySuppressed = suppressCostLevelAutosave
      if (!alreadySuppressed) {
        await beginCostLevelHydration()
      }
      try {
        applyPriorityLocal(priorityGwei.value)
        applyAutoMaxCreditsLocal(autoMaxCreditsPerTask.value)
      } finally {
        if (!alreadySuppressed) {
          await endCostLevelHydration()
        }
      }
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

async function loadImagePricingExamples() {
  try {
    const data = await llmAPI.getImagePricingExamples()
    imagePricingExamples.value = Array.isArray(data?.examples)
      ? data.examples
      : []
    const nextWidth = Number(data?.example_width)
    const nextHeight = Number(data?.example_height)
    const nextSteps = Number(data?.example_steps)
    const nextNumImages = Number(data?.example_num_images)
    if (Number.isFinite(nextWidth) && nextWidth > 0) {
      imageExampleWidth.value = nextWidth
    }
    if (Number.isFinite(nextHeight) && nextHeight > 0) {
      imageExampleHeight.value = nextHeight
    }
    if (Number.isFinite(nextSteps) && nextSteps > 0) {
      imageExampleSteps.value = nextSteps
    }
    if (Number.isFinite(nextNumImages) && nextNumImages > 0) {
      imageExampleNumImages.value = nextNumImages
    }
  } catch (e) {
    console.error('Failed to load Image pricing examples', e)
    imagePricingExamples.value = []
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

  const rawMax = Number(data.auto_max_credits_per_task)
  if (Number.isFinite(rawMax) && rawMax > 0) {
    const maxValue = clampCredits(rawMax, defaultAutoMaxCredits.value)
    savedAutoMaxCreditsPerTask.value = maxValue
    applyAutoMaxCreditsLocal(maxValue)
  } else {
    savedAutoMaxCreditsPerTask.value = null
    ensureAutoMaxCreditsInitialized()
  }
}

async function onCopyField(field, value) {
  if (!value) return
  try {
    await copyText(value)
    copiedFields.value.add(field)
    const currentTimer = copiedFieldTimers.get(field)
    if (currentTimer) clearTimeout(currentTimer)
    const timer = setTimeout(() => {
      copiedFields.value.delete(field)
      copiedFieldTimers.delete(field)
    }, 2000)
    copiedFieldTimers.set(field, timer)
  } catch (e) {
    console.error('Failed to copy URL', e)
  }
}

function isCopied(field) {
  return copiedFields.value.has(field)
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

function onAutoMaxCreditsInput() {
  const parsed = parseCreditsInput(autoMaxCreditsInput.value)
  if (parsed == null) return
  applyAutoMaxCreditsLocal(parsed, { syncInput: false, remapSlider: true })
  schedulePrioritySave()
}

function onAutoMaxCreditsInputBlur() {
  const parsed = parseCreditsInput(autoMaxCreditsInput.value)
  if (parsed == null) {
    autoMaxCreditsInput.value = String(autoMaxCreditsPerTask.value)
    return
  }
  applyAutoMaxCreditsLocal(parsed)
  schedulePrioritySave()
}

function onSelectCostLevelMode(mode) {
  if (mode !== 'static' && mode !== 'auto') return
  if (mode === costLevelMode.value) return
  costLevelMode.value = mode
  ensureAutoMaxCreditsInitialized()
  if (mode === 'auto') {
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
    auto_max_credits_per_task: String(autoMaxCreditsPerTask.value),
  }
  const modeToSave = costLevelMode.value
  const priorityToSave = priorityGwei.value
  const positionToSave = autoQueuePosition.value
  const maxToSave = autoMaxCreditsPerTask.value
  savingPriority.value = true
  try {
    const data = await projectsAPI.update(project.value.id, payload)
    await beginCostLevelHydration()
    try {
      applyProject(data)
    } finally {
      await endCostLevelHydration()
    }
    if (
      costLevelMode.value !== modeToSave ||
      Number(priorityGwei.value) !== Number(priorityToSave) ||
      Number(autoQueuePosition.value) !== Number(positionToSave) ||
      Number(autoMaxCreditsPerTask.value) !== Number(maxToSave)
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
      await beginCostLevelHydration()
      try {
        applyProject(project.value)
      } finally {
        await endCostLevelHydration()
      }
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

onMounted(async () => {
  await beginCostLevelHydration()
  try {
    await Promise.all([
      loadBillingConfig(),
      loadPricingExamples(),
      loadImagePricingExamples(),
      loadProject(),
    ])
  } finally {
    await endCostLevelHydration()
  }
})

onUnmounted(() => {
  clearPrioritySaveTimer()
  for (const timer of copiedFieldTimers.values()) {
    clearTimeout(timer)
  }
  copiedFieldTimers.clear()
  copiedFields.value.clear()
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
                  isCopied('base') ? 'Copied' : 'Copy base URL'
                "
                @click="onCopyField('base', llmBaseUrl)"
              >
                <Check v-if="isCopied('base')" class="size-4" />
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
                  <div v-if="item.baseUrl" class="mb-4 grid gap-2">
                    <Label class="text-muted-foreground">Base URL</Label>
                    <div class="flex min-w-0 items-start gap-2">
                      <code class="min-w-0 flex-1 break-all rounded bg-muted/50 px-3 py-2 text-xs">
                        {{ item.baseUrl }}
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        class="shrink-0"
                        :aria-label="
                          isCopied(`${item.id}_base`)
                            ? 'Copied'
                            : `Copy ${item.label} base URL`
                        "
                        @click="onCopyField(`${item.id}_base`, item.baseUrl)"
                      >
                        <Check v-if="isCopied(`${item.id}_base`)" class="size-4" />
                        <Copy v-else class="size-4" />
                      </Button>
                    </div>
                    <p class="text-xs text-muted-foreground">
                      Use this URL as the OpenAI client base URL.
                    </p>
                  </div>

                  <div class="grid gap-3">
                    <div
                      v-for="endpoint in item.endpoints"
                      :key="endpoint.id"
                      class="rounded-md border border-border p-3"
                    >
                      <div class="mb-2 flex items-center gap-2">
                        <span class="rounded bg-muted px-2 py-0.5 font-mono text-xs font-semibold">
                          {{ endpoint.method }}
                        </span>
                        <span class="text-sm text-muted-foreground">
                          {{ endpoint.purpose }}
                        </span>
                      </div>
                      <div class="flex min-w-0 items-start gap-2">
                        <code class="min-w-0 flex-1 break-all rounded bg-muted/50 px-3 py-2 text-xs">
                          {{ endpoint.url }}
                        </code>
                        <Button
                          variant="outline"
                          size="icon"
                          class="shrink-0"
                          :aria-label="
                            isCopied(endpoint.id)
                              ? 'Copied'
                              : `Copy ${endpoint.purpose} URL`
                          "
                          @click="onCopyField(endpoint.id, endpoint.url)"
                        >
                          <Check v-if="isCopied(endpoint.id)" class="size-4" />
                          <Copy v-else class="size-4" />
                        </Button>
                      </div>
                      <p
                        v-if="endpoint.note"
                        class="mt-2 text-xs text-muted-foreground"
                      >
                        {{ endpoint.note }}
                      </p>
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
            <span class="flex min-w-0 items-baseline gap-x-1.5 font-mono tabular-nums">
              <template v-if="isAutoMode">
                <span class="text-2xl font-semibold text-sky-600 dark:text-sky-400">
                  {{ autoQueuePosition }}%
                </span>
                <span class="text-base font-medium text-muted-foreground">
                  / {{ formatCredits(autoMaxCreditsPerTask) }}
                </span>
              </template>
              <template v-else>
                <span class="text-2xl font-semibold text-primary">
                  {{ formatGwei(priorityGwei) }}
                </span>
                <span class="text-base font-medium text-muted-foreground">
                  / {{ formatCredits(autoMaxCreditsPerTask) }}
                </span>
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
              higher in the queue. The bars under the slider show the Crynux and
              Provider queue ranges.
            </p>
            <p v-else>
              Within Max Credits per task, the system tries to reach the chosen
              queue position. If the budget is too low for that position, the
              task is placed lower in the queue. If Max Credits cannot cover the
              shared Provider minimum for the request, the request is rejected.
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
                The system adjusts Cost Level toward your chosen queue position
                within Max Credits per task. Credits for the same task can
                change, but they never exceed that maximum.
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

          <div class="mb-20 space-y-10">
            <template v-if="!isAutoMode">
              <div class="space-y-4">
                <div
                  class="grid w-full min-w-0 grid-cols-[9rem_auto_minmax(0,1fr)_auto] gap-x-2.5 pr-10 sm:pr-14"
                >
                  <div
                    class="flex h-20 w-full items-center justify-center self-center rounded-lg border border-input bg-background focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-3"
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
                  <span
                    class="flex h-8 items-center self-center text-xs text-muted-foreground"
                  >
                    Cheaper
                  </span>
                  <div class="flex h-8 items-center self-center">
                    <Slider
                      v-model="sliderPercent"
                      :min="0"
                      :max="SLIDER_MAX"
                      :step="1"
                      class="w-full"
                    />
                  </div>
                  <span
                    class="flex h-8 items-center self-center text-xs text-muted-foreground"
                  >
                    Faster
                  </span>
                </div>

                <div
                  class="rounded-xl border border-border bg-muted/20 py-4 sm:py-5"
                >
                  <p
                    class="mb-5 px-4 text-sm font-semibold text-foreground sm:px-5"
                  >
                    Task queue
                  </p>
                  <div
                    class="grid w-full min-w-0 grid-cols-[9rem_auto_minmax(0,1fr)_auto] gap-x-2.5 gap-y-5 pr-10 sm:pr-14"
                  >
                    <span
                      class="col-span-2 flex h-3 items-center self-start whitespace-nowrap pl-4 text-xs text-muted-foreground sm:pl-5"
                      :class="crynuxQueueRangeBar ? 'mt-[1.375rem]' : null"
                    >
                      Open source models
                    </span>
                    <CostLevelRangeBar
                      :bar="crynuxQueueRangeBar"
                      min-label="Current queue min"
                      max-label="Current queue max"
                      empty-label="Queue empty"
                    />
                    <span />
                    <span
                      class="col-span-2 flex h-3 items-center self-start whitespace-nowrap pl-4 text-xs text-muted-foreground sm:pl-5"
                      :class="providerQueueRangeBar ? 'mt-[1.375rem]' : null"
                    >
                      Provider models
                    </span>
                    <CostLevelRangeBar
                      :bar="providerQueueRangeBar"
                      min-label="Provider queue min"
                      max-label="Provider queue max"
                      empty-label="Queue empty"
                      :markers="providerMinCostLevelMarkers"
                    />
                    <span />
                  </div>
                  <p
                    class="mt-5 px-4 text-xs leading-relaxed sm:px-5"
                    :class="staticProviderAvailabilityClass"
                  >
                    {{ staticProviderAvailabilityHint }}
                  </p>
                </div>
              </div>
            </template>

            <div
              v-else
              class="rounded-xl border border-border bg-muted/20 p-4 sm:p-5"
            >
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
                      <div class="relative mb-3 h-2.5">
                        <span
                          class="absolute top-0 -translate-x-full whitespace-nowrap pr-1 text-[10px] leading-none text-muted-foreground"
                          :style="{ left: `${AUTO_QUEUE_POSITION_BAR_MARGIN}%` }"
                        >
                          Queue min
                        </span>
                        <span
                          class="absolute top-0 whitespace-nowrap pl-1 text-[10px] leading-none text-muted-foreground"
                          :style="{
                            left: `${100 - AUTO_QUEUE_POSITION_BAR_MARGIN}%`,
                          }"
                        >
                          Queue max
                        </span>
                      </div>
                      <div class="relative h-3">
                        <div
                          class="absolute inset-x-0 top-0 h-3 overflow-hidden rounded-full bg-red-500"
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
                          class="absolute bottom-full h-2 w-0 -translate-x-1/2"
                          :style="{ left: `${AUTO_QUEUE_POSITION_BAR_MARGIN}%` }"
                        >
                          <div class="mx-auto h-full w-0.5 bg-foreground/80" />
                        </div>
                        <div
                          class="absolute bottom-full h-2 w-0 -translate-x-1/2"
                          :style="{
                            left: `${100 - AUTO_QUEUE_POSITION_BAR_MARGIN}%`,
                          }"
                        >
                          <div class="mx-auto h-full w-0.5 bg-foreground/80" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="rounded-xl border border-border bg-muted/20 p-4 sm:p-5">
              <div class="mb-4">
                <p class="text-sm font-semibold text-foreground">
                  Max Credits per task
                </p>
                <p class="mt-1 text-xs text-muted-foreground">
                  <template v-if="isAutoMode">
                    Upper Credits cap for each Auto request. The system stays
                    within this budget while trying to reach the chosen queue
                    position. For the reference
                    {{ providerMinReferenceLabel }} workload, Provider min -
                    cheapest is about
                    {{ formatCredits(providerMinCreditsCheapest || 0) }} Credits
                    and Provider min - expensive is about
                    {{ formatCredits(providerMinCreditsExpensive || 0) }} Credits.
                    Requests are rejected when Max Credits cannot cover the
                    selected Provider model.
                  </template>
                  <template v-else>
                    Upper Credits cap for each request. Estimated Credits above
                    this budget are rejected without changing Cost Level. For
                    the reference {{ providerMinReferenceLabel }} workload,
                    Provider min - cheapest is about
                    {{ formatCredits(providerMinCreditsCheapest || 0) }} Credits
                    and Provider min - expensive is about
                    {{ formatCredits(providerMinCreditsExpensive || 0) }} Credits.
                    Requests are rejected when Max Credits cannot cover the
                    selected Provider model.
                  </template>
                </p>
              </div>
              <div class="flex items-center gap-x-3">
                <div
                  class="flex h-20 w-36 shrink-0 items-center justify-center rounded-lg border border-input bg-background focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-3"
                >
                  <Input
                    v-model="autoMaxCreditsInput"
                    inputmode="numeric"
                    autocomplete="off"
                    aria-label="Max Credits per task"
                    class="h-auto w-full border-0 bg-transparent py-0 text-center font-mono text-2xl font-semibold leading-none text-primary tabular-nums shadow-none focus-visible:border-transparent focus-visible:ring-0 md:text-2xl"
                    @input="onAutoMaxCreditsInput"
                    @blur="onAutoMaxCreditsInputBlur"
                  />
                </div>
                <div class="flex min-w-0 flex-1 justify-center">
                  <div
                    class="grid w-[80%] min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 gap-y-4"
                  >
                    <span
                      class="flex h-8 items-center text-xs text-muted-foreground"
                    >
                      Lower
                    </span>
                    <div class="flex h-8 items-center">
                      <Slider
                        v-model="autoMaxCreditsSlider"
                        :min="0"
                        :max="SLIDER_MAX"
                        :step="1"
                        class="w-full"
                      />
                    </div>
                    <span
                      class="flex h-8 items-center text-xs text-muted-foreground"
                    >
                      Higher
                    </span>
                    <span />
                    <CostLevelRangeBar
                      :bar="null"
                      min-label="Min"
                      max-label="Max"
                      empty-label=""
                      :markers="providerMinCreditsMarkers"
                    />
                    <span />
                  </div>
                </div>
              </div>
              <p
                class="mt-5 text-xs leading-relaxed"
                :class="maxCreditsProviderAvailabilityClass"
              >
                {{ maxCreditsProviderAvailabilityHint }}
              </p>
            </div>
          </div>

          <Tabs
            v-model="costLevelExampleTab"
            class="flex w-full flex-col gap-4"
          >
            <TabsList variant="line">
              <TabsTrigger value="chat" class="flex-none px-3">
                Chat
              </TabsTrigger>
              <TabsTrigger value="image" class="flex-none px-3">
                Image
              </TabsTrigger>
            </TabsList>

            <TabsContent value="chat" class="mt-0">
              <div class="grid gap-4 lg:grid-cols-2">
                <div class="overflow-hidden rounded-xl border border-border bg-muted/30">
                  <div class="border-b border-border px-4 py-3">
                    <p class="text-sm font-medium text-foreground">
                      {{ creditsTableTitle }}
                    </p>
                    <p class="mt-0.5 text-xs text-muted-foreground">
                      <template v-if="isAutoMode">
                        Estimates at the current Crynux queue high when available,
                        otherwise the median. Actual Auto Cost Level is resolved
                        per request within Max Credits.
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
                          <PricingExampleModelCell :row="row" />
                        </td>
                        <td class="px-4 py-3.5 text-right tabular-nums text-foreground">
                          <span class="font-semibold">{{ formatExampleCredits(row.inputCredits) }}</span>
                          <span class="ml-1 text-xs font-normal text-muted-foreground">Credits</span>
                        </td>
                        <td class="px-4 py-3.5 text-right tabular-nums text-foreground">
                          <span class="font-semibold">{{ formatExampleCredits(row.outputCredits) }}</span>
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
                          <PricingExampleModelCell :row="row" />
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
            </TabsContent>

            <TabsContent value="image" class="mt-0">
              <div class="grid gap-4 lg:grid-cols-2">
                <div class="overflow-hidden rounded-xl border border-border bg-muted/30">
                  <div class="border-b border-border px-4 py-3">
                    <p class="text-sm font-medium text-foreground">
                      {{ imageCreditsTableTitle }}
                    </p>
                    <p class="mt-0.5 text-xs text-muted-foreground">
                      <template v-if="isAutoMode">
                        Estimates for {{ imageExampleWorkloadNote }} at the
                        current Crynux queue high when available, otherwise the
                        median. Actual Auto Cost Level is resolved per request
                        within Max Credits.
                      </template>
                      <template v-else>
                        Estimates for {{ imageExampleWorkloadNote }}. Actual
                        charges may differ.
                      </template>
                    </p>
                  </div>
                  <table class="w-full text-left text-sm">
                    <thead>
                      <tr class="border-b border-border text-muted-foreground">
                        <th class="px-4 py-3 font-medium">Model</th>
                        <th class="px-4 py-3 text-right font-medium">Size</th>
                        <th class="px-4 py-3 text-right font-medium">Steps</th>
                        <th class="px-4 py-3 text-right font-medium">Credits</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="row in imagePricingRows"
                        :key="`image-credits-${row.id}`"
                        class="border-b border-border last:border-b-0"
                      >
                        <td class="px-4 py-3.5 text-foreground">
                          <PricingExampleModelCell :row="row" />
                        </td>
                        <td class="px-4 py-3.5 text-right tabular-nums text-foreground">
                          {{ imageExampleSizeLabel }}
                        </td>
                        <td class="px-4 py-3.5 text-right tabular-nums text-foreground">
                          {{ formatTokenCount(imageExampleSteps) }}
                        </td>
                        <td class="px-4 py-3.5 text-right tabular-nums text-foreground">
                          <span class="font-semibold">{{ formatExampleCredits(row.credits) }}</span>
                          <span class="ml-1 text-xs font-normal text-muted-foreground">Credits</span>
                        </td>
                      </tr>
                      <tr v-if="imagePricingRows.length === 0">
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

                <div class="overflow-hidden rounded-xl border border-border bg-muted/30">
                  <div class="border-b border-border px-4 py-3">
                    <p class="text-sm font-medium text-foreground">
                      Execution time examples
                    </p>
                    <p class="mt-0.5 text-xs text-muted-foreground">
                      Actual execution time for {{ imageExampleWorkloadNote }}.
                      Does not include queue wait, and does not change with cost
                      level.
                    </p>
                  </div>
                  <table class="w-full text-left text-sm">
                    <thead>
                      <tr class="border-b border-border text-muted-foreground">
                        <th class="px-4 py-3 font-medium">Model</th>
                        <th class="px-4 py-3 text-right font-medium">Size</th>
                        <th class="px-4 py-3 text-right font-medium">Steps</th>
                        <th class="px-4 py-3 text-right font-medium">Seconds</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="row in imagePricingRows"
                        :key="`image-time-${row.id}`"
                        class="border-b border-border last:border-b-0"
                      >
                        <td class="px-4 py-3.5 text-foreground">
                          <PricingExampleModelCell :row="row" />
                        </td>
                        <td class="px-4 py-3.5 text-right tabular-nums text-foreground">
                          {{ imageExampleSizeLabel }}
                        </td>
                        <td class="px-4 py-3.5 text-right tabular-nums text-foreground">
                          {{ formatTokenCount(imageExampleSteps) }}
                        </td>
                        <td class="px-4 py-3.5 text-right font-semibold tabular-nums text-foreground">
                          {{ formatSeconds(row.executionSeconds) }}
                        </td>
                      </tr>
                      <tr v-if="imagePricingRows.length === 0">
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
            </TabsContent>
          </Tabs>
        </div>
      </section>

      <ProjectPlaygroundSection
        v-if="endpointToken"
        :project-id="project.id"
        :endpoint-token="endpointToken"
      />

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
