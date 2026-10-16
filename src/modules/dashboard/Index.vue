<script setup lang="ts">
import { computed, ref } from "vue";
import { Icon } from "@iconify/vue";
import StatCard from "@/components/UI/StatCard.vue";
import WidgetCard from "@/components/UI/WidgetCard.vue";
import PeriodFilter from "@/components/UI/PeriodFilter.vue";
import UserAvatar from "@/components/UI/UserAvatar.vue";
import BarList from "@/components/charts/BarList.vue";
import useFetch from "@/composables/useFetch";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import { useAuthorization } from "@/composables/useAuthorization.ts";
import { useActiveMembers } from "@/composables/useLookups.ts";
import { useAuthStore } from "@/store/auth.ts";
import { formatMinutes, fromNow, toIsoDate } from "@/utils";
import { P } from "@/config/permissions";
import { apiDashboardSummary } from "@/modules/dashboard/api";

const { t } = useLocaleSettings();
const { can } = useAuthorization();
const auth = useAuthStore();
const { memberOptions } = useActiveMembers();

const period = ref({ preset: "30d", from: toIsoDate(new Date(Date.now() - 29 * 864e5)), to: toIsoDate(new Date()) });
const ownerId = ref("");

const { data, isLoading, isError, refetch } = useFetch({
  queryKey: computed(() => ["dashboard", period.value.from, period.value.to, ownerId.value]),
  queryFn: () => apiDashboardSummary({ from: period.value.from, to: period.value.to, ownerId: ownerId.value }),
  options: { refetchInterval: 60_000 },
});
const s = computed(() => data.value?.data);
const k = computed(() => s.value?.kpis);

const greeting = computed(() => {
  const h = new Date().getHours();
  return t(h < 12 ? "dashboard.goodMorning" : h < 18 ? "dashboard.goodAfternoon" : "dashboard.goodEvening", { name: auth.username.split(" ")[0] });
});

const sourceRows = computed(() => (s.value?.bySource ?? []).map((r) => ({ label: r.source, value: r.leads, hint: t("dashboard.wonCount", { count: r.won }) })));

const ATTENTION_ICONS: Record<string, string> = { uncontacted: "lucide:phone-missed", overdue_task: "lucide:alarm-clock-off", needs_review: "lucide:circle-alert" };
const ACTIVITY_ICONS: Record<string, string> = { call: "lucide:phone", email: "lucide:mail", meeting: "lucide:calendar-days", note: "lucide:sticky-note", stage_changed: "lucide:git-commit-horizontal", created: "lucide:sparkle", owner_changed: "lucide:user-round-cog", task_completed: "lucide:check-circle-2", ai_classified: "lucide:sparkles" };
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
      <div>
        <h1 class="text-xl">{{ greeting }}</h1>
        <p class="text-sm text-neural-300">{{ t("dashboard.subtitle") }}</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <select v-if="can(P.leadsViewAll)" v-model="ownerId" class="h-9 rounded border border-line bg-white px-2 text-sm text-black" :aria-label="t('fields.owner')">
          <option value="">{{ t("dashboard.wholeTeam") }}</option>
          <option v-for="m in memberOptions" :key="m.id" :value="m.id">{{ m.name }}</option>
        </select>
        <PeriodFilter v-model="period" />
      </div>
    </div>

    <div v-if="isError" class="rounded border border-errors-100/30 bg-errors-100/10 px-4 py-3 text-sm text-errors-100 flex items-center justify-between" role="alert">
      {{ t("messages.loadFailed") }}
      <button type="button" class="font-medium" @click="refetch()">{{ t("buttons.retry") }}</button>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      <StatCard :label="t('dashboard.newLeads')" :value="isLoading ? '…' : k?.newLeads ?? 0" icon="lucide:user-plus" :definition="t('definitions.newLeads')" :to="{ name: 'leads' }" />
      <StatCard :label="t('dashboard.notFollowedUp')" :value="isLoading ? '…' : k?.notFollowedUp ?? 0" icon="lucide:phone-missed" :tone="k?.notFollowedUp ? 'warn' : 'default'" :definition="t('definitions.notFollowedUp')" :to="{ name: 'leads', query: { uncontacted: '1' } }" />
      <StatCard :label="t('dashboard.tasksDueToday')" :value="isLoading ? '…' : k?.tasksDue ?? 0" icon="lucide:calendar-check" :to="{ name: 'tasks' }" />
      <StatCard :label="t('dashboard.overdueTasks')" :value="isLoading ? '…' : k?.tasksOverdue ?? 0" icon="lucide:alarm-clock-off" :tone="k?.tasksOverdue ? 'danger' : 'default'" :to="{ name: 'tasks' }" />
      <StatCard :label="t('dashboard.qualified')" :value="isLoading ? '…' : k?.qualified ?? 0" icon="lucide:badge-check" :definition="t('definitions.qualified')" />
      <StatCard :label="t('dashboard.wonLost')" :value="isLoading ? '…' : `${k?.won ?? 0} / ${k?.lost ?? 0}`" icon="lucide:trophy" tone="success" :definition="t('definitions.wonLost')" />
      <StatCard :label="t('dashboard.conversionRate')" :value="isLoading ? '…' : `${k?.conversionRate ?? 0}%`" icon="lucide:percent" :definition="t('definitions.conversionRate')" />
      <StatCard :label="t('dashboard.avgFirstResponse')" :value="isLoading ? '…' : formatMinutes(k?.avgFirstResponseMinutes)" icon="lucide:timer" :definition="t('definitions.firstResponse')" />
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <WidgetCard :title="t('dashboard.needsAttention')" :subtitle="t('dashboard.needsAttentionHint')" :loading="isLoading" :error="isError" :empty="!s?.needsAttention.length" :empty-text="t('dashboard.allClear')" class="xl:col-span-2" @retry="refetch()">
        <ul class="divide-y divide-line">
          <li v-for="(item, i) in s?.needsAttention" :key="i">
            <router-link :to="{ name: 'leadDetails', params: { id: item.lead.id } }" class="flex items-center gap-3 py-2.5 hover:bg-gray-300 -mx-2 px-2 rounded">
              <span class="w-8 h-8 rounded flex items-center justify-center shrink-0" :class="item.kind === 'overdue_task' ? 'bg-errors-100/10 text-errors-100' : 'bg-[#FFF9E9] text-[#B58500]'">
                <Icon :icon="ATTENTION_ICONS[item.kind]" class="w-4 h-4" />
              </span>
              <span class="flex-1 min-w-0">
                <span class="block text-sm font-medium text-heading truncate">{{ item.lead.name }}</span>
                <span class="block text-xs text-neural-300 truncate">{{ t(`dashboard.attention.${item.kind}`) }} · {{ item.detail }}</span>
              </span>
              <span class="text-xs text-neural-300 shrink-0">{{ fromNow(item.at) }}</span>
            </router-link>
          </li>
        </ul>
      </WidgetCard>

      <WidgetCard :title="t('dashboard.leadsBySource')" :subtitle="t('dashboard.inPeriod')" :loading="isLoading" :error="isError" :empty="!sourceRows.length" @retry="refetch()">
        <BarList :rows="sourceRows" :aria-label="t('dashboard.leadsBySource')" />
      </WidgetCard>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <WidgetCard v-if="can(P.leadsViewAll)" :title="t('dashboard.teamPerformance')" :subtitle="t('dashboard.inPeriod')" :loading="isLoading" :error="isError" :empty="!s?.team.length" class="xl:col-span-2" @retry="refetch()">
        <div class="overflow-x-auto -mx-5">
          <table class="w-full text-sm">
            <thead class="bg-tableHeader">
              <tr>
                <th class="text-start">{{ t("fields.member") }}</th>
                <th class="text-end">{{ t("dashboard.assigned") }}</th>
                <th class="text-end">{{ t("dashboard.contacted") }}</th>
                <th class="text-end">{{ t("dashboard.won") }}</th>
                <th class="text-end">{{ t("dashboard.overdueTasks") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in s?.team" :key="row.user.id" class="border-t border-line">
                <td><span class="flex items-center gap-2"><UserAvatar :name="row.user.name" size="xs" />{{ row.user.name }}</span></td>
                <td class="text-end tabular-nums">{{ row.assigned }}</td>
                <td class="text-end tabular-nums">{{ row.contacted }} <span class="text-xs text-neural-300">({{ row.assigned ? Math.round((row.contacted / row.assigned) * 100) : 0 }}%)</span></td>
                <td class="text-end tabular-nums">{{ row.won }}</td>
                <td class="text-end tabular-nums" :class="{ 'text-errors-100 font-semibold': row.overdueTasks }">{{ row.overdueTasks }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </WidgetCard>

      <WidgetCard :title="t('dashboard.recentActivity')" :loading="isLoading" :error="isError" :empty="!s?.recentActivity.length" :class="{ 'xl:col-span-3': !can(P.leadsViewAll) }" @retry="refetch()">
        <ul class="flex flex-col gap-3">
          <li v-for="a in s?.recentActivity" :key="a.id" class="flex items-start gap-2.5">
            <Icon :icon="ACTIVITY_ICONS[a.type] ?? 'lucide:dot'" class="w-4 h-4 mt-0.5 text-primary-700 shrink-0" />
            <span class="text-sm min-w-0">
              <router-link :to="{ name: 'leadDetails', params: { id: a.lead.id } }" class="font-medium text-heading hover:text-primary-700">{{ a.lead.name }}</router-link>
              <span class="text-neural-400"> · {{ t(`options.activity.${a.type}`) }}</span>
              <span class="block text-xs text-neural-300">{{ a.actor?.name ?? t("timeline.system") }} · {{ fromNow(a.createdAt) }}</span>
            </span>
          </li>
        </ul>
      </WidgetCard>
    </div>
  </div>
</template>
