<script setup>
import { computed } from 'vue'
import {
  formatMinVramLabel,
  modelQuantizationConfig,
  modelReplacedComponents,
  quantizationDisplayLabel,
} from '@/lib/model-tags'

const props = defineProps({
  model: {
    type: Object,
    required: true,
  },
})

const quantLabel = computed(() =>
  quantizationDisplayLabel(modelQuantizationConfig(props.model)),
)

const replacedComponents = computed(() => modelReplacedComponents(props.model))

const vramLabel = computed(() => formatMinVramLabel(props.model?.min_vram))

const nodeCount = computed(() => Number(props.model?.on_disk_node_count) || 0)

const showComponentsSection = computed(
  () => replacedComponents.value.length > 0,
)

function componentRepoLabel(row) {
  if (row.quantBitLabel) return `${row.repo}-${row.quantBitLabel}`
  return row.repo
}
</script>

<template>
  <div class="min-w-0 space-y-2.5">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
        {{ model.id }}
      </div>
      <div class="flex shrink-0 items-start gap-3 text-right">
        <div
          v-if="vramLabel"
          class="min-w-[3.25rem]"
        >
          <div class="text-sm font-semibold tabular-nums text-foreground">
            {{ vramLabel }}
          </div>
          <div class="text-[10px] uppercase tracking-wide text-muted-foreground">
            VRAM
          </div>
        </div>
        <div class="min-w-[2.5rem]">
          <div class="text-sm font-semibold tabular-nums text-foreground">
            {{ nodeCount }}
          </div>
          <div class="text-[10px] uppercase tracking-wide text-muted-foreground">
            nodes
          </div>
        </div>
      </div>
    </div>

    <div class="flex gap-4">
      <div
        class="min-w-0"
        :class="showComponentsSection ? 'flex-1' : 'w-full'"
      >
        <div class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Quantization
        </div>
        <div class="mt-0.5 truncate text-xs font-medium text-foreground">
          {{ quantLabel }}
        </div>
      </div>

      <div
        v-if="showComponentsSection"
        class="min-w-0 flex-1"
      >
        <div class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Components
        </div>
        <div class="mt-0.5 space-y-1">
          <div
            v-for="row in replacedComponents"
            :key="row.name"
            class="truncate text-xs font-medium text-foreground"
          >
            {{ componentRepoLabel(row) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
