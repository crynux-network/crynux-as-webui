<script setup>
defineProps({
  row: {
    type: Object,
    required: true,
  },
})
</script>

<template>
  <div class="min-w-0">
    <div class="flex min-w-0 flex-wrap items-center gap-1.5">
      <span class="truncate font-medium text-foreground">
        {{ row.model }}
      </span>
      <span
        class="inline-flex shrink-0 items-center rounded-md border border-border bg-muted/50 px-1.5 py-0 text-[11px] font-medium leading-5 text-muted-foreground"
      >
        {{ row.quantizationLabel }}
      </span>
      <span
        v-if="row.minVramLabel"
        class="inline-flex shrink-0 items-center rounded-md border border-border bg-muted/50 px-1.5 py-0 text-[11px] font-medium leading-5 text-muted-foreground"
      >
        {{ row.minVramLabel }}
      </span>
    </div>
    <div
      v-if="Array.isArray(row.componentRepos) && row.componentRepos.length > 0"
      class="mt-1 space-y-0.5"
    >
      <div
        v-for="repo in row.componentRepos"
        :key="repo"
        class="truncate text-[11px] leading-4 text-muted-foreground"
      >
        {{ repo }}
      </div>
    </div>
  </div>
</template>
