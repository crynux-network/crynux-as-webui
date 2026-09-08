<script setup>
import { computed } from 'vue'
import { ChevronRight } from 'lucide-vue-next'
import { formatTokenRatio } from '@/lib/token-ratio'
import { formatProjectCreatedAt } from '@/lib/project-ui'

const props = defineProps({
  project: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['open'])

const costLevel = computed(() => formatTokenRatio(props.project.token_ratio))
const createdAt = computed(() =>
  formatProjectCreatedAt(props.project.created_at),
)

function onOpen() {
  emit('open', props.project)
}
</script>

<template>
  <button
    type="button"
    class="group w-full rounded-xl border border-border bg-background px-5 py-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    @click="onOpen"
  >
    <div class="flex items-start justify-between gap-3">
      <h2 class="min-w-0 truncate text-lg font-semibold tracking-tight text-foreground">
        {{ project.name }}
      </h2>
      <ChevronRight
        class="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
      />
    </div>

    <div
      class="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-3 sm:gap-6"
    >
      <div>
        <p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Cost level
        </p>
        <p class="mt-1.5 font-mono text-xl font-semibold tabular-nums tracking-tight text-primary">
          {{ costLevel }}×
        </p>
      </div>

      <div class="min-w-0">
        <p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Key prefix
        </p>
        <p
          class="mt-1.5 inline-block max-w-full truncate rounded-md bg-muted px-2 py-1 font-mono text-sm text-foreground"
        >
          {{ project.api_key_prefix }}
        </p>
      </div>

      <div>
        <p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Created
        </p>
        <p class="mt-1.5 text-sm text-muted-foreground">
          {{ createdAt }}
        </p>
      </div>
    </div>
  </button>
</template>
