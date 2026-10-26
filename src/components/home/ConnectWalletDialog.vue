<script setup>
import { ref, watch } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { readStoredInviteCode, storeInviteCode } from '@/lib/referral'

const open = defineModel('open', { type: Boolean, default: false })
const props = defineProps({
  step: {
    type: String,
    default: 'connect',
    validator: (value) => value === 'connect' || value === 'sign',
  },
  busy: {
    type: Boolean,
    default: false,
  },
})
const emit = defineEmits(['connect'])

const inviteCode = ref('')

watch(open, (isOpen) => {
  if (!isOpen) return
  if (props.step === 'connect') {
    inviteCode.value = readStoredInviteCode()
  }
})

function preventDefault(event) {
  event.preventDefault()
}

function onEscapeKeyDown(event) {
  if (props.step === 'sign') {
    event.preventDefault()
  }
}

function onConnect() {
  if (props.busy || props.step !== 'connect') return
  storeInviteCode(inviteCode.value)
  emit('connect', String(inviteCode.value || '').trim())
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="gap-6 p-6 sm:max-w-lg"
      :show-close-button="step === 'connect'"
      @pointer-down-outside="preventDefault"
      @interact-outside="preventDefault"
      @escape-key-down="onEscapeKeyDown"
      @open-auto-focus="preventDefault"
    >
      <DialogHeader class="gap-4 text-left sm:text-left">
        <DialogTitle class="text-xl">
          {{ step === 'sign' ? 'Sign message' : 'Connect wallet' }}
        </DialogTitle>
        <div class="space-y-3">
          <p class="text-sm text-muted-foreground">
            {{
              step === 'sign'
                ? 'Please sign the message in the wallet popup.'
                : 'Please connect in the wallet popup.'
            }}
          </p>
          <p
            class="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm font-medium leading-relaxed text-green-700 dark:text-green-300"
          >
            <template v-if="step === 'sign'">
              We will not ask for a transfer, token approval, or any other
              on-chain permission. Signing only proves you own this wallet.
            </template>
            <template v-else>
              We will not ask for a transfer, token approval, or any other
              on-chain permission. Connecting only shares your wallet address.
            </template>
          </p>
        </div>
      </DialogHeader>

      <div
        v-if="step === 'sign'"
        class="flex flex-col items-center justify-center gap-3 py-4"
      >
        <Loader2
          class="size-12 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
        <p class="text-sm text-muted-foreground">
          Waiting for wallet signature…
        </p>
      </div>

      <div v-if="step === 'connect'" class="grid gap-1.5">
        <Label
          for="invite-code"
          class="text-xs font-normal text-muted-foreground"
        >
          Invite code (optional)
        </Label>
        <Input
          id="invite-code"
          v-model="inviteCode"
          autocomplete="off"
          spellcheck="false"
          placeholder="Only if you have one"
          class="h-9 border-border/60 bg-muted/20 text-sm text-muted-foreground placeholder:text-muted-foreground/70"
        />
      </div>

      <DialogFooter v-if="step === 'connect'" class="sm:justify-stretch">
        <Button
          type="button"
          class="w-full sm:w-full"
          size="lg"
          :disabled="busy"
          @click="onConnect"
        >
          Connect
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
