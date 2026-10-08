<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { projectPrivateAPI } from '@/api/project-private'

const MAX_TURNS = 10

const props = defineProps({
  endpointToken: {
    type: String,
    required: true,
  },
})

const models = ref([])
const selectedModel = ref('')
const messages = ref([])
const draft = ref('')
const thinking = ref(true)
const loadingModels = ref(false)
const sending = ref(false)
const pendingElapsedSeconds = ref(0)

let elapsedTimerId = null
let requestStartedAt = 0

const canSend = computed(
  () =>
    !sending.value &&
    !loadingModels.value &&
    Boolean(selectedModel.value) &&
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

async function loadModels() {
  loadingModels.value = true
  try {
    const list = await projectPrivateAPI.listModels(props.endpointToken)
    models.value = list
    if (!selectedModel.value && list.length > 0) {
      selectedModel.value = list[0].id
    }
    if (selectedModel.value && !list.some((m) => m.id === selectedModel.value)) {
      selectedModel.value = list[0]?.id || ''
    }
  } catch (error) {
    console.error('Failed to load LLM models for playground', error)
    toast.error('Failed to load models. Please try again later.')
    models.value = []
    selectedModel.value = ''
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
    const response = await projectPrivateAPI.chatCompletions(props.endpointToken, {
      model: selectedModel.value,
      messages: nextMessages.map(({ role, content: messageContent }) => ({
        role,
        content: messageContent,
      })),
      chat_template_kwargs: {
        enable_thinking: thinking.value,
      },
    })
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
  () => props.endpointToken,
  () => {
    stopElapsedTimer()
    pendingElapsedSeconds.value = 0
    sending.value = false
    messages.value = []
    draft.value = ''
    thinking.value = true
    selectedModel.value = ''
    loadModels()
  },
)

onMounted(() => {
  loadModels()
})

onUnmounted(() => {
  stopElapsedTimer()
})
</script>

<template>
  <div class="space-y-4">
    <div class="space-y-2">
      <Label>Model</Label>
      <Select v-model="selectedModel" :disabled="loadingModels || sending || models.length === 0">
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
