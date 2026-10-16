<script setup lang="ts">
import MainButton from '@/components/buttons/MainButton.vue';
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center gap-6 p-6 bg-dashboardBg text-center">
    <h1 class="font-bold text-primary-700 text-[96px] leading-tight">404</h1>
    <p class="text-neural-300">{{ $t('messages.notFound') }}</p>
    <MainButton text="buttons.backToDashboard" @action="$router.push({ name: 'dashboard' })" />
  </div>
</template>
