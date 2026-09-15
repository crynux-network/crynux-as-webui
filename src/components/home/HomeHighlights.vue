<script setup>
import HomeReveal from '@/components/home/HomeReveal.vue'
import { highlights } from '@/content/home'
</script>

<template>
  <section class="mx-auto max-w-7xl px-6 py-24 lg:py-32">
    <HomeReveal>
      <h2 class="text-4xl font-extrabold tracking-tight md:text-5xl">
        Service Highlights
      </h2>
    </HomeReveal>

    <div class="mt-14 grid gap-5 lg:grid-cols-3">
      <HomeReveal
        v-for="(item, index) in highlights"
        :key="item.title"
        :delay="index * 0.08"
        class="h-full"
      >
        <div
          class="group relative h-full overflow-hidden rounded-[2rem] border border-foreground/10 bg-[var(--home-surface)] p-8"
        >
          <div
            class="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.08] via-[color-mix(in_srgb,var(--home-secondary)_6%,transparent)] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          />
          <h3 class="relative text-2xl font-bold tracking-tight">{{ item.title }}</h3>
          <ul class="relative mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
            <li v-for="line in item.items" :key="line" class="flex gap-2">
              <span class="mt-0.5 shrink-0 text-primary">▶</span>
              <span>{{ line }}</span>
            </li>
          </ul>
        </div>
      </HomeReveal>
    </div>
  </section>
</template>
