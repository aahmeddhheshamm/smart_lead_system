<template>
  <div>
    <label class="flex flex-col">
      <span
          :class="['flex gap-1 items-center leading-normal text-heading mb-1.5 font-medium text-sm', labelClass]"
        v-if="label"
      >
        <span> {{ label }}</span>
        <span class="text-errors-100" v-if="required && !disabled && !readonly">*</span>
      </span>
      <textarea
        class="py-2"
        :class="['w-full resize-none', { 'is-invalid': errorMessage }]"
        autoResize
        :readonly="readonly"
        :name="name"
        cols="50"
        v-model.trim="value"
        @change="handleChange"
        @blur="handleBlur($event, true)"
        :placeholder="placeholder"
        :disabled="disabled"
        :dir="direction"
        :rows="rows"
      />
    </label>
    <div class="min-h-6 pt-1 overflow-hidden">
      <Transition name="error" mode="out-in">
        <span
          v-if="errorMessage"
          class="text-errors-100 block font-normal text-xs leading-4 break-all text-wrap hyphens-auto"
        >
          {{ errorMessage }}
        </span>
      </Transition>
    </div>
  </div>
</template>
<script setup>
import { useField } from 'vee-validate';
import {computed} from "vue";

const props = defineProps({
  name: {
    type: String,
    required: true
  },

  label: {
    type: String,
    required: false
  },
  rows:{
    type: Number,
    required: false,
    default: 5
  },
  placeholder: {
    type: String,
    required: true
  },
  required: {
    type: Boolean,
    required: false,
    default: false
  },
  readonly: {
    type: Boolean,
    required: false,
    default: false
  },
  disabled: {
    type: Boolean,
    required: false,
    default: false
  }
});

const { handleChange, value, handleBlur, errorMessage } = useField(() => props.name, undefined);
const direction = computed(() => {
  if (value.value && /[._](ar|en)$/.test(props.name)){
    return /[\u0600-\u06FF]/.test(value.value) ? "rtl" : "ltr";
  }
  return ''
});
</script>
col
