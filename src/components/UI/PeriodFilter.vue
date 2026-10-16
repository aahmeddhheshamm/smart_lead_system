<script setup lang="ts">
import { computed } from "vue";
import { toIsoDate } from "@/utils";

// Date-range control shared by Dashboard and Reports: presets + custom range
const model = defineModel<{ preset: string; from: string; to: string }>({ required: true });
const presets = ["7d", "30d", "90d", "month", "custom"];

const apply = (preset: string) => {
  const to = new Date();
  const from = new Date();
  if (preset === "7d") from.setDate(to.getDate() - 6);
  if (preset === "30d") from.setDate(to.getDate() - 29);
  if (preset === "90d") from.setDate(to.getDate() - 89);
  if (preset === "month") from.setDate(1);
  model.value = preset === "custom" ? { ...model.value, preset } : { preset, from: toIsoDate(from), to: toIsoDate(to) };
};
const isCustom = computed(() => model.value.preset === "custom");
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <div class="inline-flex rounded border border-line bg-white overflow-hidden" role="group" :aria-label="$t('fields.period')">
      <button
          v-for="p in presets"
          :key="p"
          type="button"
          class="px-3 h-9 text-sm border-e border-line last:border-e-0 transition-colors"
          :class="model.preset === p ? 'bg-primary-700 text-[#fff]' : 'text-neural-400 hover:bg-gray-300'"
          :aria-pressed="model.preset === p"
          @click="apply(p)"
      >
        {{ $t(`period.${p}`) }}
      </button>
    </div>
    <template v-if="isCustom">
      <input v-model="model.from" type="date" class="h-9 rounded border border-line bg-white px-2 text-sm text-black" :aria-label="$t('fields.from')" :max="model.to" />
      <span class="text-neural-300">–</span>
      <input v-model="model.to" type="date" class="h-9 rounded border border-line bg-white px-2 text-sm text-black" :aria-label="$t('fields.to')" :min="model.from" />
    </template>
  </div>
</template>
