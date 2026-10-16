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
import { apiAutomations, apiUpdateAutomation } from "@/modules/automations/api";
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

// short, human summary of the current settings shown on each card
const summary = (rule: AutomationRule) => {
  const c = rule.config ?? {};
  switch (rule.type) {
    case "lead_ingestion": return t("automations.summary.ingestion", { policy: t(`automations.config.policy.${c.dedupePolicy}`), fields: (c.matchOn ?? []).map((f: string) => t(`fields.${f}`)).join(" + ") });
    case "lead_assignment": return t(`automations.config.strategies.${c.strategy}`);
    case "first_response_sla": return t("automations.summary.sla", { minutes: c.minutes });
    case "stale_lead_follow_up": return t("automations.summary.stale", { days: c.businessDays });
    case "ai_classification": return t("automations.summary.ai", { pct: Math.round((c.minConfidence ?? 0.6) * 100) });
    case "daily_report": return t("automations.summary.report", { hour: String(c.hour).padStart(2, "0") });
    default: return t("automations.summary.stop");
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
              <h2 class="text-base font-semibold">{{ t(`automations.types.${rule.type}.name`) }}</h2>
              <p class="text-xs text-neural-300 mt-0.5">{{ t(`automations.types.${rule.type}.description`) }}</p>
            </div>
          </div>
          <ToggleSwitch
              :model-value="rule.enabled"
              :disabled="!can(P.automationsManage) || toggling === rule.id"
              :aria-label="t('automations.toggle', { name: t(`automations.types.${rule.type}.name`) })"
              @update:model-value="toggle(rule)"
          />
        </header>

        <p class="text-sm text-heading bg-gray-300 rounded px-3 py-2">{{ summary(rule) }}</p>

        <dl class="grid grid-cols-3 gap-2 text-xs">
          <div><dt class="text-neural-300">{{ t("automations.lastRun") }}</dt><dd class="text-heading mt-0.5">{{ rule.lastRunAt ? fromNow(rule.lastRunAt) : t("automations.never") }}</dd></div>
          <div><dt class="text-neural-300">{{ t("automations.runs7d") }}</dt><dd class="text-heading mt-0.5 tabular-nums">{{ rule.runsLast7d }}</dd></div>
          <div><dt class="text-neural-300">{{ t("automations.failures7d") }}</dt><dd class="mt-0.5 tabular-nums" :class="rule.failuresLast7d ? 'text-errors-100 font-semibold' : 'text-heading'">{{ rule.failuresLast7d }}</dd></div>
        </dl>

        <footer class="flex items-center justify-between gap-2 pt-3 border-t border-line">
          <span class="flex items-center gap-2 text-xs text-neural-300">
            <StatusBadge v-if="rule.lastRunStatus" :status="rule.lastRunStatus" />
            <code class="text-[11px]">{{ rule.workflowId }}</code>
          </span>
          <span class="flex items-center gap-3">
            <router-link :to="{ name: 'automationRuns', query: { type: rule.type } }" class="text-xs text-primary-700 font-medium">{{ t("automations.viewRuns") }}</router-link>
            <button v-if="can(P.automationsManage) && rule.type !== 'stop_on_close'" type="button" class="text-xs text-primary-700 font-medium" @click="configure(rule)">{{ t("automations.configure") }}</button>
          </span>
        </footer>
      </article>
    </div>
  </div>
</template>
