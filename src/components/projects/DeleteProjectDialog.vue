<script setup>
import { ref, watch } from 'vue'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { projectsAPI } from '@/api/v1/projects'
import { projectErrorMessage } from '@/lib/project-ui'
import { toast } from 'vue-sonner'

const open = defineModel('open', { type: Boolean, default: false })

const props = defineProps({
  projectId: { type: [Number, String], default: null },
  projectName: { type: String, default: '' },
})

const emit = defineEmits(['deleted'])

const submitting = ref(false)

watch(open, (isOpen) => {
  if (isOpen) {
    submitting.value = false
  }
})

async function onConfirm() {
  if (props.projectId == null) return

  submitting.value = true
  try {
    await projectsAPI.remove(props.projectId)
    open.value = false
    emit('deleted')
  } catch (e) {
    console.error('Failed to delete project', e)
    toast.error(
      projectErrorMessage(e, 'Could not delete project. Please try again later.'),
    )
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AlertDialog v-model:open="open">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete project</AlertDialogTitle>
        <AlertDialogDescription>
          Delete
          <span class="font-medium text-foreground">
            {{ projectName || 'this project' }}
          </span>
          permanently? The private LLM endpoint and API key stop working
          immediately. This cannot be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>

      <AlertDialogFooter>
        <AlertDialogCancel as-child>
          <Button variant="outline" :disabled="submitting">Cancel</Button>
        </AlertDialogCancel>
        <Button
          variant="destructive"
          :disabled="submitting || projectId == null"
          @click="onConfirm"
        >
          {{ submitting ? 'Deleting…' : 'Delete' }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
