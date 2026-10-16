<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { toast } from "vue3-toastify";
import { useQueryClient, useMutation } from "@tanstack/vue-query";
import MainButton from "@/components/buttons/MainButton.vue";
import InterceptorHelper from "@/InterceptorHelper.ts";

// Confirms and runs a single state-changing call (complete, cancel, void, ...)
// then invalidates every list/detail query that the action affects.
const props = withDefaults(
    defineProps<{
      headerTitle?: string;
      // Already-translated confirmation question and explanation
      title: string;
      subtitle?: string;
      confirmText: string;
      // Endpoint relative to the API base, e.g. production-orders/12/complete
      url: string;
      method?: "POST" | "PUT" | "DELETE";
      body?: Record<string, any>;
      danger?: boolean;
      // e.g. while a required note in the default slot is empty
      confirmDisabled?: boolean;
      invalidateKeys?: string[];
    }>(),
    { headerTitle: "", subtitle: "", method: "POST", danger: false, confirmDisabled: false, invalidateKeys: () => [] }
);

const emit = defineEmits<{ (e: "done", response: any): void }>();

const visible = defineModel<boolean>("visible", { default: false });

const { t } = useI18n();
const queryClient = useQueryClient();

const { mutate, isPending } = useMutation({
  mutationFn: () =>
      InterceptorHelper.intercept<any>(props.url, {
        method: props.method,
        ...(props.body ? { body: props.body as any } : {}),
      }),
  onSuccess: (res: any) => {
    props.invalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
    toast.success(res?.message || t("messages.success"));
    visible.value = false;
    emit("done", res);
  },
});
</script>

<template>
  <Dialog
      v-model:visible="visible"
      :header="headerTitle ? t(headerTitle) : ''"
      :closable="false"
      :style="{ width: '40vw' }"
      :breakpoints="{ '1199px': '75vw', '575px': '90vw' }"
      modal
      class="custom-dialog"
  >
    <div class="pt-5">
      <div class="flex flex-col justify-center items-center gap-5 px-0 md:px-8 pb-2">
        <span
            class="w-14 h-14 rounded-full flex justify-center items-center"
            :class="danger ? 'bg-darkred/10' : 'bg-primary-50'"
        >
          <img src="/src/assets/images/warning-icon.svg" alt="warning-img" />
        </span>
        <div class="flex flex-col gap-2 justify-center items-center">
          <h2 class="text-2xl font-medium text-black text-center">{{ title }}</h2>
          <p v-if="subtitle" class="text-base text-neural-300 text-center">{{ subtitle }}</p>
        </div>
        <slot />
        <div class="flex gap-5 mt-4">
          <MainButton
              text="cancel"
              :class="danger ? '!bg-errors-100/10 !text-errors-100' : '!bg-gray-300 !text-neural-400'"
              @action="visible = false"
          />
          <MainButton
              :text="confirmText"
              :class="danger ? '!bg-errors-100 capitalize' : '!bg-primary-700 capitalize'"
              :loading="isPending"
              :disabled="confirmDisabled"
              @action="mutate()"
          />
        </div>
      </div>
    </div>
  </Dialog>
</template>
