<script setup lang="ts">
import { computed } from "vue";
import { useForm } from "vee-validate";
import * as yup from "yup";
import { toast } from "vue3-toastify";
import { useQueryClient } from "@tanstack/vue-query";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import useMutate from "@/composables/useMutate";
import useFetch from "@/composables/useFetch";
import { useAuthStore } from "@/store/auth.ts";
import Box from "@/components/UI/Box.vue";
import MainTitle from "@/components/UI/MainTitle.vue";
import UserAvatar from "@/components/UI/UserAvatar.vue";
import FormSection from "@/components/form/FormSection.vue";
import InputPasswordField from "@/components/form/InputPasswordField.vue";
import MainButton from "@/components/buttons/MainButton.vue";
import { fromNow } from "@/utils";
import { apiChangePassword, apiRevokeOtherSessions, apiRevokeSession, apiSessions } from "@/modules/auth/api";
import { USE_MOCK } from "@/InterceptorHelper";
import { usePasswordRules } from "@/modules/auth/composables/usePasswordRules.ts";

const { t } = useLocaleSettings();
const auth = useAuthStore();
const rules = usePasswordRules();
const queryClient = useQueryClient();

const schema = computed(() =>
    yup.object({
      currentPassword: yup.string().required(t("validations.required", { field: t("fields.currentPassword") })),
      password: rules.password(),
      passwordConfirmation: rules.confirm(),
    })
);
const { handleSubmit, resetForm } = useForm<any>({ validationSchema: schema, initialValues: { currentPassword: "", password: "", passwordConfirmation: "" } });
const { mutate, isPending } = useMutate({ mutationKey: ["change-password"], mutationFn: apiChangePassword });
const onSubmit = handleSubmit((v: any) => {
  mutate({ currentPassword: v.currentPassword, password: v.password }, {
    onSuccess: (res) => {
      toast.success(res.message || t("messages.passwordChanged"));
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
});

const { data: sessionsData } = useFetch({ queryKey: ["sessions"], queryFn: apiSessions });
const sessions = computed(() => sessionsData.value?.data ?? []);
const revokeOthers = async () => {
  await apiRevokeOtherSessions();
  toast.success(t("profile.othersRevoked"));
  queryClient.invalidateQueries({ queryKey: ["sessions"] });
};
const revoke = async (id: string) => {
  await apiRevokeSession(id);
  toast.success(t("profile.sessionRevoked"));
  queryClient.invalidateQueries({ queryKey: ["sessions"] });
};
</script>

<template>
  <Box>
    <template #header><MainTitle :title="t('myProfile')" /></template>
    <div class="flex flex-col gap-8 max-w-3xl">
      <div class="flex items-center gap-4">
        <UserAvatar :name="auth.username" size="lg" />
        <div>
          <p class="text-lg font-semibold text-heading">{{ auth.username }}</p>
          <p class="text-sm text-neural-300">{{ auth.user?.email }}</p>
          <p class="text-sm text-primary-700">{{ t(`roles.${auth.role}`) }} · {{ auth.organization?.name }}</p>
        </div>
      </div>

      <form class="flex flex-col gap-4" novalidate @submit.prevent="onSubmit">
        <FormSection :title="t('fields.changePassword')" :description="t('profile.changePasswordHint')">
          <div class="md:col-span-2"><InputPasswordField name="currentPassword" :label="t('fields.currentPassword')" :placeholder="t('fields.currentPassword')" /></div>
          <InputPasswordField name="password" :label="t('fields.newPassword')" :placeholder="t('fields.enterPassword')" />
          <InputPasswordField name="passwordConfirmation" :label="t('fields.confirmPassword')" :placeholder="t('fields.confirmPassword')" />
        </FormSection>
        <div class="flex justify-end"><MainButton type="submit" text="buttons.save" :loading="isPending" /></div>
      </form>

      <section>
        <h3 class="text-base font-semibold mb-1">{{ t("profile.sessions") }}</h3>
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
          <p class="text-sm text-neural-300">{{ t("profile.sessionsHint") }}</p>
          <button v-if="!USE_MOCK && sessions.length > 1" type="button" class="text-xs text-errors-100 font-medium" @click="revokeOthers">{{ t("profile.signOutOthers") }}</button>
        </div>
        <ul class="border border-line rounded divide-y divide-line">
          <li v-for="s in sessions" :key="s.id" class="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
            <span class="min-w-0">
              <span class="block text-heading truncate">{{ s.userAgent }}</span>
              <span class="block text-xs text-neural-300">{{ s.ip }} · {{ t("profile.lastSeen", { when: fromNow(s.lastSeenAt) }) }}</span>
            </span>
            <span v-if="s.current" class="text-xs text-[#03894A] shrink-0">{{ t("profile.thisDevice") }}</span>
            <button v-else type="button" class="text-xs text-errors-100 shrink-0" @click="revoke(s.id)">{{ t("profile.signOut") }}</button>
          </li>
        </ul>
      </section>
    </div>
  </Box>
</template>
