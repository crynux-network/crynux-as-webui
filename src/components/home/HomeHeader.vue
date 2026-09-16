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
  <header class="sticky inset-x-0 top-4 z-40 h-0 px-4">
    <div
      class="mx-auto grid h-16 max-w-4xl grid-cols-[1fr_auto_1fr] items-center rounded-full border border-foreground/10 bg-background/80 pl-5 pr-2.5 shadow-[0_8px_32px_-12px_rgba(16,21,27,0.15)] backdrop-blur-xl dark:bg-card/80"
    >
      <a href="/" class="col-start-1 row-start-1 flex min-w-0 items-center gap-2.5 justify-self-start">
        <img
          src="/home/crynux_as_logo_solid_triangle.svg?v=3"
          alt="Crynux AI Services"
          class="size-7 object-contain"
        />
        <span class="truncate text-lg font-bold tracking-tight">Crynux AI Services</span>
      </a>

      <nav
        class="col-start-2 row-start-1 hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex"
      >
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

      <div class="col-start-3 row-start-1 flex items-center gap-1.5 justify-self-end">
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
