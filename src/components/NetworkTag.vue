<script setup>
import { computed } from 'vue'
import {
  networkTagClass,
  purchaseNetworkLabel,
} from '@/lib/purchase-icons'

const props = defineProps({
  networkId: {
    type: String,
    default: '',
  },
  label: {
    type: String,
    default: '',
  },
})

const text = computed(
  () =>
    props.label ||
    purchaseNetworkLabel(props.networkId) ||
    props.networkId ||
    '—',
)

const tagClass = computed(() => networkTagClass(props.networkId))
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-medium"
    :class="tagClass"
  >
    {{ text }}
  </span>
</template>
