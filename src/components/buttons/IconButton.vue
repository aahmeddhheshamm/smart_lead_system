<script setup lang="ts">
const emit = defineEmits<{
(e: "action"): () => void;
}>();

defineProps({
  loading: { type: Boolean, default: false, required: false },
  disabled: { type: Boolean, default: false, required: false },
  tooltipValue: { type: String, required: false, default: null },
  isDeleteButton:{type:Boolean, required: false, default: false},
})
</script>

<template>
  <button
      v-tooltip.top="{ value: tooltipValue }"
      class="group bg-white border border-line shadow-none overflow-hidden flex items-center justify-center outline-0 rounded w-8 h-8 transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300"
      :class="[
        disabled || loading
          ? 'cursor-not-allowed dark:opacity-50'
          : isDeleteButton ? 'hover:bg-errors-100/10 hover:border-errors-100/30' : 'hover:bg-primary-50 hover:border-primary-200'
      ]"
      type="button"
      :disabled="disabled || loading"
      v-bind="$attrs"
      @click="emit('action')"
  >
    <div
        v-if="loading"
        class="animate-spin inline-block size-4 border-[3px] border-current border-t-transparent text-[#fff] rounded-full"
        role="status"
        aria-label="loading"
    ></div>
    <div
        class="fill-neural-300 group-hover:fill-primary-700 ease-in-out duration-150 w-1/2 h-1/2"
        :class="{'group-hover:!fill-red-600':isDeleteButton}"
        v-else
    >
      <slot></slot>
    </div>
  </button>
</template>
