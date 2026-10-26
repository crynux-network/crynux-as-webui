<script setup>
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import config from '@/config.json'

const open = defineModel('open', { type: Boolean, default: false })
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Get support</DialogTitle>
        <DialogDescription>
          Need help with requests or API integration? Join Crynux Discord for
          real-time technical support from the team and community.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter class="gap-2 sm:gap-2">
        <Button type="button" variant="outline" @click="open = false">
          Close
        </Button>
        <Button as-child>
          <a
            :href="config.discord_url"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open Discord
          </a>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
