<script setup>
import HomeReveal from '@/components/home/HomeReveal.vue'

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
  <section class="mx-auto max-w-7xl px-6 py-24 lg:py-32">
    <HomeReveal>
      <div
        class="rounded-[2rem] border border-foreground/10 bg-gradient-to-br from-primary/[0.10] via-[var(--home-surface)] to-[color-mix(in_srgb,var(--home-secondary)_10%,transparent)] p-10 md:p-14"
      >
        <h2 class="text-4xl font-extrabold tracking-tight lg:whitespace-nowrap xl:text-5xl">
          Connect Your Wallet for Free Credits
        </h2>
        <p class="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Connect your wallet to claim your free usage credits and experience the full power of Crynux AI.
        </p>
        <p class="mt-2 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Start your journey of limitless creation today!
        </p>
        <button
          type="button"
          class="mt-8 inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50"
          :disabled="loading"
          @click="emit('primary')"
        >
          {{ authenticated ? 'Dashboard' : loading ? 'Connecting…' : 'Start for Free' }}
        </button>
      </div>
    </HomeReveal>
  </section>
</template>
