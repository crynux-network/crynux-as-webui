<script setup>
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { Coins, FolderKanban, LogOut } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth'
import { useWalletStore } from '@/stores/wallet'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const wallet = useWalletStore()

const creditsNavActive = computed(() => route.name === 'credits')

const projectsNavActive = computed(
  () => route.name === 'projects' || route.name === 'project-detail',
)

async function signOut() {
  await wallet.disconnectWallet()
  router.push({ name: 'home' })
}
</script>

<template>
  <div class="flex h-screen w-full overflow-hidden bg-background">
    <aside
      class="flex h-full w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
    >
      <div class="flex h-14 items-center border-b border-sidebar-border px-4">
        <RouterLink to="/" class="truncate text-sm font-semibold tracking-tight">
          Crynux AS
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
        <div class="mb-2 truncate px-1 text-xs text-muted-foreground">
          {{ wallet.shortAddress() || auth.sessionAddress }}
        </div>
        <Button variant="outline" size="sm" class="w-full justify-start gap-2" @click="signOut">
          <LogOut class="size-4" />
          Sign out
        </Button>
      </div>
    </aside>

    <main class="min-h-0 min-w-0 flex-1 overflow-y-auto">
      <div class="h-full w-full px-6 py-8">
        <RouterView />
      </div>
    </main>
  </div>
</template>
