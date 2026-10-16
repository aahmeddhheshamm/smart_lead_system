<template>
  <nav
    class="bg-white h-[3.75rem] ps-4 pe-4 sm:ps-6 sm:pe-6 flex justify-between items-center border-b border-line transition-all duration-500"
  >
    <div class="flex items-center gap-4">
      <span
        @click="toggleSidebar"
        :class="collapseIconClass"
        class="p-1 cursor-pointer transition-all duration-500 hidden md:block"
      >
        <ExpandIcon class=" ltr:rotate-180 fill-primary-700 stroke-primary-700 " />
      </span>

      <span class="block md:hidden">
        <MobileSidebar>
          <template #buttonContent>
          <MenuIcon class="fill-primary-700" />
          </template>
          <template #sideBarLinks>
            <AccordionSidebar :mini="false" />
          </template>
        </MobileSidebar>
      </span>
      <span class="font-semibold text-lg leading-none text-heading capitalize truncate">{{
        $t(`sidebar.${pageTitleKey}`)
      }}</span>
    </div>

    <div class="flex items-center gap-2">
      <div class="hidden sm:flex gap-2">
        <rounded-button :aria-label="$t('buttons.toggleTheme')" @action="toggleTheme">
          <LightModeIcon v-if="currentTheme === 'light'"/>
          <DarkModeIcon v-else />
        </rounded-button>
      </div>
      <NotificationBell />
      <SwitchLanguage />

      <UserHint :name="`navbar`" class="" />
    </div>
  </nav>
</template>

<script setup lang="ts">
import RoundedButton from '@/components/buttons/RoundedButton.vue'
import UserHint from '@/layouts/dashboard/components/navbar/partial/UserHint.vue'
import { useThemeStore } from '@/store/theme'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MobileSidebar from "@/layouts/dashboard/components/sidebar/partial/MobileSidebar.vue";
import AccordionSidebar from "@/layouts/dashboard/components/sidebar/partial/Accordion.vue";
import NotificationBell from "@/layouts/dashboard/components/navbar/partial/NotificationBell.vue";
import SwitchLanguage from "@/layouts/dashboard/components/navbar/partial/SwitchLanguage.vue";
import ExpandIcon from "@/components/icons/ExpandIcon.vue";
import LightModeIcon from "@/components/icons/LightModeIcon.vue";
import DarkModeIcon from "@/components/icons/DarkModeIcon.vue";
import MenuIcon from "@/components/icons/MenuIcon.vue";
import { sidebarItems } from "@/composables/useSideBar.ts";

const route = useRoute()
const router = useRouter()

const { toggleTheme } = useThemeStore()
const { currentTheme } = storeToRefs(useThemeStore())

// Resolves the active sidebar entry's title key so the navbar heading always matches
// the menu label, instead of guessing a locale key from the raw URL segment.
const pageTitleKey = computed(() => {
  const matchedNames = route.matched.map((r) => r.name)

  for (const item of sidebarItems.value) {
    if (matchedNames.includes(item.routeName)) return item.title
    const child = item.children?.find((c: any) => matchedNames.includes(c.routeName))
    if (child) return child.title
  }

  // Sub-routes (add/edit/details) aren't registered as their own sidebar entry —
  // fall back to matching the base path segment against each menu item's route.
  // Some sidebar entries point at route names that aren't registered yet, so guard
  // with hasRoute before resolving instead of letting an unmatched name throw.
  // Longest matching path prefix wins, so nested sections (manufacturing/boms vs
  // manufacturing/production-orders) resolve to the right entry.
  let best = { title: '', length: 0 }
  for (const item of sidebarItems.value) {
    if (!router.hasRoute(item.routeName)) continue
    const itemPath = router.resolve({ name: item.routeName }).path
    const matches = route.path === itemPath || route.path.startsWith(`${itemPath}/`)
    if (matches && itemPath.length > best.length) best = { title: item.title, length: itemPath.length }
  }
  if (best.title) return best.title
  if (route.name === 'profile') return 'profile'
  if (route.name === 'onboarding') return 'onboarding'
  return 'dashboard'
})

const isSidebarVisible = ref(true)
const emit = defineEmits(['collapse'])

const toggleSidebar = () => {
  isSidebarVisible.value = !isSidebarVisible.value
  emit('collapse', isSidebarVisible.value)
}

const collapseIconClass = computed(() => {
  return isSidebarVisible.value ? '' : 'rotate-180'
})

</script>

<style scoped></style>
