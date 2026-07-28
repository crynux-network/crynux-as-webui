<script setup>
import { ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { projectsAPI } from '@/api/v1/projects'
import { projectErrorMessage } from '@/lib/project-ui'

const open = defineModel('open', { type: Boolean, default: false })

const emit = defineEmits(['created'])

const name = ref('')
const submitting = ref(false)
const errorMessage = ref('')

watch(open, (isOpen) => {
  if (isOpen) {
    name.value = ''
    errorMessage.value = ''
    submitting.value = false
  }
})

async function onSubmit() {
  const trimmed = name.value.trim()
  if (!trimmed) {
    errorMessage.value = 'Project name is required.'
    return
  }

  errorMessage.value = ''
  submitting.value = true
  try {
    const project = await projectsAPI.create({ name: trimmed })
    open.value = false
    emit('created', project)
  } catch (e) {
    console.error('Failed to create project', e)
    errorMessage.value = projectErrorMessage(
      e,
      'Could not create project. Please try again.',
    )
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Create project</DialogTitle>
        <DialogDescription>
          Creates a project with a private LLM endpoint and a one-time API key.
        </DialogDescription>
      </DialogHeader>

      <form class="grid gap-4" @submit.prevent="onSubmit">
        <div class="grid gap-2">
          <Label for="project-name">Name</Label>
          <Input
            id="project-name"
            v-model="name"
            placeholder="My project"
            :disabled="submitting"
            autocomplete="off"
          />
        </div>

        <p v-if="errorMessage" class="text-sm text-destructive">
          {{ errorMessage }}
        </p>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            :disabled="submitting"
            @click="open = false"
          >
            Cancel
          </Button>
          <Button type="submit" :disabled="submitting">
            {{ submitting ? 'Creating…' : 'Create' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
