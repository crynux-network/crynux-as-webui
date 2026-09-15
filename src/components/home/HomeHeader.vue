<script setup>
import ThemeToggle from '@/components/theme/ThemeToggle.vue'
import { navLinks } from '@/content/home'

defineProps({
  authenticated: {
    type: Boolean,
    default: false,
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['primary'])
</script>

<template>
  <header class="fixed inset-x-0 top-4 z-40 px-4">
    <div
      class="mx-auto flex h-16 max-w-4xl items-center justify-between rounded-full border border-foreground/10 bg-background/80 pl-5 pr-2.5 shadow-[0_8px_32px_-12px_rgba(16,21,27,0.15)] backdrop-blur-xl dark:bg-card/80"
    >
      <a href="/" class="flex items-center gap-2.5">
        <img src="/home/crynux_logo.svg" alt="Crynux" class="h-7 w-auto" />
        <span class="text-lg font-bold tracking-tight">Crynux AI Services</span>
      </a>

      <nav class="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
        <a
          v-for="link in navLinks"
          :key="link.label"
          :href="link.href"
          target="_blank"
          rel="noreferrer"
          class="transition-colors hover:text-foreground"
        >
          {{ link.label }}
        </a>
      </nav>

      <div class="flex items-center gap-1.5">
        <ThemeToggle />
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50"
          :disabled="loading"
          @click="emit('primary')"
        >
          {{ authenticated ? 'Dashboard' : loading ? 'Connecting…' : 'Start for Free' }}
        </button>
      </div>
    </div>
  </header>
</template>
