<script setup>
import { computed, ref, watch } from 'vue'
import { ChevronsUpDown } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import ModelSummary from '@/components/projects/playground/ModelSummary.vue'
import {
  normalizeHuggingFaceModelID,
  validateHuggingFaceModelID,
} from '@/lib/huggingface-model-id'
import {
  catalogToModelSelection,
  modelExecutionDtype,
  modelQuantizationConfig,
  modelReplacedComponents,
  modelSelectionKey,
  quantizationTagLabel,
} from '@/lib/model-tags'

const DEFAULT_CUSTOM_VRAM = 24

const props = defineProps({
  models: {
    type: Array,
    default: () => [],
  },
  modelValue: {
    type: Object,
    default: null,
  },
  mode: {
    type: String,
    required: true,
    validator: (value) => value === 'chat' || value === 'image',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const query = ref('')
const customVram = ref(String(DEFAULT_CUSTOM_VRAM))
const customError = ref('')

const filteredModels = computed(() => {
  const q = query.value.trim().toLowerCase()
  const matched = !q
    ? [...props.models]
    : props.models.filter((model) => {
        const id = String(model.id || '').toLowerCase()
        const dtype = modelExecutionDtype(model)
        const quantLabel = quantizationTagLabel(
          modelQuantizationConfig(model),
        ).toLowerCase()
        const componentMatched = modelReplacedComponents(model).some((row) => {
          const name = row.name.toLowerCase()
          const repo = row.repo.toLowerCase()
          const bit = row.quantBitLabel
            ? `-${row.quantBitLabel}`.toLowerCase()
            : ''
          return (
            name.includes(q) ||
            repo.includes(q) ||
            `${repo}${bit}`.includes(q)
          )
        })
        return (
          id.includes(q) ||
          dtype.includes(q) ||
          quantLabel.includes(q) ||
          componentMatched
        )
      })

  if (!q && props.modelValue?.id && !props.modelValue.isCustom) {
    const selectedIndex = matched.findIndex((model) => isSelected(model))
    if (selectedIndex > 0) {
      const [selected] = matched.splice(selectedIndex, 1)
      matched.unshift(selected)
    }
  }
  return matched
})

const showCustomOption = computed(() => {
  const q = query.value.trim()
  return Boolean(q) && filteredModels.value.length === 0
})

function prefillDialogFromSelection() {
  customError.value = ''
  const selected = props.modelValue
  customVram.value = String(DEFAULT_CUSTOM_VRAM)
  if (!selected?.id) {
    query.value = ''
    return
  }
  if (selected.isCustom) {
    query.value = selected.id
    customVram.value = String(
      Number(selected.min_vram) > 0 ? Number(selected.min_vram) : DEFAULT_CUSTOM_VRAM,
    )
    return
  }
  query.value = ''
}

watch(open, (isOpen) => {
  if (isOpen) {
    prefillDialogFromSelection()
  }
})

function isSelected(model) {
  if (!props.modelValue || props.modelValue.isCustom) return false
  return (
    modelSelectionKey(props.modelValue) ===
    modelSelectionKey(catalogToModelSelection(model))
  )
}

function selectCatalogModel(model) {
  emit('update:modelValue', catalogToModelSelection(model))
  open.value = false
}

function confirmCustomModel() {
  const idError = validateHuggingFaceModelID(query.value)
  if (idError) {
    customError.value = idError
    return
  }
  const vram = Number(customVram.value)
  if (!Number.isInteger(vram) || vram <= 0) {
    customError.value = 'VRAM must be a positive integer.'
    return
  }
  customError.value = ''
  emit('update:modelValue', {
    id: normalizeHuggingFaceModelID(query.value),
    min_vram: vram,
    on_disk_node_count: 0,
    execution_dtype: '',
    quantization_config: null,
    isCustom: true,
  })
  open.value = false
}

function openPicker() {
  if (props.disabled || props.loading) return
  open.value = true
}
</script>

<template>
  <div class="space-y-2">
    <Label>Model</Label>
    <button
      type="button"
      class="flex w-full max-w-xl items-start justify-between gap-3 rounded-lg border border-input bg-transparent px-3 py-3 text-left transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
      :disabled="disabled || loading"
      @click="openPicker"
    >
      <div
        v-if="loading"
        class="text-sm text-muted-foreground"
      >
        Loading models…
      </div>
      <div
        v-else-if="!modelValue"
        class="text-sm text-muted-foreground"
      >
        Select a model
      </div>
      <ModelSummary
        v-else
        class="min-w-0 flex-1"
        :model="modelValue"
      />
      <ChevronsUpDown class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
    </button>

    <Dialog v-model:open="open">
      <DialogContent class="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Select model</DialogTitle>
          <DialogDescription>
            Search the catalog or enter a Hugging Face model id such as
            org/model-name. URLs are not allowed.
          </DialogDescription>
        </DialogHeader>

        <div class="grid gap-3">
          <div class="grid gap-2">
            <Label for="playground-model-search">Model</Label>
            <Input
              id="playground-model-search"
              v-model="query"
              autocomplete="off"
              placeholder="Search or enter org/model-name"
            />
          </div>

          <div
            class="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-border p-2"
          >
            <button
              v-for="model in filteredModels"
              :key="modelSelectionKey(catalogToModelSelection(model))"
              type="button"
              class="w-full rounded-md border px-3 py-2.5 text-left transition-colors"
              :class="
                isSelected(model)
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                  : 'border-transparent hover:bg-muted/50'
              "
              @click="selectCatalogModel(model)"
            >
              <ModelSummary :model="model" />
            </button>

            <div
              v-if="showCustomOption"
              class="space-y-3 rounded-md border border-dashed border-border bg-muted/20 px-3 py-3"
            >
              <div class="space-y-1">
                <p class="text-sm font-semibold text-foreground">
                  Use custom model
                </p>
                <p class="truncate text-sm text-muted-foreground">
                  {{ query.trim() }}
                </p>
              </div>

              <div class="grid gap-2">
                <Label for="playground-custom-vram">VRAM (GB)</Label>
                <Input
                  id="playground-custom-vram"
                  v-model="customVram"
                  type="number"
                  min="1"
                  step="1"
                  autocomplete="off"
                />
              </div>

              <p
                v-if="customError"
                class="text-sm text-destructive"
              >
                {{ customError }}
              </p>

              <DialogFooter class="sm:justify-start">
                <Button
                  type="button"
                  @click="confirmCustomModel"
                >
                  Use this model
                </Button>
              </DialogFooter>
            </div>

            <p
              v-else-if="filteredModels.length === 0"
              class="px-2 py-6 text-center text-sm text-muted-foreground"
            >
              No models available.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
