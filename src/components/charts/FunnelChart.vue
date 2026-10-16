<script setup lang="ts">
import { computed } from "vue";

// Centered funnel: each step shows count + % of the first step (single hue, lighter as it narrows)
const props = defineProps<{ steps: Array<{ label: string; count: number }> }>();
const top = computed(() => Math.max(1, props.steps[0]?.count ?? 1));
const pct = (n: number) => Math.round((n / top.value) * 100);
</script>

<template>
  <ol class="flex flex-col gap-1.5">
    <li v-for="(step, i) in steps" :key="step.label" class="grid grid-cols-[7rem_1fr_4.5rem] items-center gap-3 text-sm" v-tooltip.top="`${step.label}: ${step.count} (${pct(step.count)}%)`">
      <span class="text-neural-400 truncate">{{ step.label }}</span>
      <div class="h-7 flex justify-center">
        <div
            class="h-full rounded transition-[width] duration-500"
            :style="{ width: `${Math.max(step.count ? 3 : 0, pct(step.count))}%`, backgroundColor: `rgba(var(--primary-700), ${1 - i * 0.14})` }"
        />
      </div>
      <span class="text-end tabular-nums"><span class="font-semibold text-heading">{{ step.count }}</span> <span class="text-xs text-neural-300">{{ pct(step.count) }}%</span></span>
    </li>
  </ol>
</template>
