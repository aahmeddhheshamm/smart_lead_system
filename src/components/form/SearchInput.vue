<script setup lang="ts">

const props = defineProps<{
  isVisible: boolean
  hasCloseIcon?: boolean
}>()

const emit = defineEmits(['input', 'cancel'])

const query = defineModel('query')
</script>

<template>
  <div
    v-if="isVisible"
    class="rounded-full overflow-hidden bg-primary-50 items-center flex justify-between px-3"
  >
    <div class="w-full flex justify-start items-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="17"
        height="16"
        viewBox="0 0 17 16"
        fill="none"
        class="stroke-primary-700"
      >
        <path
          d="M7.91895 12.5C10.8184 12.5 13.1689 10.1495 13.1689 7.25C13.1689 4.35051 10.8184 2 7.91895 2C5.01945 2 2.66895 4.35051 2.66895 7.25C2.66895 10.1495 5.01945 12.5 7.91895 12.5Z"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          d="M11.6313 10.9624L14.6688 13.9999"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <input
        v-bind="$attrs"
        autofocus
        type="text"
        class="w-full bg-transparent border-0 active:border-0 !focus:border-0 focus:outline-none focus:ring-0 placeholder:text-xs placeholder:font-light placeholder:text-black/60 text-primary-700"
        placeholder="Search"
        v-model.trim="query"
        @input="emit('input')"
      />
    </div>

    <svg
      v-if="hasCloseIcon"
      @click="emit('cancel')"
      width="10"
      height="10"
      viewBox="0 0 16 16"
      fill="none"
      class="fill-primary-700 cursor-pointer"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M14.716 15.8675C14.5393 16.0442 14.2531 16.0442 14.0762 15.8675L7.99986 9.79103L1.92354 15.8675C1.74701 16.044 1.46061 16.0442 1.28373 15.8675L0.132464 14.716C-0.0442435 14.5393 -0.0440657 14.2531 0.132464 14.0764L6.20878 7.99975L0.132642 1.92349C-0.0440658 1.74678 -0.043888 1.46055 0.132642 1.28384L1.28391 0.132555C1.46061 -0.0441555 1.74701 -0.0441555 1.92372 0.132378L7.99986 6.20899L14.0764 0.132555C14.2531 -0.0441555 14.5393 -0.0441555 14.7162 0.132555L15.8676 1.28384C16.0441 1.46055 16.0441 1.74678 15.8676 1.92349L9.79075 7.99992L15.8674 14.0765C16.044 14.2531 16.044 14.5395 15.8674 14.7162L14.716 15.8675Z"
      />
    </svg>
  </div>
</template>

<style scoped></style>
