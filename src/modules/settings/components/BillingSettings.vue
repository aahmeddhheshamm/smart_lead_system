<script setup lang="ts">
import { computed } from "vue";
import StatusBadge from "@/components/UI/StatusBadge.vue";
import SpinnerLoading from "@/components/UI/SpinnerLoading.vue";
import useFetch from "@/composables/useFetch";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import { changeDateFormat } from "@/utils";
import { apiSubscription } from "@/modules/settings/api";

const { t } = useLocaleSettings();
const { data, isLoading } = useFetch({ queryKey: ["billing"], queryFn: apiSubscription });
const sub = computed(() => data.value?.data);
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
        <a href="mailto:sales@bytebit.ae?subject=LeadFlow%20AI%20plan" class="details-btn-outline inline-flex items-center">{{ t("settings.changePlan") }}</a>
      </div>
      <ul class="flex flex-col gap-4">
        <li v-for="u in sub.usage" :key="u.key">
          <div class="flex justify-between text-sm mb-1">
            <span class="text-neural-400">{{ t(`settings.usage.${u.key}`) }}</span>
            <span class="tabular-nums" :class="pct(u) >= 90 ? 'text-errors-100 font-semibold' : 'text-heading'">{{ u.used.toLocaleString() }} / {{ u.limit.toLocaleString() }}</span>
          </div>
          <div class="h-2 rounded bg-neural-100 overflow-hidden" role="progressbar" :aria-valuenow="pct(u)" aria-valuemin="0" aria-valuemax="100" :aria-label="t(`settings.usage.${u.key}`)">
            <div class="h-full rounded-e" :class="pct(u) >= 90 ? 'bg-errors-100' : pct(u) >= 75 ? 'bg-[#E0A800]' : 'bg-primary-700'" :style="{ width: `${pct(u)}%` }" />
          </div>
        </li>
      </ul>
      <p class="text-xs text-neural-300">{{ t("settings.billingNote") }}</p>
    </template>
  </div>
</template>
