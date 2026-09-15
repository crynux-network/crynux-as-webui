<script setup>
import HomeReveal from '@/components/home/HomeReveal.vue'
import { integrations } from '@/content/home'
</script>

<template>
  <section id="integrations" class="bg-[var(--home-background)] text-foreground">
    <div class="mx-auto max-w-7xl px-6 py-24 lg:py-32">
      <HomeReveal>
        <h2 class="text-4xl font-extrabold tracking-tight md:text-5xl">
          Seamless Integrations
        </h2>
        <p class="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Seamlessly integrated into a growing ecosystem of popular AI tools and libraries.
          Unlock the full potential of Crynux AI without leaving your favourite environments.
        </p>
      </HomeReveal>

      <div class="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <HomeReveal
          v-for="(item, index) in integrations"
          :key="item.name"
          :delay="index * 0.08"
          class="h-full"
        >
          <a
            :href="item.href"
            target="_blank"
            rel="noreferrer"
            class="group flex h-full flex-col items-center justify-center rounded-[2rem] border border-foreground/10 bg-[var(--home-surface)] p-8 transition-colors hover:bg-foreground/[0.04]"
          >
            <span class="relative inline-block h-10">
              <img
                :src="item.gray"
                :alt="`${item.name} Logo Grayscale`"
                class="h-10 w-auto grayscale opacity-70 transition-opacity duration-300 group-hover:opacity-0 dark:invert"
              />
              <img
                :src="item.color"
                :alt="`${item.name} Logo`"
                class="absolute inset-0 h-10 w-auto opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              />
            </span>
            <span class="mt-4 text-sm font-semibold text-foreground">{{ item.name }}</span>
          </a>
        </HomeReveal>
      </div>
    </div>
  </section>
</template>
