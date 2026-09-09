<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import UsageLineChart from '@/components/stats/UsageLineChart.vue'
import { accountAPI } from '@/api/v1/account'
import {
  formatCompactCredits,
  formatCompactNumber,
  formatExactCredits,
  formatExactNumber,
  formatStatsAxisTime,
  formatSuccessRate,
  statsSeriesPointCount,
} from '@/lib/usage-stats-ui'
import { projectErrorMessage } from '@/lib/project-ui'

const range = ref('1d')
const loading = ref(false)
const stats = ref(null)

const metrics = computed(() => {
  const data = stats.value
  if (!data) {
    return [
      { label: 'Requests', value: '0', exact: '0' },
      { label: 'Input tokens', value: '0', exact: '0' },
      { label: 'Output tokens', value: '0', exact: '0' },
      { label: 'Credits used', value: '0', exact: '0' },
      { label: 'Success rate', value: '0%', exact: '0%' },
    ]
  }
  return [
    {
      label: 'Requests',
      value: formatCompactNumber(data.request_count),
      exact: formatExactNumber(data.request_count),
    },
    {
      label: 'Input tokens',
      value: formatCompactNumber(data.prompt_tokens),
      exact: formatExactNumber(data.prompt_tokens),
    },
    {
      label: 'Output tokens',
      value: formatCompactNumber(data.completion_tokens),
      exact: formatExactNumber(data.completion_tokens),
    },
    {
      label: 'Credits used',
      value: formatCompactCredits(data.credits),
      exact: formatExactCredits(data.credits),
    },
    {
      label: 'Success rate',
      value: formatSuccessRate(data.success_rate),
      exact: formatSuccessRate(data.success_rate),
    },
  ]
})

const requestPoints = computed(() =>
  (stats.value?.requests_series || []).map((point) => ({
    timestamp: point.timestamp,
    value: Number(point.value || 0),
    complete: Boolean(point.complete),
    label: formatStatsAxisTime(point.timestamp, range.value),
  })),
)

const creditsPoints = computed(() =>
  (stats.value?.credits_series || []).map((point) => ({
    timestamp: point.timestamp,
    value: Number(point.value || 0),
    complete: Boolean(point.complete),
    label: formatStatsAxisTime(point.timestamp, range.value),
  })),
)

const seriesPointCount = computed(() => statsSeriesPointCount(range.value))

async function loadStats() {
  loading.value = true
  try {
    stats.value = await accountAPI.getStats(range.value)
  } catch (e) {
    console.error('Failed to load account stats', e)
    toast.error(
      projectErrorMessage(e, 'Could not load usage stats. Please try again later.'),
    )
  } finally {
    loading.value = false
  }
}

watch(range, () => {
  loadStats()
})

onMounted(() => {
  loadStats()
})
</script>

<template>
  <section class="mb-6 rounded-xl border border-border bg-muted/30 px-5 py-5">
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Account usage
      </h2>
      <Select v-model="range">
        <SelectTrigger class="w-[140px]">
          <SelectValue placeholder="Range" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1d">1 day</SelectItem>
          <SelectItem value="7d">7 days</SelectItem>
          <SelectItem value="1m">1 month</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div
      v-if="loading && !stats"
      class="py-8 text-center text-sm text-muted-foreground"
    >
      Loading usage…
    </div>

    <template v-else>
      <div class="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div
          v-for="metric in metrics"
          :key="metric.label"
          class="min-w-0 text-center"
          :title="metric.exact"
        >
          <div class="text-xs uppercase tracking-wide text-muted-foreground">
            {{ metric.label }}
          </div>
          <div class="mt-1 truncate text-2xl font-semibold tabular-nums text-primary">
            {{ metric.value }}
          </div>
        </div>
      </div>

      <div class="mt-10 grid gap-4 lg:grid-cols-2">
        <div class="min-w-0 rounded-lg border border-border bg-background px-4 pt-4 pb-2">
          <div class="mb-2 text-sm font-medium">Requests</div>
          <UsageLineChart
            :points="requestPoints"
            :x-count="seriesPointCount"
            :series="[{ key: 'value', color: 'hsl(var(--primary))', fill: 'hsl(var(--primary))' }]"
          />
        </div>
        <div class="min-w-0 rounded-lg border border-border bg-background px-4 pt-4 pb-2">
          <div class="mb-2 text-sm font-medium">Credits used</div>
          <UsageLineChart
            :points="creditsPoints"
            :x-count="seriesPointCount"
            :series="[{ key: 'value', color: 'hsl(var(--primary))', fill: 'hsl(var(--primary))' }]"
          />
        </div>
      </div>
    </template>
  </section>
</template>
