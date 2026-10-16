<script setup lang="ts">
import { computed } from "vue";
import StatusBadge from "@/components/UI/StatusBadge.vue";
import useFetch from "@/composables/useFetch";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import { fromNow } from "@/utils";
import { apiLeadRuns } from "@/modules/leads/api";

const props = defineProps<{ leadId: string }>();
const { t } = useLocaleSettings();
const { data, isLoading } = useFetch({
  queryKey: computed(() => ["leads", props.leadId, "runs"]),
  queryFn: () => apiLeadRuns(props.leadId),
});
const runs = computed(() => data.value?.data ?? []);
</script>

<template>
  <div>
    <p v-if="isLoading" class="text-sm text-neural-300">{{ t("messages.loading") }}</p>
    <ul v-else-if="runs.length" class="divide-y divide-line">
      <li v-for="run in runs" :key="run.id" class="py-2 flex items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="text-sm text-heading truncate">{{ run.rule ? t(`automations.types.${run.rule.type}.name`) : run.trigger }}</p>
          <p class="text-xs text-neural-300 truncate">{{ run.error || run.steps.map((s) => s.message).filter(Boolean).join(" · ") || run.trigger }} · {{ fromNow(run.startedAt) }}</p>
        </div>
        <StatusBadge :status="run.status" />
      </li>
    </ul>
    <p v-else class="text-sm text-neural-300">{{ t("automations.noRunsForLead") }}</p>
  </div>
</template>
