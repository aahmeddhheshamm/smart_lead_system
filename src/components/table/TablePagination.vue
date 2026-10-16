<script setup lang="ts">
const emits = defineEmits<{
  (e: 'prevPage'): void;
  (e: 'nextPage'): void;
  (e: 'update:perPage', value: number): void; // إضافة دعم لتحديث عدد العناصر
}>();

 withDefaults(defineProps<{
  tableData: any[];
  pageSizes?: number[];
  page?: number;
  perPage?: number;
  pagination: { total?: number; lastPage?: number };
}>(), {
  pageSizes: () => [10, 25, 50, 100],
  page: 1,
  perPage: 10
});

</script>

<template>
  <p class="text-sm text-neural-300">
    {{ $t('pagination.showing') }} {{ tableData?.length }} {{ $t('pagination.resultsOf') }} {{ pagination?.total }} {{ $t('pagination.entries') }}
  </p>
  <div class="flex items-center gap-3">
    <select
        :value="perPage"
        @change="e => emits('update:perPage', Number((e.target as HTMLSelectElement).value))"
        class="h-8 bg-white text-black ps-2 pe-7 text-sm rounded border border-line outline-0 focus:border-primary-700 focus:shadow-none focus:ring-0"
    >
      <option v-for="i in pageSizes">{{ i }}</option>
    </select>
    <div class="flex items-center gap-1">
      <button
          type="button"
          class="page-btn"
          :disabled="page == 1"
          @click="emits('prevPage')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="5" height="8" viewBox="0 0 4 6" fill="currentColor" class="rtl:rotate-180">
          <path d="M3.5 5.03105L3.5 1.20527C3.5 0.778098 2.99894 0.547643 2.6746 0.825646L0.4429 2.73854C0.210094 2.93808 0.210094 3.29824 0.4429 3.49779L2.6746 5.41068C2.99894 5.68868 3.5 5.45823 3.5 5.03105Z" />
        </svg>
      </button>
      <span class="h-8 min-w-8 px-2.5 rounded bg-primary-700 text-white flex justify-center items-center text-sm">
        {{ page }} / {{ pagination?.lastPage }}
      </span>
      <button
          type="button"
          class="page-btn"
          :disabled="page >= (pagination?.lastPage || 1)"
          @click="emits('nextPage')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="5" height="8" viewBox="0 0 4 6" fill="currentColor" class="rtl:rotate-180">
          <path d="M0.5 1.20527L0.5 5.03105C0.5 5.45823 1.00106 5.68868 1.3254 5.41068L3.5571 3.49779C3.78991 3.29824 3.78991 2.93808 3.5571 2.73854L1.3254 0.825646C1.00106 0.547643 0.5 0.778098 0.5 1.20527Z" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.page-btn {
  @apply h-8 w-8 flex items-center justify-center rounded border border-line bg-white text-neural-300 transition-colors duration-200;
}

.page-btn:not(:disabled):hover {
  @apply text-primary-700 bg-gray-300;
}

.page-btn:disabled {
  @apply opacity-50 cursor-not-allowed;
}
</style>
