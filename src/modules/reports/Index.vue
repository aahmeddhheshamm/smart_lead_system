<script setup lang="ts">
import { computed, ref } from "vue";
import WidgetCard from "@/components/UI/WidgetCard.vue";
import PeriodFilter from "@/components/UI/PeriodFilter.vue";
import StatCard from "@/components/UI/StatCard.vue";
import BarList from "@/components/charts/BarList.vue";
import FunnelChart from "@/components/charts/FunnelChart.vue";
import useFetch from "@/composables/useFetch";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import { useI18n } from "vue-i18n";
import { useActiveMembers, useSources } from "@/composables/useLookups.ts";
import { formatMinutes, toIsoDate } from "@/utils";
import { apiReports } from "@/modules/reports/api";

const { t } = useLocaleSettings();
const { te } = useI18n();
const { memberOptions } = useActiveMembers();
const { sourceOptions } = useSources();

const period = ref({ preset: "90d", from: toIsoDate(new Date(Date.now() - 89 * 864e5)), to: toIsoDate(new Date()) });
const ownerId = ref("");
const sourceId = ref("");

const { data, isLoading, isError, refetch } = useFetch({
  queryKey: computed(() => ["reports", period.value.from, period.value.to, ownerId.value, sourceId.value]),
  queryFn: () => apiReports({ from: period.value.from, to: period.value.to, ownerId: ownerId.value, sourceId: sourceId.value }),
});
const r = computed(() => data.value?.data);

const funnelSteps = computed(() => (r.value?.funnel ?? []).map((f) => ({ label: f.stage, count: f.count })));
const lostRows = computed(() =>
    (r.value?.lostReasons ?? []).map((x) => {
      const key = x.reason.split(":")[0];
      return { label: te(`options.lostReason.${key}`) ? t(`options.lostReason.${key}`) : x.reason, value: x.count };
    })
);
const responseRows = computed(() => {
  const rt = r.value?.responseTime;
  if (!rt) return [];
  return [
    { label: t("reports.within15m"), value: rt.within15m },
    { label: t("reports.within1h"), value: rt.within1h },
    { label: t("reports.over1h"), value: rt.over1h },
    { label: t("reports.never"), value: rt.never },
  ];
});
const totalCohort = computed(() => r.value?.funnel?.[0]?.count ?? 0);
const wonCount = computed(() => r.value?.funnel?.find((f) => f.type === "won")?.count ?? 0);

// Plain CSV of the tables currently on screen (respects filters)
const downloadCsv = () => {
  if (!r.value) return;
  const lines = [
    ["section", "name", "leads", "qualified", "won", "conversion_rate"].join(","),
    ...r.value.bySource.map((x) => ["source", x.source, x.leads, x.qualified, x.won, x.conversionRate].join(",")),
    ...r.value.byCampaign.map((x) => ["campaign", x.campaign, x.leads, "", x.won, x.conversionRate].join(",")),
    ...r.value.team.map((x) => ["team", x.user.name, x.assigned, "", x.won, x.conversionRate].join(",")),
  ];
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }));
  link.download = `leadflow-report-${period.value.from}_${period.value.to}.csv`;
  link.click();
};
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col xl:flex-row xl:items-end justify-between gap-3">
      <div>
        <h1 class="text-xl">{{ t("sidebar.reports") }}</h1>
        <p class="text-sm text-neural-300">{{ t("reports.subtitle") }}</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <select v-model="ownerId" class="h-9 rounded border border-line bg-white px-2 text-sm text-black" :aria-label="t('fields.owner')">
          <option value="">{{ t("dashboard.wholeTeam") }}</option>
          <option v-for="m in memberOptions" :key="m.id" :value="m.id">{{ m.name }}</option>
        </select>
        <select v-model="sourceId" class="h-9 rounded border border-line bg-white px-2 text-sm text-black" :aria-label="t('fields.source')">
          <option value="">{{ t("reports.allSources") }}</option>
          <option v-for="s in sourceOptions" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
        <PeriodFilter v-model="period" />
        <button type="button" class="details-btn-outline !h-9" :disabled="!r" @click="downloadCsv">{{ t("buttons.exportCsv") }}</button>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <StatCard :label="t('reports.cohortLeads')" :value="isLoading ? '…' : totalCohort" icon="lucide:users" :definition="t('definitions.newLeads')" />
      <StatCard :label="t('reports.cohortWon')" :value="isLoading ? '…' : wonCount" icon="lucide:trophy" tone="success" :definition="t('definitions.conversionRate')" />
      <StatCard :label="t('reports.medianFirstResponse')" :value="isLoading ? '…' : formatMinutes(r?.responseTime.medianMinutes)" icon="lucide:timer" :definition="t('definitions.firstResponse')" />
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <WidgetCard :title="t('reports.funnel')" :subtitle="t('reports.funnelHint')" :loading="isLoading" :error="isError" :empty="!totalCohort" @retry="refetch()">
        <FunnelChart :steps="funnelSteps" />
      </WidgetCard>
      <WidgetCard :title="t('reports.responseTime')" :subtitle="t('definitions.firstResponse')" :loading="isLoading" :error="isError" :empty="!totalCohort" @retry="refetch()">
        <BarList :rows="responseRows" :aria-label="t('reports.responseTime')" />
      </WidgetCard>
    </div>

    <WidgetCard :title="t('reports.bySource')" :subtitle="t('definitions.conversionRate')" :loading="isLoading" :error="isError" :empty="!r?.bySource.length" @retry="refetch()">
      <div class="overflow-x-auto -mx-5">
        <table class="w-full text-sm">
          <thead class="bg-tableHeader"><tr>
            <th class="text-start">{{ t("fields.source") }}</th><th class="text-end">{{ t("reports.leads") }}</th><th class="text-end">{{ t("dashboard.qualified") }}</th>
            <th class="text-end">{{ t("dashboard.won") }}</th><th class="text-end w-1/3">{{ t("dashboard.conversionRate") }}</th>
          </tr></thead>
          <tbody>
            <tr v-for="row in r?.bySource" :key="row.source" class="border-t border-line">
              <td>{{ row.source }}</td><td class="text-end tabular-nums">{{ row.leads }}</td><td class="text-end tabular-nums">{{ row.qualified }}</td><td class="text-end tabular-nums">{{ row.won }}</td>
              <td>
                <div class="flex items-center gap-2 justify-end">
                  <div class="h-2 w-24 rounded bg-neural-100 overflow-hidden hidden sm:block"><div class="h-full bg-primary-700 rounded-e" :style="{ width: `${Math.min(100, row.conversionRate)}%` }" /></div>
                  <span class="tabular-nums font-semibold text-heading w-12 text-end">{{ row.conversionRate }}%</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </WidgetCard>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <WidgetCard :title="t('reports.team')" :loading="isLoading" :error="isError" :empty="!r?.team.length" @retry="refetch()">
        <div class="overflow-x-auto -mx-5">
          <table class="w-full text-sm">
            <thead class="bg-tableHeader"><tr>
              <th class="text-start">{{ t("fields.member") }}</th><th class="text-end">{{ t("dashboard.assigned") }}</th><th class="text-end">{{ t("dashboard.won") }}</th>
              <th class="text-end">{{ t("dashboard.conversionRate") }}</th><th class="text-end">{{ t("dashboard.avgFirstResponse") }}</th>
            </tr></thead>
            <tbody>
              <tr v-for="row in r?.team" :key="row.user.id" class="border-t border-line">
                <td>{{ row.user.name }}</td><td class="text-end tabular-nums">{{ row.assigned }}</td><td class="text-end tabular-nums">{{ row.won }}</td>
                <td class="text-end tabular-nums">{{ row.conversionRate }}%</td><td class="text-end tabular-nums">{{ formatMinutes(row.avgFirstResponseMinutes) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </WidgetCard>
      <WidgetCard :title="t('reports.lostReasons')" :subtitle="t('definitions.lost')" :loading="isLoading" :error="isError" :empty="!lostRows.length" @retry="refetch()">
        <BarList :rows="lostRows" :aria-label="t('reports.lostReasons')" />
      </WidgetCard>
    </div>

    <WidgetCard :title="t('reports.byCampaign')" :loading="isLoading" :error="isError" :empty="!r?.byCampaign.length" @retry="refetch()">
      <div class="overflow-x-auto -mx-5">
        <table class="w-full text-sm">
          <thead class="bg-tableHeader"><tr><th class="text-start">{{ t("fields.campaign") }}</th><th class="text-end">{{ t("reports.leads") }}</th><th class="text-end">{{ t("dashboard.won") }}</th><th class="text-end">{{ t("dashboard.conversionRate") }}</th></tr></thead>
          <tbody>
            <tr v-for="row in r?.byCampaign" :key="row.campaign" class="border-t border-line">
              <td>{{ row.campaign }}</td><td class="text-end tabular-nums">{{ row.leads }}</td><td class="text-end tabular-nums">{{ row.won }}</td><td class="text-end tabular-nums">{{ row.conversionRate }}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </WidgetCard>

    <details class="bg-white border border-line rounded p-5 text-sm">
      <summary class="font-semibold text-heading cursor-pointer">{{ t("reports.definitions") }}</summary>
      <dl class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div v-for="key in ['newLeads', 'qualified', 'wonLost', 'conversionRate', 'firstResponse', 'notFollowedUp']" :key="key">
          <dt class="font-medium text-heading">{{ t(`reports.metric.${key}`) }}</dt>
          <dd class="text-neural-300">{{ t(`definitions.${key}`) }}</dd>
        </div>
      </dl>
    </details>
  </div>
</template>
