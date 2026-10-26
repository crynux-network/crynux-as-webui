<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import ConnectWalletDialog from '@/components/home/ConnectWalletDialog.vue'
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
import { useWalletStore } from '@/stores/wallet'
import { readStoredInviteCode, storeInviteCode } from '@/lib/referral'
import '@/assets/home.css'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const wallet = useWalletStore()
const { ensureWalletConnected, signIn } = useWalletConnect()
const loading = ref(false)
const connectDialogOpen = ref(false)
const dialogStep = ref('connect')
const pendingInviteCode = ref('')

function goDashboard() {
  router.push({ name: 'projects' })
}

function showConnectError(result) {
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
}

function openConnectDialog() {
  if (auth.isAuthenticated) {
    goDashboard()
    return
  }
  dialogStep.value = 'connect'
  connectDialogOpen.value = true
}

async function onDialogConnect(inviteCode) {
  pendingInviteCode.value = inviteCode
  connectDialogOpen.value = false
  loading.value = true
  try {
    const connected = await ensureWalletConnected()
    if (!connected.success) {
      showConnectError(connected)
      dialogStep.value = 'connect'
      connectDialogOpen.value = true
      return
    }

    dialogStep.value = 'sign'
    connectDialogOpen.value = true

    const result = await signIn(
      { name: 'projects' },
      { inviteCode: pendingInviteCode.value },
    )
    connectDialogOpen.value = false
    dialogStep.value = 'connect'
    if (result.success) return
    showConnectError(result)
    connectDialogOpen.value = true
  } finally {
    loading.value = false
  }
}

async function onDialogOpenChange(open) {
  connectDialogOpen.value = open
  if (open) return
  if (dialogStep.value === 'sign' && !auth.isAuthenticated && !loading.value) {
    await wallet.disconnectWallet()
  }
  if (!loading.value) {
    dialogStep.value = 'connect'
  }
}

onMounted(() => {
  const refCode = String(route.query.ref || '').trim()
  if (refCode) {
    storeInviteCode(refCode)
  }
  if (!auth.isAuthenticated && (refCode || readStoredInviteCode())) {
    dialogStep.value = 'connect'
    connectDialogOpen.value = true
  }
})
</script>

<template>
  <div class="home-page h-full overflow-x-hidden overflow-y-auto bg-[var(--home-background)] text-foreground">
    <HomeHeader
      :authenticated="auth.isAuthenticated"
      :loading="loading || auth.isAuthenticating"
      @primary="openConnectDialog"
    />
    <HomeHero
      :authenticated="auth.isAuthenticated"
      :loading="loading || auth.isAuthenticating"
      @primary="openConnectDialog"
    />
    <HomeServices />
    <HomePricing />
    <HomeIntegrations />
    <HomeHighlights />
    <HomeUseCases />
    <HomeCta
      :authenticated="auth.isAuthenticated"
      :loading="loading || auth.isAuthenticating"
      @primary="openConnectDialog"
    />
    <HomeFooter />
    <ConnectWalletDialog
      :open="connectDialogOpen"
      :step="dialogStep"
      :busy="loading || auth.isAuthenticating"
      @update:open="onDialogOpenChange"
      @connect="onDialogConnect"
    />
  </div>
</template>
