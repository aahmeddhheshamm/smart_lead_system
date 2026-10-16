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
