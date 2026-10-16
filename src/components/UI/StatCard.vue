<script setup lang="ts">
import { Icon } from "@iconify/vue";

defineProps<{
  label: string;
  value: string | number;
  icon: string;
  // plain-language metric definition, shown on hover (PRD: every metric states how it is computed)
  definition?: string;
  tone?: "default" | "warn" | "danger" | "success";
  to?: any;
}>();
</script>

<template>
  <component
      :is="to ? 'router-link' : 'div'"
      :to="to"
      class="bg-white border border-line rounded p-4 flex items-start gap-3 transition-colors"
      :class="{ 'hover:border-primary-200': to }"
  >
    <span
        class="w-10 h-10 rounded flex items-center justify-center shrink-0"
        :class="{
          'bg-primary-50 text-primary-700': !tone || tone === 'default',
          'bg-[#FFF9E9] text-[#B58500]': tone === 'warn',
          'bg-[#FAE7E7] text-[#C70B0B]': tone === 'danger',
          'bg-[#E8FAF0] text-[#03894A]': tone === 'success',
        }"
    >
      <Icon :icon="icon" class="w-5 h-5" />
    </span>
    <div class="min-w-0">
      <p class="text-xs text-neural-300 flex items-center gap-1">
        <span class="truncate">{{ label }}</span>
        <Icon v-if="definition" v-tooltip.top="definition" icon="lucide:info" class="w-3.5 h-3.5 shrink-0 cursor-help" :aria-label="definition" />
      </p>
      <p class="text-2xl font-bold text-heading tabular-nums leading-tight mt-0.5">{{ value }}</p>
    </div>
  </component>
</template>
