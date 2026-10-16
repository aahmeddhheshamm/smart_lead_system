<template>
  <main>
    <router-view v-slot="{ Component }">
  <transition name="fade" mode="out-in">

        <component :is="Component" />
  </transition>    </router-view>

  </main>
</template>

<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import {watch} from 'vue'
import { useI18n } from 'vue-i18n'
const queryClient = useQueryClient()
const { locale } = useI18n()

watch(locale, () => {
  queryClient.invalidateQueries()
})

</script>

<style scoped>
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease-out;
}
</style>
