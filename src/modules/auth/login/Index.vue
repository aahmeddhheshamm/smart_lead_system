<script setup lang="ts">
import MainButton from "@/components/buttons/MainButton.vue";
import InputTextField from "@/components/form/InputTextField.vue";
import InputPasswordField from "@/components/form/InputPasswordField.vue";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import { useLoginForm } from "@/modules/auth/composables/useLoginForm.ts";

const { t } = useLocaleSettings();
const { onSubmit, isPending, errorMessage, setValues } = useLoginForm();

const isMock = import.meta.env.VITE_USE_MOCK === "true";
const demoAccounts = [
  { email: "owner@nileproperties.test", role: "owner" },
  { email: "manager@nileproperties.test", role: "sales_manager" },
  { email: "sara@nileproperties.test", role: "sales_agent" },
  { email: "analyst@nileproperties.test", role: "analyst" },
];
const useDemo = (email: string) => setValues({ email, password: "Password123!" });
</script>

<template>
  <form class="flex flex-col gap-1 w-full" novalidate @submit="onSubmit">
    <div class="mb-6">
      <h1 class="text-2xl font-semibold text-heading">{{ t("auth.welcomeBack") }}</h1>
      <p class="text-sm text-neural-300 mt-1">{{ t("auth.signInSubtitle") }}</p>
    </div>

    <div v-if="errorMessage" role="alert" class="mb-4 rounded border border-errors-100/30 bg-errors-100/10 px-3 py-2 text-sm text-errors-100">
      {{ errorMessage }}
    </div>

    <InputTextField name="email" type="email" :label="t('fields.email')" required :placeholder="t('fields.enterEmail')" />
    <InputPasswordField name="password" :label="t('fields.password')" :placeholder="t('fields.enterPassword')" required />

    <div class="flex items-center justify-end pb-5">
      <router-link to="/forget-password" class="text-primary-700 font-medium text-sm">{{ t("auth.forgotPassword") }}</router-link>
    </div>

    <MainButton class="w-full" text="buttons.login" type="submit" :loading="isPending" />

    <p class="text-sm text-center text-neural-300 mt-5">
      {{ t("auth.noAccount") }}
      <router-link :to="{ name: 'register' }" class="text-primary-700 font-medium">{{ t("auth.createWorkspace") }}</router-link>
    </p>

    <div v-if="isMock" class="mt-6 rounded border border-dashed border-line p-3">
      <p class="text-xs font-semibold text-heading mb-2">{{ t("auth.demoAccounts") }}</p>
      <div class="flex flex-wrap gap-2">
        <button
            v-for="acc in demoAccounts"
            :key="acc.email"
            type="button"
            class="text-xs px-2 py-1 rounded bg-primary-50 text-primary-700 hover:bg-primary-100"
            @click="useDemo(acc.email)"
        >
          {{ t(`roles.${acc.role}`) }}
        </button>
      </div>
      <p class="text-[11px] text-neural-300 mt-2">{{ t("auth.demoHint") }}</p>
    </div>
  </form>
</template>
