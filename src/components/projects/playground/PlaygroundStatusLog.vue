<script setup>
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Cpu,
  Download,
  Send,
  ShieldCheck,
  Upload,
} from 'lucide-vue-next'
import {
  formatLocalDateTime,
  statusLogLineExplanation,
} from '@/lib/playground-status-log'

defineProps({
  entries: {
    type: Array,
    default: () => [],
  },
})

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

function lineIcon(entry) {
  const explanation = statusLogLineExplanation(entry)
  return PHASE_ICONS[explanation?.icon] || Clock
}

function lineText(entry) {
  return statusLogLineExplanation(entry)?.text || ''
}
</script>

<template>
  <div
    v-if="entries.length > 0"
    class="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground"
  >
    <div
      v-for="(entry, index) in entries"
      :key="`${entry.at}-${entry.phase}-${index}`"
      class="flex min-w-0 items-start gap-1.5 leading-relaxed"
    >
      <component
        :is="lineIcon(entry)"
        class="mt-0.5 size-3.5 shrink-0 text-foreground/70"
        aria-hidden="true"
      />
      <div class="min-w-0">
        <span class="text-foreground/80">{{ formatLocalDateTime(entry.at) }}</span>
        <span class="mx-1.5 text-border">·</span>
        <span
          class="text-foreground"
          :class="entry.phase === 'failed' ? 'text-destructive' : ''"
        >{{ lineText(entry) }}</span>
        <span
          v-if="entry.phase === 'running' && entry.estimatedCompletionAt"
          class="ml-1"
        >
          (estimated {{ formatLocalDateTime(entry.estimatedCompletionAt) }})
        </span>
      </div>
    </div>
  </div>
</template>
