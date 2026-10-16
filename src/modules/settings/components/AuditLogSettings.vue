<script setup lang="ts">
import { computed, ref, watch } from "vue";
import SpinnerLoading from "@/components/UI/SpinnerLoading.vue";
import TablePagination from "@/components/table/TablePagination.vue";
import useFetch from "@/composables/useFetch";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import { changeDateFormat } from "@/utils";
import { apiAuditLogs } from "@/modules/settings/api";

const { t } = useLocaleSettings();
const action = ref("");
const page = ref(1);
const perPage = ref(20);
watch([action, perPage], () => (page.value = 1));
const { data, isLoading } = useFetch({
  queryKey: computed(() => ["audit-logs", action.value, page.value, perPage.value]),
  queryFn: () => apiAuditLogs({ action: action.value, page: page.value, pageSize: perPage.value }),
});
const rows = computed(() => data.value?.data ?? []);
const pagination = computed(() => ({ total: data.value?.pagination?.total ?? 0, lastPage: data.value?.pagination?.totalPages ?? 1 }));
const ACTIONS = ["member", "invitation", "leads", "lead", "automation", "integration", "organization", "pipeline", "user"];
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="text-base font-semibold">{{ t("settings.audit") }}</h2>
        <p class="text-sm text-neural-300">{{ t("settings.auditHint") }}</p>
      </div>
      <select v-model="action" class="h-9 rounded border border-line bg-white px-2 text-sm text-black" :aria-label="t('fields.action')">
        <option value="">{{ t("settings.allActions") }}</option>
        <option v-for="a in ACTIONS" :key="a" :value="a">{{ a }}.*</option>
      </select>
    </div>
    <div v-if="isLoading" class="py-10"><SpinnerLoading /></div>
    <div v-else class="overflow-x-auto border border-line rounded">
      <table class="w-full text-sm">
        <thead class="bg-tableHeader"><tr><th class="text-start">{{ t("fields.date") }}</th><th class="text-start">{{ t("fields.actor") }}</th><th class="text-start">{{ t("fields.action") }}</th><th class="text-start">{{ t("fields.details") }}</th></tr></thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id" class="border-t border-line align-top">
            <td class="whitespace-nowrap text-neural-300">{{ changeDateFormat(row.createdAt) }}</td>
            <td>{{ row.actor?.name ?? t("timeline.system") }}</td>
            <td><code class="text-xs">{{ row.action }}</code></td>
            <td class="text-xs text-neural-300 max-w-md break-words">{{ Object.entries(row.metadata ?? {}).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join(" · ") || "—" }}</td>
          </tr>
          <tr v-if="!rows.length"><td colspan="4" class="text-center text-neural-300 py-8">{{ t("noRecordsFound") }}</td></tr>
        </tbody>
      </table>
    </div>
    <div v-if="rows.length && pagination.lastPage > 1" class="flex items-center gap-3 justify-between flex-col lg:flex-row">
      <TablePagination :table-data="rows" :page="page" :per-page="perPage" :pagination="pagination" @prev-page="page--" @next-page="page++" @update:per-page="(v) => (perPage = v)" />
    </div>
  </div>
</template>
