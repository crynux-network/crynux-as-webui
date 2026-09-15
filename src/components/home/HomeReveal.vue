<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { prefersReducedMotion } from '@/lib/theme'

const props = defineProps({
  delay: {
    type: Number,
    default: 0,
  },
  class: {
    type: String,
    default: '',
  },
})

const root = ref(null)
const visible = ref(false)
let observer

function markVisible() {
  visible.value = true
  observer?.disconnect()
  observer = null
}

onMounted(() => {
  if (prefersReducedMotion()) {
    markVisible()
    return
  }

  const el = root.value
  if (!el) {
    markVisible()
    return
  }

  const rect = el.getBoundingClientRect()
  if (rect.top < window.innerHeight * 0.95 && rect.bottom > 0) {
    markVisible()
    return
  }

  const scrollRoot = el.closest('.home-page')
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          markVisible()
          break
        }
      }
    },
    { root: scrollRoot instanceof Element ? scrollRoot : null, threshold: 0.15 },
  )
  observer.observe(el)
})

onUnmounted(() => {
  observer?.disconnect()
})
</script>

<template>
  <div
    ref="root"
    class="home-reveal"
    :class="[props.class, visible ? 'is-visible' : '']"
    :style="{ transitionDelay: `${delay}s` }"
  >
    <slot />
  </div>
</template>
