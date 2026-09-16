<script setup>
import { onMounted, ref } from 'vue'
import { shapes } from '@/components/home/crynux-shards'
import { prefersReducedMotion } from '@/lib/theme'

defineProps({
  class: {
    type: String,
    default: '',
  },
})

const assembled = ref(false)

onMounted(() => {
  if (prefersReducedMotion()) {
    assembled.value = true
    return
  }
  requestAnimationFrame(() => {
    assembled.value = true
  })
})

function shardStyle(shape) {
  const delay = shape.c.rc * 40
  if (assembled.value) {
    return {
      opacity: 1,
      transform: 'translate(0px, 0px) scale(1)',
      transition: `opacity 0.55s cubic-bezier(0.32, 0.72, 0, 1) ${delay}ms, transform 0.55s cubic-bezier(0.32, 0.72, 0, 1) ${delay}ms`,
      transformBox: 'fill-box',
      transformOrigin: 'center',
    }
  }
  return {
    opacity: 0,
    transform: `translate(${shape.c.ox}px, ${shape.c.oy}px) scale(0.8)`,
    transition: `opacity 0.55s cubic-bezier(0.32, 0.72, 0, 1) ${delay}ms, transform 0.55s cubic-bezier(0.32, 0.72, 0, 1) ${delay}ms`,
    transformBox: 'fill-box',
    transformOrigin: 'center',
  }
}
</script>

<template>
  <svg
    viewBox="0 0 64 64"
    role="img"
    aria-label="Crynux AI Services logo"
    class="overflow-visible"
    :class="$props.class"
  >
    <g v-for="(shape, index) in shapes" :key="index" :style="shardStyle(shape)">
      <path :d="shape.d" :fill="shape.fill" />
    </g>
  </svg>
</template>
