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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import ProviderIcon from '@/components/earn/ProviderIcon.vue'
import { earnAPI } from '@/api/v1/earn'
import { earnErrorMessage } from '@/lib/earn-ui'

const open = defineModel('open', { type: Boolean, default: false })

const props = defineProps({
  providers: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['created'])

const serviceProvider = ref('')
const apiKey = ref('')
const submitting = ref(false)
const fieldError = ref('')

const canSubmit = computed(
  () =>
    !!serviceProvider.value &&
    !!apiKey.value.trim() &&
    !submitting.value,
)

const selectedProvider = computed(
  () => props.providers.find((p) => p.id === serviceProvider.value) ?? null,
)

function clearSecret() {
  apiKey.value = ''
}

function resetForm() {
  clearSecret()
  fieldError.value = ''
  if (props.providers.length) {
    serviceProvider.value = props.providers[0].id
  } else {
    serviceProvider.value = ''
  }
}

watch(open, (isOpen) => {
  if (isOpen) {
    resetForm()
  } else {
    clearSecret()
    submitting.value = false
  }
})

watch(
  () => props.providers,
  (list) => {
    if (!serviceProvider.value && list.length) {
      serviceProvider.value = list[0].id
    }
  },
  { immediate: true },
)

function preventOutside(event) {
  if (submitting.value) event.preventDefault()
}

async function onSubmit() {
  if (!canSubmit.value) return
  const secret = apiKey.value.trim()
  if (!secret) {
    fieldError.value = 'API key is required.'
    return
  }
  fieldError.value = ''
  submitting.value = true
  try {
    await earnAPI.createKey({
      service_provider: serviceProvider.value,
      api_key: secret,
    })
    clearSecret()
    open.value = false
    emit('created')
  } catch (e) {
    console.error('Failed to create Shared API Key', e)
    clearSecret()
    toast.error(
      earnErrorMessage(e, 'Failed to add Shared API Key. Please try again later.'),
    )
  } finally {
    submitting.value = false
  }
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
        <DialogTitle class="text-xl">Add Shared API Key</DialogTitle>
      </DialogHeader>

      <form class="grid gap-5" @submit.prevent="onSubmit">
        <p class="text-sm leading-relaxed text-muted-foreground">
          Your API key is encrypted before storage, so others cannot steal or
          misuse it.
        </p>

        <div class="grid gap-2.5">
          <Label class="text-sm">Provider</Label>
          <Select v-model="serviceProvider" :disabled="submitting">
            <SelectTrigger class="h-14 w-full px-3.5 text-base data-[size=default]:h-14">
              <SelectValue placeholder="Select provider">
                <span
                  v-if="selectedProvider"
                  class="flex items-center gap-3"
                >
                  <ProviderIcon
                    :provider-id="selectedProvider.id"
                    size="md"
                  />
                  <span>{{ selectedProvider.display_name }}</span>
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent class="min-w-[var(--reka-select-trigger-width)]">
              <SelectItem
                v-for="provider in providers"
                :key="provider.id"
                :value="provider.id"
                :text-value="provider.display_name"
                class="py-3 pl-3 text-base"
              >
                <span class="flex items-center gap-3">
                  <ProviderIcon :provider-id="provider.id" size="md" />
                  <span>{{ provider.display_name }}</span>
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="grid gap-2.5">
          <Label class="text-sm">API Key</Label>
          <Input
            v-model="apiKey"
            type="password"
            autocomplete="off"
            placeholder="Paste your API key"
            :disabled="submitting"
            class="h-11"
          />
          <p v-if="fieldError" class="text-sm text-destructive">
            {{ fieldError }}
          </p>
        </div>

        <DialogFooter>
          <Button
            type="submit"
            class="h-11 w-full"
            :disabled="!canSubmit"
          >
            {{ submitting ? 'Adding…' : 'Add' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
