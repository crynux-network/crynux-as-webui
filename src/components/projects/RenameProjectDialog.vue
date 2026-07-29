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
import { toast } from 'vue-sonner'

const open = defineModel('open', { type: Boolean, default: false })

const props = defineProps({
  projectId: { type: [Number, String], default: null },
  projectName: { type: String, default: '' },
  tokenRatio: { type: Number, default: 1 },
})

const emit = defineEmits(['renamed'])

const name = ref('')
const submitting = ref(false)
const errorMessage = ref('')

watch(open, (isOpen) => {
  if (isOpen) {
    name.value = props.projectName || ''
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
  if (props.projectId == null) return

  errorMessage.value = ''
  submitting.value = true
  try {
    const project = await projectsAPI.update(props.projectId, {
      name: trimmed,
      token_ratio: props.tokenRatio,
    })
    open.value = false
    emit('renamed', project)
  } catch (e) {
    console.error('Failed to rename project', e)
    toast.error(
      projectErrorMessage(e, 'Could not rename project. Please try again later.'),
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
        <DialogTitle>Rename project</DialogTitle>
        <DialogDescription>
          Update the display name for this project.
        </DialogDescription>
      </DialogHeader>

      <form class="grid gap-4" @submit.prevent="onSubmit">
        <div class="grid gap-2">
          <Label for="rename-project-name">Name</Label>
          <Input
            id="rename-project-name"
            v-model="name"
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
            {{ submitting ? 'Saving…' : 'Save' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
