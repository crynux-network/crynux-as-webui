<script setup>
import { computed, ref } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { Coins, FolderKanban, LogOut, MessageCircle } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import ThemeToggle from '@/components/theme/ThemeToggle.vue'
import GetSupportDialog from '@/components/support/GetSupportDialog.vue'
import SignOutDialog from '@/components/layout/SignOutDialog.vue'
import { useAuthStore } from '@/stores/auth'
import { useWalletStore } from '@/stores/wallet'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const wallet = useWalletStore()
const supportOpen = ref(false)
const signOutOpen = ref(false)
const signOutBusy = ref(false)

const creditsNavActive = computed(() => route.name === 'credits')

const projectsNavActive = computed(
  () => route.name === 'projects' || route.name === 'project-detail',
)

async function confirmSignOut() {
  signOutBusy.value = true
  try {
    await wallet.disconnectWallet()
    signOutOpen.value = false
    router.push({ name: 'home' })
  } finally {
    signOutBusy.value = false
  }
}
</script>

<template>
  <div class="flex h-full w-full overflow-hidden bg-background">
    <aside
      class="flex h-full w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
    >
      <div class="flex h-14 items-center border-b border-sidebar-border px-4">
        <RouterLink
          :to="{ name: 'projects' }"
          class="flex min-w-0 items-center gap-2 text-sm font-semibold tracking-tight"
        >
          <img
            src="/home/crynux_as_logo_solid_triangle.svg?v=3"
            alt=""
            aria-hidden="true"
            class="size-6 shrink-0 object-contain"
          />
          <span class="truncate">Crynux AI Services</span>
        </RouterLink>
      </div>

      <nav class="flex-1 overflow-hidden px-2 py-3">
        <RouterLink
          :to="{ name: 'projects' }"
          class="flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
          :class="
            projectsNavActive
              ? 'bg-sidebar-primary font-medium text-sidebar-primary-foreground'
              : ''
          "
        >
          <FolderKanban class="size-4" />
          Projects
        </RouterLink>
        <RouterLink
          :to="{ name: 'credits' }"
          class="mt-1 flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
          :class="
            creditsNavActive
              ? 'bg-sidebar-primary font-medium text-sidebar-primary-foreground'
              : ''
          "
        >
          <Coins class="size-4" />
          Credits
        </RouterLink>
      </nav>

      <div class="border-t border-sidebar-border p-3">
        <div class="mb-2 flex items-center gap-1 px-1">
          <div class="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {{ wallet.shortAddress() || auth.sessionAddress }}
          </div>
          <div class="flex shrink-0 items-center">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger as-child>
                  <button
                    type="button"
                    aria-label="Get support"
                    class="flex size-10 cursor-pointer items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/10"
                    @click="supportOpen = true"
                  >
                    <MessageCircle class="size-[18px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Get support
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <ThemeToggle />
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          class="w-full justify-start gap-2"
          @click="signOutOpen = true"
        >
          <LogOut class="size-4" />
          Sign out
        </Button>
      </div>
    </aside>

    <GetSupportDialog v-model:open="supportOpen" />
    <SignOutDialog
      v-model:open="signOutOpen"
      :busy="signOutBusy"
      @confirm="confirmSignOut"
    />

    <main class="min-h-0 min-w-0 flex-1 overflow-y-auto">
      <div class="w-full px-6 py-8">
        <RouterView />
      </div>
    </main>
  </div>
</template>
