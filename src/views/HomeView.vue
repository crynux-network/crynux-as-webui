<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { useWalletConnect } from '@/composables/use-wallet-connect'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const { connect } = useWalletConnect()
const loading = ref(false)

function goDashboard() {
  router.push({ name: 'projects' })
}

async function onConnect() {
  loading.value = true
  try {
    const result = await connect({ name: 'projects' })
    if (result.success) return

    if (result.reason === 'missing_project_id') {
      toast.error(
        'Missing VITE_REOWN_PROJECT_ID. Create one at https://dashboard.reown.com and add it to .env',
      )
    } else if (result.reason === 'connect_cancelled') {
      toast.error('Wallet connection was cancelled.')
    } else if (result.reason === 'auth_failed') {
      toast.error('Authentication failed or was rejected.')
    } else if (result.reason === 'already_authenticating') {
      toast.error('Authentication is already in progress.')
    } else {
      toast.error('Could not connect wallet. Please try again later.')
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center bg-background px-6">
    <div class="mx-auto w-full max-w-xl text-center">
      <p class="mb-2 text-sm font-medium uppercase tracking-widest text-muted-foreground">
        Crynux AI Services
      </p>
      <h1 class="mb-4 text-4xl font-semibold tracking-tight text-foreground">
        Home
      </h1>
      <p class="mb-8 text-muted-foreground">
        Homepage content placeholder. Connect your wallet to open the dashboard.
      </p>

      <Button v-if="auth.isAuthenticated" size="lg" @click="goDashboard">
        Dashboard
      </Button>
      <Button
        v-else
        size="lg"
        :disabled="loading || auth.isAuthenticating"
        @click="onConnect"
      >
        {{ loading || auth.isAuthenticating ? 'Connecting…' : 'Connect Wallet' }}
      </Button>
    </div>
  </div>
</template>
