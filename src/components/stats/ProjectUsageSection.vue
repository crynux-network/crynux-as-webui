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
import UsageDurationHistogram from '@/components/stats/UsageDurationHistogram.vue'
import { projectsAPI } from '@/api/v1/projects'
import {
  formatCompactCredits,
  formatCompactNumber,
  formatExactCredits,
  formatExactNumber,
  formatStatsAxisTime,
  formatStatsTooltipTime,
  formatSuccessRate,
  statsSeriesPointCount,
} from '@/lib/usage-stats-ui'
import { projectErrorMessage } from '@/lib/project-ui'

const props = defineProps({
  projectId: {
    type: [Number, String],
    required: true,
  },
})

const requestRange = ref('1d')
const tokenRange = ref('1d')
const creditsRange = ref('1d')
const durationRange = ref('1d')
const modelRange = ref('1d')

const statsByRange = ref({})
const loadingStatsRanges = ref({})
const loadingDuration = ref(false)
const loadingModels = ref(false)

const durationStats = ref(null)
const modelStats = ref(null)

function mapRequestPoints(series, range) {
  return (series || []).map((point) => ({
    timestamp: point.timestamp,
    success_count: Number(point.success_count || 0),
    failure_count: Number(point.failure_count || 0),
    complete: Boolean(point.complete),
    label: formatStatsAxisTime(point.timestamp, range),
    tooltipLabel: formatStatsTooltipTime(point.timestamp, range),
  }))
}

function mapCreditsPoints(series, range) {
  return (series || []).map((point) => ({
    timestamp: point.timestamp,
    value: Number(point.value || 0),
    complete: Boolean(point.complete),
    label: formatStatsAxisTime(point.timestamp, range),
    tooltipLabel: formatStatsTooltipTime(point.timestamp, range),
  }))
}

function mapTokenPoints(series, range) {
  return (series || []).map((point) => ({
    timestamp: point.timestamp,
    prompt_tokens: Number(point.prompt_tokens || 0),
    completion_tokens: Number(point.completion_tokens || 0),
    complete: Boolean(point.complete),
    label: formatStatsAxisTime(point.timestamp, range),
    tooltipLabel: formatStatsTooltipTime(point.timestamp, range),
  }))
}

const requestPoints = computed(() =>
  mapRequestPoints(
    statsByRange.value[requestRange.value]?.request_series,
    requestRange.value,
  ),
)

const tokenPoints = computed(() =>
  mapTokenPoints(
    statsByRange.value[tokenRange.value]?.token_series,
    tokenRange.value,
  ),
)

const creditsPoints = computed(() =>
  mapCreditsPoints(
    statsByRange.value[creditsRange.value]?.credits_series,
    creditsRange.value,
  ),
)

const requestSeriesPointCount = computed(() =>
  statsSeriesPointCount(requestRange.value),
)
const tokenSeriesPointCount = computed(() =>
  statsSeriesPointCount(tokenRange.value),
)
const creditsSeriesPointCount = computed(() =>
  statsSeriesPointCount(creditsRange.value),
)

const loadingRequest = computed(
  () =>
    Boolean(loadingStatsRanges.value[requestRange.value]) &&
    !statsByRange.value[requestRange.value],
)
const loadingToken = computed(
  () =>
    Boolean(loadingStatsRanges.value[tokenRange.value]) &&
    !statsByRange.value[tokenRange.value],
)
const loadingCredits = computed(
  () =>
    Boolean(loadingStatsRanges.value[creditsRange.value]) &&
    !statsByRange.value[creditsRange.value],
)

async function loadStatsForRange(range) {
  loadingStatsRanges.value = {
    ...loadingStatsRanges.value,
    [range]: true,
  }
  try {
    const data = await projectsAPI.getStats(props.projectId, range)
    statsByRange.value = {
      ...statsByRange.value,
      [range]: data,
    }
  } catch (e) {
    console.error('Failed to load project chart stats', e)
    toast.error(
      projectErrorMessage(e, 'Could not load usage stats. Please try again later.'),
    )
  } finally {
    loadingStatsRanges.value = {
      ...loadingStatsRanges.value,
      [range]: false,
    }
  }
}

async function ensureStatsRanges(ranges) {
  const unique = [...new Set(ranges)]
  await Promise.all(unique.map((range) => loadStatsForRange(range)))
}

async function loadDuration() {
  loadingDuration.value = true
  try {
    durationStats.value = await projectsAPI.getCompletionDurationStats(
      props.projectId,
      durationRange.value,
    )
  } catch (e) {
    console.error('Failed to load duration stats', e)
    toast.error(
      projectErrorMessage(e, 'Could not load usage stats. Please try again later.'),
    )
  } finally {
    loadingDuration.value = false
  }
}

async function loadModels() {
  loadingModels.value = true
  try {
    modelStats.value = await projectsAPI.getModelStats(props.projectId, modelRange.value)
  } catch (e) {
    console.error('Failed to load model stats', e)
    toast.error(
      projectErrorMessage(e, 'Could not load usage stats. Please try again later.'),
    )
  } finally {
    loadingModels.value = false
  }
}

watch(requestRange, (range) => {
  loadStatsForRange(range)
})
watch(tokenRange, (range) => {
  loadStatsForRange(range)
})
watch(creditsRange, (range) => {
  loadStatsForRange(range)
})
watch(durationRange, loadDuration)
watch(modelRange, loadModels)
watch(
  () => props.projectId,
  () => {
    statsByRange.value = {}
    ensureStatsRanges([
      requestRange.value,
      tokenRange.value,
      creditsRange.value,
    ])
    loadDuration()
    loadModels()
  },
)

onMounted(() => {
  ensureStatsRanges([
    requestRange.value,
    tokenRange.value,
    creditsRange.value,
  ])
  loadDuration()
  loadModels()
})
</script>

<template>
  <section class="mb-8 rounded-xl border border-border px-5 py-5">
    <div class="mb-4">
      <h2 class="text-base font-semibold tracking-tight">Usage</h2>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <div class="min-w-0 rounded-lg border border-border bg-muted/30 px-4 pt-4 pb-2">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div class="text-sm font-medium">Requests</div>
          <Select v-model="requestRange">
            <SelectTrigger class="w-[140px]">
              <SelectValue placeholder="Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">1 day</SelectItem>
              <SelectItem value="1m">1 month</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div
          v-if="loadingRequest"
          class="py-8 text-center text-sm text-muted-foreground"
        >
          Loading…
        </div>
        <UsageLineChart
          v-else
          :points="requestPoints"
          :x-count="requestSeriesPointCount"
          :series="[
            {
              key: 'failure_count',
              label: 'Failure',
              color: 'var(--destructive)',
              fill: 'var(--destructive)',
            },
            {
              key: 'success_count',
              label: 'Success',
              color: 'var(--chart-1)',
              fill: 'var(--chart-1)',
            },
          ]"
        />
      </div>

      <div class="min-w-0 rounded-lg border border-border bg-muted/30 px-4 pt-4 pb-2">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div class="text-sm font-medium">Tokens</div>
          <Select v-model="tokenRange">
            <SelectTrigger class="w-[140px]">
              <SelectValue placeholder="Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">1 day</SelectItem>
              <SelectItem value="1m">1 month</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div
          v-if="loadingToken"
          class="py-8 text-center text-sm text-muted-foreground"
        >
          Loading…
        </div>
        <UsageLineChart
          v-else
          :points="tokenPoints"
          :x-count="tokenSeriesPointCount"
          :series="[
            {
              key: 'prompt_tokens',
              label: 'Input',
              color: 'var(--chart-1)',
              fill: 'var(--chart-1)',
            },
            {
              key: 'completion_tokens',
              label: 'Output',
              color: 'var(--chart-5)',
              fill: 'var(--chart-5)',
            },
          ]"
        />
      </div>
    </div>

    <div class="mt-4 grid gap-4 lg:grid-cols-10">
      <div class="min-w-0 rounded-lg border border-border bg-muted/30 px-4 pt-4 pb-2 lg:col-span-4">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div class="text-sm font-medium">Completion time</div>
          <Select v-model="durationRange">
            <SelectTrigger class="w-[140px]">
              <SelectValue placeholder="Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">1 hour</SelectItem>
              <SelectItem value="1d">1 day</SelectItem>
              <SelectItem value="7d">7 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div
          v-if="loadingDuration && !durationStats"
          class="py-8 text-center text-sm text-muted-foreground"
        >
          Loading…
        </div>
        <UsageDurationHistogram
          v-else
          :buckets="durationStats?.buckets || []"
        />
      </div>

      <div class="min-w-0 overflow-hidden rounded-xl border border-border bg-muted/30 lg:col-span-6">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div class="text-sm font-medium">Top models</div>
          <Select v-model="modelRange">
            <SelectTrigger class="w-[140px]">
              <SelectValue placeholder="Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">1 hour</SelectItem>
              <SelectItem value="1d">1 day</SelectItem>
              <SelectItem value="7d">7 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div
          v-if="loadingModels && !modelStats"
          class="px-4 py-8 text-center text-sm text-muted-foreground"
        >
          Loading…
        </div>
        <div
          v-else-if="!(modelStats?.models || []).length"
          class="px-4 py-8 text-center text-sm text-muted-foreground"
        >
          No calls in the selected range.
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th class="px-4 py-2.5 font-medium">Model</th>
                <th class="px-4 py-2.5 font-medium">Requests</th>
                <th class="px-4 py-2.5 font-medium">Input tokens</th>
                <th class="px-4 py-2.5 font-medium">Output tokens</th>
                <th class="px-4 py-2.5 font-medium">Success rate</th>
                <th class="px-4 py-2.5 font-medium">Credits used</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in modelStats.models"
                :key="`${item.rank}-${item.model}`"
                class="border-t border-border"
              >
                <td class="px-4 py-3 font-medium">{{ item.model || '—' }}</td>
                <td
                  class="px-4 py-3 tabular-nums"
                  :title="formatExactNumber(item.request_count)"
                >
                  {{ formatCompactNumber(item.request_count) }}
                </td>
                <td
                  class="px-4 py-3 tabular-nums"
                  :title="formatExactNumber(item.prompt_tokens)"
                >
                  {{ formatCompactNumber(item.prompt_tokens) }}
                </td>
                <td
                  class="px-4 py-3 tabular-nums"
                  :title="formatExactNumber(item.completion_tokens)"
                >
                  {{ formatCompactNumber(item.completion_tokens) }}
                </td>
                <td class="px-4 py-3 tabular-nums">
                  {{ formatSuccessRate(item.success_rate) }}
                </td>
                <td
                  class="px-4 py-3 tabular-nums"
                  :title="formatExactCredits(item.credits)"
                >
                  {{ formatCompactCredits(item.credits) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="mt-4 min-w-0 rounded-lg border border-border bg-muted/30 px-4 pt-4 pb-2">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div class="text-sm font-medium">Credits used</div>
        <Select v-model="creditsRange">
          <SelectTrigger class="w-[140px]">
            <SelectValue placeholder="Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1d">1 day</SelectItem>
            <SelectItem value="1m">1 month</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div
        v-if="loadingCredits"
        class="py-8 text-center text-sm text-muted-foreground"
      >
        Loading…
      </div>
      <UsageLineChart
        v-else
        :points="creditsPoints"
        :x-count="creditsSeriesPointCount"
        :series="[{ key: 'value', label: 'Credits', color: 'var(--chart-1)', fill: 'var(--chart-1)' }]"
      />
    </div>
  </section>
</template>
