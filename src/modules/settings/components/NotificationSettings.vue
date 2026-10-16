<script setup lang="ts">
import { ref, watch } from "vue";
import { toast } from "vue3-toastify";
import MainButton from "@/components/buttons/MainButton.vue";
import useFetch from "@/composables/useFetch";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import type { NotificationPreferences } from "@/types/domain";
import { apiPreferences, apiSavePreferences } from "@/modules/notifications/api";

const { t } = useLocaleSettings();
const { data } = useFetch({ queryKey: ["notification-preferences"], queryFn: apiPreferences });
const prefs = ref<NotificationPreferences | null>(null);
watch(() => data.value?.data, (v) => (prefs.value = v ? JSON.parse(JSON.stringify(v)) : null), { immediate: true });
const saving = ref(false);

const save = async () => {
  if (!prefs.value) return;
  saving.value = true;
  try {
    await apiSavePreferences(prefs.value);
    toast.success(t("messages.saved"));
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <div class="flex flex-col gap-4 max-w-3xl">
    <div>
      <h2 class="text-base font-semibold">{{ t("settings.notifications") }}</h2>
      <p class="text-sm text-neural-300">{{ t("settings.notificationsHint") }}</p>
    </div>
    <div v-if="prefs" class="overflow-x-auto border border-line rounded">
      <table class="w-full text-sm">
        <thead class="bg-tableHeader"><tr><th class="text-start">{{ t("settings.event") }}</th><th class="text-center">{{ t("settings.inApp") }}</th><th class="text-center">{{ t("settings.email") }}</th></tr></thead>
        <tbody>
          <tr v-for="(value, key) in prefs" :key="key" class="border-t border-line">
            <td>{{ t(`notifications.types.${key}`) }}</td>
            <td class="text-center"><input v-model="value.inApp" type="checkbox" class="w-4 h-4 accent-primary-700" :aria-label="`${t(`notifications.types.${key}`)} – ${t('settings.inApp')}`" /></td>
            <td class="text-center"><input v-model="value.email" type="checkbox" class="w-4 h-4 accent-primary-700" :aria-label="`${t(`notifications.types.${key}`)} – ${t('settings.email')}`" /></td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="text-xs text-neural-300">{{ t("settings.notificationsRule") }}</p>
    <div class="flex justify-end"><MainButton text="buttons.save" :loading="saving" @action="save" /></div>
  </div>
</template>
