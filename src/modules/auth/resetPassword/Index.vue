<script setup lang="ts">
import { computed } from "vue";
import { useForm } from "vee-validate";
import * as yup from "yup";
import { useRoute, useRouter } from "vue-router";
import { toast } from "vue3-toastify";
import MainButton from "@/components/buttons/MainButton.vue";
import InputPasswordField from "@/components/form/InputPasswordField.vue";
import useMutate from "@/composables/useMutate";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import { apiResetPassword } from "@/modules/auth/api";
import { usePasswordRules } from "@/modules/auth/composables/usePasswordRules.ts";

const { t } = useLocaleSettings();
const route = useRoute();
const router = useRouter();
const rules = usePasswordRules();
const token = computed(() => (typeof route.query.token === "string" ? route.query.token : ""));
// the backend's reset email links to /reset-password?uid=…&token=…
const uid = computed(() => (typeof route.query.uid === "string" ? route.query.uid : undefined));

const schema = computed(() => yup.object({ password: rules.password(), confirmPassword: rules.confirm() }));
const { handleSubmit } = useForm({ validationSchema: schema, initialValues: { password: "", confirmPassword: "" } });
const { mutate, isPending } = useMutate({ mutationKey: ["reset-password"], mutationFn: apiResetPassword });

const onSubmit = handleSubmit((values) => {
  mutate({ token: token.value, uid: uid.value, password: values.password }, {
    onSuccess: (res) => {
      toast.success(res.message || t("messages.passwordChanged"));
      router.push({ name: "login" });
    },
  });
});
</script>

<template>
  <div class="w-full">
    <h1 class="text-2xl font-semibold text-heading">{{ t("auth.resetPasswordTitle") }}</h1>
    <div v-if="!token" class="mt-4 rounded bg-errors-100/10 p-4 text-sm text-errors-100" role="alert">{{ t("auth.resetLinkInvalid") }}</div>
    <form v-else class="flex flex-col gap-1 mt-6" novalidate @submit="onSubmit">
      <InputPasswordField name="password" :label="t('fields.newPassword')" :placeholder="t('fields.enterPassword')" required />
      <InputPasswordField name="confirmPassword" :label="t('fields.confirmPassword')" :placeholder="t('fields.confirmPassword')" required />
      <MainButton class="w-full" text="buttons.save" type="submit" :loading="isPending" />
    </form>
    <router-link :to="{ name: 'login' }" class="block text-center text-sm text-primary-700 font-medium mt-6">{{ t("auth.backToLogin") }}</router-link>
  </div>
</template>
