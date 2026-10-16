<template>
  <section>
    <div class="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-line">
      <h3 class="text-base font-semibold text-heading">{{ title }}</h3>
      <slot name="extra" />
    </div>
    <!-- grid: label/value fields; plain: tables, stat rows or free content -->
    <div v-if="grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5 w-full">
      <slot />
    </div>
    <slot v-else />
  </section>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ title: string; grid?: boolean }>(), { grid: true });
</script>
