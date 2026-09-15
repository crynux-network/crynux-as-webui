<script setup>
import { computed, ref } from 'vue'
import HomeCodeBlock from '@/components/home/HomeCodeBlock.vue'
import HomeReveal from '@/components/home/HomeReveal.vue'
import { serviceTabs } from '@/content/home'

const activeId = ref(serviceTabs[0].id)
const activeTab = computed(() => serviceTabs.find((tab) => tab.id === activeId.value) || serviceTabs[0])
</script>

<template>
  <section class="overflow-x-hidden bg-[var(--home-background)] text-foreground">
    <div class="mx-auto max-w-7xl px-6 py-24 lg:py-32">
      <HomeReveal>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="tab in serviceTabs"
            :key="tab.id"
            type="button"
            class="rounded-full px-5 py-2 text-sm font-semibold transition-colors"
            :class="
              activeId === tab.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground'
            "
            @click="activeId = tab.id"
          >
            {{ tab.label }}
          </button>
        </div>
      </HomeReveal>

      <div class="mt-12 grid min-w-0 gap-12 lg:grid-cols-[5fr_7fr]">
        <HomeReveal class="min-w-0">
          <h2 class="text-3xl font-extrabold tracking-tight text-balance md:text-4xl">
            {{ activeTab.title }}
          </h2>
          <div class="mt-8 space-y-6">
            <div v-for="(point, index) in activeTab.points" :key="`${activeTab.id}-${index}`">
              <h3 v-if="point.title" class="text-xl font-bold tracking-tight">
                {{ point.title }}
              </h3>
              <p class="mt-2 max-w-lg leading-relaxed text-muted-foreground">
                {{ point.body }}
              </p>
            </div>
          </div>
        </HomeReveal>

        <HomeReveal v-if="activeTab.code" class="min-w-0" :delay="0.08">
          <HomeCodeBlock :code="activeTab.code" :language="activeTab.language" />
        </HomeReveal>
      </div>
    </div>
  </section>
</template>
