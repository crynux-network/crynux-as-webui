import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useWalletStore } from '@/stores/wallet'
import HomeView from '@/views/HomeView.vue'
import DashboardLayout from '@/components/layout/DashboardLayout.vue'
import ProjectListView from '@/views/ProjectListView.vue'
import ProjectDetailView from '@/views/ProjectDetailView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/dashboard',
      component: DashboardLayout,
      meta: { requiresAuth: true },
      redirect: { name: 'projects' },
      children: [
        {
          path: 'projects',
          name: 'projects',
          component: ProjectListView
        },
        {
          path: 'projects/:id',
          name: 'project-detail',
          component: ProjectDetailView
        }
      ]
    }
  ]
})

router.beforeEach((to, from, next) => {
  const auth = useAuthStore()
  const wallet = useWalletStore()
  const requiresAuth = to.matched.some((record) => record.meta && record.meta.requiresAuth)

  if (requiresAuth) {
    if (auth.isAuthenticated) {
      next()
    } else {
      try {
        auth.clearSession()
      } catch (e) {
        console.warn('Failed to clear auth session', e)
      }
      try {
        wallet.setAccount(null)
      } catch (e) {
        console.warn('Failed to clear wallet state', e)
      }
      next({ path: '/' })
    }
  } else {
    next()
  }
})

export default router
