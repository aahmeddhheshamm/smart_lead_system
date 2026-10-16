<script setup lang="ts">
import { ref } from "vue";
import { toast } from "vue3-toastify";
import { useQueryClient } from "@tanstack/vue-query";
import MainButton from "@/components/buttons/MainButton.vue";
import StatusBadge from "@/components/UI/StatusBadge.vue";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import { useAuthorization } from "@/composables/useAuthorization.ts";
import { useSources } from "@/composables/useLookups.ts";
import { P } from "@/config/permissions";
import { SOURCE_TYPES } from "@/constants/lead";
import { apiCreateSource, apiDeleteSource, apiUpdateSource } from "@/modules/settings/api";

const { t } = useLocaleSettings();
const { can } = useAuthorization();
const queryClient = useQueryClient();
const { sources } = useSources();

const name = ref("");
const type = ref("other");
const busy = ref(false);
const refresh = () => queryClient.invalidateQueries({ queryKey: ["lead-sources"] });

const add = async () => {
  busy.value = true;
  try {
    await apiCreateSource({ name: name.value.trim(), type: type.value });
    name.value = "";
    toast.success(t("messages.saved"));
    refresh();
  } finally {
    busy.value = false;
  }
};
const toggle = async (s: any) => {
  await apiUpdateSource(s.id, { active: !s.active });
  refresh();
};
const remove = async (s: any) => {
  await apiDeleteSource(s.id);
  toast.success(s.leads ? t("settings.sourceDeactivated") : t("settings.sourceDeleted"));
  refresh();
};
</script>

<template>
  <div class="flex flex-col gap-4 max-w-3xl">
    <div>
      <h2 class="text-base font-semibold">{{ t("settings.sources") }}</h2>
      <p class="text-sm text-neural-300">{{ t("settings.sourcesHint") }}</p>
    </div>
    <form v-if="can(P.settingsManage)" class="flex flex-wrap gap-2" @submit.prevent="add">
      <input v-model="name" maxlength="40" required class="h-10 flex-1 min-w-[12rem] rounded border border-line bg-white px-3 text-sm text-black" :placeholder="t('settings.sourceName')" :aria-label="t('settings.sourceName')" />
      <select v-model="type" class="h-10 rounded border border-line bg-white px-2 text-sm text-black" :aria-label="t('fields.type')">
        <option v-for="x in SOURCE_TYPES" :key="x" :value="x">{{ t(`options.sourceType.${x}`) }}</option>
      </select>
      <MainButton type="submit" text="buttons.add" :loading="busy" :disabled="!name.trim()" />
    </form>
    <ul class="border border-line rounded divide-y divide-line">
      <li v-for="s in sources" :key="s.id" class="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
        <span class="min-w-0">
          <span class="font-medium text-heading">{{ s.name }}</span>
          <span class="text-xs text-neural-300"> · {{ t(`options.sourceType.${s.type}`) }} · {{ t("settings.leadsCount", { count: s.leads }) }}</span>
        </span>
        <span class="flex items-center gap-3">
          <StatusBadge :status="s.active ? 'active' : 'inactive'" />
          <template v-if="can(P.settingsManage)">
            <button type="button" class="text-xs text-primary-700" @click="toggle(s)">{{ s.active ? t("settings.deactivate") : t("settings.activate") }}</button>
            <button type="button" class="text-xs text-errors-100" @click="remove(s)">{{ t("buttons.delete") }}</button>
          </template>
        </span>
      </li>
    </ul>
    <p class="text-xs text-neural-300">{{ t("settings.sourcesRule") }}</p>
  </div>
</template>
