<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Plus } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import CreateProjectDialog from '@/components/projects/CreateProjectDialog.vue'
import ApiKeyRevealDialog from '@/components/projects/ApiKeyRevealDialog.vue'
import ProjectListItem from '@/components/projects/ProjectListItem.vue'
import { projectsAPI } from '@/api/v1/projects'
import { projectErrorMessage } from '@/lib/project-ui'

const router = useRouter()

const projects = ref([])
const loading = ref(false)
const projectsReady = ref(false)
const createOpen = ref(false)
const revealOpen = ref(false)
const revealedApiKey = ref('')

async function loadProjects() {
  loading.value = true
  try {
    const data = await projectsAPI.list()
    projects.value = data?.projects ?? []
    projectsReady.value = true
  } catch (e) {
    console.error('Failed to list projects', e)
    toast.error(
      projectErrorMessage(e, 'Could not load projects. Please try again later.'),
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

    <div
      v-if="loading && projects.length === 0"
      class="rounded-lg border border-border px-4 py-10 text-center text-sm text-muted-foreground"
    >
      Loading projects…
    </div>

    <div
      v-else-if="projectsReady && projects.length === 0"
      class="rounded-lg border border-dashed border-border px-4 py-10 text-center"
    >
      <p class="text-sm text-muted-foreground">No projects yet.</p>
      <Button class="mt-4" size="sm" @click="createOpen = true">
        Create your first project
      </Button>
    </div>

    <div v-else-if="projects.length > 0" class="flex flex-col gap-3">
      <ProjectListItem
        v-for="project in projects"
        :key="project.id"
        :project="project"
        @open="openProject"
      />
    </div>

    <CreateProjectDialog v-model:open="createOpen" @created="onCreated" />
    <ApiKeyRevealDialog
      v-model:open="revealOpen"
      :api-key="revealedApiKey"
      @done="onRevealDone"
    />
  </div>
</template>
