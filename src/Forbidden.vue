<script setup lang="ts">
import MainButton from '@/components/buttons/MainButton.vue';
import Box from '@/components/UI/Box.vue';
</script>

<template>
  <Box class="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
    <span class="w-14 h-14 rounded-full bg-errors-100/10 text-errors-100 flex items-center justify-center text-2xl" aria-hidden="true">⛔</span>
    <h1 class="text-2xl">{{ $t('messages.forbiddenTitle') }}</h1>
    <p class="text-sm text-neural-300 max-w-md">{{ $t('messages.forbiddenBody') }}</p>
    <MainButton text="buttons.backToDashboard" @action="$router.push({ name: 'dashboard' })" />
  </Box>
</template>
