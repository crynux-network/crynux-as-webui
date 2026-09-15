<script setup>
import HomeCrynuxLogo from '@/components/home/HomeCrynuxLogo.vue'
import HomeFancyText from '@/components/home/HomeFancyText.vue'
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
  <section class="relative overflow-hidden">
    <div
      aria-hidden="true"
      class="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[64rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(10,169,252,0.14),transparent)]"
    />
    <div class="mx-auto grid max-w-7xl items-center gap-16 px-6 pt-40 pb-20 lg:grid-cols-[7fr_5fr] lg:pt-48">
      <HomeReveal>
        <h1 class="text-5xl font-extrabold tracking-tight text-balance md:text-6xl lg:text-7xl">
          Simple, Scalable,<br />
          <HomeFancyText>Cost-efficient</HomeFancyText>
        </h1>
        <div class="mt-24 flex flex-wrap gap-4 md:mt-28">
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50"
            :disabled="loading"
            @click="emit('primary')"
          >
            {{ authenticated ? 'Dashboard' : loading ? 'Connecting…' : 'Start for Free' }}
          </button>
        </div>
      </HomeReveal>
      <HomeCrynuxLogo class="mx-auto w-64 max-w-full sm:w-80 lg:w-full" />
    </div>
  </section>
</template>
