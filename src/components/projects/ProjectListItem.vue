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
  buildProjectListCostLevelHints,
  formatCredits,
  formatKgwei,
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
const elevatedRecentFailureRate = computed(
  () => Boolean(props.project.elevated_recent_failure_rate),
)

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

const autoMaxDisplay = computed(() => {
  const n = Number(props.project.auto_max_credits_per_task)
  if (!(n > 0)) return '—'
  return formatCredits(n)
})

const costLevelDisplay = computed(() => formatKgwei(props.project.priority_gwei))

const lastRequestLabel = computed(() => {
  if (props.project.last_request_at == null) return 'No requests yet'
  return `Last request ${formatRelativeTime(props.project.last_request_at)}`
})

const lastRequestExact = computed(() => {
  if (props.project.last_request_at == null) return ''
  return new Date(Number(props.project.last_request_at) * 1000).toLocaleString()
})

const costLevelHints = computed(() => {
  if (!props.queueConfig) {
    return { lines: [], openSourcePosition: null }
  }
  return buildProjectListCostLevelHints({
    mode: props.project.cost_level_mode,
    priorityGwei: props.project.priority_gwei,
    autoMaxCreditsPerTask: props.project.auto_max_credits_per_task,
    lowestPriorityGwei: props.queueConfig.lowestPriorityGwei,
    highestPriorityGwei: props.queueConfig.highestPriorityGwei,
    medianPriorityGwei: props.queueConfig.medianPriorityGwei,
    providerLowestPriorityGwei: props.queueConfig.providerLowestPriorityGwei,
    providerHighestPriorityGwei: props.queueConfig.providerHighestPriorityGwei,
    providerQueueHasJobs: props.queueConfig.providerQueueHasJobs,
    providerMinPriorityGwei: props.queueConfig.providerMinPriorityGwei,
    providerMinCreditsCheapest: props.queueConfig.providerMinCreditsCheapest,
    providerMinCreditsExpensive: props.queueConfig.providerMinCreditsExpensive,
  })
})

const modeTagText = computed(() => (isAutoMode.value ? 'Auto' : 'Static'))

const modeTagClass = computed(() =>
  isAutoMode.value
    ? 'bg-sky-500/10 text-sky-700 dark:text-sky-400'
    : 'border border-border bg-muted/50 text-foreground',
)

const primaryValueStyle = computed(() => {
  if (isAutoMode.value) return undefined
  const color = costLevelHints.value.openSourcePosition?.color
  return color ? { color } : undefined
})

const primaryValueClass = computed(() => {
  if (isAutoMode.value) return 'text-sky-600 dark:text-sky-400'
  if (costLevelHints.value.openSourcePosition?.color) return undefined
  return 'text-muted-foreground'
})

const costLevelTitle = computed(() => {
  if (isAutoMode.value) {
    return `Auto · Queue position ${autoQueuePosition.value}% · Max Credits ${autoMaxDisplay.value}`
  }
  return `Static · Cost Level ${costLevelDisplay.value} · Max Credits ${autoMaxDisplay.value}`
})

function hintLineClass(line) {
  if (line?.tone === 'ok') {
    return 'text-emerald-700 dark:text-emerald-400'
  }
  if (line?.tone === 'warn') {
    return 'text-amber-700 dark:text-amber-400'
  }
  if (line?.muted || !line?.color) {
    return 'text-muted-foreground'
  }
  return undefined
}

function hintLineStyle(line) {
  if (line?.color && !line?.muted && line?.tone === 'queue') {
    return { color: line.color }
  }
  return undefined
}

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
                class="text-3xl font-semibold tabular-nums tracking-tight"
                :class="elevatedRecentFailureRate
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-muted-foreground'"
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
          <span
            class="rounded-full px-2 py-0.5 text-[11px] font-medium"
            :class="modeTagClass"
          >
            {{ modeTagText }}
          </span>
        </div>

        <div class="mt-4 flex items-end gap-5">
          <div class="min-w-0">
            <p
              class="text-3xl font-semibold tabular-nums tracking-tight"
              :class="primaryValueClass"
              :style="primaryValueStyle"
            >
              <template v-if="isAutoMode">{{ autoQueuePosition }}%</template>
              <template v-else>{{ costLevelDisplay }}</template>
            </p>
            <p class="mt-1 text-xs text-muted-foreground">
              {{ isAutoMode ? 'Queue position' : 'Cost Level' }}
            </p>
          </div>
          <div
            class="mb-1 h-8 w-px shrink-0 bg-border"
            aria-hidden="true"
          />
          <div class="min-w-0">
            <p
              class="text-3xl font-semibold tabular-nums tracking-tight text-foreground/70"
            >
              {{ autoMaxDisplay }}
            </p>
            <p class="mt-1 text-xs text-muted-foreground">
              Max Credits
            </p>
          </div>
        </div>

        <div
          v-if="costLevelHints.lines.length > 0"
          class="mt-3 space-y-1"
        >
          <p
            v-for="(line, index) in costLevelHints.lines"
            :key="`${index}-${line.text}`"
            class="text-xs leading-relaxed"
            :class="hintLineClass(line)"
            :style="hintLineStyle(line)"
          >
            {{ line.text }}
          </p>
        </div>
      </div>
    </div>
  </button>
</template>
