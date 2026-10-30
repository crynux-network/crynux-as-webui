<script setup>
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { earnAPI } from '@/api/v1/earn'
import { earnErrorMessage, formatTokenCount } from '@/lib/earn-ui'

const open = defineModel('open', { type: Boolean, default: false })

const props = defineProps({
  apiKey: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['updated', 'request-reset'])

const maxInput = ref('')
const maxOutput = ref('')
const inputError = ref('')
const outputError = ref('')
const saving = ref(false)

const usedInput = computed(() => props.apiKey?.used_input_tokens ?? 0)
const usedOutput = computed(() => props.apiKey?.used_output_tokens ?? 0)

const busy = computed(() => saving.value)

function limitToInput(value) {
  if (value == null) return ''
  return String(value)
}

function parseLimitField(raw, fieldLabel) {
  const text = String(raw ?? '').trim()
  if (text === '') {
    return { value: null, error: '' }
  }
  if (!/^\d+$/.test(text)) {
    return { value: null, error: `${fieldLabel} must be a positive integer or empty.` }
  }
  const n = Number(text)
  if (!Number.isSafeInteger(n) || n <= 0) {
    return { value: null, error: `${fieldLabel} must be a positive integer or empty.` }
  }
  return { value: n, error: '' }
}

function syncFromKey() {
  maxInput.value = limitToInput(props.apiKey?.max_input_tokens)
  maxOutput.value = limitToInput(props.apiKey?.max_output_tokens)
  inputError.value = ''
  outputError.value = ''
}

watch(open, (isOpen) => {
  if (isOpen) {
    syncFromKey()
  } else {
    saving.value = false
  }
})

watch(
  () => props.apiKey,
  () => {
    if (open.value) syncFromKey()
  },
)

function preventOutside(event) {
  if (busy.value) event.preventDefault()
}

async function onSave() {
  if (!props.apiKey || busy.value) return
  const inputParsed = parseLimitField(maxInput.value, 'Max input tokens')
  const outputParsed = parseLimitField(maxOutput.value, 'Max output tokens')
  inputError.value = inputParsed.error
  outputError.value = outputParsed.error
  if (inputParsed.error || outputParsed.error) return

  saving.value = true
  try {
    await earnAPI.setKeyLimits(props.apiKey.id, {
      max_input_tokens: inputParsed.value,
      max_output_tokens: outputParsed.value,
    })
    open.value = false
    emit('updated')
  } catch (e) {
    console.error('Failed to set Shared API Key limits', e)
    toast.error(
      earnErrorMessage(e, 'Failed to save token limits. Please try again later.'),
    )
  } finally {
    saving.value = false
  }
}

function onResetClick() {
  if (!props.apiKey || busy.value) return
  const key = props.apiKey
  open.value = false
  emit('request-reset', key)
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="gap-6 p-6 sm:max-w-lg"
      @pointer-down-outside="preventOutside"
      @interact-outside="preventOutside"
      @escape-key-down="preventOutside"
    >
      <DialogHeader>
        <DialogTitle class="text-xl">Token Limits</DialogTitle>
      </DialogHeader>

      <form class="grid gap-5" @submit.prevent="onSave">
        <p class="text-sm leading-relaxed text-muted-foreground">
          Set maximum input and output tokens for this key. Leave a field empty
          for unlimited. When usage reaches a limit, the key stops receiving new
          tasks until you reset usage.
        </p>

        <div class="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
          <div class="flex justify-between gap-4">
            <span class="text-muted-foreground">Used input</span>
            <span class="font-mono">{{ formatTokenCount(usedInput) }}</span>
          </div>
          <div class="mt-2 flex justify-between gap-4">
            <span class="text-muted-foreground">Used output</span>
            <span class="font-mono">{{ formatTokenCount(usedOutput) }}</span>
          </div>
        </div>

        <div class="grid gap-2.5">
          <Label class="text-sm">Max input tokens</Label>
          <Input
            v-model="maxInput"
            type="text"
            inputmode="numeric"
            autocomplete="off"
            placeholder="Unlimited"
            :disabled="busy"
            class="h-11 font-mono"
          />
          <p v-if="inputError" class="text-sm text-destructive">
            {{ inputError }}
          </p>
        </div>

        <div class="grid gap-2.5">
          <Label class="text-sm">Max output tokens</Label>
          <Input
            v-model="maxOutput"
            type="text"
            inputmode="numeric"
            autocomplete="off"
            placeholder="Unlimited"
            :disabled="busy"
            class="h-11 font-mono"
          />
          <p v-if="outputError" class="text-sm text-destructive">
            {{ outputError }}
          </p>
        </div>

        <DialogFooter class="flex-col gap-2 sm:flex-col">
          <Button
            type="submit"
            class="h-11 w-full"
            :disabled="busy"
          >
            {{ saving ? 'Saving…' : 'Save' }}
          </Button>
          <Button
            type="button"
            variant="secondary"
            class="h-11 w-full"
            :disabled="busy"
            @click="onResetClick"
          >
            Reset usage
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
