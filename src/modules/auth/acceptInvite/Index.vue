<script setup lang="ts">
import { computed } from "vue";
import { useForm } from "vee-validate";
import * as yup from "yup";
import { useRoute, useRouter } from "vue-router";
import MainButton from "@/components/buttons/MainButton.vue";
import InputTextField from "@/components/form/InputTextField.vue";
import InputPasswordField from "@/components/form/InputPasswordField.vue";
import SpinnerLoading from "@/components/UI/SpinnerLoading.vue";
import useFetch from "@/composables/useFetch";
import useMutate from "@/composables/useMutate";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import { useAuthStore } from "@/store/auth.ts";
import { apiAcceptInvitation, apiInvitation } from "@/modules/auth/api";
import { usePasswordRules } from "@/modules/auth/composables/usePasswordRules.ts";

const { t } = useLocaleSettings();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const rules = usePasswordRules();
const token = computed(() => String(route.params.token));

const { data, isLoading, isError, error } = useFetch({
  queryKey: computed(() => ["invitation", token.value]),
  queryFn: () => apiInvitation(token.value),
});
const invitation = computed(() => data.value?.data);

const schema = computed(() =>
    yup.object({
      name: yup.string().trim().required(t("validations.required", { field: t("fields.fullName") })),
      password: rules.password(),
    })
);
const { handleSubmit } = useForm({ validationSchema: schema, initialValues: { name: "", password: "" } });
const { mutate, isPending } = useMutate({ mutationKey: ["accept-invite"], mutationFn: (v: any) => apiAcceptInvitation(token.value, v) });

const onSubmit = handleSubmit((values) => {
  mutate(values, {
    onSuccess: (res) => {
      // the new session belongs to the invited organization
      authStore.loaded = false;
      authStore.setSession(res.data);
      router.push({ name: "dashboard" });
    },
  });
});
</script>

<template>
  <div class="w-full">
    <div v-if="isLoading" class="py-10"><SpinnerLoading /></div>
    <div v-else-if="isError" class="rounded bg-errors-100/10 p-4 text-sm text-errors-100" role="alert">
      {{ (error as any)?.error?.message || t("auth.invitationInvalid") }}
    </div>
    <template v-else-if="invitation">
      <h1 class="text-2xl font-semibold text-heading">{{ t("auth.joinOrganization", { name: invitation.organization.name }) }}</h1>
      <p class="text-sm text-neural-300 mt-1 mb-6">
        {{ t("auth.invitedAs", { email: invitation.email, role: t(`roles.${invitation.role}`) }) }}
      </p>
      <form class="flex flex-col gap-1" novalidate @submit="onSubmit">
        <InputTextField name="name" :label="t('fields.fullName')" :placeholder="t('fields.enterFullName')" required />
        <InputPasswordField name="password" :label="t('fields.password')" :placeholder="t('fields.enterPassword')" required />
        <MainButton class="w-full" text="auth.acceptInvitation" type="submit" :loading="isPending" />
      </form>
    </template>
  </div>
</template>
