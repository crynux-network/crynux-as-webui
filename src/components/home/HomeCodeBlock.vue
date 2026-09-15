<script setup>
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'
import python from 'highlight.js/lib/languages/python'
import { computed } from 'vue'
import 'highlight.js/styles/atom-one-dark.css'

hljs.registerLanguage('python', python)
hljs.registerLanguage('json', json)

const props = defineProps({
  code: {
    type: String,
    required: true,
  },
  language: {
    type: String,
    required: true,
  },
})

const highlighted = computed(() => {
  if (!props.code || !props.language) return ''
  return hljs.highlight(props.code, { language: props.language }).value
})
</script>

<template>
  <pre
    class="home-code-block max-w-full overflow-x-auto rounded-[1.5rem] border border-black/20 p-4 text-sm leading-relaxed sm:p-6"
  ><code
      class="hljs block whitespace-pre"
      :class="`language-${language}`"
      v-html="highlighted"
    /></pre>
</template>
