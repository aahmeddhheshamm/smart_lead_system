<script setup>
import { ref, watch, computed } from 'vue'
import { useRoute } from 'vue-router'
import ExitIcon from '@/components/icons/ExitIcon.vue'
import BrandLogo from "@/components/UI/BrandLogo.vue";

const menuIsOpen = ref(false)
const currentRoute = computed(() => route.path)
const route = useRoute()
watch(currentRoute, () => {
  menuIsOpen.value = false
})

function toggleMenu() {
  menuIsOpen.value = !menuIsOpen.value
}

</script>

<template>
  <button type="button" class="block lg:hidden text-gray-500 menu-button-area" @click="toggleMenu">
    <slot name="buttonContent"></slot>
  </button>
  <teleport to="body">
    <div
        class="fixed top-0 bottom-0 mobile-menu lg:hidden rtl:left-full ltr:right-full w-[100vw] !h-[100vh] z-[99999] transition-all"
        :class="{ 'menu-open rtl:!left-0 ltr:!right-0': menuIsOpen }"
    >
      <div class="absolute inset-0 bg-black/70" @click="toggleMenu"></div>
      <div
          class="absolute top-[22px] end-[30px] z-50 w-[20px] h-[20px] drop-shadow-xl cursor-pointer"
          @click="toggleMenu"
      >
        <ExitIcon />
      </div>
      <nav class="flex flex-col relative z-10 w-[300px] h-full pt-4 p-4 bg-white">
        <div class="flex items-center justify-center gap-2 border-b border-line pb-4 pt-2">
          <BrandLogo img-class="h-10" />
        </div>
        <slot name="sideBarLinks"></slot>
      </nav>
    </div>
  </teleport>
</template>

<style scoped>
.menu-open {
  transition: left 0.5s ease-in-out, right 0.5s ease-in-out;
}

.mobile-menu {
  transition: all 0.5s ease-in-out;
}
</style>