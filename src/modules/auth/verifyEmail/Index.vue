<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import SpinnerLoading from "@/components/UI/SpinnerLoading.vue";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import { useAuthStore } from "@/store/auth.ts";
import { apiVerifyEmail } from "@/modules/auth/api";

const { t } = useLocaleSettings();
const route = useRoute();
const auth = useAuthStore();
const state = ref<"loading" | "done" | "failed">("loading");
const message = ref("");

onMounted(async () => {
  const token = typeof route.query.token === "string" ? route.query.token : "";
  if (!token) return (state.value = "failed");
  try {
    await apiVerifyEmail(token);
    if (auth.user) auth.user.emailVerified = true;
    state.value = "done";
  } catch (e: any) {
    message.value = e?.error?.message ?? "";
    state.value = "failed";
  }
});
</script>

<template>
  <div class="w-full text-center">
    <div v-if="state === 'loading'" class="py-10"><SpinnerLoading /></div>
    <template v-else-if="state === 'done'">
      <h1 class="text-2xl font-semibold text-heading">{{ t("auth.emailVerified") }}</h1>
      <p class="text-sm text-neural-300 mt-2">{{ t("auth.emailVerifiedBody") }}</p>
    </template>
    <template v-else>
      <h1 class="text-2xl font-semibold text-heading">{{ t("auth.emailVerifyFailed") }}</h1>
      <p class="text-sm text-neural-300 mt-2">{{ message || t("auth.emailVerifyFailedBody") }}</p>
    </template>
    <router-link :to="auth.token ? { name: 'dashboard' } : { name: 'login' }" class="block text-sm text-primary-700 font-medium mt-6">
      {{ auth.token ? t("buttons.backToDashboard") : t("auth.backToLogin") }}
    </router-link>
  </div>
</template>
