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
    <div
      class="mx-auto grid max-w-7xl items-center gap-12 px-6 pt-40 pb-20 min-[900px]:grid-cols-[7fr_5fr] min-[900px]:gap-16 min-[900px]:pt-48 xl:grid-cols-2"
    >
      <HomeReveal class="text-center min-[900px]:text-left">
        <h1 class="text-5xl font-extrabold tracking-tight text-balance md:text-6xl xl:text-7xl">
          Simple, Scalable,<br />
          <HomeFancyText>Cost-efficient</HomeFancyText>
        </h1>
        <div
          class="mt-12 flex flex-col items-center gap-3 md:mt-16 min-[900px]:mt-24 min-[900px]:items-start"
        >
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50"
            :disabled="loading"
            @click="emit('primary')"
          >
            {{ authenticated ? 'Dashboard' : loading ? 'Connecting…' : 'Start for Free' }}
          </button>
          <p
            v-if="!authenticated && !loading"
            class="whitespace-nowrap text-sm leading-relaxed text-muted-foreground"
          >
            Connect your wallet to claim your free usage credits
          </p>
        </div>
      </HomeReveal>
      <HomeCrynuxLogo
        class="mx-auto w-56 max-w-full sm:w-64 min-[900px]:mx-0 min-[900px]:w-80 min-[900px]:justify-self-end xl:w-96"
      />
    </div>
  </section>
</template>
