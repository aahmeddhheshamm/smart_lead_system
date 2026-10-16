<template>
  <div :class="{ 'md:col-span-2 lg:col-span-3': wide }">
    <p class="text-sm text-neural-300 mb-1">{{ label }}</p>
    <div class="text-sm text-black font-medium break-words" :class="valueClass">
      <slot>{{ isEmpty ? '—' : value }}</slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  label: string;
  value?: any;
  // Spans the full row (long text such as notes, address, description)
  wide?: boolean;
  valueClass?: string;
}>();

const isEmpty = computed(() => props.value === null || props.value === undefined || props.value === "");
</script>
