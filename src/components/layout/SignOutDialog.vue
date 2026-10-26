<script setup>
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
  busy: {
    type: Boolean,
    default: false,
  },
})
const emit = defineEmits(['confirm'])

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
        <DialogTitle class="text-xl">Sign out</DialogTitle>
        <div class="space-y-3">
          <p class="text-sm leading-relaxed text-muted-foreground">
            You will be signed out of Crynux AI Services on this device.
          </p>
          <p class="text-sm leading-relaxed text-muted-foreground">
            Your wallet will disconnect. You can connect again anytime to
            continue.
          </p>
        </div>
      </DialogHeader>

      <DialogFooter class="sm:justify-stretch">
        <Button
          type="button"
          class="w-full sm:w-full"
          size="lg"
          :disabled="busy"
          @click="onConfirm"
        >
          {{ busy ? 'Signing out…' : 'Sign out' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
