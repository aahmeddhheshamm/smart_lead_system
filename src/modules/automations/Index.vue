<script setup lang="ts">
import { computed, ref } from "vue";
import { Icon } from "@iconify/vue";
import { toast } from "vue3-toastify";
import { useQueryClient } from "@tanstack/vue-query";
import SpinnerLoading from "@/components/UI/SpinnerLoading.vue";
import StatusBadge from "@/components/UI/StatusBadge.vue";
import useFetch from "@/composables/useFetch";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import { useAuthorization } from "@/composables/useAuthorization.ts";
import { fromNow } from "@/utils";
import { P } from "@/config/permissions";
import { AUTOMATION_ICONS, AUTOMATION_TYPES } from "@/constants/lead";
import type { AutomationRule } from "@/types/domain";
import { apiAutomations, apiRunAutomationNow, apiUpdateAutomation } from "@/modules/automations/api";
import { USE_MOCK } from "@/InterceptorHelper";
import AutomationConfigModal from "@/modules/automations/components/AutomationConfigModal.vue";

const { t } = useLocaleSettings();
const { can } = useAuthorization();
const queryClient = useQueryClient();

const { data, isLoading, isError, refetch } = useFetch({ queryKey: ["automations"], queryFn: apiAutomations });
const rules = computed<AutomationRule[]>(() =>
    [...(data.value?.data ?? [])].sort((a, b) => AUTOMATION_TYPES.indexOf(a.type) - AUTOMATION_TYPES.indexOf(b.type))
);

const toggling = ref<string | null>(null);
const toggle = async (rule: AutomationRule) => {
  toggling.value = rule.id;
  try {
    await apiUpdateAutomation(rule.id, { enabled: !rule.enabled });
    toast.success(rule.enabled ? t("automations.disabled") : t("automations.enabled"));
    queryClient.invalidateQueries({ queryKey: ["automations"] });
  } finally {
    toggling.value = null;
  }
};

const editing = ref<AutomationRule | null>(null);
const showConfig = ref(false);
const configure = (rule: AutomationRule) => {
  editing.value = rule;
  showConfig.value = true;
};

const running = ref<string | null>(null);
const runNow = async (rule: AutomationRule) => {
  running.value = rule.id;
  try {
    await apiRunAutomationNow(rule.id);
    toast.success(t("automations.ranNow"));
    ["automations", "automation-runs", "notifications", "tasks"].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
  } finally {
    running.value = null;
  }
};

// backend rules carry their own name/description; fall back to the built-in copy
const nameOf = (rule: AutomationRule) => rule.name || t(`automations.types.${rule.type}.name`);
const descriptionOf = (rule: AutomationRule) => rule.description || t(`automations.types.${rule.type}.description`);
const SCHEDULED = ["first_response_sla", "stale_lead_follow_up", "task_reminder", "daily_report"];
const generic = (c: Record<string, any>) =>
    Object.entries(c).filter(([, v]) => ["number", "boolean", "string"].includes(typeof v)).slice(0, 3)
        .map(([k, v]) => `${k}: ${typeof v === "boolean" ? (v ? "✓" : "✗") : v}`).join(" · ") || t("automations.summary.stop");

// short, human summary of the current settings shown on each card
const summary = (rule: AutomationRule) => {
  const c = rule.config ?? {};
  switch (rule.type) {
    case "lead_ingestion": return t("automations.summary.ingestion", { policy: t(`automations.config.policy.${c.dedupePolicy}`), fields: (c.matchOn ?? []).map((f: string) => t(`fields.${f}`)).join(" + ") });
    case "lead_assignment": return c.strategy ? t(`automations.config.strategies.${c.strategy}`) : generic(c);
    case "first_response_sla": return c.minutes ? t("automations.summary.sla", { minutes: c.minutes }) : generic(c);
    case "stale_lead_follow_up": return c.businessDays ? t("automations.summary.stale", { days: c.businessDays }) : generic(c);
    case "ai_classification": return c.minConfidence ? t("automations.summary.ai", { pct: Math.round(c.minConfidence * 100) }) : generic(c);
    case "daily_report": return c.hour !== undefined ? t("automations.summary.report", { hour: String(c.hour).padStart(2, "0") }) : generic(c);
    default: return generic(c);
  }
};
</script>

<template>
  <div class="flex flex-col gap-4">
    <AutomationConfigModal v-model:visible="showConfig" :rule="editing" />

    <div class="flex flex-col md:flex-row md:items-end justify-between gap-3">
      <div>
        <h1 class="text-xl">{{ t("sidebar.automations") }}</h1>
        <p class="text-sm text-neural-300 max-w-2xl">{{ t("automations.subtitle") }}</p>
      </div>
      <router-link :to="{ name: 'automationRuns' }" class="details-btn-outline inline-flex items-center gap-2 self-start"><Icon icon="lucide:activity" class="w-4 h-4" />{{ t("sidebar.automationRuns") }}</router-link>
    </div>

    <div v-if="isLoading" class="py-16"><SpinnerLoading /></div>
    <p v-else-if="isError" class="py-12 text-center text-sm text-neural-300">{{ t("messages.loadFailed") }} <button type="button" class="text-primary-700" @click="refetch()">{{ t("buttons.retry") }}</button></p>

    <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <article v-for="rule in rules" :key="rule.id" class="bg-white border border-line rounded p-5 flex flex-col gap-3" :class="{ 'opacity-75': !rule.enabled }">
        <header class="flex items-start justify-between gap-3">
          <div class="flex items-start gap-3 min-w-0">
            <span class="w-10 h-10 rounded flex items-center justify-center shrink-0" :class="rule.enabled ? 'bg-primary-50 text-primary-700' : 'bg-neural-100 text-neural-300'">
              <Icon :icon="AUTOMATION_ICONS[rule.type]" class="w-5 h-5" />
            </span>
            <div class="min-w-0">
              <h2 class="text-base font-semibold">{{ nameOf(rule) }}</h2>
              <p class="text-xs text-neural-300 mt-0.5">{{ descriptionOf(rule) }}</p>
            </div>
          </div>
          <ToggleSwitch
              :model-value="rule.enabled"
              :disabled="!can(P.automationsManage) || toggling === rule.id"
              :aria-label="t('automations.toggle', { name: nameOf(rule) })"
              @update:model-value="toggle(rule)"
          />
        </header>

        <p class="text-sm text-heading bg-gray-300 rounded px-3 py-2">{{ summary(rule) }}</p>

        <dl class="grid grid-cols-3 gap-2 text-xs">
          <div><dt class="text-neural-300">{{ t("automations.lastRun") }}</dt><dd class="text-heading mt-0.5">{{ rule.lastRunAt ? fromNow(rule.lastRunAt) : t("automations.never") }}</dd></div>
          <div><dt class="text-neural-300">{{ USE_MOCK ? t("automations.runs7d") : t("automations.runsTotal") }}</dt><dd class="text-heading mt-0.5 tabular-nums">{{ rule.runCount }}</dd></div>
          <div><dt class="text-neural-300">{{ USE_MOCK ? t("automations.failures7d") : t("automations.failuresTotal") }}</dt><dd class="mt-0.5 tabular-nums" :class="rule.failureCount ? 'text-errors-100 font-semibold' : 'text-heading'">{{ rule.failureCount }}</dd></div>
        </dl>
        <p v-if="rule.lastError" class="text-xs text-errors-100 bg-errors-100/10 rounded px-2 py-1 -mt-1">{{ rule.lastError }}</p>

        <footer class="flex items-center justify-between gap-2 pt-3 border-t border-line">
          <span class="flex items-center gap-2 text-xs text-neural-300">
            <StatusBadge v-if="rule.lastRunStatus" :status="rule.lastRunStatus" />
            <code v-if="rule.workflowId" class="text-[11px]">{{ rule.workflowId }}</code>
          </span>
          <span class="flex items-center gap-3">
            <button v-if="!USE_MOCK && can(P.automationsManage) && rule.enabled && SCHEDULED.includes(rule.type)" type="button" class="text-xs text-primary-700 font-medium disabled:opacity-50" :disabled="running === rule.id" @click="runNow(rule)">{{ t("automations.runNow") }}</button>
            <router-link :to="{ name: 'automationRuns', query: { type: rule.type } }" class="text-xs text-primary-700 font-medium">{{ t("automations.viewRuns") }}</router-link>
            <button v-if="can(P.automationsManage) && rule.type !== 'stop_on_close'" type="button" class="text-xs text-primary-700 font-medium" @click="configure(rule)">{{ t("automations.configure") }}</button>
          </span>
        </footer>
      </article>
    </div>
  </div>
</template>
