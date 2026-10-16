<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type {MainModalProps} from "@/types/types.ts";
import MainButton from "@/components/buttons/MainButton.vue";
import useMutate from "@/composables/useMutate.ts";
import InterceptorHelper from "@/InterceptorHelper.ts";
import {computed} from "vue";
import {toast} from "vue3-toastify";

const { t } = useI18n();

const props = withDefaults(defineProps<MainModalProps>(), {
  headerTitle: "",
  draggable: false,
  closable: false,
  width: '40vw',
  modal: true,
  position: 'center',
  deleteData: () => ({ id: '', key: '', text: '', url: '' })
});

const visible = defineModel<boolean>('visible', { default: false });
const emit = defineEmits<{ (e: 'deleted'): void }>();

const { mutate, isPending } = useMutate({
  mutationKey: ["delete"],
  queryKey: [computed(() => props.deleteData?.key)],
  mutationFn: () => {
    const fullUrl = `${props.deleteData?.url}/${props.deleteData?.id}`;
    return InterceptorHelper.intercept(fullUrl, {
      method: "DELETE",
    });
  },
});

const deleteItem = () => {
  mutate(
      {},
      {
        onSuccess: (res) => {
          // a 204 has no body, so fall back to the generic message
          toast.success(res?.message || t('messages.success'))
          visible.value = false
          emit('deleted')
        },
        onError: (e) => {
          console.log(e)
        },
      },
  );
};

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
        <div class="flex flex-col justify-center items-center gap-5 px-0 md:px-8 pb-2">
              <span class="w-14 h-14 rounded-full bg-darkred/10 flex justify-center items-center">
                <img src="/src/assets/images/warning-icon.svg" alt="warning-img" />
              </span>
          <div class="flex flex-col gap-2 justify-center items-center">
            <h2 class="text-2xl font-medium text-black">{{ t('modal.permanentlyDelete') }} {{ deleteData?.text }}?</h2>
            <p class="text-base text-neural-300 text-center">
              {{ t('modal.permanentlyDeleteSubtitle') }}
            </p>
          </div>
          <div class="flex gap-5 mt-4">
            <MainButton
                text="cancel"
                class="!bg-errors-100/10 !text-errors-100"
                @action="visible = false"
            />
            <MainButton
                text="delete"
                class="!bg-errors-100 capitalize"
                @action="deleteItem"
                :loading="isPending"
            />
          </div>
        </div>
    </div>

  </Dialog>
</template>

<style>

</style>