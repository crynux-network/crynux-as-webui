<script setup>
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { FolderKanban, LogOut } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth'
import { useWalletStore } from '@/stores/wallet'

const router = useRouter()
const auth = useAuthStore()
const wallet = useWalletStore()

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
          class="flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          active-class="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
        >
          <FolderKanban class="size-4" />
          Projects
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
      <RouterView />
    </main>
  </div>
</template>
