<script setup>
import { onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { projectsAPI } from '@/api/v1/projects'
import { formatCredits, formatSeconds } from '@/lib/llm-billing'
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

function formatRequestStatus(status) {
  if (Number(status) === 0) return 'Success'
  if (Number(status) === 1) return 'Failed'
  return String(status)
}

function formatRequestDuration(durationMs) {
  const ms = Number(durationMs)
  if (!Number.isFinite(ms) || ms < 0) return '—'
  return `${formatSeconds(ms / 1000)} s`
}

async function loadRequests() {
  if (props.projectId == null || props.projectId === '') return
  loading.value = true
  try {
    const data = await projectsAPI.listRequests(props.projectId)
    requests.value = data?.requests ?? []
    ready.value = true
  } catch (e) {
    console.error('Failed to load project recent requests', e)
    toast.error(
      projectErrorMessage(e, 'Could not load recent requests. Please try again later.'),
    )
  } finally {
    loading.value = false
  }
}

onMounted(loadRequests)
watch(() => props.projectId, loadRequests)
</script>

<template>
  <section class="mb-8 rounded-xl border border-border px-5 py-5">
    <h2 class="mb-4 text-base font-semibold tracking-tight">Recent Requests</h2>

    <div class="overflow-x-auto rounded-lg border border-border">
      <table class="w-full min-w-[960px] text-left text-sm">
        <thead class="border-b border-border bg-muted/40 text-muted-foreground">
          <tr>
            <th class="px-4 py-2.5 font-medium">Time</th>
            <th class="px-4 py-2.5 font-medium">Status</th>
            <th class="px-4 py-2.5 font-medium">Cost Level</th>
            <th class="px-4 py-2.5 font-medium">Model</th>
            <th class="px-4 py-2.5 font-medium">VRAM</th>
            <th class="px-4 py-2.5 font-medium">Input</th>
            <th class="px-4 py-2.5 font-medium">Output</th>
            <th class="px-4 py-2.5 font-medium">Duration</th>
            <th class="px-4 py-2.5 font-medium">Credits</th>
          </tr>
        </thead>
        <tbody v-if="!loading && requests.length > 0">
          <tr
            v-for="request in requests"
            :key="request.id"
            class="border-b border-border last:border-0"
          >
            <td class="px-4 py-2.5 whitespace-nowrap">
              {{ formatRecordTime(request.created_at) }}
            </td>
            <td class="px-4 py-2.5 whitespace-nowrap">
              {{ formatRequestStatus(request.status) }}
            </td>
            <td class="px-4 py-2.5 tabular-nums">
              <template v-if="Number(request.token_ratio) > 0">
                {{ formatTokenRatio(request.token_ratio) }}×
              </template>
              <template v-else>—</template>
            </td>
            <td class="px-4 py-2.5 max-w-[220px] truncate" :title="request.model">
              {{ request.model }}
            </td>
            <td class="px-4 py-2.5 tabular-nums">
              {{ request.billed_vram }} GB
            </td>
            <td class="px-4 py-2.5 tabular-nums">
              {{ formatCredits(request.prompt_tokens || 0) }}
            </td>
            <td class="px-4 py-2.5 tabular-nums">
              {{ formatCredits(request.completion_tokens || 0) }}
            </td>
            <td class="px-4 py-2.5 tabular-nums whitespace-nowrap">
              {{ formatRequestDuration(request.duration_ms) }}
            </td>
            <td class="px-4 py-2.5 tabular-nums">
              {{ formatCreditsValue(request.credits) }}
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
