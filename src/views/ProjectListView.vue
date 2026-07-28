<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Plus } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import CreateProjectDialog from '@/components/projects/CreateProjectDialog.vue'
import ApiKeyRevealDialog from '@/components/projects/ApiKeyRevealDialog.vue'
import { projectsAPI } from '@/api/v1/projects'
import { formatTokenRatio } from '@/lib/token-ratio'
import {
  formatProjectCreatedAt,
  projectErrorMessage,
  projectStatusLabel,
} from '@/lib/project-ui'

const router = useRouter()

const projects = ref([])
const loading = ref(false)
const errorMessage = ref('')
const createOpen = ref(false)
const revealOpen = ref(false)
const revealedApiKey = ref('')

async function loadProjects() {
  errorMessage.value = ''
  loading.value = true
  try {
    const data = await projectsAPI.list()
    projects.value = data?.projects ?? []
  } catch (e) {
    console.error('Failed to list projects', e)
    errorMessage.value = projectErrorMessage(
      e,
      'Could not load projects. Please try again.',
    )
  } finally {
    loading.value = false
  }
}

function openProject(project) {
  router.push({ name: 'project-detail', params: { id: String(project.id) } })
}

function onCreated(project) {
  revealedApiKey.value = project?.api_key || ''
  revealOpen.value = true
  loadProjects()
}

function onRevealDone() {
  revealedApiKey.value = ''
}

onMounted(() => {
  loadProjects()
})
</script>

<template>
  <div class="w-full">
    <div class="mb-6 flex items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Projects</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          Manage private LLM endpoints and API keys for your account.
        </p>
      </div>
      <Button size="sm" class="gap-1.5" @click="createOpen = true">
        <Plus class="size-4" />
        Create project
      </Button>
    </div>

    <p v-if="errorMessage" class="mb-4 text-sm text-destructive">
      {{ errorMessage }}
      <button
        type="button"
        class="ml-2 underline underline-offset-2"
        @click="loadProjects"
      >
        Retry
      </button>
    </p>

    <div
      v-if="loading && projects.length === 0"
      class="rounded-lg border border-border px-4 py-10 text-center text-sm text-muted-foreground"
    >
      Loading projects…
    </div>

    <div
      v-else-if="!loading && projects.length === 0 && !errorMessage"
      class="rounded-lg border border-dashed border-border px-4 py-10 text-center"
    >
      <p class="text-sm text-muted-foreground">No projects yet.</p>
      <Button class="mt-4" size="sm" @click="createOpen = true">
        Create your first project
      </Button>
    </div>

    <div
      v-else-if="projects.length > 0"
      class="overflow-hidden rounded-lg border border-border"
    >
      <table class="w-full text-left text-sm">
        <thead class="border-b border-border bg-muted/40 text-muted-foreground">
          <tr>
            <th class="px-4 py-2.5 font-medium">Name</th>
            <th class="px-4 py-2.5 font-medium">API key</th>
            <th class="px-4 py-2.5 font-medium">Cost level</th>
            <th class="px-4 py-2.5 font-medium">Status</th>
            <th class="px-4 py-2.5 font-medium">Created</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="project in projects"
            :key="project.id"
            class="cursor-pointer border-b border-border last:border-b-0 hover:bg-muted/40"
            @click="openProject(project)"
          >
            <td class="px-4 py-3 font-medium text-foreground">
              {{ project.name }}
            </td>
            <td class="px-4 py-3 font-mono text-xs text-muted-foreground">
              {{ project.api_key_prefix }}…
            </td>
            <td class="px-4 py-3 text-muted-foreground">
              {{ formatTokenRatio(project.token_ratio) }}×
            </td>
            <td class="px-4 py-3 text-muted-foreground">
              {{ projectStatusLabel(project.status) }}
            </td>
            <td class="px-4 py-3 text-muted-foreground">
              {{ formatProjectCreatedAt(project.created_at) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <CreateProjectDialog v-model:open="createOpen" @created="onCreated" />
    <ApiKeyRevealDialog
      v-model:open="revealOpen"
      :api-key="revealedApiKey"
      @done="onRevealDone"
    />
  </div>
</template>
