<script setup>
import { computed } from 'vue'
import { formatCredits, formatTokenCount } from '@/lib/llm-billing'

const props = defineProps({
  taskType: {
    type: String,
    default: 'llm',
  },
  promptTokens: {
    type: [Number, null],
    default: null,
  },
  completionTokens: {
    type: [Number, null],
    default: null,
  },
  imageWidth: {
    type: [Number, null],
    default: null,
  },
  imageHeight: {
    type: [Number, null],
    default: null,
  },
  imageSteps: {
    type: [Number, null],
    default: null,
  },
  imageCount: {
    type: [Number, null],
    default: null,
  },
  /** request: Size/Steps; top-models: image count only */
  variant: {
    type: String,
    default: 'request',
  },
})

const isImage = computed(() => props.taskType === 'image')

const sizeLabel = computed(() => {
  const w = Number(props.imageWidth)
  const h = Number(props.imageHeight)
  if (!(w > 0) || !(h > 0)) return ''
  return `${Math.trunc(w)}×${Math.trunc(h)}`
})

const stepsLabel = computed(() => {
  const steps = Number(props.imageSteps)
  if (!(steps > 0)) return ''
  const count = Number(props.imageCount)
  if (count > 1) return `${formatTokenCount(steps)} steps ×${formatTokenCount(count)}`
  return `${formatTokenCount(steps)} steps`
})

const imageCountLabel = computed(() => {
  const n = Number(props.imageCount)
  if (!(n > 0)) return ''
  return formatCredits(n)
})
</script>

<template>
  <div class="min-w-0 leading-tight">
    <template v-if="isImage && variant === 'top-models'">
      <template v-if="imageCountLabel">
        <div class="tabular-nums text-foreground">{{ imageCountLabel }}</div>
        <div class="text-[11px] text-muted-foreground">images</div>
      </template>
      <span v-else class="text-muted-foreground">—</span>
    </template>
    <template v-else-if="isImage">
      <template v-if="sizeLabel || stepsLabel">
        <div
          v-if="sizeLabel"
          class="tabular-nums text-foreground"
        >
          {{ sizeLabel }}
        </div>
        <div
          v-if="stepsLabel"
          class="text-[11px] text-muted-foreground"
        >
          {{ stepsLabel }}
        </div>
      </template>
      <span v-else class="text-muted-foreground">—</span>
    </template>
    <template v-else>
      <template v-if="promptTokens != null || completionTokens != null">
        <div class="flex items-baseline gap-1.5 tabular-nums">
          <span class="text-foreground">{{ formatCredits(promptTokens || 0) }}</span>
          <span class="text-[11px] text-muted-foreground">tokens in</span>
        </div>
        <div class="flex items-baseline gap-1.5 tabular-nums">
          <span class="text-foreground">{{ formatCredits(completionTokens || 0) }}</span>
          <span class="text-[11px] text-muted-foreground">tokens out</span>
        </div>
      </template>
      <span v-else class="text-muted-foreground">—</span>
    </template>
  </div>
</template>
