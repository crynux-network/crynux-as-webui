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
        <DialogTitle class="text-xl">Reset invite code</DialogTitle>
        <div class="space-y-3">
          <p class="text-sm leading-relaxed text-muted-foreground">
            Your current referral link will stop working. People who already
            signed up with it stay linked to you.
          </p>
          <p class="text-sm leading-relaxed text-muted-foreground">
            A new invite code and referral link will be created for future
            invites.
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
          {{ busy ? 'Resetting…' : 'Reset invite code' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
