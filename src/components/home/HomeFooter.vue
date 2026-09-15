<script setup>
import { Github, MessageCircle } from 'lucide-vue-next'
import { navLinks, socialLinks } from '@/content/home'
</script>

<template>
  <footer class="border-t border-foreground/10 bg-[var(--home-surface)]/60">
    <div class="mx-auto grid max-w-7xl gap-12 px-6 py-16 md:grid-cols-[1fr_auto] md:gap-24">
      <div>
        <div class="flex items-center gap-2.5">
          <img src="/home/crynux_logo.svg" alt="Crynux" class="h-8 w-auto" />
          <span class="text-xl font-bold tracking-tight">Crynux AI Services</span>
        </div>
        <p class="mt-8 text-xs text-muted-foreground">
          &copy;2025 Crynux AI Services. All rights reserved.
        </p>
      </div>

      <div class="grid grid-cols-2 gap-10 sm:gap-16">
        <div>
          <div class="text-sm font-semibold">Links</div>
          <ul class="mt-4 space-y-3 text-sm text-muted-foreground">
            <li v-for="link in navLinks" :key="link.label">
              <a
                :href="link.href"
                target="_blank"
                rel="noreferrer"
                class="transition-colors hover:text-foreground"
              >
                {{ link.label }}
              </a>
            </li>
          </ul>
        </div>
        <div>
          <div class="text-sm font-semibold">Community</div>
          <ul class="mt-4 space-y-3 text-sm text-muted-foreground">
            <li v-for="link in socialLinks" :key="link.label">
              <a
                :href="link.href"
                target="_blank"
                rel="noreferrer"
                class="inline-flex items-center gap-2 transition-colors hover:text-foreground"
              >
                <Github v-if="link.label === 'GitHub'" class="size-4 shrink-0" />
                <MessageCircle
                  v-else-if="link.label === 'Discord'"
                  class="size-4 shrink-0"
                />
                <svg
                  v-else-if="link.label === 'X'"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  class="size-4 shrink-0 fill-current"
                >
                  <path
                    d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117Z"
                  />
                </svg>
                {{ link.label }}
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </footer>
</template>
