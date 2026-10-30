<script setup>
defineProps({
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
        v-if="markerPercent != null"
        class="absolute inset-y-0 left-0 overflow-hidden rounded-l-full bg-red-500"
        :style="{
          width: `${Math.max(markerPercent, 0)}%`,
          borderTopRightRadius: markerPercent >= 100 ? '9999px' : '0',
          borderBottomRightRadius: markerPercent >= 100 ? '9999px' : '0',
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
        v-if="markerPercent != null"
        class="absolute top-full z-20 h-2 w-0 -translate-x-1/2"
        :style="{ left: `${markerPercent}%` }"
      >
        <div class="mx-auto h-full w-0.5 bg-violet-500/80" />
      </div>
    </div>
    <div
      v-if="markerPercent != null && markerLabel"
      class="relative mt-3 h-2.5"
    >
      <span
        class="absolute top-0 -translate-x-1/2 whitespace-nowrap text-[10px] leading-none text-violet-500/80"
        :style="{ left: `${markerPercent}%` }"
      >
        {{ markerLabel }}
      </span>
    </div>
  </div>
</template>
