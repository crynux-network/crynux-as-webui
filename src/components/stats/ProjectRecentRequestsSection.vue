<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { CheckCircle2, Clock, CircleDot, XCircle } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { projectsAPI } from '@/api/v1/projects'
import { formatCredits } from '@/lib/llm-billing'
import { formatCreditsValue, formatRecordTime } from '@/lib/credits-ui'
import { formatTokenRatio } from '@/lib/token-ratio'
import { projectErrorMessage } from '@/lib/project-ui'

const props = defineProps({
  projectId: {
    type: [Number, String],
    required: true,
  },
})

const requests = ref([])
const loading = ref(false)
const ready = ref(false)
let refreshTimer = null

const hasInProgress = computed(() =>
  requests.value.some(
    (request) => request.status === 'queued' || request.status === 'in_progress',
  ),
)

function requestKey(request) {
  return `${request.source}:${request.id}`
}

function requestStatusLabel(status) {
  if (status === 'queued') return 'Queued'
  if (status === 'in_progress') return 'In Progress'
  if (status === 'success') return 'Success'
  if (status === 'failed') return 'Failed'
  return String(status)
}

function formatRequestDuration(durationMs) {
  if (durationMs == null) return '—'
  const ms = Number(durationMs)
  if (!Number.isFinite(ms) || ms < 0) return '—'
  return `${Math.round(ms / 1000)} s`
}

function formatNullableCredits(value) {
  if (value == null) return '—'
  return formatCreditsValue(value)
}

function formatNullableTokens(value) {
  if (value == null) return '—'
  return formatCredits(value || 0)
}

function stopRefresh() {
  if (refreshTimer != null) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

function syncRefresh() {
  stopRefresh()
  if (!hasInProgress.value) return
  refreshTimer = setInterval(() => {
    loadRequests({ silent: true })
  }, 5000)
}

async function loadRequests({ silent = false } = {}) {
  if (props.projectId == null || props.projectId === '') return
  if (!silent) loading.value = true
  try {
    const data = await projectsAPI.listRequests(props.projectId)
    requests.value = data?.requests ?? []
    ready.value = true
    syncRefresh()
  } catch (e) {
    console.error('Failed to load project recent requests', e)
    if (!silent) {
      toast.error(
        projectErrorMessage(e, 'Could not load recent requests. Please try again later.'),
      )
    }
  } finally {
    if (!silent) loading.value = false
  }
}

onMounted(loadRequests)
watch(() => props.projectId, () => {
  stopRefresh()
  loadRequests()
})
onUnmounted(stopRefresh)
</script>

<template>
  <section class="mb-8 rounded-xl border border-border px-5 py-5">
    <h2 class="mb-4 text-base font-semibold tracking-tight">Recent Requests</h2>

    <div class="overflow-x-auto rounded-lg border border-border">
      <table class="w-full min-w-[860px] text-left text-sm">
        <thead class="border-b border-border bg-muted/40 text-muted-foreground">
          <tr>
            <th class="w-10 px-3 py-2.5 font-medium">
              <span class="sr-only">Status</span>
            </th>
            <th class="px-4 py-2.5 font-medium">Model</th>
            <th class="px-4 py-2.5 font-medium">VRAM</th>
            <th class="px-4 py-2.5 font-medium">Input</th>
            <th class="px-4 py-2.5 font-medium">Output</th>
            <th class="px-4 py-2.5 font-medium">Duration</th>
            <th class="px-4 py-2.5 font-medium">Cost Level</th>
            <th class="px-4 py-2.5 font-medium">Credits</th>
            <th class="px-4 py-2.5 font-medium">Time</th>
          </tr>
        </thead>
        <tbody v-if="!loading && requests.length > 0">
          <tr
            v-for="request in requests"
            :key="requestKey(request)"
            class="border-b border-border last:border-0"
          >
            <td class="px-3 py-2.5">
              <CheckCircle2
                v-if="request.status === 'success'"
                class="size-4 text-emerald-600"
                :title="requestStatusLabel(request.status)"
                aria-hidden="true"
              />
              <XCircle
                v-else-if="request.status === 'failed'"
                class="size-4 text-destructive"
                :title="requestStatusLabel(request.status)"
                aria-hidden="true"
              />
              <CircleDot
                v-else-if="request.status === 'in_progress'"
                class="size-4 text-primary"
                :title="requestStatusLabel(request.status)"
                aria-hidden="true"
              />
              <Clock
                v-else-if="request.status === 'queued'"
                class="size-4 text-muted-foreground"
                :title="requestStatusLabel(request.status)"
                aria-hidden="true"
              />
              <span
                v-else
                class="text-muted-foreground"
                :title="requestStatusLabel(request.status)"
              >—</span>
              <span class="sr-only">{{ requestStatusLabel(request.status) }}</span>
            </td>
            <td class="px-4 py-2.5 max-w-[220px] truncate" :title="request.model">
              {{ request.model }}
            </td>
            <td class="px-4 py-2.5 tabular-nums">
              {{ request.billed_vram }} GB
            </td>
            <td class="px-4 py-2.5 tabular-nums">
              {{ formatNullableTokens(request.prompt_tokens) }}
            </td>
            <td class="px-4 py-2.5 tabular-nums">
              {{ formatNullableTokens(request.completion_tokens) }}
            </td>
            <td class="px-4 py-2.5 tabular-nums whitespace-nowrap">
              {{ formatRequestDuration(request.duration_ms) }}
            </td>
            <td class="px-4 py-2.5 tabular-nums">
              <template v-if="Number(request.token_ratio) > 0">
                {{ formatTokenRatio(request.token_ratio) }}×
              </template>
              <template v-else>—</template>
            </td>
            <td class="px-4 py-2.5 tabular-nums">
              {{ formatNullableCredits(request.credits) }}
            </td>
            <td class="px-4 py-2.5 whitespace-nowrap">
              {{ formatRecordTime(request.created_at) }}
            </td>
          </tr>
        </tbody>
      </table>
      <p
        v-if="loading"
        class="px-4 py-10 text-center text-sm text-muted-foreground"
      >
        Loading recent requests…
      </p>
      <p
        v-else-if="ready && requests.length === 0"
        class="px-4 py-10 text-center text-sm text-muted-foreground"
      >
        No requests yet.
      </p>
    </div>
  </section>
</template>
