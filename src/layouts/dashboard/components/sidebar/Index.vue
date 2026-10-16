<template>
  <aside
    class="bg-white fixed w-[18.875rem] border-e border-line start-0 top-0 h-screen overflow-hidden"
    @mouseover="emit('onHover')"
    @mouseleave="emit('onLeave')"
  >
    <!-- logo -->
    <div class="flex items-center justify-center gap-2 border-b border-line h-[3.75rem]">
      <BrandLogo v-if="isExpanded || isHovered" img-class="h-10" />
      <BrandLogo v-else variant="mark" img-class="h-9" />
    </div>

    <!-- menu -->
    <div data-scrollbar class="h-[calc(100%-3.75rem)] overflow-y-auto pt-2 pb-4" id="sidebar-scroll">
      <div
        class="px-3 flex flex-col gap-8 overflow-x-hidden"
        :class="{ 'items-center': !isExpanded && !isHovered }"
      >
        <AccordionSidebar :mini="!isHovered && !isExpanded" />
      </div>
    </div>

  </aside>
</template>

<script setup lang="ts">
import AccordionSidebar from './partial/Accordion.vue';
import BrandLogo from "@/components/UI/BrandLogo.vue";

const props = defineProps<{
  isExpanded: boolean
  isHovered: boolean
}>()

const emit = defineEmits(['onHover', 'onLeave'])
</script>
<style>

</style>
