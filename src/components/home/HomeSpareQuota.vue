<script setup>
import ProviderIcon from '@/components/earn/ProviderIcon.vue'
import HomeReveal from '@/components/home/HomeReveal.vue'
import { spareQuotaSharing } from '@/content/home'
</script>

<template>
  <section class="overflow-x-hidden border-t border-foreground/10 bg-[var(--home-background)] text-foreground">
    <div class="mx-auto max-w-7xl px-6 py-24 lg:py-32">
      <HomeReveal>
        <h2 class="max-w-3xl text-4xl font-extrabold tracking-tight md:text-5xl">
          {{ spareQuotaSharing.title }}
        </h2>
        <p class="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          {{ spareQuotaSharing.intro }}
        </p>
      </HomeReveal>

      <div class="mt-14 grid gap-px overflow-hidden rounded-[1.5rem] border border-foreground/10 bg-foreground/10 lg:grid-cols-2">
        <HomeReveal
          v-for="(audience, index) in spareQuotaSharing.audiences"
          :key="audience.role"
          :delay="index * 0.06"
          class="bg-[var(--home-surface)] p-8 sm:p-10"
        >
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            {{ audience.role }}
          </p>
          <h3 class="mt-4 text-2xl font-bold tracking-tight md:text-3xl">
            {{ audience.title }}
          </h3>
          <p class="mt-4 max-w-md leading-relaxed text-muted-foreground">
            {{ audience.body }}
          </p>
        </HomeReveal>
      </div>

      <HomeReveal class="mt-16" :delay="0.12">
        <p class="text-center text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          One API, all providers, all models
        </p>
        <div class="mt-6 grid gap-px overflow-hidden rounded-[1.5rem] border border-foreground/10 bg-foreground/10 sm:grid-cols-2 lg:grid-cols-4">
          <div
            v-for="provider in spareQuotaSharing.providers"
            :key="provider.id"
            class="flex items-center gap-4 bg-[var(--home-surface)] px-5 py-6"
          >
            <div class="text-foreground">
              <ProviderIcon :provider-id="provider.id" size="xl" />
            </div>
            <div class="min-w-0">
              <p class="font-semibold tracking-tight">{{ provider.name }}</p>
              <p class="mt-0.5 text-sm text-muted-foreground">{{ provider.note }}</p>
            </div>
          </div>
        </div>
      </HomeReveal>
    </div>
  </section>
</template>
