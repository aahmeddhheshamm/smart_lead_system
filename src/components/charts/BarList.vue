<script setup lang="ts">
import { computed } from "vue";

// Single-series magnitude bars (one hue): the value is always printed as text,
// so the bar length is never the only carrier of the number.
const props = withDefaults(
    defineProps<{
      rows: Array<{ label: string; value: number; hint?: string }>;
      format?: (v: number) => string;
      max?: number;
      ariaLabel?: string;
    }>(),
    { format: (v: number) => v.toLocaleString(), max: 0, ariaLabel: "" }
);

const maxValue = computed(() => props.max || Math.max(1, ...props.rows.map((r) => r.value)));
</script>

<template>
  <ul class="flex flex-col gap-3" :aria-label="ariaLabel">
    <li
        v-for="row in rows"
        :key="row.label"
        v-tooltip.top="row.hint ? `${row.label}: ${format(row.value)} · ${row.hint}` : `${row.label}: ${format(row.value)}`"
        class="group"
    >
      <div class="flex items-center justify-between gap-3 text-sm mb-1">
        <span class="text-neural-400 truncate">{{ row.label }}</span>
        <span class="text-heading font-semibold tabular-nums shrink-0">
          {{ format(row.value) }}<span v-if="row.hint" class="text-neural-300 font-normal text-xs ms-1">{{ row.hint }}</span>
        </span>
      </div>
      <div class="h-2 rounded bg-neural-100 overflow-hidden">
        <div
            class="h-full rounded-e bg-primary-700 transition-[width] duration-500 group-hover:bg-primary-600"
            :style="{ width: `${Math.max(row.value ? 2 : 0, (row.value / maxValue) * 100)}%` }"
        />
      </div>
    </li>
  </ul>
</template>
