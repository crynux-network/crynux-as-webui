<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import HomeCta from '@/components/home/HomeCta.vue'
import HomeFooter from '@/components/home/HomeFooter.vue'
import HomeHeader from '@/components/home/HomeHeader.vue'
import HomeHero from '@/components/home/HomeHero.vue'
import HomeHighlights from '@/components/home/HomeHighlights.vue'
import HomeIntegrations from '@/components/home/HomeIntegrations.vue'
import HomePricing from '@/components/home/HomePricing.vue'
import HomeServices from '@/components/home/HomeServices.vue'
import HomeUseCases from '@/components/home/HomeUseCases.vue'
import { useWalletConnect } from '@/composables/use-wallet-connect'
import { useAuthStore } from '@/stores/auth'
import '@/assets/home.css'

const router = useRouter()
const auth = useAuthStore()
const { connect } = useWalletConnect()
const loading = ref(false)

function goDashboard() {
  router.push({ name: 'projects' })
}

async function onPrimary() {
  if (auth.isAuthenticated) {
    goDashboard()
    return
  }

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
  <div class="home-page h-full overflow-x-hidden overflow-y-auto bg-[var(--home-background)] text-foreground">
    <HomeHeader
      :authenticated="auth.isAuthenticated"
      :loading="loading || auth.isAuthenticating"
      @primary="onPrimary"
    />
    <HomeHero
      :authenticated="auth.isAuthenticated"
      :loading="loading || auth.isAuthenticating"
      @primary="onPrimary"
    />
    <HomeServices />
    <HomePricing />
    <HomeIntegrations />
    <HomeHighlights />
    <HomeUseCases />
    <HomeCta
      :authenticated="auth.isAuthenticated"
      :loading="loading || auth.isAuthenticating"
      @primary="onPrimary"
    />
    <HomeFooter />
  </div>
</template>
