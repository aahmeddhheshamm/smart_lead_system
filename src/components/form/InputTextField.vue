<template>
  <div>
    <label>
      <span
          :class="['flex gap-1 items-center leading-normal text-heading mb-1.5 font-medium text-sm', labelClass]"
          v-if="label"
      >
        <span> {{ label }}</span>
        <span class="text-errors-100" v-if="required && !disabled">*</span>
      </span>
      <InputText
          :class="['w-full', { 'is-invalid': errorMessage },  inputClass]"
          :feedback="false"
          toggleMask
          :name="name"
          v-model.trim="value"
          @change="handleChange"
          @blur="handleBlur($event, true)"
          :placeholder="placeholder"
          :type="type"
          :disabled="disabled"
          v-bind="$attrs"
          autocomplete="new-password"
          :dir="direction"
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
<script setup lang="ts">
import { useField } from 'vee-validate';
import {computed} from "vue";
import type {InputTextFieldProps} from "@/types/FormComponents.ts";

defineOptions({
  inheritAttrs: false
});

const {
  name,
  type = 'text',
  inputClass = '',
  required = false,
  disabled = false,
  labelClass = '',
} = defineProps<InputTextFieldProps>()


const { handleChange, value, handleBlur, errorMessage } = useField<string>(() => name, undefined);
const direction = computed(() => {
  if (value.value && /[._](ar|en)$/.test(name)){
    return /[\u0600-\u06FF]/.test(value.value) ? "rtl" : "ltr";
  }
  return ''
});
</script>
