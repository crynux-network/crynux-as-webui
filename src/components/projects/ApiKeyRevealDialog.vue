<script setup>
import { computed, ref, watch } from 'vue'
import { Check, Copy } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { copyText } from '@/lib/project-ui'

const open = defineModel('open', { type: Boolean, default: false })

const props = defineProps({
  apiKey: { type: String, default: '' },
})

const emit = defineEmits(['done'])

const copied = ref(false)
let copiedTimer = null

const canCopy = computed(() => Boolean(props.apiKey))

watch(open, (isOpen) => {
  if (!isOpen) {
    copied.value = false
    if (copiedTimer) {
      clearTimeout(copiedTimer)
      copiedTimer = null
    }
    emit('done')
  }
})

async function onCopy() {
  if (!props.apiKey) return
  try {
    await copyText(props.apiKey)
    copied.value = true
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => {
      copied.value = false
      copiedTimer = null
    }, 2000)
  } catch (e) {
    console.error('Failed to copy API key', e)
  }
}

function onSelectAll(event) {
  const el = event?.target
  if (el && typeof el.select === 'function') {
    el.select()
  }
}

function onClose() {
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md" :show-close-button="false">
      <DialogHeader>
        <DialogTitle>API key</DialogTitle>
        <DialogDescription>
          This plaintext API key is shown only once. Copy and store it securely
          before closing this dialog.
        </DialogDescription>
      </DialogHeader>

      <div class="flex gap-2">
        <Input
          :model-value="apiKey"
          readonly
          class="min-w-0 flex-1 font-mono text-xs"
          @focus="onSelectAll"
          @click="onSelectAll"
        />
        <Button
          variant="outline"
          size="icon"
          :disabled="!canCopy"
          :aria-label="copied ? 'Copied' : 'Copy API key'"
          @click="onCopy"
        >
          <Check v-if="copied" class="size-4" />
          <Copy v-else class="size-4" />
        </Button>
      </div>

      <DialogFooter>
        <Button size="sm" @click="onClose">I have saved the key</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
