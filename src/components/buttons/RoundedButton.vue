<script setup lang="ts"></script>

<template>
  <button type="button" class="rounded-button bg-white border border-line text-neural-300" @click="$emit('action')">
    <slot />
  </button>
</template>

<style scoped>
.rounded-button {
  display: flex;
  width: 2.25rem;
  height: 2.25rem;
  justify-content: center;
  align-items: center;
  gap: 0.625rem;
  flex-shrink: 0;
  border-radius: 5px;
  transition: background-color 200ms ease-in-out, box-shadow 200ms ease-in-out;
}

.rounded-button:hover {
  background-color: theme('colors.primary.50');
  border-color: theme('colors.primary.200');
}

.rounded-button:focus-visible {
  outline: 2px solid theme('colors.primary.300');
  outline-offset: 2px;
}
</style>
