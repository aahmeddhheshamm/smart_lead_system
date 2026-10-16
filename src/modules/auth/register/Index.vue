<script setup lang="ts">
import { computed } from "vue";
import { useForm } from "vee-validate";
import * as yup from "yup";
import { useRouter } from "vue-router";
import MainButton from "@/components/buttons/MainButton.vue";
import InputTextField from "@/components/form/InputTextField.vue";
import InputPasswordField from "@/components/form/InputPasswordField.vue";
import SelectBox from "@/components/form/SelectBox.vue";
import useMutate from "@/composables/useMutate";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import { useAuthStore } from "@/store/auth.ts";
import { apiRegister } from "@/modules/auth/api";
import { usePasswordRules } from "@/modules/auth/composables/usePasswordRules.ts";
import { INDUSTRIES, TIMEZONES } from "@/constants/lead";

const { t, locale } = useLocaleSettings();
const router = useRouter();
const authStore = useAuthStore();
const rules = usePasswordRules();

const schema = computed(() =>
    yup.object({
      name: yup.string().trim().required(t("validations.required", { field: t("fields.fullName") })),
      email: yup.string().trim().email(t("validations.email")).required(t("validations.required", { field: t("fields.email") })),
      password: rules.password(),
      organizationName: yup.string().trim().required(t("validations.required", { field: t("fields.organizationName") })),
      industry: yup.string().required(t("validations.required", { field: t("fields.industry") })),
      timezone: yup.string().required(t("validations.required", { field: t("fields.timezone") })),
    })
);

const { handleSubmit } = useForm({
  validationSchema: schema,
  initialValues: {
    name: "", email: "", password: "", organizationName: "", industry: "real_estate",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone && TIMEZONES.includes(Intl.DateTimeFormat().resolvedOptions().timeZone)
        ? Intl.DateTimeFormat().resolvedOptions().timeZone : "Africa/Cairo",
  },
});

const industryOptions = computed(() => INDUSTRIES.map((id) => ({ id, name: t(`options.industry.${id}`) })));
const timezoneOptions = TIMEZONES.map((id) => ({ id, name: id }));

const { mutate, isPending } = useMutate({ mutationKey: ["register"], mutationFn: apiRegister });

const onSubmit = handleSubmit((values: any) => {
  mutate(
      { ...values, email: values.email.trim().toLowerCase(), locale: locale.value === "AR" ? "ar" : "en" },
      {
        onSuccess: (res) => {
          authStore.setSession(res.data);
          router.push({ name: "onboarding" });
        },
      }
  );
});
</script>

<template>
  <form class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 w-full" novalidate @submit="onSubmit">
    <div class="sm:col-span-2 mb-6">
      <h1 class="text-2xl font-semibold text-heading">{{ t("auth.createWorkspace") }}</h1>
      <p class="text-sm text-neural-300 mt-1">{{ t("auth.registerSubtitle") }}</p>
    </div>
    <InputTextField name="name" :label="t('fields.fullName')" :placeholder="t('fields.enterFullName')" required />
    <InputTextField name="email" type="email" :label="t('fields.email')" :placeholder="t('fields.enterEmail')" required />
    <div class="sm:col-span-2">
      <InputPasswordField name="password" :label="t('fields.password')" :placeholder="t('fields.enterPassword')" required />
    </div>
    <div class="sm:col-span-2">
      <InputTextField name="organizationName" :label="t('fields.organizationName')" :placeholder="t('fields.enterOrganizationName')" required />
    </div>
    <SelectBox name="industry" :label="t('fields.industry')" :multi="false" :static-options="industryOptions" option-label="name" option-value="id" :placeholder="t('fields.select')" required />
    <SelectBox name="timezone" :label="t('fields.timezone')" :multi="false" :static-options="timezoneOptions" option-label="name" option-value="id" :placeholder="t('fields.select')" filter required />
    <MainButton class="sm:col-span-2 w-full mt-2" text="auth.createWorkspace" type="submit" :loading="isPending" />
    <p class="sm:col-span-2 text-sm text-center text-neural-300 mt-5">
      {{ t("auth.haveAccount") }}
      <router-link :to="{ name: 'login' }" class="text-primary-700 font-medium">{{ t("buttons.login") }}</router-link>
    </p>
  </form>
</template>
