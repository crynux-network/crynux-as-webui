<script setup>
import HomeReveal from '@/components/home/HomeReveal.vue'
import { useCases } from '@/content/home'
</script>

<template>
  <section class="border-y border-foreground/10 bg-[var(--home-surface)]">
    <div
      class="mx-auto grid max-w-7xl gap-12 px-6 py-24 lg:grid-cols-[4fr_8fr] lg:gap-16 lg:py-32"
    >
      <HomeReveal>
        <p class="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
          Built for real work
        </p>
        <h2 class="mt-4 text-4xl font-extrabold tracking-tight md:text-5xl">
          Use Cases
        </h2>
        <p class="mt-5 max-w-sm text-lg leading-relaxed text-muted-foreground">
          Apply scalable AI processing to creative production, analysis, and
          large data workloads.
        </p>
      </HomeReveal>

      <div>
        <HomeReveal
          v-for="(item, index) in useCases"
          :key="item.title"
          :delay="index * 0.05"
          class="group border-t border-foreground/15 py-7 last:border-b"
        >
          <div class="grid gap-4 sm:grid-cols-[3rem_minmax(0,1fr)] lg:grid-cols-[4rem_minmax(0,1fr)]">
            <span class="font-mono text-sm font-semibold tabular-nums text-primary">
              {{ String(index + 1).padStart(2, '0') }}
            </span>
            <div>
              <h3
                class="text-2xl font-bold tracking-tight transition-transform duration-300 group-hover:translate-x-1"
              >
                {{ item.title }}
              </h3>
              <ul
                class="mt-4 space-y-2 text-sm leading-relaxed text-muted-foreground"
              >
                <li
                  v-for="line in item.items"
                  :key="line"
                  class="flex gap-2"
                >
                  <span class="mt-[0.65em] size-1 shrink-0 rounded-full bg-primary" />
                  <span>{{ line }}</span>
                </li>
              </ul>
            </div>
          </div>
        </HomeReveal>
      </div>
    </div>
  </section>
</template>
