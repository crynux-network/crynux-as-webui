<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import ApiError from '@/api/api-error'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { projectPrivateAPI } from '@/api/project-private'

const POLL_INTERVAL_MS = 2500
const MAX_POLL_MS = 11 * 60 * 1000
const FALLBACK_ERROR = 'Image generation failed'
const STEPS_MIN = 1
const STEPS_MAX = 50
const STEPS_DEFAULT = 4

const props = defineProps({
  endpointToken: {
    type: String,
    required: true,
  },
})

const models = ref([])
const selectedModel = ref('')
const prompt = ref('')
const negativePrompt = ref('')
const steps = ref([STEPS_DEFAULT])
const loadingModels = ref(false)
const generating = ref(false)
const imageUrl = ref('')
const errorMessage = ref('')
const elapsedSeconds = ref(0)
const showElapsed = ref(false)

let elapsedTimerId = null
let requestStartedAt = 0

const canGenerate = computed(
  () =>
    !generating.value &&
    !loadingModels.value &&
    Boolean(selectedModel.value) &&
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

function startElapsedTimer() {
  stopElapsedTimer()
  requestStartedAt = Date.now()
  elapsedSeconds.value = 0
  showElapsed.value = true
  elapsedTimerId = setInterval(() => {
    elapsedSeconds.value = Math.max(
      0,
      Math.floor((Date.now() - requestStartedAt) / 1000),
    )
  }, 250)
}

function finalizeElapsedSeconds() {
  stopElapsedTimer()
  elapsedSeconds.value = Math.max(
    0,
    Math.floor((Date.now() - requestStartedAt) / 1000),
  )
}

function revokeImageUrl() {
  if (imageUrl.value) {
    URL.revokeObjectURL(imageUrl.value)
    imageUrl.value = ''
  }
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
    if (!selectedModel.value && list.length > 0) {
      selectedModel.value = list[0].id
    }
    if (selectedModel.value && !list.some((m) => m.id === selectedModel.value)) {
      selectedModel.value = list[0]?.id || ''
    }
  } catch (error) {
    console.error('Failed to load image models for playground', error)
    toast.error('Failed to load models. Please try again later.')
    models.value = []
    selectedModel.value = ''
  } finally {
    loadingModels.value = false
  }
}

function buildTaskArgs() {
  return {
    base_model: {
      name: selectedModel.value,
      variant: 'fp16',
    },
    prompt: prompt.value.trim(),
    negative_prompt: negativePrompt.value.trim(),
    task_config: {
      num_images: 1,
      image_width: 512,
      image_height: 512,
      steps: steps.value?.[0] ?? STEPS_DEFAULT,
      seed: Date.now() % 0x7fffffff,
      safety_checker: false,
      cfg: 7,
    },
    scheduler: {
      method: 'EulerAncestralDiscreteScheduler',
      args: {
        timestep_spacing: 'trailing',
      },
    },
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForTask(taskId) {
  const started = Date.now()
  while (Date.now() - started < MAX_POLL_MS) {
    const task = await projectPrivateAPI.getInferenceTask(
      props.endpointToken,
      taskId,
    )
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

async function generateImage() {
  if (!canGenerate.value) return

  generating.value = true
  errorMessage.value = ''
  revokeImageUrl()
  startElapsedTimer()

  try {
    const created = await projectPrivateAPI.createInferenceTask(
      props.endpointToken,
      {
        task_type: 0,
        task_args: JSON.stringify(buildTaskArgs()),
      },
    )
    const taskId = created?.id
    if (!taskId) {
      throw new Error('Missing task id')
    }
    await waitForTask(taskId)
    const blob = await projectPrivateAPI.getImageBlob(
      props.endpointToken,
      taskId,
      0,
    )
    imageUrl.value = URL.createObjectURL(blob)
  } catch (error) {
    console.error('Playground image generation failed', error)
    const message = resolveErrorMessage(error)
    errorMessage.value = message
    toast.error(
      message === FALLBACK_ERROR
        ? 'Image generation failed. Please try again later.'
        : message,
    )
  } finally {
    finalizeElapsedSeconds()
    generating.value = false
  }
}

watch(
  () => props.endpointToken,
  () => {
    stopElapsedTimer()
    elapsedSeconds.value = 0
    showElapsed.value = false
    generating.value = false
    errorMessage.value = ''
    prompt.value = ''
    negativePrompt.value = ''
    steps.value = [STEPS_DEFAULT]
    selectedModel.value = ''
    revokeImageUrl()
    loadModels()
  },
)

onMounted(() => {
  loadModels()
})

onUnmounted(() => {
  stopElapsedTimer()
  revokeImageUrl()
})
</script>

<template>
  <div class="space-y-4">
    <div class="space-y-2">
      <Label>Model</Label>
      <Select
        v-model="selectedModel"
        :disabled="loadingModels || generating || models.length === 0"
      >
        <SelectTrigger class="w-full max-w-md">
          <SelectValue :placeholder="loadingModels ? 'Loading models…' : 'Select a model'" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="model in models"
            :key="model.id"
            :value="model.id"
          >
            {{ model.id }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

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
