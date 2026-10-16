<template>
  <div>
    <label :for="inputId" v-if="label">
      <span
          :class="['flex gap-1 items-center leading-normal text-heading mb-1.5 font-medium text-sm', labelClass]"
      >
        <span> {{ label }}</span>
        <span class="text-errors-100" v-if="required && !disabled">*</span>
      </span>
    </label>

    <!-- MULTI -->
    <MultiSelect
        v-if="multi"
        v-model="value"
        :options="options"
        :option-value="optionValue"
        :optionLabel="optionLabel"
        :placeholder="placeholder"
        :filter="filter"
        :disabled="disabled"
        :loading="loading"
        display="chip"
        :inputId="inputId"
        class="w-full text-sm items-center"
        :class="{ 'is-invalid': errorMessage }"
        @blur="handleBlur($event, true)"
        @update:modelValue="handleChange"
    />

    <!-- SINGLE -->
    <Dropdown
        v-else
        v-model="value"
        :options="options"
        :option-value="optionValue"
        :optionLabel="optionLabel"
        :placeholder="placeholder"
        :filter="filter"
        :disabled="disabled"
        :loading="loading"
        :inputId="inputId"
        class="w-full text-sm items-center"
        :class="{ 'is-invalid': errorMessage }"
        @blur="handleBlur($event, true)"
        @update:modelValue="handleChange"
    />

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
import { ref, onMounted, watch, computed } from 'vue'
import useFetch from '@/composables/useFetch'
import InterceptorHelper from '@/InterceptorHelper'

defineOptions({
  inheritAttrs: false
})

type Option = Record<string, any>

type Props = {
  name: string
  multi?: boolean
  fetchOptionsUrl?: string
  optionValue: string
  optionLabel: string
  placeholder: string

  label?: string
  labelClass?: string
  filter?: boolean
  required?: boolean
  readonly?: boolean
  disabled?: boolean

  staticOptions?: Option[]
  optionalParams?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  multi: true,
  filter: false,
  staticOptions: () => []
})

const {
  value,
  errorMessage,
  handleChange,
  handleBlur,
  setValue
} = useField<any>(props.name)

const inputId = computed(() => `select.${props.name}`)
const options = ref<Option[]>([])
const loading = ref(false)

watch(
    () => props.multi,
    (isMulti) => {
      if (isMulti && !Array.isArray(value.value)) {
        setValue(value.value ? [value.value] : [], false)
      }

      if (!isMulti && Array.isArray(value.value)) {
        setValue(value.value[0] ?? null, false)
      }
    },
    { immediate: true }
)

function syncValuesWithOptions() {
  if (!props.multi || !Array.isArray(value.value)) return

  const validIds = options.value.map(
      (o) => o[props.optionValue]
  )

  setValue(
      value.value.filter((v) => validIds.includes(v)),
      false
  )
}

// Remote options are a query owned by this component (it must be created during setup,
// not inside an async callback, or its result is read before the request resolves)
const remote = useFetch<any>({
  queryKey: computed(() => ['select_box', props.fetchOptionsUrl, props.optionalParams]),
  queryFn: () =>
      InterceptorHelper.intercept(props.fetchOptionsUrl!, undefined, {
        per_page: 100,
        ...props.optionalParams,
      }),
  enabled: computed(() => !!props.fetchOptionsUrl && !props.staticOptions?.length),
})

watch(remote.isFetching, (fetching) => {
  if (props.fetchOptionsUrl) loading.value = fetching
}, { immediate: true })

function resolveOptions() {
  if (props.staticOptions?.length) {
    options.value = [...props.staticOptions]
    syncValuesWithOptions()
    return
  }

  const remoteRows = remote.data.value?.data
  options.value = props.fetchOptionsUrl && Array.isArray(remoteRows) ? remoteRows : []
  syncValuesWithOptions()
}

onMounted(resolveOptions)

watch(
    () => [props.staticOptions, props.optionalParams, remote.data.value],
    resolveOptions,
    { deep: true }
)
</script>

