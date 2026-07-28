<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import ApiKeyRevealDialog from '@/components/projects/ApiKeyRevealDialog.vue'
import DeleteProjectDialog from '@/components/projects/DeleteProjectDialog.vue'
import RenameProjectDialog from '@/components/projects/RenameProjectDialog.vue'
import ResetApiKeyDialog from '@/components/projects/ResetApiKeyDialog.vue'
import ApiError from '@/api/api-error'
import { llmAPI } from '@/api/v1/llm'
import { projectsAPI } from '@/api/v1/projects'
import { projectLlmBaseUrl } from '@/lib/project-url'
import {
  DEFAULT_VRAM_TIERS,
  buildPricingRows,
  formatCredits,
} from '@/lib/llm-billing'
import {
  TOKEN_RATIO_SLIDER_MAX,
  formatTokenRatio,
  sliderIndexToTokenRatio,
  tokenRatioToSliderIndex,
} from '@/lib/token-ratio'
import {
  copyText,
  projectErrorMessage,
} from '@/lib/project-ui'
import { toast } from 'vue-sonner'

const route = useRoute()
const router = useRouter()

const project = ref(null)
const loading = ref(false)
const savingRatio = ref(false)
const errorMessage = ref('')
const sliderIndex = ref([tokenRatioToSliderIndex(1)])
const savedTokenRatio = ref(1)
const vramTiers = ref([...DEFAULT_VRAM_TIERS])
const urlCopied = ref(false)
let urlCopiedTimer = null
let ratioSaveTimer = null
let syncingSlider = false
const COST_LEVEL_TOAST_ID = 'cost-level-save'
const COST_LEVEL_SAVE_DELAY_MS = 3000

const revealOpen = ref(false)
const revealedApiKey = ref('')
const deleteOpen = ref(false)
const resetOpen = ref(false)
const renameOpen = ref(false)
const costLevelOpen = ref(false)

const projectId = computed(() => route.params.id)
const llmBaseUrl = computed(() =>
  project.value?.endpoint_token
    ? projectLlmBaseUrl(project.value.endpoint_token)
    : '',
)
const currentTokenRatio = computed(() =>
  sliderIndexToTokenRatio(sliderIndex.value[0]),
)
const ratioDirty = computed(
  () =>
    formatTokenRatio(currentTokenRatio.value) !==
    formatTokenRatio(savedTokenRatio.value),
)
const pricingRows = computed(() =>
  buildPricingRows(vramTiers.value, currentTokenRatio.value),
)

watch(projectId, () => {
  clearRatioSaveTimer()
  loadProject()
})

watch(
  () => sliderIndex.value?.[0],
  () => {
    if (syncingSlider || !project.value) return
    scheduleRatioSave()
  },
)

function clearRatioSaveTimer() {
  if (ratioSaveTimer) {
    clearTimeout(ratioSaveTimer)
    ratioSaveTimer = null
  }
}

function scheduleRatioSave() {
  clearRatioSaveTimer()
  if (!ratioDirty.value) return
  ratioSaveTimer = setTimeout(() => {
    ratioSaveTimer = null
    saveCostLevel()
  }, COST_LEVEL_SAVE_DELAY_MS)
}

function showCostLevelToast(type, message) {
  if (type === 'success') {
    toast.success(message, { id: COST_LEVEL_TOAST_ID })
  } else {
    toast.error(message, { id: COST_LEVEL_TOAST_ID })
  }
}

function setSliderFromRatio(tokenRatio) {
  syncingSlider = true
  sliderIndex.value = [tokenRatioToSliderIndex(tokenRatio)]
  syncingSlider = false
}

async function loadVramTiers() {
  try {
    const data = await llmAPI.getVramRatios()
    const tiers = Array.isArray(data) ? data : []
    if (tiers.length > 0) {
      vramTiers.value = tiers.map((tier) => ({
        max_vram: tier.max_vram,
        ratio: tier.ratio,
      }))
    }
  } catch (e) {
    console.error('Failed to load VRAM billing tiers', e)
    vramTiers.value = [...DEFAULT_VRAM_TIERS]
  }
}

async function loadProject() {
  errorMessage.value = ''
  loading.value = true
  try {
    const data = await projectsAPI.get(projectId.value)
    applyProject(data)
  } catch (e) {
    console.error('Failed to load project', e)
    if (e instanceof ApiError && e.type === ApiError.Type.NotFound) {
      router.replace({ name: 'projects' })
      return
    }
    errorMessage.value = projectErrorMessage(
      e,
      'Could not load project. Please try again.',
    )
  } finally {
    loading.value = false
  }
}

function applyProject(data) {
  project.value = data
  savedTokenRatio.value = Number(data.token_ratio)
  setSliderFromRatio(data.token_ratio)
}

async function onCopyUrl() {
  if (!llmBaseUrl.value) return
  try {
    await copyText(llmBaseUrl.value)
    urlCopied.value = true
    if (urlCopiedTimer) clearTimeout(urlCopiedTimer)
    urlCopiedTimer = setTimeout(() => {
      urlCopied.value = false
      urlCopiedTimer = null
    }, 2000)
  } catch (e) {
    console.error('Failed to copy LLM base URL', e)
  }
}

function onSelectUrl(event) {
  const el = event?.target
  if (el && typeof el.select === 'function') {
    el.select()
  }
}

async function saveCostLevel() {
  if (!project.value || !ratioDirty.value) return
  if (savingRatio.value) {
    scheduleRatioSave()
    return
  }

  const ratioToSave = currentTokenRatio.value
  savingRatio.value = true
  try {
    const data = await projectsAPI.update(project.value.id, {
      name: project.value.name,
      token_ratio: ratioToSave,
    })
    project.value = data
    savedTokenRatio.value = Number(data.token_ratio)
    if (
      formatTokenRatio(currentTokenRatio.value) ===
      formatTokenRatio(ratioToSave)
    ) {
      setSliderFromRatio(data.token_ratio)
    } else {
      scheduleRatioSave()
    }
    showCostLevelToast('success', 'Cost level saved')
  } catch (e) {
    console.error('Failed to update cost setting', e)
    showCostLevelToast(
      'error',
      projectErrorMessage(e, 'Could not save cost level. Please try again.'),
    )
    setSliderFromRatio(savedTokenRatio.value)
  } finally {
    savingRatio.value = false
  }
}

function onReset(data) {
  if (project.value && data?.api_key_prefix) {
    project.value = {
      ...project.value,
      api_key_prefix: data.api_key_prefix,
    }
  }
  revealedApiKey.value = data?.api_key || ''
  revealOpen.value = true
}

function onRevealDone() {
  revealedApiKey.value = ''
}

function onRenamed(data) {
  applyProject(data)
}

function onDeleted() {
  router.push({ name: 'projects' })
}

onMounted(() => {
  loadVramTiers()
  loadProject()
})

onUnmounted(() => {
  clearRatioSaveTimer()
  if (urlCopiedTimer) {
    clearTimeout(urlCopiedTimer)
    urlCopiedTimer = null
  }
})
</script>

<template>
  <div class="w-full">
    <Button
      variant="ghost"
      size="sm"
      class="mb-4 gap-1.5"
      @click="router.push({ name: 'projects' })"
    >
      <ArrowLeft class="size-4" />
      Projects
    </Button>

    <div v-if="loading && !project" class="text-sm text-muted-foreground">
      Loading project…
    </div>

    <template v-else-if="project">
      <p v-if="errorMessage" class="mb-4 text-sm text-destructive">
        {{ errorMessage }}
      </p>

      <!-- 1. LLM API credentials -->
      <section class="mb-8 rounded-xl border border-border bg-muted/40 p-5">
        <div class="mb-5 flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h1 class="truncate text-xl font-semibold tracking-tight">
              {{ project.name }}
            </h1>
            <p class="mt-1 text-sm text-muted-foreground">
              Private OpenAI-compatible LLM endpoint for this project.
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button
                variant="outline"
                size="icon"
                class="shrink-0"
                aria-label="Project actions"
              >
                <MoreHorizontal class="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-auto min-w-40">
              <DropdownMenuItem @click="renameOpen = true">
                <Pencil class="size-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" @click="deleteOpen = true">
                <Trash2 class="size-4" />
                Delete project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div class="grid gap-5">
          <div class="grid gap-2">
            <Label class="text-muted-foreground">Base URL</Label>
            <div class="flex w-fit max-w-md items-center gap-2">
              <Input
                :model-value="llmBaseUrl"
                readonly
                class="min-w-0 w-80 truncate bg-background font-mono text-xs"
                @focus="onSelectUrl"
                @click="onSelectUrl"
              />
              <Button
                variant="outline"
                size="icon"
                class="shrink-0 bg-background"
                :aria-label="urlCopied ? 'Copied' : 'Copy base URL'"
                @click="onCopyUrl"
              >
                <Check v-if="urlCopied" class="size-4" />
                <Copy v-else class="size-4" />
              </Button>
            </div>
          </div>

          <div class="grid gap-2">
            <Label class="text-muted-foreground">API key</Label>
            <div>
              <Button
                variant="outline"
                size="sm"
                class="h-8 bg-background"
                @click="resetOpen = true"
              >
                Reset
              </Button>
            </div>
          </div>
        </div>
      </section>

      <!-- 2. Cost Level -->
      <section class="mb-8 rounded-xl border border-border">
        <button
          type="button"
          class="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
          :aria-expanded="costLevelOpen"
          @click="costLevelOpen = !costLevelOpen"
        >
          <span class="flex items-center gap-2">
            <ChevronDown
              class="size-4 shrink-0 text-muted-foreground transition-transform"
              :class="costLevelOpen ? 'rotate-0' : '-rotate-90'"
            />
            <span class="text-base font-semibold tracking-tight">
              Cost Level
            </span>
          </span>
          <span
            v-if="!costLevelOpen"
            class="font-mono text-2xl font-semibold tabular-nums text-primary"
          >
            {{ formatTokenRatio(currentTokenRatio) }}×
          </span>
        </button>

        <div v-if="costLevelOpen" class="border-t border-border px-5 pb-5 pt-4">
          <div class="mb-5 max-w-3xl space-y-3 text-sm text-muted-foreground">
            <p>
              Every LLM call spends Credits from your account. The charge depends
              on input tokens, output tokens, and the model VRAM tier. Larger
              models (higher VRAM) cost more per token.
            </p>
            <p>
              This slider is your project cost level. Lower levels spend fewer
              Credits but jobs may wait longer on the network; higher levels
              spend more Credits and usually get scheduled faster.
            </p>
          </div>

          <div class="mb-6 flex items-center gap-3">
            <span
              class="shrink-0 font-mono text-2xl font-semibold tabular-nums text-primary"
            >
              {{ formatTokenRatio(currentTokenRatio) }}×
            </span>
            <span class="shrink-0 text-xs text-muted-foreground">Cheaper</span>
            <Slider
              v-model="sliderIndex"
              :min="0"
              :max="TOKEN_RATIO_SLIDER_MAX"
              :step="1"
              class="min-w-0 flex-1"
            />
            <span class="shrink-0 text-xs text-muted-foreground">Faster</span>
          </div>

          <div class="overflow-hidden rounded-xl border border-border bg-muted/30">
            <div class="border-b border-border px-4 py-3">
              <p class="text-sm font-medium text-foreground">
                Credits per 1M tokens
              </p>
              <p class="mt-0.5 text-xs text-muted-foreground">
                Prices update with your current cost level.
              </p>
            </div>
            <table class="w-full text-left text-sm">
              <thead>
                <tr class="border-b border-border text-muted-foreground">
                  <th class="px-4 py-3 font-medium">Name</th>
                  <th class="px-4 py-3 text-right font-medium">Input</th>
                  <th class="px-4 py-3 text-right font-medium">Output</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in pricingRows"
                  :key="row.id"
                  class="border-b border-border last:border-b-0"
                >
                  <td class="px-4 py-3.5 text-foreground">
                    {{ row.name }}
                  </td>
                  <td class="px-4 py-3.5 text-right font-semibold tabular-nums text-foreground">
                    {{ formatCredits(row.inputCredits) }}
                  </td>
                  <td class="px-4 py-3.5 text-right font-semibold tabular-nums text-foreground">
                    {{ formatCredits(row.outputCredits) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </template>

    <div v-else-if="errorMessage" class="text-sm text-destructive">
      {{ errorMessage }}
      <button
        type="button"
        class="ml-2 underline underline-offset-2"
        @click="loadProject"
      >
        Retry
      </button>
    </div>

    <RenameProjectDialog
      v-model:open="renameOpen"
      :project-id="project?.id"
      :project-name="project?.name"
      :token-ratio="savedTokenRatio"
      @renamed="onRenamed"
    />
    <ResetApiKeyDialog
      v-model:open="resetOpen"
      :project-id="project?.id"
      @reset="onReset"
    />
    <ApiKeyRevealDialog
      v-model:open="revealOpen"
      :api-key="revealedApiKey"
      @done="onRevealDone"
    />
    <DeleteProjectDialog
      v-model:open="deleteOpen"
      :project-id="project?.id"
      :project-name="project?.name"
      @deleted="onDeleted"
    />
  </div>
</template>
