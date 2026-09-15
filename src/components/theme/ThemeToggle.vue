<script setup>
import { Moon, Sun } from 'lucide-vue-next'
import { onMounted, onUnmounted, ref } from 'vue'
import { resolveTheme, toggleTheme } from '@/lib/theme'

const theme = ref('light')

function syncTheme() {
  theme.value = resolveTheme()
}

function onToggle() {
  const next = toggleTheme()
  theme.value = next
}

function onStorage(event) {
  if (event.key === 'crynux-as-theme') syncTheme()
}

onMounted(() => {
  syncTheme()
  window.addEventListener('storage', onStorage)
})

onUnmounted(() => {
  window.removeEventListener('storage', onStorage)
})
</script>

<template>
  <button
    type="button"
    aria-label="Toggle dark mode"
    class="flex size-10 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
    @click="onToggle"
  >
    <Sun v-if="theme === 'dark'" class="size-[18px]" />
    <Moon v-else class="size-[18px]" />
  </button>
</template>
