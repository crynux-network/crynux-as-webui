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
})

const emit = defineEmits(['reset'])

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
    const data = await projectsAPI.resetApiKey(props.projectId)
    open.value = false
    emit('reset', data)
  } catch (e) {
    console.error('Failed to reset API key', e)
    toast.error(
      projectErrorMessage(e, 'Could not reset API key. Please try again later.'),
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
        <AlertDialogTitle>Reset API key</AlertDialogTitle>
        <AlertDialogDescription>
          Generate a new API key for this project? The current key is
          invalidated immediately. The new plaintext key is shown only once.
        </AlertDialogDescription>
      </AlertDialogHeader>

      <AlertDialogFooter>
        <AlertDialogCancel as-child>
          <Button variant="outline" :disabled="submitting">Cancel</Button>
        </AlertDialogCancel>
        <Button
          :disabled="submitting || projectId == null"
          @click="onConfirm"
        >
          {{ submitting ? 'Resetting…' : 'Reset key' }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
