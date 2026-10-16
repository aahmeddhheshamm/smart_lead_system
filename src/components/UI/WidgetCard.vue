<script setup lang="ts">
import SpinnerLoading from "@/components/UI/SpinnerLoading.vue";

// Every dashboard/report widget supports loading, empty and error states (PRD §9)
withDefaults(
    defineProps<{ title: string; subtitle?: string; loading?: boolean; error?: boolean; empty?: boolean; emptyText?: string }>(),
    { subtitle: "", loading: false, error: false, empty: false, emptyText: "" }
);
const emit = defineEmits<{ (e: "retry"): void }>();
</script>

<template>
  <section class="bg-white border border-line rounded p-5 flex flex-col min-w-0">
    <header class="flex items-start justify-between gap-3 mb-4">
      <div class="min-w-0">
        <h2 class="text-base font-semibold text-heading">{{ title }}</h2>
        <p v-if="subtitle" class="text-xs text-neural-300 mt-0.5">{{ subtitle }}</p>
      </div>
      <slot name="extra" />
    </header>
    <div v-if="loading" class="py-10 flex-1 flex items-center"><SpinnerLoading /></div>
    <div v-else-if="error" class="py-10 flex-1 flex flex-col items-center justify-center gap-2 text-sm text-neural-300">
      {{ $t("messages.loadFailed") }}
      <button type="button" class="text-primary-700 font-medium" @click="emit('retry')">{{ $t("buttons.retry") }}</button>
    </div>
    <p v-else-if="empty" class="py-10 flex-1 flex items-center justify-center text-sm text-neural-300 text-center">{{ emptyText || $t("noRecordsFound") }}</p>
    <div v-else class="flex-1 min-w-0"><slot /></div>
  </section>
</template>
