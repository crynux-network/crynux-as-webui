<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  CircleDot,
  Cpu,
  Download,
  Send,
  ShieldCheck,
  Upload,
  XCircle,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { projectsAPI } from '@/api/v1/projects'
import { formatGwei } from '@/lib/llm-billing'
import { formatCreditsValue, formatRecordTime } from '@/lib/credits-ui'
import { projectErrorMessage } from '@/lib/project-ui'
import { requestStatusSecondaryLine } from '@/lib/playground-status-log'
import { Button } from '@/components/ui/button'
import GetSupportDialog from '@/components/support/GetSupportDialog.vue'
import UsageModelCell from '@/components/stats/UsageModelCell.vue'
import UsageWorkloadCell from '@/components/stats/UsageWorkloadCell.vue'

const PHASE_ICONS = {
  send: Send,
  clock: Clock,
  cpu: Cpu,
  shield: ShieldCheck,
  upload: Upload,
  download: Download,
  check: CheckCircle2,
  alert: AlertCircle,
}

const props = defineProps({
  projectId: {
    type: [Number, String],
    required: true,
  },
})

const requests = ref([])
const loading = ref(false)
const ready = ref(false)
const supportOpen = ref(false)

const requestRows = computed(() =>
  requests.value.map((request) => ({
    request,
    secondaryLine: requestStatusSecondaryLine(request),
  })),
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

function secondaryLineIcon(secondaryLine) {
  return PHASE_ICONS[secondaryLine?.icon] || Clock
}

function formatRequestDuration(durationMs) {
  if (durationMs == null) return '—'
  const ms = Number(durationMs)
  if (!Number.isFinite(ms) || ms < 0) return '—'
  return `${Math.round(ms / 1000)} s`
}

function formatNullableCredits(value, status) {
  if (status === 'failed' || value == null) return '—'
  return formatCreditsValue(value)
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
    <div class="mb-4 flex items-center gap-3">
      <h2 class="text-base font-semibold tracking-tight whitespace-nowrap">
        Recent Requests
      </h2>
      <Button
        type="button"
        variant="link"
        class="h-auto shrink-0 px-0 text-sm text-muted-foreground"
        @click="supportOpen = true"
      >
        Having trouble?
      </Button>
    </div>

    <GetSupportDialog v-model:open="supportOpen" />

    <div class="overflow-x-auto rounded-lg border border-border">
      <table class="w-full min-w-[800px] text-left text-sm">
        <thead class="border-b border-border bg-muted/40 text-muted-foreground">
          <tr>
            <th class="w-10 px-3 py-2.5 font-medium">
              <span class="sr-only">Status</span>
            </th>
            <th class="px-4 py-2.5 font-medium">Model</th>
            <th class="px-4 py-2.5 font-medium">VRAM</th>
            <th class="px-4 py-2.5 font-medium">Usage</th>
            <th class="px-4 py-2.5 font-medium">Duration</th>
            <th class="px-4 py-2.5 font-medium">Cost Level</th>
            <th class="px-4 py-2.5 font-medium">Credits</th>
            <th class="px-4 py-2.5 font-medium">Time</th>
          </tr>
        </thead>
        <tbody v-if="!loading && requestRows.length > 0">
          <tr
            v-for="{ request, secondaryLine } in requestRows"
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
            <td class="px-4 py-2.5 max-w-[360px]">
              <UsageModelCell
                :model="request.model"
                :quantization-config="request.quantization_config"
                :components="request.components"
              />
              <p
                v-if="secondaryLine"
                class="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted-foreground"
                :title="secondaryLine.text"
              >
                <component
                  :is="secondaryLineIcon(secondaryLine)"
                  class="size-3 shrink-0"
                  aria-hidden="true"
                />
                <span class="truncate">{{ secondaryLine.text }}</span>
              </p>
            </td>
            <td class="px-4 py-2.5 tabular-nums">
              {{ request.billed_vram }} GB
            </td>
            <td class="px-4 py-2.5">
              <UsageWorkloadCell
                :task-type="request.task_type || 'llm'"
                :prompt-tokens="request.prompt_tokens"
                :completion-tokens="request.completion_tokens"
                :image-width="request.image_width"
                :image-height="request.image_height"
                :image-steps="request.image_steps"
                :image-count="request.image_count"
                variant="request"
              />
            </td>
            <td class="px-4 py-2.5 tabular-nums whitespace-nowrap">
              {{ formatRequestDuration(request.duration_ms) }}
            </td>
            <td class="px-4 py-2.5 tabular-nums">
              <template v-if="Number(request.priority_gwei) > 0">
                {{ formatGwei(request.priority_gwei) }}
              </template>
              <template v-else>—</template>
            </td>
            <td class="px-4 py-2.5 tabular-nums">
              {{ formatNullableCredits(request.credits, request.status) }}
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
