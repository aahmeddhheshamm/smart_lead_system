<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { Icon } from "@iconify/vue";
import { toast } from "vue3-toastify";
import { useQueryClient } from "@tanstack/vue-query";
import Box from "@/components/UI/Box.vue";
import MainTitle from "@/components/UI/MainTitle.vue";
import SpinnerLoading from "@/components/UI/SpinnerLoading.vue";
import StatusBadge from "@/components/UI/StatusBadge.vue";
import TablePagination from "@/components/table/TablePagination.vue";
import useFetch from "@/composables/useFetch";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import { useAuthorization } from "@/composables/useAuthorization.ts";
import { changeDateFormat, fromNow } from "@/utils";
import { P } from "@/config/permissions";
import { AUTOMATION_TYPES } from "@/constants/lead";
import type { AutomationRun } from "@/types/domain";
import { apiRetryRun, apiRuns } from "@/modules/automations/api";

const { t } = useLocaleSettings();
const { can } = useAuthorization();
const route = useRoute();
const queryClient = useQueryClient();

const status = ref("");
const type = ref(typeof route.query.type === "string" ? route.query.type : "");
const page = ref(1);
const perPage = ref(20);
watch([status, type, perPage], () => (page.value = 1));

const { data, isLoading, isError, refetch } = useFetch({
  queryKey: computed(() => ["automation-runs", status.value, type.value, page.value, perPage.value]),
  queryFn: () => apiRuns({ status: status.value, type: type.value, page: page.value, pageSize: perPage.value }),
  options: { refetchInterval: 20_000 },
});
const runs = computed<AutomationRun[]>(() => data.value?.data ?? []);
const pagination = computed(() => ({ total: data.value?.pagination?.total ?? 0, lastPage: data.value?.pagination?.totalPages ?? 1 }));

const expanded = ref<string | null>(null);
const retrying = ref<string | null>(null);
const retry = async (run: AutomationRun) => {
  retrying.value = run.id;
  try {
    await apiRetryRun(run.id);
    toast.success(t("automations.retried"));
    queryClient.invalidateQueries({ queryKey: ["automation-runs"] });
    queryClient.invalidateQueries({ queryKey: ["automations"] });
  } finally {
    retrying.value = null;
  }
};
const duration = (run: AutomationRun) =>
    run.durationMs != null ? `${run.durationMs} ms` : run.finishedAt ? `${Math.max(0, new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime())} ms` : "—";
</script>

<template>
  <Box>
    <template #header>
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <MainTitle title="sidebar.automationRuns" />
        <div class="flex flex-wrap gap-2">
          <select v-model="type" class="h-9 rounded border border-line bg-white px-2 text-sm text-black" :aria-label="t('fields.automation')">
            <option value="">{{ t("automations.allAutomations") }}</option>
            <option v-for="x in AUTOMATION_TYPES" :key="x" :value="x">{{ t(`automations.types.${x}.name`) }}</option>
          </select>
          <select v-model="status" class="h-9 rounded border border-line bg-white px-2 text-sm text-black" :aria-label="t('fields.status')">
            <option value="">{{ t("automations.allStatuses") }}</option>
            <option v-for="x in ['succeeded', 'failed', 'skipped', 'running']" :key="x" :value="x">{{ t(`status.${x}`) }}</option>
          </select>
        </div>
      </div>
    </template>

    <p class="text-xs text-neural-300 mb-3">{{ t("automations.logsPrivacy") }}</p>

    <div v-if="isLoading" class="py-12"><SpinnerLoading /></div>
    <p v-else-if="isError" class="py-12 text-center text-sm text-neural-300">{{ t("messages.loadFailed") }} <button type="button" class="text-primary-700" @click="refetch()">{{ t("buttons.retry") }}</button></p>
    <p v-else-if="!runs.length" class="py-12 text-center text-sm text-neural-300">{{ t("automations.noRuns") }}</p>

    <ul v-else class="divide-y divide-line">
      <li v-for="run in runs" :key="run.id" class="py-3">
        <div class="flex flex-wrap items-center gap-3">
          <button type="button" class="flex items-center gap-3 flex-1 min-w-0 text-start" :aria-expanded="expanded === run.id" @click="expanded = expanded === run.id ? null : run.id">
            <Icon icon="lucide:chevron-right" class="w-4 h-4 text-neural-300 transition-transform shrink-0 rtl:rotate-180" :class="{ 'rotate-90 rtl:rotate-90': expanded === run.id }" />
            <StatusBadge :status="run.status" />
            <span class="min-w-0">
              <span class="block text-sm font-medium text-heading truncate">{{ run.rule ? run.rule.name || ($te(`automations.types.${run.rule.type}.name`) ? t(`automations.types.${run.rule.type}.name`) : run.rule.type) : "—" }}<span v-if="run.lead" class="text-neural-300 font-normal"> · {{ run.lead.name }}</span></span>
              <span class="block text-xs text-neural-300 truncate">{{ run.trigger }} · {{ t("automations.attempt", { n: run.attempt }) }} · <span v-tooltip="changeDateFormat(run.startedAt)">{{ fromNow(run.startedAt) }}</span></span>
            </span>
          </button>
          <span v-if="run.error" class="text-xs text-errors-100 max-w-xs truncate" :title="run.error">{{ run.error }}</span>
          <button v-if="run.status === 'failed' && can(P.automationsManage)" type="button" class="h-8 px-3 rounded border border-primary-700 text-primary-700 text-xs font-medium hover:bg-primary-50 disabled:opacity-50" :disabled="retrying === run.id" @click="retry(run)">
            {{ t("automations.retry") }}
          </button>
        </div>
        <div v-if="expanded === run.id" class="mt-3 ms-7 rounded border border-line bg-gray-300 p-3 text-xs">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
            <p><span class="text-neural-300">{{ t("automations.runId") }}:</span> <code>{{ run.id }}</code></p>
            <p><span class="text-neural-300">{{ t("automations.eventId") }}:</span> <code>{{ run.eventId }}</code></p>
            <p><span class="text-neural-300">{{ t("automations.duration") }}:</span> {{ duration(run) }}</p>
          </div>
          <div v-if="!run.steps.length && (run.input || run.output)" class="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div v-if="run.input"><p class="text-neural-300 mb-1">{{ t("automations.input") }}</p><pre class="rounded bg-white border border-line p-2 overflow-x-auto max-h-48" dir="ltr">{{ JSON.stringify(run.input, null, 2) }}</pre></div>
            <div v-if="run.output"><p class="text-neural-300 mb-1">{{ t("automations.output") }}</p><pre class="rounded bg-white border border-line p-2 overflow-x-auto max-h-48" dir="ltr">{{ JSON.stringify(run.output, null, 2) }}</pre></div>
          </div>
          <ol class="flex flex-col gap-1.5">
            <li v-for="(step, i) in run.steps" :key="i" class="flex items-center gap-2">
              <span class="w-5 text-neural-300 tabular-nums">{{ i + 1 }}.</span>
              <StatusBadge :status="step.status" />
              <span class="text-heading">{{ t(`automations.steps.${step.name}`, step.name) }}</span>
              <span v-if="step.message" class="text-neural-300 truncate">— {{ step.message }}</span>
              <span class="ms-auto text-neural-300 tabular-nums">{{ step.durationMs }} ms</span>
            </li>
          </ol>
          <router-link v-if="run.lead" :to="{ name: 'leadDetails', params: { id: run.lead.id } }" class="inline-block mt-3 text-primary-700 font-medium">{{ t("automations.openLead") }}</router-link>
        </div>
      </li>
    </ul>

    <div v-if="runs.length && pagination.lastPage > 1" class="pt-4 flex items-center gap-3 justify-between flex-col lg:flex-row">
      <TablePagination :table-data="runs" :page="page" :per-page="perPage" :pagination="pagination" @prev-page="page--" @next-page="page++" @update:per-page="(v) => (perPage = v)" />
    </div>
  </Box>
</template>
