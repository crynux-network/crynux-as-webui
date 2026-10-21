<script setup>
import {
  formatLocalDateTime,
  phaseLabel,
} from '@/lib/playground-status-log'

defineProps({
  entries: {
    type: Array,
    default: () => [],
  },
})
</script>

<template>
  <div
    v-if="entries.length > 0"
    class="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border bg-muted/20 px-3 py-2 font-mono text-xs text-muted-foreground"
  >
    <div
      v-for="(entry, index) in entries"
      :key="`${entry.at}-${entry.phase}-${index}`"
      class="leading-relaxed"
    >
      <span class="text-foreground/80">{{ formatLocalDateTime(entry.at) }}</span>
      <span class="mx-1.5 text-border">·</span>
      <span class="text-foreground">{{ phaseLabel(entry.phase) }}</span>
      <span
        v-if="entry.phase === 'running' && entry.estimatedCompletionAt"
        class="ml-1"
      >
        (estimated {{ formatLocalDateTime(entry.estimatedCompletionAt) }})
      </span>
      <span
        v-if="entry.message"
        class="ml-1 text-destructive"
      >
        — {{ entry.message }}
      </span>
    </div>
  </div>
</template>
