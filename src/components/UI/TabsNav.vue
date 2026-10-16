<script setup lang="ts">
// Lightweight accessible tab strip (role=tablist); the parent renders the panel
const model = defineModel<string>({ required: true });
defineProps<{ tabs: Array<{ key: string; label: string; count?: number | null; icon?: string }> }>();
</script>

<template>
  <div class="flex gap-1 border-b border-line overflow-x-auto -mx-1 px-1" role="tablist">
    <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        role="tab"
        :aria-selected="model === tab.key"
        class="relative px-3 h-10 text-sm whitespace-nowrap transition-colors flex items-center gap-2"
        :class="model === tab.key ? 'text-primary-700 font-semibold' : 'text-neural-300 hover:text-primary-700'"
        @click="model = tab.key"
    >
      {{ tab.label }}
      <span v-if="tab.count !== undefined && tab.count !== null" class="text-[11px] px-1.5 py-0.5 rounded-full" :class="model === tab.key ? 'bg-primary-50' : 'bg-neural-100'">{{ tab.count }}</span>
      <span v-if="model === tab.key" class="absolute inset-x-2 -bottom-px h-0.5 rounded bg-primary-700" />
    </button>
  </div>
</template>
