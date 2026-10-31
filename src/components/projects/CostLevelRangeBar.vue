<script setup>
import { computed } from 'vue'

const props = defineProps({
  bar: {
    type: Object,
    default: null,
  },
  minLabel: {
    type: String,
    required: true,
  },
  maxLabel: {
    type: String,
    required: true,
  },
  emptyLabel: {
    type: String,
    default: 'Queue empty',
  },
  markerPercent: {
    type: Number,
    default: null,
  },
  markerLabel: {
    type: String,
    default: '',
  },
  markers: {
    type: Array,
    default: () => [],
  },
})

const resolvedMarkers = computed(() => {
  if (Array.isArray(props.markers) && props.markers.length > 0) {
    return props.markers.filter(
      (marker) => marker != null && Number(marker.percent) >= 0,
    )
  }
  if (props.markerPercent == null) return []
  return [
    {
      percent: props.markerPercent,
      label: props.markerLabel || '',
      title: undefined,
    },
  ]
})

const redUntilPercent = computed(() => {
  const markers = resolvedMarkers.value
  if (markers.length === 0) return null
  return Math.min(...markers.map((marker) => Number(marker.percent)))
})

const tickPercents = computed(() => {
  const seen = new Set()
  const percents = []
  for (const marker of resolvedMarkers.value) {
    const key = String(marker.percent)
    if (seen.has(key)) continue
    seen.add(key)
    percents.push(Number(marker.percent))
  }
  return percents
})

const labelGroups = computed(() => {
  const groups = []
  const byPercent = new Map()
  for (const marker of resolvedMarkers.value) {
    if (!marker.label) continue
    const key = String(marker.percent)
    if (!byPercent.has(key)) {
      const group = {
        percent: Number(marker.percent),
        labels: [],
      }
      byPercent.set(key, group)
      groups.push(group)
    }
    byPercent.get(key).labels.push({
      text: marker.label,
      title: marker.title,
    })
  }
  return groups
})

const labelRowHeightClass = computed(() => {
  const maxLabels = labelGroups.value.reduce(
    (max, group) => Math.max(max, group.labels.length),
    0,
  )
  if (maxLabels >= 2) return 'h-7'
  if (maxLabels === 1) return 'h-2.5'
  return 'h-0'
})
</script>

<template>
  <div class="relative w-full" aria-hidden="true">
    <div v-if="bar" class="relative mb-3 h-2.5">
      <span
        class="absolute top-0 -translate-x-full whitespace-nowrap pr-1 text-[10px] leading-none text-muted-foreground"
        :style="{ left: `${bar.minPercent}%` }"
      >
        {{ minLabel }}
      </span>
      <span
        class="absolute top-0 whitespace-nowrap pl-1 text-[10px] leading-none text-muted-foreground"
        :style="{ left: `${bar.maxPercent}%` }"
      >
        {{ maxLabel }}
      </span>
    </div>
    <div class="relative h-3">
      <template v-if="bar">
        <div
          class="absolute inset-x-0 top-0 h-3 overflow-hidden rounded-full bg-red-500"
        >
          <div
            v-if="!bar.outOfRange"
            class="absolute inset-y-0 bg-blue-500"
            :style="{
              left: `${bar.blueLeft}%`,
              width: `${Math.max(bar.blueWidth, 0.5)}%`,
            }"
          />
        </div>
        <div
          class="absolute bottom-full h-2 w-0 -translate-x-1/2"
          :style="{ left: `${bar.minPercent}%` }"
        >
          <div class="mx-auto h-full w-0.5 bg-foreground/80" />
        </div>
        <div
          class="absolute bottom-full h-2 w-0 -translate-x-1/2"
          :style="{ left: `${bar.maxPercent}%` }"
        >
          <div class="mx-auto h-full w-0.5 bg-foreground/80" />
        </div>
      </template>
      <div
        v-else
        class="absolute inset-x-0 top-0 h-3 overflow-hidden rounded-full bg-muted-foreground/25"
      />
      <div
        v-if="redUntilPercent != null"
        class="absolute inset-y-0 left-0 overflow-hidden rounded-l-full bg-red-500"
        :style="{
          width: `${Math.max(redUntilPercent, 0)}%`,
          borderTopRightRadius: redUntilPercent >= 100 ? '9999px' : '0',
          borderBottomRightRadius: redUntilPercent >= 100 ? '9999px' : '0',
        }"
      />
      <div
        v-if="!bar && emptyLabel"
        class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
      >
        <span class="px-2 text-[10px] leading-none text-muted-foreground">
          {{ emptyLabel }}
        </span>
      </div>
      <div
        v-for="percent in tickPercents"
        :key="`tick-${percent}`"
        class="absolute top-full z-20 h-2 w-0 -translate-x-1/2"
        :style="{ left: `${percent}%` }"
      >
        <div class="mx-auto h-full w-0.5 bg-violet-500/80" />
      </div>
    </div>
    <div
      v-if="labelGroups.length > 0"
      class="relative mt-3"
      :class="labelRowHeightClass"
    >
      <div
        v-for="group in labelGroups"
        :key="`label-group-${group.percent}`"
        class="absolute top-0 flex -translate-x-1/2 flex-col items-center gap-0.5"
        :style="{ left: `${group.percent}%` }"
      >
        <span
          v-for="(label, index) in group.labels"
          :key="`label-${group.percent}-${index}`"
          class="whitespace-nowrap text-[10px] leading-none text-violet-500/80"
          :title="label.title"
        >
          {{ label.text }}
        </span>
      </div>
    </div>
  </div>
</template>
