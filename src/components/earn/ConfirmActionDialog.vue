<script setup>
import { computed } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const open = defineModel('open', { type: Boolean, default: false })

const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: [String, Array],
    default: '',
  },
  confirmLabel: {
    type: String,
    default: 'Confirm',
  },
  busyLabel: {
    type: String,
    default: 'Working…',
  },
  busy: {
    type: Boolean,
    default: false,
  },
  confirmVariant: {
    type: String,
    default: 'default',
  },
})

const emit = defineEmits(['confirm'])

const paragraphs = computed(() => {
  if (Array.isArray(props.description)) return props.description
  if (props.description) return [props.description]
  return []
})

function preventDefault(event) {
  event.preventDefault()
}

function onConfirm() {
  if (props.busy) return
  emit('confirm')
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="gap-6 p-6 sm:max-w-lg"
      :show-close-button="true"
      @pointer-down-outside="preventDefault"
      @interact-outside="preventDefault"
      @open-auto-focus="preventDefault"
    >
      <DialogHeader class="gap-4 text-left sm:text-left">
        <DialogTitle class="text-xl">{{ title }}</DialogTitle>
        <div v-if="paragraphs.length" class="space-y-3">
          <p
            v-for="(line, index) in paragraphs"
            :key="index"
            class="text-sm leading-relaxed text-pretty text-muted-foreground"
          >
            {{ line }}
          </p>
        </div>
      </DialogHeader>

      <DialogFooter class="sm:justify-stretch">
        <Button
          type="button"
          class="w-full sm:w-full"
          size="lg"
          :variant="confirmVariant"
          :disabled="busy"
          @click="onConfirm"
        >
          {{ busy ? busyLabel : confirmLabel }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
