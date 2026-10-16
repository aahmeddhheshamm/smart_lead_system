<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type {MainModalProps} from "@/types/types.ts";

const { t } = useI18n();

 withDefaults(defineProps<MainModalProps>(), {
  headerTitle: "",
  draggable: false,
  closable: true,
  width: '50vw',
  modal: true,
  position: 'center',
});

const visible = defineModel<boolean>('visible', { default: false });

</script>

<template>
  <Dialog
      v-model:visible="visible"
      :draggable="draggable"
      :header="headerTitle ? t(headerTitle) : ''"
      :closable="closable"
      :style="{ width: width, height: position !== 'center' ? '100%' : '' }"
      :breakpoints="{ '1199px': '75vw', '575px': '90vw' }"
      :modal="modal"
      :position="position"
      class="custom-dialog"
  >
    <div class="pt-5">
      <slot/>
    </div>

  </Dialog>
</template>

<style>

</style>