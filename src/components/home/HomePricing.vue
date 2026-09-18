<script setup>
import { computed, ref } from 'vue'
import HomeReveal from '@/components/home/HomeReveal.vue'
import { Slider } from '@/components/ui/slider'
import {
  buildTokenRatioOptions,
  sliderIndexToTokenRatio,
  tokenRatioToSliderIndex,
} from '@/lib/token-ratio'
import { formatCredits } from '@/lib/llm-billing'

const tokenRatioOptions = buildTokenRatioOptions(10)
const sliderIndex = ref([tokenRatioToSliderIndex(1, tokenRatioOptions)])
const currentTokenRatio = computed(() =>
  sliderIndexToTokenRatio(sliderIndex.value[0], tokenRatioOptions),
)

const currentSettingLabel = computed(() => {
  const maxIndex = Math.max(1, tokenRatioOptions.length - 1)
  const ratio = sliderIndex.value[0] / maxIndex
  if (ratio < 1 / 3) return 'Cheaper'
  if (ratio < 2 / 3) return 'Balanced'
  return 'Faster'
})

const exampleRows = [
  {
    model: 'qwen/qwen3-8b',
    minVram: 24,
    inputCredits: 260,
    outputCredits: 48_000,
  },
  {
    model: 'qwen/qwen3.6-27b',
    minVram: 80,
    inputCredits: 1_200,
    outputCredits: 180_000,
  },
  {
    model: 'qwen/qwen3.6-35b-a3b',
    minVram: 128,
    inputCredits: 2_100,
    outputCredits: 290_000,
  },
  {
    model: 'qwen/qwen3.5-122b-a10b',
    minVram: 383,
    inputCredits: 3_200,
    outputCredits: 420_000,
  },
]

const pricingRows = computed(() =>
  exampleRows.map((row) => ({
    ...row,
    inputCredits: Math.floor(row.inputCredits * currentTokenRatio.value),
    outputCredits: Math.floor(row.outputCredits * currentTokenRatio.value),
  })),
)
</script>

<template>
  <section
    id="pricing"
    class="bg-[var(--home-ink)] text-white dark:border-y dark:border-white/10"
  >
    <div class="mx-auto max-w-7xl px-6 py-24 lg:py-32">
      <div class="grid items-start gap-12 lg:grid-cols-[4fr_8fr] lg:gap-16">
        <HomeReveal>
          <p class="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            Price or speed. You decide.
          </p>
          <h2 class="mt-4 text-4xl font-extrabold tracking-tight md:text-5xl">
            Flexible Pricing
          </h2>
          <p class="mt-5 max-w-md text-lg leading-relaxed text-white/60">
            Move the slider yourself at any time to prioritize a lower price or
            faster processing. Lower settings spend fewer Credits, while higher
            settings move requests higher in the network queue.
          </p>
          <div class="mt-8 grid grid-cols-2 gap-6 border-t border-white/10 pt-6">
            <div>
              <p class="text-2xl font-bold text-white">Pay for usage</p>
              <p class="mt-1 text-sm text-white/50">Input and output tokens</p>
            </div>
            <div>
              <p class="text-2xl font-bold text-white">Cost Level</p>
              <p class="mt-1 text-sm text-white/50">Per project</p>
            </div>
          </div>
        </HomeReveal>

        <HomeReveal :delay="0.08">
          <div
            class="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/20 sm:p-8"
          >
            <div class="flex items-end justify-between gap-4">
              <div>
                <p class="text-sm font-medium text-white/55">Current Setting</p>
                <p class="mt-1 text-sm text-white/45">
                  Drag to compare example Credits
                </p>
              </div>
              <p class="text-4xl font-semibold text-primary">
                {{ currentSettingLabel }}
              </p>
            </div>

            <div
              class="mt-8 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3"
            >
              <span class="text-xs font-medium text-white/55">Cheaper</span>
              <Slider
                v-model="sliderIndex"
                :min="0"
                :max="tokenRatioOptions.length - 1"
                :step="1"
                aria-label="Example price and speed setting"
                class="[&_[data-slot=slider-track]]:bg-white/15"
              />
              <span class="text-xs font-medium text-white/55">Faster</span>
            </div>

            <div class="mt-8 space-y-3 sm:hidden">
              <div
                v-for="row in pricingRows"
                :key="row.model"
                class="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4"
              >
                <div class="min-w-0">
                  <div class="break-all font-medium text-white">{{ row.model }}</div>
                  <div class="mt-0.5 text-xs text-white/45">{{ row.minVram }} GB</div>
                </div>
                <div class="mt-3 grid grid-cols-2 gap-3 border-t border-white/10 pt-3">
                  <div>
                    <p class="text-xs text-white/55">1M Input</p>
                    <p class="mt-1 tabular-nums text-white">
                      <span class="font-semibold">{{ formatCredits(row.inputCredits) }}</span>
                      <span class="ml-1 text-xs text-white/45">Credits</span>
                    </p>
                  </div>
                  <div>
                    <p class="text-xs text-white/55">1M Output</p>
                    <p class="mt-1 tabular-nums text-white">
                      <span class="font-semibold">{{ formatCredits(row.outputCredits) }}</span>
                      <span class="ml-1 text-xs text-white/45">Credits</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-8 hidden overflow-x-auto rounded-2xl border border-white/10 sm:block">
              <table class="w-full text-left text-sm">
                <thead class="border-b border-white/10 bg-white/[0.05] text-white/55">
                  <tr>
                    <th class="px-4 py-3 font-medium sm:px-5">Model</th>
                    <th class="px-4 py-3 text-right font-medium sm:px-5">1M Input</th>
                    <th class="px-4 py-3 text-right font-medium sm:px-5">1M Output</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in pricingRows"
                    :key="row.model"
                    class="border-b border-white/10 last:border-0"
                  >
                    <td class="px-4 py-4 text-white sm:px-5">
                      <div class="font-medium">{{ row.model }}</div>
                      <div class="mt-0.5 text-xs text-white/45">
                        {{ row.minVram }} GB
                      </div>
                    </td>
                    <td class="px-4 py-4 text-right tabular-nums text-white sm:px-5">
                      <span class="font-semibold">{{ formatCredits(row.inputCredits) }}</span>
                      <span class="ml-1 text-xs text-white/45">Credits</span>
                    </td>
                    <td class="px-4 py-4 text-right tabular-nums text-white sm:px-5">
                      <span class="font-semibold">{{ formatCredits(row.outputCredits) }}</span>
                      <span class="ml-1 text-xs text-white/45">Credits</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p class="mt-4 text-xs leading-relaxed text-white/40">
              Illustrative values. Actual charges depend on the selected model,
              execution time, VRAM, and Cost Level.
            </p>
          </div>
        </HomeReveal>
      </div>
    </div>
  </section>
</template>
