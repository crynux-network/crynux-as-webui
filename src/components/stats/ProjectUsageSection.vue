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

const chartRange = ref('1d')
const durationRange = ref('1d')
const modelRange = ref('1d')

const loadingCharts = ref(false)
const loadingDuration = ref(false)
const loadingModels = ref(false)

const chartStats = ref(null)
const durationStats = ref(null)
const modelStats = ref(null)

const requestPoints = computed(() =>
  (chartStats.value?.request_series || []).map((point) => ({
    timestamp: point.timestamp,
    success_count: Number(point.success_count || 0),
    failure_count: Number(point.failure_count || 0),
    complete: Boolean(point.complete),
    label: formatStatsAxisTime(point.timestamp, chartRange.value),
  })),
)

const creditsPoints = computed(() =>
  (chartStats.value?.credits_series || []).map((point) => ({
    timestamp: point.timestamp,
    value: Number(point.value || 0),
    complete: Boolean(point.complete),
    label: formatStatsAxisTime(point.timestamp, chartRange.value),
  })),
)

const tokenPoints = computed(() =>
  (chartStats.value?.token_series || []).map((point) => ({
    timestamp: point.timestamp,
    prompt_tokens: Number(point.prompt_tokens || 0),
    completion_tokens: Number(point.completion_tokens || 0),
    complete: Boolean(point.complete),
    label: formatStatsAxisTime(point.timestamp, chartRange.value),
  })),
)

const seriesPointCount = computed(() => statsSeriesPointCount(chartRange.value))

async function loadCharts() {
  loadingCharts.value = true
  try {
    chartStats.value = await projectsAPI.getStats(props.projectId, chartRange.value)
  } catch (e) {
    console.error('Failed to load project chart stats', e)
    toast.error(
      projectErrorMessage(e, 'Could not load usage stats. Please try again later.'),
    )
  } finally {
    loadingCharts.value = false
  }
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

watch(chartRange, loadCharts)
watch(durationRange, loadDuration)
watch(modelRange, loadModels)
watch(
  () => props.projectId,
  () => {
    loadCharts()
    loadDuration()
    loadModels()
  },
)

onMounted(() => {
  loadCharts()
  loadDuration()
  loadModels()
})
</script>

<template>
  <section class="mb-8 rounded-xl border border-border px-5 py-5">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-base font-semibold tracking-tight">Usage</h2>
      <Select v-model="chartRange">
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
      v-if="loadingCharts && !chartStats"
      class="py-8 text-center text-sm text-muted-foreground"
    >
      Loading usage…
    </div>

    <template v-else>
      <div class="grid gap-4 lg:grid-cols-2">
        <div class="min-w-0 rounded-lg border border-border bg-muted/30 px-4 pt-4 pb-2">
          <div class="mb-2 text-sm font-medium">Requests</div>
          <UsageLineChart
            :points="requestPoints"
            :x-count="seriesPointCount"
            :series="[
              { key: 'success_count', color: 'hsl(var(--primary))', fill: 'hsl(var(--primary))' },
              { key: 'failure_count', color: 'hsl(var(--destructive))', fill: 'hsl(var(--destructive))' },
            ]"
          />
        </div>

        <div class="min-w-0 rounded-lg border border-border bg-muted/30 px-4 pt-4 pb-2">
          <div class="mb-2 text-sm font-medium">Tokens</div>
          <UsageLineChart
            :points="tokenPoints"
            :x-count="seriesPointCount"
            :series="[
              { key: 'prompt_tokens', color: 'hsl(var(--primary))', fill: 'hsl(var(--primary))' },
              { key: 'completion_tokens', color: 'hsl(210 40% 50%)', fill: 'hsl(210 40% 50%)' },
            ]"
          />
        </div>
      </div>
    </template>

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

    <div
      v-if="chartStats"
      class="mt-4 min-w-0 rounded-lg border border-border bg-muted/30 px-4 pt-4 pb-2"
    >
      <div class="mb-2 text-sm font-medium">Credits used</div>
      <UsageLineChart
        :points="creditsPoints"
        :x-count="seriesPointCount"
        :series="[{ key: 'value', color: 'hsl(var(--primary))', fill: 'hsl(var(--primary))' }]"
      />
    </div>
  </section>
</template>
