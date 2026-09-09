<script setup>
import { computed, ref } from 'vue'
import { useElementSize } from '@vueuse/core'

const props = defineProps({
  buckets: {
    type: Array,
    default: () => [],
  },
  height: {
    type: Number,
    default: 220,
  },
})

const root = ref(null)
const { width: containerWidth } = useElementSize(root)

const emptyYMax = 10
const padding = { top: 12, right: 16, bottom: 52, left: 44 }

const emptyBuckets = [
  { bucket_index: 0, bucket_label: '0-250ms', request_count: 0 },
  { bucket_index: 1, bucket_label: '250-500ms', request_count: 0 },
  { bucket_index: 2, bucket_label: '500ms-1s', request_count: 0 },
  { bucket_index: 3, bucket_label: '1-2s', request_count: 0 },
  { bucket_index: 4, bucket_label: '2-5s', request_count: 0 },
  { bucket_index: 5, bucket_label: '5-10s', request_count: 0 },
  { bucket_index: 6, bucket_label: '10-30s', request_count: 0 },
  { bucket_index: 7, bucket_label: '30-60s', request_count: 0 },
  { bucket_index: 8, bucket_label: '1-2min', request_count: 0 },
  { bucket_index: 9, bucket_label: '2-5min', request_count: 0 },
  { bucket_index: 10, bucket_label: '5-10min', request_count: 0 },
  { bucket_index: 11, bucket_label: '10min+', request_count: 0 },
]

function niceIntegerMax(rawMax) {
  if (!Number.isFinite(rawMax) || rawMax <= 0) return emptyYMax
  const target = Math.ceil(rawMax)
  if (target <= 1) return 1
  const magnitude = 10 ** Math.floor(Math.log10(target))
  const normalized = target / magnitude
  let nice
  if (normalized <= 1) nice = 1
  else if (normalized <= 2) nice = 2
  else if (normalized <= 5) nice = 5
  else nice = 10
  return nice * magnitude
}

function integerTicks(max) {
  const tickCount = Math.min(max, 5)
  const step = Math.max(1, Math.ceil(max / tickCount))
  const ticks = []
  for (let value = 0; value < max; value += step) {
    ticks.push(value)
  }
  if (ticks[ticks.length - 1] !== max) {
    ticks.push(max)
  }
  return ticks
}

const chart = computed(() => {
  const buckets = (props.buckets || []).length > 0 ? props.buckets : emptyBuckets
  const width = Math.max(1, Math.floor(containerWidth.value || 0))
  const height = props.height
  const rawMax = Math.max(0, ...buckets.map((b) => Number(b.request_count || 0)))
  const max = niceIntegerMax(rawMax)
  const innerW = Math.max(1, width - padding.left - padding.right)
  const innerH = height - padding.top - padding.bottom
  const gap = 4
  const barW = buckets.length > 0 ? (innerW - gap * (buckets.length - 1)) / buckets.length : innerW

  const bars = buckets.map((bucket, idx) => {
    const value = Number(bucket.request_count || 0)
    const barH = (value / max) * innerH
    const x = padding.left + idx * (barW + gap)
    const y = padding.top + innerH - barH
    return {
      key: bucket.bucket_index ?? idx,
      x,
      y,
      width: barW,
      height: barH,
      label: bucket.bucket_label || '',
      value,
      labelX: x + barW / 2,
      labelY: padding.top + innerH + 10,
    }
  })

  const yTicks = integerTicks(max)
  const yLabels = yTicks.map((value) => ({
    y: padding.top + innerH - (value / max) * innerH,
    text: String(value),
  }))

  const xGrid = bars.map((bar) => bar.x + bar.width / 2)

  return {
    width,
    height,
    bars,
    yLabels,
    xGrid,
    yGrid: yLabels.map((label) => label.y),
    denseXLabels: bars.length > 8,
    axis: {
      x1: padding.left,
      y1: padding.top,
      x2: padding.left + innerW,
      y2: padding.top + innerH,
    },
  }
})
</script>

<template>
  <div
    ref="root"
    class="w-full min-w-0"
    :style="{ minHeight: `${chart.height}px` }"
  >
    <svg
      v-if="chart.width > 0"
      :viewBox="`0 0 ${chart.width} ${chart.height}`"
      class="block w-full"
      :style="{ height: `${chart.height}px` }"
      role="img"
    >
      <g class="stroke-border" opacity="0.45">
        <line
          v-for="(x, idx) in chart.xGrid"
          :key="`vx-${idx}`"
          :x1="x"
          :y1="chart.axis.y1"
          :x2="x"
          :y2="chart.axis.y2"
          stroke-width="1"
        />
        <line
          v-for="(y, idx) in chart.yGrid"
          :key="`hy-${idx}`"
          :x1="chart.axis.x1"
          :y1="y"
          :x2="chart.axis.x2"
          :y2="y"
          stroke-width="1"
        />
      </g>
      <line
        :x1="chart.axis.x1"
        :y1="chart.axis.y1"
        :x2="chart.axis.x1"
        :y2="chart.axis.y2"
        class="stroke-border"
        stroke-width="1"
      />
      <line
        :x1="chart.axis.x1"
        :y1="chart.axis.y2"
        :x2="chart.axis.x2"
        :y2="chart.axis.y2"
        class="stroke-border"
        stroke-width="1"
      />
      <rect
        v-for="bar in chart.bars"
        :key="`bar-${bar.key}`"
        :x="bar.x"
        :y="bar.y"
        :width="bar.width"
        :height="bar.height"
        class="fill-primary"
        opacity="0.8"
      >
        <title>{{ bar.label }}: {{ bar.value }}</title>
      </rect>
      <g
        v-for="label in chart.yLabels"
        :key="`y-${label.y}-${label.text}`"
      >
        <text
          :x="padding.left - 8"
          :y="label.y + 3"
          text-anchor="end"
          class="fill-muted-foreground text-[10px]"
        >
          {{ label.text }}
        </text>
      </g>
      <g
        v-for="(bar, idx) in chart.bars"
        :key="`x-${idx}`"
      >
        <text
          :x="bar.labelX"
          :y="bar.labelY"
          :text-anchor="chart.denseXLabels ? 'end' : 'middle'"
          :transform="chart.denseXLabels ? `rotate(-60 ${bar.labelX} ${bar.labelY})` : undefined"
          class="fill-muted-foreground text-[9px]"
        >
          {{ bar.label }}
        </text>
      </g>
    </svg>
  </div>
</template>
