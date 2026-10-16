<template>
  <div class="bg-white p-5 transition-all duration-500 box-shadow rounded border border-line" v-bind="$attrs">
    <div v-if="$slots.header" class="">
      <div class="border-b border-line -mx-5 -mt-5 px-5 py-4 mb-5">
        <slot name="header" />
      </div>
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.box-shadow {
  box-shadow: 0px 1px 1px 1px rgba(198, 198, 198, 0.2);
}
</style>
