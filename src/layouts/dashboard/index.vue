<template>
  <div class="flex overflow-auto">
    <MainSidebar
        class="transition-all duration-500 hidden md:block"
        :class="sidebarClass"
        :isExpanded
        :isHovered
        @on-hover="onHover"
        @on-leave="onLeave"
    />
    <div
        class="grow transition-all duration-500 overflow-hidden ps-0 md:ps-[5.5rem]"
        :class="divClass"
    >
      <main-nav class="sticky top-0 z-10"  @collapse="collapseSidebar" />
      <div v-if="auth.user && auth.user.emailVerified === false" class="bg-[#FFF9E9] text-[#8A6700] text-sm px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2" role="status">
        <span>{{ $t("auth.verifyEmailBanner", { email: auth.user.email }) }}</span>
        <button type="button" class="font-medium underline disabled:opacity-50" :disabled="resending" @click="resend">{{ $t("auth.resendVerification") }}</button>
      </div>
      <div data-scrollbar id="main-scrollbar" tabindex="-1">
        <div class="bg-dashboardBg transition-all duration-500 min-h-[calc(100vh-3.75rem)]">
          <suspense>
            <template #default>
              <router-view v-slot="{ Component, route }">
                <transition name="fade" mode="out-in">
                  <div :key="route.name!" class="p-4 sm:p-6">
                    <component :is="Component"></component>
                  </div>
                </transition>
              </router-view>
            </template>
          </suspense>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useThemeStore } from '@/store/theme.ts'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import MainNav from './components/navbar/Index.vue'
import MainSidebar from './components/sidebar/Index.vue'
import { toast } from 'vue3-toastify'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/store/auth.ts'
import { apiResendVerification } from '@/modules/auth/api'

const auth = useAuthStore()
const { t } = useI18n()
const resending = ref(false)
const resend = async () => {
  resending.value = true
  try {
    await apiResendVerification()
    toast.success(t('auth.verificationSent'))
  } finally {
    resending.value = false
  }
}
const { setTheme } = useThemeStore()
const { currentTheme } = storeToRefs(useThemeStore())

// the router guard has already loaded the session (/auth/me) before this layout renders
onMounted(() => setTheme(currentTheme.value))

const isExpanded = ref(true)
const isHovered = ref(false)

const onHover = () => {
  isHovered.value = true
}

const onLeave = () => {
  isHovered.value = false
}

const collapseSidebar = (value: boolean) => {
  isExpanded.value = value
}

const divClass = computed(() => {
  return isExpanded.value ? 'md:!ps-[18.875rem]' : ''
})

const sidebarClass = computed(() => {
  return isExpanded.value ? '' : 'w-[5.5rem] hover:w-[18.875rem] hover:z-30 hover:transition-all hover:duration-500 z-20'
})
</script>

<style scoped>
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

.fade-enter-active,
.fade-leave-active {
  transition: all 0.2s ease-out;
}
</style>
