<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { Icon } from "@iconify/vue";
import { toast } from "vue3-toastify";
import { useQueryClient } from "@tanstack/vue-query";
import SpinnerLoading from "@/components/UI/SpinnerLoading.vue";
import StatusBadge from "@/components/UI/StatusBadge.vue";
import MainModal from "@/components/UI/modals/MainModal.vue";
import MainButton from "@/components/buttons/MainButton.vue";
import useFetch from "@/composables/useFetch";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import { useAuthorization } from "@/composables/useAuthorization.ts";
import { fromNow } from "@/utils";
import { P } from "@/config/permissions";
import { INTEGRATION_ICONS } from "@/constants/lead";
import type { Integration } from "@/types/domain";
import { apiDisconnect, apiIntegrations, apiTestIntegration } from "@/modules/integrations/api";
import ConnectIntegrationModal from "@/modules/integrations/components/ConnectIntegrationModal.vue";

const { t } = useLocaleSettings();
const { can } = useAuthorization();
const router = useRouter();
const queryClient = useQueryClient();

const { data, isLoading, isError, refetch } = useFetch({ queryKey: ["integrations"], queryFn: apiIntegrations });
const groups = computed(() => {
  const all = data.value?.data ?? [];
  return (["core", "later", "future"] as const).map((priority) => ({ priority, items: all.filter((i) => i.priority === priority) })).filter((g) => g.items.length);
});

const selected = ref<Integration | null>(null);
const showConnect = ref(false);
const disconnecting = ref<Integration | null>(null);
const busy = ref<string | null>(null);

const open = (integ: Integration) => {
  if (integ.provider === "csv_import") return router.push({ name: "leads" });
  selected.value = integ;
  showConnect.value = true;
};

const test = async (integ: Integration) => {
  busy.value = integ.provider;
  try {
    const res = await apiTestIntegration(integ.provider);
    toast.success(res.data.lead ? t("integrations.testLeadCreated", { name: res.data.lead.name }) : t("integrations.testOk"));
    ["integrations", "leads", "automation-runs", "dashboard"].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
  } finally {
    busy.value = null;
  }
};

const disconnect = async () => {
  if (!disconnecting.value) return;
  busy.value = disconnecting.value.provider;
  try {
    await apiDisconnect(disconnecting.value.provider);
    toast.success(t("integrations.disconnected"));
    queryClient.invalidateQueries({ queryKey: ["integrations"] });
    disconnecting.value = null;
  } finally {
    busy.value = null;
  }
};
</script>

<template>
  <div class="flex flex-col gap-6">
    <ConnectIntegrationModal v-model:visible="showConnect" :integration="selected" />
    <MainModal :visible="!!disconnecting" header-title="integrations.disconnectTitle" width="30rem" @update:visible="(v: boolean) => !v && (disconnecting = null)">
      <p class="text-sm text-neural-400">{{ t("integrations.disconnectBody") }}</p>
      <div class="flex justify-end gap-3 pt-4">
        <button type="button" class="details-btn-light" @click="disconnecting = null">{{ t("buttons.cancel") }}</button>
        <MainButton text="integrations.disconnect" class="!bg-errors-100 !border-errors-100" :loading="!!busy" @action="disconnect" />
      </div>
    </MainModal>

    <div>
      <h1 class="text-xl">{{ t("sidebar.integrations") }}</h1>
      <p class="text-sm text-neural-300 max-w-2xl">{{ t("integrations.subtitle") }}</p>
    </div>

    <div v-if="isLoading" class="py-16"><SpinnerLoading /></div>
    <p v-else-if="isError" class="py-12 text-center text-sm text-neural-300">{{ t("messages.loadFailed") }} <button type="button" class="text-primary-700" @click="refetch()">{{ t("buttons.retry") }}</button></p>

    <section v-for="group in groups" v-else :key="group.priority">
      <h2 class="text-sm font-semibold text-neural-300 uppercase tracking-wide mb-3">{{ t(`integrations.priority.${group.priority}`) }}</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <article v-for="integ in group.items" :key="integ.id" class="bg-white border border-line rounded p-5 flex flex-col gap-3">
          <header class="flex items-start justify-between gap-3">
            <span class="flex items-center gap-3 min-w-0">
              <span class="w-10 h-10 rounded bg-primary-50 text-primary-700 flex items-center justify-center shrink-0"><Icon :icon="INTEGRATION_ICONS[integ.provider]" class="w-5 h-5" /></span>
              <span class="text-base font-semibold text-heading truncate">{{ t(`integrations.providers.${integ.provider}.name`) }}</span>
            </span>
            <StatusBadge :status="integ.status" />
          </header>
          <p class="text-xs text-neural-300 flex-1">{{ t(`integrations.providers.${integ.provider}.description`) }}</p>
          <p v-if="integ.lastError" class="text-xs text-errors-100 bg-errors-100/10 rounded px-2 py-1">{{ integ.lastError }}</p>
          <dl v-if="integ.status === 'connected'" class="grid grid-cols-2 gap-2 text-xs">
            <div><dt class="text-neural-300">{{ t("integrations.lastSync") }}</dt><dd class="text-heading">{{ integ.lastSyncAt ? fromNow(integ.lastSyncAt) : "—" }}</dd></div>
            <div v-if="integ.provider === 'website_form'"><dt class="text-neural-300">{{ t("integrations.events7d") }}</dt><dd class="text-heading tabular-nums">{{ integ.eventsLast7d }}</dd></div>
            <div v-if="integ.config?.secretPreview" class="col-span-2"><dt class="text-neural-300">{{ t("integrations.signingSecret") }}</dt><dd class="text-heading"><code>{{ integ.config.secretPreview }}</code></dd></div>
            <div v-if="integ.config?.fromAddress" class="col-span-2"><dt class="text-neural-300">{{ t("integrations.fromAddress") }}</dt><dd class="text-heading truncate">{{ integ.config.fromAddress }}</dd></div>
          </dl>
          <footer v-if="integ.status !== 'coming_soon'" class="flex flex-wrap items-center gap-2 pt-3 border-t border-line">
            <template v-if="integ.provider === 'csv_import'">
              <button type="button" class="details-btn-outline !h-8 text-xs" @click="open(integ)">{{ t("integrations.openImport") }}</button>
            </template>
            <template v-else-if="can(P.integrationsManage)">
              <button type="button" class="details-btn-outline !h-8 text-xs" @click="open(integ)">{{ integ.status === "connected" ? t("integrations.manage") : t("integrations.connect") }}</button>
              <button v-if="integ.status === 'connected'" type="button" class="details-btn-light !h-8 text-xs" :disabled="busy === integ.provider" @click="test(integ)">{{ t("integrations.test") }}</button>
              <button v-if="integ.status === 'connected'" type="button" class="ms-auto text-xs text-errors-100" @click="disconnecting = integ">{{ t("integrations.disconnect") }}</button>
            </template>
            <span v-else class="text-xs text-neural-300">{{ t("integrations.askAdmin") }}</span>
          </footer>
        </article>
      </div>
    </section>
  </div>
</template>
