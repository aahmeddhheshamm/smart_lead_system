<template>
  <div class="flex flex-col">
    <!-- Menu Search -->
    <div v-if="!mini" class="pb-3 mt-2">
      <div class="flex items-center gap-2 rounded border border-line h-9 px-3 transition-colors duration-200 focus-within:border-primary-700">
        <Icon icon="lucide:search" class="w-3.5 h-3.5 shrink-0 text-black/40" />
        <input
            v-model="searchQuery"
            type="text"
            :placeholder="$t('sidebar.search')"
            class="w-full min-w-0 bg-transparent border-0 p-0 text-sm text-black focus:outline-none focus:ring-0 placeholder:text-neural-200"
        />
      </div>
    </div>

    <div class="hs-accordion-group flex flex-col gap-1 overflow-y-hidden overflow-x-hidden justify-start">
      <template v-for="section in groupedSections" :key="section.group ?? `root_${section.entries[0]?.index}`">
        <p v-if="section.group && !mini" class="px-3 pb-2 pt-4 text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF] first:pt-0">
          {{ $t(`sidebarGroups.${section.group}`) }}
        </p>

        <div
            v-for="{ item, index } in section.entries"
            :key="`${item.title}_${index}`"
            class="hs-accordion"
            :class="{
              active: $route.matched.some(({ name }) => name === item.routeName),
              'hs-accordion-active': openAccordion === index
            }"
            :id="`hs-basic-heading-${item.title}_${index}`"
        >
          <button
              @click="handleItemClick(index, item)"
              v-tooltip.right="mini ? $t(`sidebar.${item.title}`) : null"
              class="flex hs-accordion-toggle justify-between items-center px-3 h-10 w-full rounded disabled:pointer-events-none text-neural-400 transition-colors duration-200 hover:bg-gray-300 hover:text-primary-700"
              :class="{
              '!w-12 !h-10 transition-all duration-500': mini,
              'bg-primary-50 !text-primary-700 brand-active-bar': openAccordion === index || $route.matched.some(({ name }) => name === item?.routeName)
            }"
              :aria-expanded="openAccordion === index"
              :aria-controls="`hs-basic-collapse-${item?.title}_${index}`"
          >
            <div class="flex items-center justify-start gap-2 w-full">
              <!-- Dynamically render icon using icons[item.icon] -->
              <Icon :icon="icons[item?.icon]" class="w-5 h-5 shrink-0" />
              <p class="font-medium text-[15px] w-full text-start truncate" :class="{ hidden: mini }">
                {{ $t(`sidebar.${item.title}`) }}
              </p>
              <span
                  v-if="item.badge && !mini"
                  class="ms-auto shrink-0 inline-flex items-center justify-center min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-errors-100 text-white text-[10px] font-semibold leading-none"
              >
                {{ item.badge }}
              </span>
            </div>
            <Icon
                v-if="!mini && item?.children"
                icon="lucide:chevron-down"
                :class="['size-4 transition-transform duration-200 shrink-0', openAccordion === index ? 'rotate-180' : '']"
            />
          </button>

          <!-- Show children if available and not minimized -->
          <div
              v-if="item?.children && !mini"
              :id="`hs-basic-collapse-${item?.title}_${index}`"
              class="overflow-hidden transition-all duration-300"
              :style="{
              maxHeight: openAccordion === index ? '500px' : '0px',
              opacity: openAccordion === index ? 1 : 0
            }"
          >
            <ul class="flex flex-col gap-0.5 pt-1 pb-1">
              <template v-for="(child, key) in item?.children" :key="key">
                <li>
                  <router-link
                      :to="{ name: child?.routeName }"
                      exact-active-class="active-sidebar"
                      class="flex items-center ps-10 w-full h-9 px-3 rounded relative z-10 text-neural-300 transition-colors duration-200 hover:text-primary-700"
                      :class="[
                      {
                        '!w-12 !h-10 justify-center items-center rounded-lg !p-0 transition-all duration-500': mini
                      }
                    ]"
                  >
                    <div class="flex gap-2 items-center">
                      <!-- Dynamically render child icon using icons[child.icon] -->
                      <Icon :icon="icons[child?.icon]" class="w-4 h-4 shrink-0" />
                      <p v-if="!mini" class="text-sm text-nowrap">{{ $t(`sidebar.${child?.title}`) }}</p>
                    </div>
                  </router-link>
                </li>
              </template>
            </ul>
          </div>
        </div>
      </template>

      <p v-if="!groupedSections.length" class="px-3 py-6 text-center text-xs text-black/40">
        {{ $t('sidebar.noResults') }}
      </p>
    </div>
  </div>
</template>


<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import {sidebarItems, icons} from "@/composables/useSideBar.ts";

const props = defineProps({
  item: { type: Object },
  active: { type: Boolean, default: false },
  mini: { type: Boolean }
})

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const openAccordion = ref<number | null>(null)
const searchQuery = ref('')

// Search matches by translated label; group headers/membership come from each item's original flat index
const filteredEntries = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return sidebarItems.value
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !q || t(`sidebar.${item.title}`).toLowerCase().includes(q))
})

// Collapses consecutive same-group entries into labelled sections, preserving menu order
const groupedSections = computed(() => {
  const sections: { group: string | null; entries: { item: any; index: number }[] }[] = []
  let current: (typeof sections)[number] | null = null

  for (const entry of filteredEntries.value) {
    const key = entry.item.group ?? null
    if (!current || current.group !== key) {
      current = { group: key, entries: [] }
      sections.push(current)
    }
    current.entries.push(entry)
  }

  return sections
})

const handleItemClick = (index: number, item: any) => {
  if (!item.children || item.children.length === 0) {
    // If no children, navigate to the route
    router.push({ name: item.routeName })
    openAccordion.value = openAccordion.value === index ? null : index
  } else {
    // Toggle the accordion if there are children
    openAccordion.value = openAccordion.value === index ? null : index
  }
}
const isActive = (item: any) => {
  return route.matched.some(({ name }) => name === item.routeName);
}
</script>

<style scoped>
/* brand marker on the active group: a thin cyan -> violet bar on the leading edge */
.brand-active-bar {
  @apply relative;
}
.brand-active-bar::before {
  content: "";
  @apply absolute start-0 top-2 bottom-2 w-[3px] rounded-full bg-brand-gradient;
}

.active-sidebar {
  @apply !text-primary-700;
}

.active-sidebar p {
  @apply font-medium;
}

.active-sidebar span > svg > path {
  fill: theme('colors.primary.700');
}
</style>