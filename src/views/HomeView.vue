<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { useWalletConnect } from '@/composables/use-wallet-connect'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const { connect } = useWalletConnect()
const errorMessage = ref('')
const loading = ref(false)

function goDashboard() {
  router.push({ name: 'projects' })
}

async function onConnect() {
  errorMessage.value = ''
  loading.value = true
  try {
    const result = await connect({ name: 'projects' })
    if (result.success) return

    if (result.reason === 'missing_project_id') {
      errorMessage.value =
        'Missing VITE_REOWN_PROJECT_ID. Create one at https://dashboard.reown.com and add it to .env'
    } else if (result.reason === 'connect_cancelled') {
      errorMessage.value = 'Wallet connection was cancelled.'
    } else if (result.reason === 'auth_failed') {
      errorMessage.value = 'Authentication failed or was rejected.'
    } else if (result.reason === 'already_authenticating') {
      errorMessage.value = 'Authentication is already in progress.'
    } else {
      errorMessage.value = 'Could not connect wallet. Please try again.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center bg-background px-6">
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

      <p v-if="errorMessage" class="mt-4 text-sm text-destructive">
        {{ errorMessage }}
      </p>
    </div>
  </div>
</template>
