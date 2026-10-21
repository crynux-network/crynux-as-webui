<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import ApiError from '@/api/api-error'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { projectPrivateAPI } from '@/api/project-private'
import {
  blobToDataUrl,
  loadPlaygroundState,
  savePlaygroundState,
} from '@/lib/playground-storage'
import { appendStatusLogEntry } from '@/lib/playground-status-log'
import {
  catalogToModelSelection,
  modelSelectionKey,
} from '@/lib/model-tags'
import ModelPicker from '@/components/projects/playground/ModelPicker.vue'
import PlaygroundStatusLog from '@/components/projects/playground/PlaygroundStatusLog.vue'

const POLL_INTERVAL_MS = 2500
const MAX_POLL_MS = 11 * 60 * 1000
const FALLBACK_ERROR = 'Image generation failed'
const STEPS_MIN = 1
const STEPS_MAX = 50
const STEPS_DEFAULT = 4
const FIRST_DOWNLOAD_HINT =
  'This model is not yet available on network nodes. The first request may take much longer while nodes download it.'

const props = defineProps({
  projectId: {
    type: [Number, String],
    required: true,
  },
  endpointToken: {
    type: String,
    required: true,
  },
})

const models = ref([])
const selectedModel = ref(null)
const prompt = ref('')
const negativePrompt = ref('')
const steps = ref([STEPS_DEFAULT])
const loadingModels = ref(false)
const generating = ref(false)
const imageUrl = ref('')
const errorMessage = ref('')
const elapsedSeconds = ref(0)
const showElapsed = ref(false)
const statusLog = ref([])
const inFlightTaskId = ref(null)
const inFlightStartedAt = ref(null)
const hydrated = ref(false)

let elapsedTimerId = null
let requestStartedAt = 0
let activeRunId = 0

function toSelection(model) {
  return catalogToModelSelection(model)
}

function beginRun() {
  activeRunId += 1
  return activeRunId
}

function isRunActive(runId) {
  return runId === activeRunId
}

function clearInFlight() {
  inFlightTaskId.value = null
  inFlightStartedAt.value = null
}

function setInFlight(taskId, startedAt) {
  inFlightTaskId.value = taskId
  inFlightStartedAt.value =
    typeof startedAt === 'number' && startedAt > 0 ? startedAt : Date.now()
}

const showFirstDownloadHint = computed(
  () =>
    Boolean(selectedModel.value) &&
    (selectedModel.value.isCustom ||
      Number(selectedModel.value.on_disk_node_count) === 0),
)

const canGenerate = computed(
  () =>
    !generating.value &&
    !loadingModels.value &&
    Boolean(selectedModel.value?.id) &&
    Boolean(prompt.value.trim()),
)

function formatDurationSeconds(seconds) {
  return `${seconds}s`
}

function stopElapsedTimer() {
  if (elapsedTimerId != null) {
    clearInterval(elapsedTimerId)
    elapsedTimerId = null
  }
}

function startElapsedTimerFrom(startedAt) {
  stopElapsedTimer()
  requestStartedAt =
    typeof startedAt === 'number' && startedAt > 0 ? startedAt : Date.now()
  elapsedSeconds.value = Math.max(
    0,
    Math.floor((Date.now() - requestStartedAt) / 1000),
  )
  showElapsed.value = true
  elapsedTimerId = setInterval(() => {
    elapsedSeconds.value = Math.max(
      0,
      Math.floor((Date.now() - requestStartedAt) / 1000),
    )
  }, 250)
}

function startElapsedTimer() {
  startElapsedTimerFrom(Date.now())
}

function finalizeElapsedSeconds() {
  stopElapsedTimer()
  elapsedSeconds.value = Math.max(
    0,
    Math.floor((Date.now() - requestStartedAt) / 1000),
  )
}

function clearImageUrl() {
  imageUrl.value = ''
}

function hydrateFromStorage() {
  const state = loadPlaygroundState(props.projectId)
  selectedModel.value = state.image.selectedModel
  prompt.value = state.image.prompt
  negativePrompt.value = state.image.negativePrompt
  steps.value = [state.image.steps]
  imageUrl.value = state.image.imageDataUrl || ''
  elapsedSeconds.value = state.image.elapsedSeconds
  showElapsed.value = state.image.showElapsed
  statusLog.value = state.image.statusLog
  inFlightTaskId.value = state.image.inFlightTaskId
  inFlightStartedAt.value = state.image.inFlightStartedAt
  hydrated.value = true
}

function persistImageState() {
  if (!hydrated.value) return
  savePlaygroundState(props.projectId, {
    image: {
      selectedModel: selectedModel.value,
      prompt: prompt.value,
      negativePrompt: negativePrompt.value,
      steps: steps.value?.[0] ?? STEPS_DEFAULT,
      imageDataUrl: imageUrl.value.startsWith('data:image/')
        ? imageUrl.value
        : null,
      elapsedSeconds: elapsedSeconds.value,
      showElapsed: showElapsed.value,
      statusLog: statusLog.value,
      inFlightTaskId: inFlightTaskId.value,
      inFlightStartedAt: inFlightStartedAt.value,
    },
  })
}

function resolveErrorMessage(error) {
  if (error instanceof ApiError && error.detail) {
    return String(error.detail)
  }
  if (error?.message && error.message !== FALLBACK_ERROR) {
    return String(error.message)
  }
  return FALLBACK_ERROR
}

async function loadModels() {
  loadingModels.value = true
  try {
    const list = await projectPrivateAPI.listImageModels(props.endpointToken)
    models.value = list
    const current = selectedModel.value
    if (current?.isCustom) {
      return
    }
    if (!current && list.length > 0) {
      selectedModel.value = toSelection(list[0])
      return
    }
    if (current) {
      const matched = list.find(
        (m) => modelSelectionKey(toSelection(m)) === modelSelectionKey(current),
      )
      if (matched) {
        selectedModel.value = toSelection(matched)
        return
      }
      selectedModel.value = list[0] ? toSelection(list[0]) : null
    }
  } catch (error) {
    console.error('Failed to load image models for playground', error)
    toast.error('Failed to load models. Please try again later.')
    models.value = []
    if (!selectedModel.value?.isCustom) {
      selectedModel.value = null
    }
  } finally {
    loadingModels.value = false
  }
}

function buildTaskArgs() {
  const selected = selectedModel.value
  const args = {
    version: '3.7.0',
    base_model: {
      name: selected.id,
    },
    prompt: prompt.value.trim(),
    negative_prompt: negativePrompt.value.trim(),
    task_config: {
      num_images_per_prompt: 1,
      image_width: 512,
      image_height: 512,
      steps: steps.value?.[0] ?? STEPS_DEFAULT,
      seed: Date.now() % 0x7fffffff,
      guidance_scale: 7,
    },
  }
  if (selected.execution_dtype) {
    args.dtype = selected.execution_dtype
  }
  if (selected.quantization_config != null) {
    args.quantization_config = selected.quantization_config
  }
  return args
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function recordTaskStatus(task) {
  statusLog.value = appendStatusLogEntry(statusLog.value, task)
}

async function waitForTask(taskId, runId) {
  const started = Date.now()
  while (Date.now() - started < MAX_POLL_MS) {
    if (!isRunActive(runId)) return null
    const task = await projectPrivateAPI.getInferenceTask(
      props.endpointToken,
      taskId,
    )
    if (!isRunActive(runId)) return null
    recordTaskStatus(task)
    if (task?.status === 'success') {
      return task
    }
    if (task?.status === 'failed') {
      const detail =
        typeof task.error_message === 'string' && task.error_message.trim()
          ? task.error_message.trim()
          : FALLBACK_ERROR
      throw new Error(detail)
    }
    await sleep(POLL_INTERVAL_MS)
  }
  throw new Error('Image generation timed out')
}

async function finishSuccessfulTask(taskId, runId) {
  const blob = await projectPrivateAPI.getImageBlob(
    props.endpointToken,
    taskId,
    0,
  )
  if (!isRunActive(runId)) return
  imageUrl.value = await blobToDataUrl(blob)
  if (!isRunActive(runId)) return
  clearInFlight()
}

async function runTaskLifecycle(taskId, runId) {
  const task = await waitForTask(taskId, runId)
  if (!isRunActive(runId) || !task) return
  await finishSuccessfulTask(taskId, runId)
}

async function resumeInFlight() {
  const taskId = inFlightTaskId.value
  if (!taskId || generating.value) return

  if (imageUrl.value.startsWith('data:image/')) {
    clearInFlight()
    return
  }

  const runId = beginRun()
  generating.value = true
  errorMessage.value = ''
  startElapsedTimerFrom(inFlightStartedAt.value || Date.now())

  try {
    await runTaskLifecycle(taskId, runId)
  } catch (error) {
    if (!isRunActive(runId)) return
    console.error('Playground image resume failed', error)
    const message = resolveErrorMessage(error)
    errorMessage.value = message
    toast.error(
      message === FALLBACK_ERROR
        ? 'Image generation failed. Please try again later.'
        : message,
    )
    clearInFlight()
  } finally {
    if (isRunActive(runId)) {
      finalizeElapsedSeconds()
      generating.value = false
    }
  }
}

async function generateImage() {
  if (!canGenerate.value) return

  const runId = beginRun()
  generating.value = true
  errorMessage.value = ''
  statusLog.value = []
  clearInFlight()
  clearImageUrl()
  startElapsedTimer()
  recordTaskStatus({ phase: 'sending' })

  try {
    const payload = {
      task_type: 0,
      task_args: JSON.stringify(buildTaskArgs()),
    }
    if (selectedModel.value.isCustom) {
      payload.min_vram = selectedModel.value.min_vram
    }
    const created = await projectPrivateAPI.createInferenceTask(
      props.endpointToken,
      payload,
    )
    if (!isRunActive(runId)) return
    recordTaskStatus(created)
    const taskId = created?.id
    if (!taskId) {
      throw new Error('Missing task id')
    }
    setInFlight(Number(taskId) || taskId, requestStartedAt)
    await runTaskLifecycle(taskId, runId)
  } catch (error) {
    if (!isRunActive(runId)) return
    console.error('Playground image generation failed', error)
    const message = resolveErrorMessage(error)
    errorMessage.value = message
    toast.error(
      message === FALLBACK_ERROR
        ? 'Image generation failed. Please try again later.'
        : message,
    )
    clearInFlight()
  } finally {
    if (isRunActive(runId)) {
      finalizeElapsedSeconds()
      generating.value = false
    }
  }
}

watch(
  [
    selectedModel,
    prompt,
    negativePrompt,
    steps,
    imageUrl,
    elapsedSeconds,
    showElapsed,
    statusLog,
    inFlightTaskId,
    inFlightStartedAt,
  ],
  () => {
    persistImageState()
  },
  { deep: true },
)

watch(
  () => [props.projectId, props.endpointToken],
  () => {
    beginRun()
    stopElapsedTimer()
    generating.value = false
    errorMessage.value = ''
    hydrated.value = false
    hydrateFromStorage()
    loadModels()
    resumeInFlight()
  },
)

onMounted(() => {
  hydrateFromStorage()
  loadModels()
  resumeInFlight()
})

onUnmounted(() => {
  beginRun()
  stopElapsedTimer()
})
</script>

<template>
  <div class="space-y-4">
    <ModelPicker
      v-model="selectedModel"
      mode="image"
      :models="models"
      :loading="loadingModels"
      :disabled="generating"
    />

    <p
      v-if="showFirstDownloadHint"
      class="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300"
    >
      {{ FIRST_DOWNLOAD_HINT }}
    </p>

    <div class="space-y-2">
      <Label for="playground-image-prompt">Prompt</Label>
      <textarea
        id="playground-image-prompt"
        v-model="prompt"
        rows="3"
        class="dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 min-h-[4.5rem] w-full resize-y rounded-lg border bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50"
        placeholder="Describe the image"
        :disabled="generating"
      />
    </div>

    <div class="space-y-2">
      <Label for="playground-image-negative-prompt">Negative prompt</Label>
      <textarea
        id="playground-image-negative-prompt"
        v-model="negativePrompt"
        rows="2"
        class="dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 min-h-[3.5rem] w-full resize-y rounded-lg border bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50"
        placeholder="Optional"
        :disabled="generating"
      />
    </div>

    <div class="space-y-2">
      <Label for="playground-image-steps">Steps</Label>
      <div class="flex w-full items-center gap-3">
        <span class="w-8 shrink-0 text-right text-base font-semibold tabular-nums text-primary">
          {{ steps?.[0] ?? STEPS_DEFAULT }}
        </span>
        <Slider
          id="playground-image-steps"
          v-model="steps"
          :min="STEPS_MIN"
          :max="STEPS_MAX"
          :step="1"
          :disabled="generating"
          class="min-w-0 flex-1"
        />
      </div>
    </div>

    <div class="space-y-2">
      <div class="flex items-center gap-2">
        <Button
          type="button"
          :disabled="!canGenerate"
          @click="generateImage"
        >
          {{ generating ? 'Generating…' : 'Generate' }}
        </Button>
        <span
          v-if="showElapsed"
          class="text-xs text-muted-foreground"
        >
          {{ formatDurationSeconds(elapsedSeconds) }}
        </span>
      </div>
      <p
        v-if="errorMessage"
        class="text-sm text-destructive"
      >
        {{ errorMessage }}
      </p>
      <PlaygroundStatusLog :entries="statusLog" />
    </div>

    <div class="overflow-hidden rounded-lg border border-border bg-muted/20">
      <img
        v-if="imageUrl"
        :src="imageUrl"
        alt="Generated image"
        class="mx-auto max-h-[32rem] w-auto max-w-full object-contain"
      >
      <div
        v-else
        class="flex h-64 items-center justify-center text-sm text-muted-foreground"
      >
        {{ generating ? 'Generating image…' : 'Generated image will appear here.' }}
      </div>
    </div>
  </div>
</template>
