<script setup>
import { computed } from 'vue'
import {
  modelQuantizationConfig,
  modelReplacedComponents,
  quantizationBitLabel,
} from '@/lib/model-tags'

const props = defineProps({
  model: {
    type: String,
    default: '',
  },
  quantizationConfig: {
    type: [Object, null],
    default: null,
  },
  components: {
    type: [Object, null],
    default: null,
  },
  showTitles: {
    type: Boolean,
    default: true,
  },
})

const quantizationLabel = computed(() =>
  quantizationBitLabel(modelQuantizationConfig({
    quantization_config: props.quantizationConfig,
  })),
)

const componentRepos = computed(() =>
  modelReplacedComponents({
    quantization_config: props.quantizationConfig,
    components: props.components,
  }).map((row) => {
    if (row.quantBitLabel) return `${row.repo}-${row.quantBitLabel}`
    return row.repo
  }),
)
</script>

<template>
  <div class="min-w-0">
    <div class="flex min-w-0 flex-wrap items-center gap-1.5">
      <span
        class="truncate font-medium text-foreground"
        :title="showTitles ? model : undefined"
      >
        {{ model || '—' }}
      </span>
      <span
        class="inline-flex shrink-0 items-center rounded-md border border-border bg-muted/50 px-1.5 py-0 text-[11px] font-medium leading-5 text-muted-foreground"
      >
        {{ quantizationLabel }}
      </span>
    </div>
    <div
      v-if="componentRepos.length > 0"
      class="mt-0.5 space-y-0.5"
    >
      <div
        v-for="repo in componentRepos"
        :key="repo"
        class="truncate text-[11px] leading-4 text-muted-foreground"
        :title="showTitles ? repo : undefined"
      >
        {{ repo }}
      </div>
    </div>
  </div>
</template>
