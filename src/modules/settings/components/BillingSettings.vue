<script setup lang="ts">
import { computed, ref } from "vue";
import { toast } from "vue3-toastify";
import { useQueryClient } from "@tanstack/vue-query";
import { USE_MOCK } from "@/InterceptorHelper";
import { useAuthorization } from "@/composables/useAuthorization.ts";
import { P } from "@/config/permissions";
import StatusBadge from "@/components/UI/StatusBadge.vue";
import SpinnerLoading from "@/components/UI/SpinnerLoading.vue";
import useFetch from "@/composables/useFetch";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import { changeDateFormat } from "@/utils";
import { apiChangePlan, apiPlans, apiSubscription } from "@/modules/settings/api";

const { t } = useLocaleSettings();
const { data, isLoading } = useFetch({ queryKey: ["billing"], queryFn: apiSubscription });
const sub = computed(() => data.value?.data);
const { can } = useAuthorization();
const queryClient = useQueryClient();
const { data: plansData } = useFetch({ queryKey: ["billing", "plans"], queryFn: apiPlans, enabled: !USE_MOCK });
const plans = computed(() => plansData.value?.data ?? []);
const changing = ref<string | null>(null);
// v1 billing is manual: the request is recorded and confirmed by the platform team
const choose = async (code: string) => {
  changing.value = code;
  try {
    await apiChangePlan(code);
    toast.success(t("settings.planRequested"));
    queryClient.invalidateQueries({ queryKey: ["billing"] });
  } finally {
    changing.value = null;
  }
};
const usageLabel = (key: string) => (t(`settings.usage.${key}`) === `settings.usage.${key}` ? key.replace(/_/g, " ") : t(`settings.usage.${key}`));
const pct = (u: { used: number; limit: number }) => Math.min(100, Math.round((u.used / Math.max(1, u.limit)) * 100));
</script>

<template>
  <div class="flex flex-col gap-4 max-w-3xl">
    <div>
      <h2 class="text-base font-semibold">{{ t("settings.billing") }}</h2>
      <p class="text-sm text-neural-300">{{ t("settings.billingHint") }}</p>
    </div>
    <div v-if="isLoading" class="py-10"><SpinnerLoading /></div>
    <template v-else-if="sub">
      <div class="rounded border border-line p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-lg font-bold text-heading">{{ sub.plan.name }} <StatusBadge :status="sub.status" class="ms-2 align-middle" /></p>
          <p class="text-sm text-neural-300">{{ sub.plan.priceMonthly }} {{ sub.plan.currency }} / {{ t("settings.month") }} · {{ t("settings.renews", { date: changeDateFormat(sub.currentPeriodEnd, "ll") }) }}</p>
        </div>
        <a v-if="USE_MOCK" href="mailto:sales@bytebit.ae?subject=LeadFlow%20AI%20plan" class="details-btn-outline inline-flex items-center">{{ t("settings.changePlan") }}</a>
      </div>
      <ul class="flex flex-col gap-4">
        <li v-for="u in sub.usage" :key="u.key">
          <div class="flex justify-between text-sm mb-1">
            <span class="text-neural-400 capitalize">{{ usageLabel(u.key) }}</span>
            <span class="tabular-nums" :class="pct(u) >= 90 ? 'text-errors-100 font-semibold' : 'text-heading'">{{ u.used.toLocaleString() }} / {{ u.limit.toLocaleString() }}</span>
          </div>
          <div class="h-2 rounded bg-neural-100 overflow-hidden" role="progressbar" :aria-valuenow="pct(u)" aria-valuemin="0" aria-valuemax="100" :aria-label="usageLabel(u.key)">
            <div class="h-full rounded-e" :class="pct(u) >= 90 ? 'bg-errors-100' : pct(u) >= 75 ? 'bg-[#E0A800]' : 'bg-primary-700'" :style="{ width: `${pct(u)}%` }" />
          </div>
        </li>
      </ul>
      <div v-if="plans.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div v-for="p in plans" :key="p.code" class="rounded border p-4 flex flex-col gap-2" :class="p.code === sub.plan.code ? 'border-primary-700 bg-primary-20' : 'border-line'">
          <p class="font-semibold text-heading">{{ p.name }}</p>
          <p class="text-sm text-neural-300">{{ p.priceMonthly }} {{ p.currency }} / {{ t("settings.month") }}</p>
          <ul class="text-xs text-neural-400 flex flex-col gap-0.5">
            <li v-for="(limit, key) in p.limits" :key="key">{{ usageLabel(String(key)) }}: {{ Number(limit).toLocaleString() }}</li>
          </ul>
          <span v-if="p.code === sub.plan.code" class="text-xs font-medium text-primary-700 mt-auto">{{ t("settings.currentPlan") }}</span>
          <button v-else-if="can(P.billingManage)" type="button" class="details-btn-outline !h-8 text-xs mt-auto disabled:opacity-50" :disabled="!!changing" @click="choose(p.code)">{{ t("settings.choosePlan") }}</button>
        </div>
      </div>
      <p class="text-xs text-neural-300">{{ t("settings.billingNote") }}</p>
    </template>
  </div>
</template>
