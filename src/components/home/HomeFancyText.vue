<script setup>
defineProps({
  class: {
    type: String,
    default: '',
  },
})
</script>

<template>
  <span class="home-fancy-text" :class="$props.class">
    <slot />
  </span>
</template>
