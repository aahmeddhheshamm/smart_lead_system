<template>
  <div class="flex min-h-screen bg-dashboardBg overflow-hidden">
    <!-- brand panel: logo on its own navy, lit by the mark's cyan -> violet glow -->
    <div class="hidden lg:flex lg:w-1/2 overflow-hidden relative bg-brand-navy">
      <!-- glows stay in the corners: the dark wordmark has an opaque navy ground -->
      <div class="absolute -top-48 -start-48 w-96 h-96 rounded-full bg-brand-cyan/15 blur-3xl"></div>
      <div class="absolute -bottom-48 -end-48 w-[26rem] h-[26rem] rounded-full bg-brand-violet/20 blur-3xl"></div>
      <div class="relative flex flex-col justify-center items-center w-full gap-6 px-10 text-center">
        <BrandLogo img-class="h-14" inverted />
        <span class="h-1 w-24 rounded-full bg-brand-gradient"></span>
        <p class="text-base text-[rgba(255,255,255,0.72)] max-w-sm">{{ $t('auth.tagline') }}</p>
        <ul class="text-start text-sm text-[rgba(255,255,255,0.72)] flex flex-col gap-3 mt-4">
          <li v-for="key in ['capture', 'assign', 'followUp', 'measure']" :key="key" class="flex items-center gap-3">
            <span class="w-6 h-6 rounded-full bg-brand-gradient flex items-center justify-center text-[#fff] text-xs">✓</span>
            {{ $t(`auth.benefits.${key}`) }}
          </li>
        </ul>
      </div>
    </div>
    <div class="w-full lg:w-1/2 p-4 sm:p-6 ">
      <div class="flex items-center justify-between gap-3">
        <div class="flex gap-2">
          <rounded-button :aria-label="$t('buttons.toggleTheme')" @action="toggleTheme">
            <LightModeIcon v-if="currentTheme === 'light'"/>
            <DarkModeIcon v-else />
          </rounded-button>
        </div>
        <SwitchLanguage />
      </div>
      <div class="flex flex-col justify-center items-center min-h-[calc(100%-2.25rem)] py-8">
      <div class="w-full max-w-xl">
        <div class="mb-8 text-center">
          <div class="lg:hidden flex justify-center">
            <BrandLogo img-class="h-14" />
          </div>
        </div>

        <div class="bg-white p-6 sm:p-8 rounded border border-line shadow-sm">
          <router-view v-slot="{ Component }">
            <transition name="fade" mode="out-in">
              <component :is="Component" />
            </transition>
          </router-view>
        </div>

      </div>
    </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import BrandLogo from "@/components/UI/BrandLogo.vue";
import LightModeIcon from "@/components/icons/LightModeIcon.vue";
import RoundedButton from "@/components/buttons/RoundedButton.vue";
import SwitchLanguage from "@/layouts/dashboard/components/navbar/partial/SwitchLanguage.vue";
import DarkModeIcon from "@/components/icons/DarkModeIcon.vue";
import {useThemeStore} from "@/store/theme.ts";
import {storeToRefs} from "pinia";
import {onMounted} from "vue";

const { toggleTheme, setTheme } = useThemeStore()

const { currentTheme } = storeToRefs(useThemeStore())


onMounted(async () => {
  setTheme(currentTheme.value)
})
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>