<template>
  <section>
    <div class="mb-4 pb-3 border-b border-line">
      <h3 class="text-base font-semibold text-heading">{{ title }}</h3>
      <p v-if="description" class="mt-1 text-sm text-neural-300">{{ description }}</p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 items-start gap-x-4 w-full">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  description?: string;
}>();
</script>
