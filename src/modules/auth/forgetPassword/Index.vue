<script setup lang="ts">
import { computed, ref } from "vue";
import { useForm } from "vee-validate";
import * as yup from "yup";
import MainButton from "@/components/buttons/MainButton.vue";
import InputTextField from "@/components/form/InputTextField.vue";
import useMutate from "@/composables/useMutate";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import { apiForgetPassword } from "@/modules/auth/api";

const { t } = useLocaleSettings();
const sent = ref(false);
// only returned by the local mock API, so the flow can be tried without an inbox
const debugToken = ref<string | null>(null);

const schema = computed(() =>
    yup.object({
      email: yup.string().trim().email(t("validations.email")).required(t("validations.required", { field: t("fields.email") })),
    })
);
const { handleSubmit } = useForm({ validationSchema: schema, initialValues: { email: "" } });
const { mutate, isPending } = useMutate({ mutationKey: ["forgot-password"], mutationFn: apiForgetPassword });

const onSubmit = handleSubmit((values) => {
  mutate({ email: values.email.trim().toLowerCase() }, {
    onSuccess: (res) => {
      sent.value = true;
      debugToken.value = res.debugResetToken ?? null;
    },
  });
});
</script>

<template>
  <div class="w-full">
    <h1 class="text-2xl font-semibold text-heading">{{ t("auth.forgotPasswordTitle") }}</h1>
    <template v-if="!sent">
      <p class="text-sm text-neural-300 mt-1 mb-6">{{ t("auth.forgotPasswordSubtitle") }}</p>
      <form class="flex flex-col gap-1" novalidate @submit="onSubmit">
        <InputTextField name="email" type="email" :label="t('fields.email')" required :placeholder="t('fields.enterEmail')" />
        <MainButton class="w-full" text="auth.sendResetLink" type="submit" :loading="isPending" />
      </form>
    </template>
    <div v-else class="mt-4 rounded bg-primary-50 p-4 text-sm text-neural-400" role="status">
      {{ t("auth.resetLinkSent") }}
      <router-link v-if="debugToken" :to="{ name: 'resetPassword', query: { token: debugToken } }" class="block mt-3 text-primary-700 font-medium">
        {{ t("auth.openResetLinkDemo") }}
      </router-link>
    </div>
    <router-link :to="{ name: 'login' }" class="block text-center text-sm text-primary-700 font-medium mt-6">{{ t("auth.backToLogin") }}</router-link>
  </div>
</template>
