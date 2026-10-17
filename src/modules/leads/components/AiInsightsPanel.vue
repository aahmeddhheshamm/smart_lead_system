<script setup lang="ts">
import { computed, ref } from "vue";
import { Icon } from "@iconify/vue";
import { toast } from "vue3-toastify";
import { useQueryClient } from "@tanstack/vue-query";
import StatusBadge from "@/components/UI/StatusBadge.vue";
import useFetch from "@/composables/useFetch";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import { fromNow, formatMoney } from "@/utils";
import type { Lead, LeadAiInsights } from "@/types/domain";
import { apiClassifyLead, apiLeadAi, apiReviewAi } from "@/modules/leads/api";

// AI output is a suggestion, shown apart from the confirmed lead data (PRD 3.5).
// Applying it is an explicit human action that is logged by the API.
const props = defineProps<{ lead: Lead; canEdit: boolean }>();
const { t } = useLocaleSettings();
const queryClient = useQueryClient();
const busy = ref<string | null>(null);

const { data: aiData, isLoading } = useFetch({
  queryKey: computed(() => ["leads", props.lead.id, "ai"]),
  queryFn: () => apiLeadAi(props.lead.id),
  // the backend produces insights asynchronously (n8n): poll while they are pending
  options: { refetchInterval: (q: any) => (q.state.data?.status === "pending" ? 4000 : false) },
});
const ai = computed<LeadAiInsights | null>(() => aiData.value ?? null);

const refresh = () => ["leads", "dashboard"].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));

const classify = async () => {
  busy.value = "classify";
  try {
    await apiClassifyLead(props.lead.id);
    toast.info(t("ai.requested"));
    refresh();
  } finally {
    busy.value = null;
  }
};

const review = async (status: "confirmed" | "rejected", apply = false) => {
  if (!ai.value) return;
  busy.value = status;
  try {
    await apiReviewAi(props.lead.id, ai.value, { status, apply, applyPriority: apply });
    toast.success(status === "confirmed" ? t("ai.confirmedToast") : t("ai.rejectedToast"));
    refresh();
  } finally {
    busy.value = null;
  }
};

const copyReply = async () => {
  try {
    await navigator.clipboard.writeText(ai.value?.suggestedReply ?? "");
    toast.success(t("ai.copied"));
  } catch {
    toast.error(t("messages.error"));
  }
};

const extractedRows = computed(() =>
    Object.entries(ai.value?.extracted ?? {})
        .filter(([key, v]) => v !== null && v !== "" && key !== "currency" && typeof v !== "object")
        .map(([key, v]) => ({ key, value: key === "budget" ? formatMoney(v, String(ai.value?.extracted?.currency ?? "")) : String(v) }))
);
const reviewable = computed(() => ai.value && ["suggested", "needs_review"].includes(ai.value.status));
</script>

<template>
  <div class="rounded border border-primary-200 bg-primary-20 p-4 flex flex-col gap-3">
    <div class="flex items-center justify-between gap-2">
      <h3 class="text-sm font-semibold text-heading flex items-center gap-2"><Icon icon="lucide:sparkles" class="w-4 h-4 text-primary-700" />{{ t("ai.title") }}</h3>
      <StatusBadge v-if="ai" :status="ai.status" />
    </div>

    <p v-if="isLoading" class="text-sm text-neural-300">{{ t("messages.loading") }}</p>

    <div v-else-if="ai?.status === 'pending'" class="flex items-center gap-2 text-sm text-neural-400" role="status">
      <span class="w-4 h-4 rounded-full animate-spin border-2 border-primary-700 border-t-transparent" />
      {{ t("ai.pending") }}
    </div>

    <template v-else-if="ai">
      <p class="text-xs text-neural-300">{{ t("ai.disclaimer") }}</p>
      <div v-if="ai.status === 'needs_review'" class="rounded bg-[#FFF9E9] text-[#8A6700] text-xs px-3 py-2">{{ t("ai.needsReviewHint") }}</div>
      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt class="text-neural-300">{{ t("ai.classification") }}</dt><dd class="text-heading font-medium">{{ ai.classification }}</dd>
        <template v-if="ai.confidence">
          <dt class="text-neural-300">{{ t("ai.confidence") }}</dt><dd class="text-heading">{{ Math.round(ai.confidence * 100) }}%</dd>
        </template>
        <dt class="text-neural-300">{{ t("ai.suggestedPriority") }}</dt><dd><StatusBadge :status="ai.priority" /> <span class="text-xs text-neural-300">{{ ai.priorityReason }}</span></dd>
        <template v-for="row in extractedRows" :key="row.key">
          <dt class="text-neural-300">{{ $te(`customFields.${row.key}`) ? t(`customFields.${row.key}`) : row.key }}</dt><dd class="text-heading">{{ row.value }} <span class="text-[10px] uppercase text-neural-300">{{ t("ai.inferred") }}</span></dd>
        </template>
      </dl>
      <div v-if="ai.summary">
        <p class="text-xs font-semibold text-heading mb-1">{{ t("ai.summary") }}</p>
        <p class="text-sm text-neural-400" dir="auto">{{ ai.summary }}</p>
      </div>
      <div v-if="ai.nextBestAction">
        <p class="text-xs font-semibold text-heading mb-1">{{ t("ai.nextBestAction") }}</p>
        <p class="text-sm text-neural-400" dir="auto">{{ ai.nextBestAction }}</p>
      </div>
      <div v-if="ai.suggestedReply">
        <div class="flex items-center justify-between mb-1">
          <p class="text-xs font-semibold text-heading">{{ t("ai.suggestedReply") }}</p>
          <button type="button" class="text-xs text-primary-700 font-medium" @click="copyReply">{{ t("buttons.copy") }}</button>
        </div>
        <p class="text-sm text-neural-400 bg-white rounded border border-line px-3 py-2" dir="auto">{{ ai.suggestedReply }}</p>
      </div>
      <p class="text-[11px] text-neural-300">{{ ai.model }}<span v-if="ai.generatedAt"> · {{ fromNow(ai.generatedAt) }}</span><span v-if="ai.reviewedBy"> · {{ t("ai.reviewedBy", { name: ai.reviewedBy.name }) }}</span></p>

      <div v-if="canEdit && reviewable" class="flex flex-wrap gap-2 pt-1">
        <button type="button" class="h-8 px-3 rounded bg-primary-700 text-[#fff] text-xs font-medium disabled:opacity-50" :disabled="!!busy" @click="review('confirmed', true)">{{ t("ai.confirmApply") }}</button>
        <button type="button" class="h-8 px-3 rounded border border-line bg-white text-xs text-neural-400 disabled:opacity-50" :disabled="!!busy" @click="review('confirmed')">{{ t("ai.confirmOnly") }}</button>
        <button type="button" class="h-8 px-3 rounded border border-errors-100/40 bg-white text-xs text-errors-100 disabled:opacity-50" :disabled="!!busy" @click="review('rejected')">{{ t("ai.reject") }}</button>
      </div>
    </template>
    <p v-else class="text-sm text-neural-300">{{ lead.message ? t("ai.notRun") : t("ai.noMessage") }}</p>

    <button v-if="canEdit && ai?.status !== 'pending'" type="button" class="self-start text-xs text-primary-700 font-medium disabled:opacity-50" :disabled="!!busy" @click="classify">
      {{ busy === "classify" ? t("messages.loading") : ai ? t("ai.rerun") : t("ai.run") }}
    </button>
  </div>
</template>
