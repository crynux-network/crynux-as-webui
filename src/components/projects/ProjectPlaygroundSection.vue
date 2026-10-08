<script setup>
import { ref } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ChatPlayground from '@/components/projects/playground/ChatPlayground.vue'
import ImagePlayground from '@/components/projects/playground/ImagePlayground.vue'

defineProps({
  endpointToken: {
    type: String,
    required: true,
  },
})

const playgroundOpen = ref(false)
const playgroundTab = ref('chat')
</script>

<template>
  <section class="mb-8 rounded-xl border border-border">
    <button
      type="button"
      class="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      :aria-expanded="playgroundOpen"
      @click="playgroundOpen = !playgroundOpen"
    >
      <span class="flex items-center gap-2">
        <ChevronDown
          class="size-4 shrink-0 text-muted-foreground transition-transform"
          :class="playgroundOpen ? 'rotate-0' : '-rotate-90'"
        />
        <span class="text-base font-semibold tracking-tight">
          Playground
        </span>
      </span>
      <span
        v-if="!playgroundOpen"
        class="text-sm text-muted-foreground"
      >
        Chat and image generation
      </span>
    </button>

    <div
      v-if="playgroundOpen"
      class="border-t border-border px-5 pb-5 pt-4"
    >
      <Tabs v-model="playgroundTab">
        <TabsList variant="line" class="mb-4">
          <TabsTrigger value="chat">
            Chat
          </TabsTrigger>
          <TabsTrigger value="image">
            Image generation
          </TabsTrigger>
        </TabsList>
        <TabsContent value="chat">
          <ChatPlayground :endpoint-token="endpointToken" />
        </TabsContent>
        <TabsContent value="image">
          <ImagePlayground :endpoint-token="endpointToken" />
        </TabsContent>
      </Tabs>
    </div>
  </section>
</template>
