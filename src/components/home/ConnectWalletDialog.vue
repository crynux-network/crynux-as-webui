<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
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
import config from '@/config.json'
import { loadTurnstile } from '@/lib/turnstile'
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
const turnstileToken = ref('')
const turnstileReady = ref(false)
const turnstileError = ref(false)
const turnstileContainer = ref(null)

const siteKey = computed(() => String(config.turnstile_site_key || '').trim())
const canConnect = computed(
  () =>
    !props.busy &&
    props.step === 'connect' &&
    turnstileReady.value &&
    !!turnstileToken.value,
)

let widgetId = null

async function mountTurnstile() {
  turnstileToken.value = ''
  turnstileReady.value = false
  turnstileError.value = false

  if (!siteKey.value) {
    turnstileError.value = true
    console.error('Missing turnstile_site_key in config.json')
    return
  }

  await nextTick()
  if (!turnstileContainer.value) return

  try {
    const turnstile = await loadTurnstile()
    if (widgetId != null) {
      turnstile.remove(widgetId)
      widgetId = null
    }
    turnstileContainer.value.innerHTML = ''
    widgetId = turnstile.render(turnstileContainer.value, {
      sitekey: siteKey.value,
      callback: (token) => {
        turnstileToken.value = token
        turnstileReady.value = true
        turnstileError.value = false
      },
      'expired-callback': () => {
        turnstileToken.value = ''
        turnstileReady.value = false
      },
      'error-callback': () => {
        turnstileToken.value = ''
        turnstileReady.value = false
        turnstileError.value = true
      },
    })
  } catch (e) {
    console.error('Turnstile mount error:', e)
    turnstileError.value = true
  }
}

function resetTurnstile() {
  turnstileToken.value = ''
  turnstileReady.value = false
  if (widgetId == null || typeof window === 'undefined' || !window.turnstile) {
    return
  }
  try {
    window.turnstile.reset(widgetId)
  } catch (e) {
    console.error('Turnstile reset error:', e)
  }
}

function removeTurnstile() {
  if (widgetId != null && typeof window !== 'undefined' && window.turnstile) {
    try {
      window.turnstile.remove(widgetId)
    } catch (e) {
      console.error('Turnstile remove error:', e)
    }
  }
  widgetId = null
  turnstileToken.value = ''
  turnstileReady.value = false
  if (turnstileContainer.value) {
    turnstileContainer.value.innerHTML = ''
  }
}

watch(
  () => [open.value, props.step],
  async ([isOpen, step]) => {
    if (!isOpen) {
      removeTurnstile()
      return
    }
    if (step === 'connect') {
      inviteCode.value = readStoredInviteCode()
      await mountTurnstile()
    }
  },
)

onBeforeUnmount(() => {
  removeTurnstile()
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
  if (!canConnect.value) return
  storeInviteCode(inviteCode.value)
  emit('connect', {
    inviteCode: String(inviteCode.value || '').trim(),
    turnstileToken: turnstileToken.value,
  })
  resetTurnstile()
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

      <div v-if="step === 'connect'" class="grid gap-4">
        <div class="grid gap-1.5">
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

        <div class="grid gap-1.5">
          <div ref="turnstileContainer" class="min-h-[65px]" />
          <p
            v-if="turnstileError"
            class="text-xs text-muted-foreground"
          >
            Security check failed to load. Please try again later.
          </p>
        </div>
      </div>

      <DialogFooter v-if="step === 'connect'" class="sm:justify-stretch">
        <Button
          type="button"
          class="w-full sm:w-full"
          size="lg"
          :disabled="!canConnect"
          @click="onConnect"
        >
          Connect
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
