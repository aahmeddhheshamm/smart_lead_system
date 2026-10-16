<template>
  <div>
    <div
        :class="[
        'flex items-center justify-between gap-4 border rounded bg-white px-3 h-10 border-line',
        { 'is-invalid': errorMessage }
      ]"
    >
      <label :for="`switch.${name}`" v-if="label">
        <span class="flex gap-1 items-center text-sm font-medium text-heading">
          <span>{{ label }}</span>
          <span
              v-if="required && !disabled"
              class="text-errors-100"
          >
            *
          </span>
        </span>
      </label>

      <ToggleSwitch
          v-model="value"
          :name="name"
          :true-value="trueValue"
          :false-value="falseValue"
          :disabled="disabled"
          :input-id="`switch.${name}`"
          @update:model-value="handleChange"
      />
    </div>

    <div class="min-h-6 pt-1 overflow-hidden">
      <Transition name="error" mode="out-in">
        <span
            v-if="errorMessage"
            class="text-errors-100 block text-xs leading-4 break-all"
        >
          {{ errorMessage }}
        </span>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useField } from 'vee-validate'

defineOptions({
  inheritAttrs: false
})

type SwitchValue = string | boolean

type Props = {
  name: string
  label?: string
  required?: boolean
  trueValue?: SwitchValue
  falseValue?: SwitchValue
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  required: false,
  disabled: false,
  trueValue: true,
  falseValue: false
})

const {
  value,
  errorMessage,
  handleChange
} = useField<SwitchValue>(() => props.name)
</script>

