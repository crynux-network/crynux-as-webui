<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { projectPrivateAPI } from '@/api/project-private'
import {
  loadPlaygroundState,
  savePlaygroundState,
} from '@/lib/playground-storage'
import ModelPicker from '@/components/projects/playground/ModelPicker.vue'

const MAX_TURNS = 10
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
const messages = ref([])
const draft = ref('')
const thinking = ref(true)
const loadingModels = ref(false)
const sending = ref(false)
const pendingElapsedSeconds = ref(0)
const hydrated = ref(false)

let elapsedTimerId = null
let requestStartedAt = 0

const showFirstDownloadHint = computed(
  () =>
    Boolean(selectedModel.value) &&
    (selectedModel.value.isCustom ||
      Number(selectedModel.value.on_disk_node_count) === 0),
)

const canSend = computed(
  () =>
    !sending.value &&
    !loadingModels.value &&
    Boolean(selectedModel.value?.id) &&
    Boolean(draft.value.trim()),
)

const canClearHistory = computed(() => !sending.value && messages.value.length > 0)

function clearHistory() {
  if (!canClearHistory.value) return
  messages.value = []
  draft.value = ''
}

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
  pendingElapsedSeconds.value = 0
  elapsedTimerId = setInterval(() => {
    pendingElapsedSeconds.value = Math.max(
      0,
      Math.floor((Date.now() - requestStartedAt) / 1000),
    )
  }, 250)
}

function finalizeElapsedSeconds() {
  stopElapsedTimer()
  return Math.max(0, Math.floor((Date.now() - requestStartedAt) / 1000))
}

function toSelection(model) {
  return {
    id: String(model.id || ''),
    variant: '',
    min_vram: Number(model.min_vram) || 0,
    on_disk_node_count: Number(model.on_disk_node_count) || 0,
    isCustom: false,
  }
}

function hydrateFromStorage() {
  const state = loadPlaygroundState(props.projectId)
  selectedModel.value = state.chat.selectedModel
  messages.value = trimToMaxTurns(state.chat.messages)
  hydrated.value = true
}

function persistChatState() {
  if (!hydrated.value) return
  savePlaygroundState(props.projectId, {
    chat: {
      selectedModel: selectedModel.value,
      messages: messages.value,
    },
  })
}

async function loadModels() {
  loadingModels.value = true
  try {
    const list = await projectPrivateAPI.listModels(props.endpointToken)
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
      const matched = list.find((m) => m.id === current.id)
      if (matched) {
        selectedModel.value = toSelection(matched)
        return
      }
      selectedModel.value = list[0] ? toSelection(list[0]) : null
    }
  } catch (error) {
    console.error('Failed to load LLM models for playground', error)
    toast.error('Failed to load models. Please try again later.')
    models.value = []
    if (!selectedModel.value?.isCustom) {
      selectedModel.value = null
    }
  } finally {
    loadingModels.value = false
  }
}

function trimToMaxTurns(list) {
  const next = [...list]
  while (next.length > MAX_TURNS * 2) {
    next.shift()
    if (next.length > 0 && next[0].role === 'assistant') {
      next.shift()
    }
  }
  return next
}

async function sendMessage() {
  const content = draft.value.trim()
  if (!canSend.value || !content) return

  let nextMessages = [...messages.value, { role: 'user', content }]
  nextMessages = trimToMaxTurns(nextMessages)
  messages.value = nextMessages
  draft.value = ''
  sending.value = true
  startElapsedTimer()

  try {
    const payload = {
      model: selectedModel.value.id,
      messages: nextMessages.map(({ role, content: messageContent }) => ({
        role,
        content: messageContent,
      })),
      chat_template_kwargs: {
        enable_thinking: thinking.value,
      },
    }
    if (selectedModel.value.isCustom) {
      payload.vram_limit = selectedModel.value.min_vram
    }
    const response = await projectPrivateAPI.chatCompletions(
      props.endpointToken,
      payload,
    )
    const assistantContent =
      response?.choices?.[0]?.message?.content ??
      response?.choices?.[0]?.text ??
      ''
    const durationSeconds = finalizeElapsedSeconds()
    messages.value = [
      ...nextMessages,
      {
        role: 'assistant',
        content: String(assistantContent || ''),
        durationSeconds,
      },
    ]
  } catch (error) {
    console.error('Playground chat completion failed', error)
    toast.error('Chat request failed. Please try again later.')
    stopElapsedTimer()
    pendingElapsedSeconds.value = 0
    messages.value = nextMessages.slice(0, -1)
    draft.value = content
  } finally {
    sending.value = false
  }
}

watch(
  [selectedModel, messages],
  () => {
    persistChatState()
  },
  { deep: true },
)

watch(
  () => [props.projectId, props.endpointToken],
  () => {
    stopElapsedTimer()
    pendingElapsedSeconds.value = 0
    sending.value = false
    draft.value = ''
    thinking.value = true
    hydrated.value = false
    hydrateFromStorage()
    loadModels()
  },
)

onMounted(() => {
  hydrateFromStorage()
  loadModels()
})

onUnmounted(() => {
  stopElapsedTimer()
})
</script>

<template>
  <div class="space-y-4">
    <ModelPicker
      v-model="selectedModel"
      mode="chat"
      :models="models"
      :loading="loadingModels"
      :disabled="sending"
    />

    <p
      v-if="showFirstDownloadHint"
      class="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300"
    >
      {{ FIRST_DOWNLOAD_HINT }}
    </p>

    <div
      class="flex h-80 flex-col gap-3 overflow-y-auto rounded-lg border border-border bg-muted/20 p-4"
    >
      <p
        v-if="messages.length === 0"
        class="m-auto text-sm text-muted-foreground"
      >
        Send a message to start chatting.
      </p>
      <div
        v-for="(message, index) in messages"
        :key="`${message.role}-${index}`"
        class="flex"
        :class="message.role === 'user' ? 'justify-end' : 'justify-start'"
      >
        <div
          class="flex max-w-[80%] items-end gap-2"
          :class="message.role === 'user' ? 'flex-row-reverse' : 'flex-row'"
        >
          <div
            class="whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed"
            :class="
              message.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background border border-border text-foreground'
            "
          >
            {{ message.content }}
          </div>
          <span
            v-if="message.role === 'assistant' && message.durationSeconds != null"
            class="shrink-0 pb-1 text-xs text-muted-foreground"
          >
            {{ formatDurationSeconds(message.durationSeconds) }}
          </span>
        </div>
      </div>
      <div
        v-if="sending"
        class="flex justify-start"
      >
        <div class="flex max-w-[80%] items-end gap-2">
          <div class="rounded-2xl border border-border bg-background px-3.5 py-2 text-sm text-muted-foreground">
            Generating…
          </div>
          <span class="shrink-0 pb-1 text-xs text-muted-foreground">
            {{ formatDurationSeconds(pendingElapsedSeconds) }}
          </span>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <Checkbox
        id="playground-chat-thinking"
        v-model="thinking"
        :disabled="sending"
      />
      <Label
        for="playground-chat-thinking"
        class="font-normal"
      >
        Thinking
      </Label>
    </div>

    <div
      class="flex w-full overflow-hidden rounded-lg border border-input bg-transparent focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        class="size-8 shrink-0 rounded-none border-0 border-r border-input"
        :disabled="!canClearHistory"
        aria-label="Clear chat history"
        @click="clearHistory"
      >
        <RefreshCw />
      </Button>
      <Input
        v-model="draft"
        class="h-8 rounded-none border-0 bg-transparent focus-visible:border-0 focus-visible:ring-0 disabled:bg-transparent dark:bg-transparent dark:disabled:bg-transparent"
        placeholder="Type a message"
        autocomplete="off"
        :disabled="sending || !selectedModel"
        @keydown.enter.prevent="sendMessage"
      />
      <Button
        type="button"
        class="h-8 rounded-none border-0 border-l border-input"
        :disabled="!canSend"
        @click="sendMessage"
      >
        Send
      </Button>
    </div>
  </div>
</template>
