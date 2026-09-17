<script setup>
import { computed } from 'vue'
import { ChevronRight } from 'lucide-vue-next'
import {
  formatCompactCredits,
  formatCompactNumber,
  formatExactCredits,
  formatExactNumber,
} from '@/lib/usage-stats-ui'
import {
  formatGwei,
  getProjectQueuePosition,
  normalizeAutoQueuePosition,
} from '@/lib/llm-billing'

const props = defineProps({
  project: {
    type: Object,
    required: true,
  },
  queueConfig: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['open'])

const successCount = computed(() => Number(props.project.success_count_day || 0))
const failureCount = computed(() => Number(props.project.failure_count_day || 0))

const successDisplay = computed(() => formatCompactNumber(successCount.value))
const successExact = computed(() => formatExactNumber(successCount.value))
const failureDisplay = computed(() => formatCompactNumber(failureCount.value))
const failureExact = computed(() => formatExactNumber(failureCount.value))

const creditsDisplay = computed(() =>
  formatCompactCredits(props.project.credits_day || '0'),
)
const creditsExact = computed(() =>
  formatExactCredits(props.project.credits_day || '0'),
)

const isAutoMode = computed(
  () => String(props.project.cost_level_mode || 'static') === 'auto',
)

const autoQueuePosition = computed(() =>
  normalizeAutoQueuePosition(props.project.auto_queue_position, 50),
)

const autoMaxDisplay = computed(() =>
  formatGwei(props.project.auto_max_priority_gwei),
)

const costLevelDisplay = computed(() => {
  if (isAutoMode.value) {
    return `${autoQueuePosition.value}%`
  }
  return formatGwei(props.project.priority_gwei)
})

const lastRequestLabel = computed(() => {
  if (props.project.last_request_at == null) return 'No requests yet'
  return `Last request ${formatRelativeTime(props.project.last_request_at)}`
})

const lastRequestExact = computed(() => {
  if (props.project.last_request_at == null) return ''
  return new Date(Number(props.project.last_request_at) * 1000).toLocaleString()
})

const queuePosition = computed(() => {
  if (isAutoMode.value || !props.queueConfig) return null
  return getProjectQueuePosition({
    priorityGwei: props.project.priority_gwei,
    lowestPriorityGwei: props.queueConfig.lowestPriorityGwei,
    highestPriorityGwei: props.queueConfig.highestPriorityGwei,
    medianPriorityGwei: props.queueConfig.medianPriorityGwei,
  })
})

const modeTagText = computed(() => (isAutoMode.value ? 'Auto' : 'Static'))

const modeTagClass = computed(() =>
  isAutoMode.value
    ? 'bg-sky-500/10 text-sky-700 dark:text-sky-400'
    : 'border border-border bg-muted/50 text-foreground',
)

const queueRangeStatusText = computed(() => {
  if (isAutoMode.value) return null
  const pos = queuePosition.value
  if (!pos) return null
  if (pos.rangeStatus === 'too_low') return 'Too low'
  if (pos.rangeStatus === 'too_high') return 'Too high'
  return 'In range'
})

const queueRangeStatusClass = computed(() => {
  const status = queuePosition.value?.rangeStatus
  if (status === 'too_low' || status === 'too_high') {
    return 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
  }
  return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
})

const costLevelDescription = computed(() => {
  if (isAutoMode.value) {
    const max = autoMaxDisplay.value
    if (max === '—') {
      return `Queue position ${autoQueuePosition.value}%. Set a max Cost Level to use Auto.`
    }
    return `Tracks the live queue at ${autoQueuePosition.value}%, capped at max ${max}.`
  }
  const position = queuePosition.value
  if (!position) return null
  if (position.rangeStatus === 'too_low') {
    return 'Below the current queue range. Requests may wait much longer.'
  }
  if (position.rangeStatus === 'too_high') {
    return 'Above the current queue range. You may be spending more than needed.'
  }
  const descriptions = {
    Slowest: 'Near the queue minimum. Lower cost, with a longer expected wait.',
    Slower: 'Below the middle of the queue. Lower cost, with a longer expected wait.',
    Balanced: 'Near the middle of the queue for a balance of cost and wait time.',
    Faster: 'Above the middle of the queue. Higher cost, with a shorter expected wait.',
    Fastest: 'Near the queue maximum. Highest cost, with the shortest expected wait.',
  }
  return descriptions[position.label] || null
})

const costLevelTitle = computed(() => {
  if (isAutoMode.value) {
    const max = autoMaxDisplay.value
    return max === '—'
      ? `Auto · ${autoQueuePosition.value}%`
      : `Auto · ${autoQueuePosition.value}% · max ${max}`
  }
  const gwei = costLevelDisplay.value
  const status = queueRangeStatusText.value
  if (!status) return `Cost level ${gwei}`
  const position = queuePosition.value?.label
  return `Cost level ${gwei} · ${status}${position ? ` · ${position}` : ''}`
})

function formatRelativeTime(unixSeconds) {
  const then = Number(unixSeconds) * 1000
  if (!Number.isFinite(then)) return '—'
  const diffSec = Math.round((Date.now() - then) / 1000)
  if (diffSec < 0) return new Date(then).toLocaleString()
  if (diffSec < 60) return 'just now'
  if (diffSec < 3600) {
    const m = Math.floor(diffSec / 60)
    return `${m}m ago`
  }
  if (diffSec < 86400) {
    const h = Math.floor(diffSec / 3600)
    return `${h}h ago`
  }
  if (diffSec < 86400 * 7) {
    const d = Math.floor(diffSec / 86400)
    return `${d}d ago`
  }
  return new Date(then).toLocaleDateString()
}
</script>

<template>
  <button
    type="button"
    class="group w-full overflow-hidden rounded-xl border border-border bg-card text-left transition-colors hover:bg-accent/40"
    @click="emit('open', project)"
  >
    <div class="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
      <div class="min-w-0">
        <h2 class="truncate text-base font-semibold tracking-tight text-foreground">
          {{ project.name }}
        </h2>
        <p
          class="mt-1 text-xs text-muted-foreground"
          :title="lastRequestExact || undefined"
        >
          {{ lastRequestLabel }}
        </p>
      </div>
      <ChevronRight
        class="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
      />
    </div>

    <div class="grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div
        class="grid gap-4 p-5 sm:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] sm:items-stretch"
      >
        <div class="min-w-0 rounded-lg bg-muted/50 px-4 py-3">
          <p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Requests today
          </p>
          <div class="mt-3 flex items-end gap-5">
            <div class="min-w-0" :title="successExact">
              <p
                class="text-3xl font-semibold tabular-nums tracking-tight text-sky-600 dark:text-sky-400"
              >
                {{ successDisplay }}
              </p>
              <p class="mt-1 text-xs text-muted-foreground">Success</p>
            </div>
            <div
              class="mb-1 h-8 w-px shrink-0 bg-border"
              aria-hidden="true"
            />
            <div class="min-w-0" :title="failureExact">
              <p
                class="text-3xl font-semibold tabular-nums tracking-tight text-red-600 dark:text-red-400"
              >
                {{ failureDisplay }}
              </p>
              <p class="mt-1 text-xs text-muted-foreground">Failed</p>
            </div>
          </div>
        </div>

        <div
          class="flex min-w-0 flex-col justify-center border-t border-border pt-4 sm:border-t-0 sm:border-l sm:pl-5 sm:pt-0"
          :title="creditsExact"
        >
          <p
            class="text-3xl font-semibold tabular-nums tracking-tight text-foreground/70"
          >
            {{ creditsDisplay }}
          </p>
          <p class="mt-1 text-xs text-muted-foreground">
            Credits used today
          </p>
        </div>
      </div>

      <div
        class="min-w-0 border-t border-border bg-muted/25 px-5 py-4 md:border-t-0 md:border-l"
        :title="costLevelTitle"
      >
        <div class="flex items-center justify-between gap-3">
          <p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Cost level
          </p>
          <div class="flex shrink-0 items-center gap-1.5">
            <span
              class="rounded-full px-2 py-0.5 text-[11px] font-medium"
              :class="modeTagClass"
            >
              {{ modeTagText }}
            </span>
            <span
              v-if="queueRangeStatusText"
              class="rounded-full px-2 py-0.5 text-[11px] font-medium"
              :class="queueRangeStatusClass"
            >
              {{ queueRangeStatusText }}
            </span>
          </div>
        </div>

        <div class="mt-4">
          <p
            class="text-4xl font-semibold tabular-nums tracking-tight"
            :style="!isAutoMode && queuePosition ? { color: queuePosition.color } : undefined"
            :class="!isAutoMode && queuePosition ? undefined : 'text-muted-foreground'"
          >
            {{ costLevelDisplay }}
          </p>
        </div>

        <template v-if="isAutoMode">
          <p class="mt-3 text-sm font-medium text-foreground">
            Queue position
          </p>
          <p class="mt-1 text-xs leading-relaxed text-muted-foreground">
            Max {{ autoMaxDisplay }}
          </p>
          <p
            v-if="costLevelDescription"
            class="mt-1 text-xs leading-relaxed text-muted-foreground"
          >
            {{ costLevelDescription }}
          </p>
        </template>
        <template v-else>
          <p
            v-if="queuePosition?.label"
            class="mt-3 text-sm font-medium text-foreground"
          >
            {{ queuePosition.label }}
          </p>
          <p
            v-if="costLevelDescription"
            class="mt-1 text-xs leading-relaxed text-muted-foreground"
          >
            {{ costLevelDescription }}
          </p>
        </template>
      </div>
    </div>
  </button>
</template>
