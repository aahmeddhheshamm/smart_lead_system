<script setup lang="ts">
import { computed, ref } from "vue";
import { Icon } from "@iconify/vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue3-toastify";
import { useQueryClient } from "@tanstack/vue-query";
import MainButton from "@/components/buttons/MainButton.vue";
import SpinnerLoading from "@/components/UI/SpinnerLoading.vue";
import useFetch from "@/composables/useFetch";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import { useOptions } from "@/composables/useLookups.ts";
import { changeDateFormat, fromNow } from "@/utils";
import { CALL_OUTCOMES, LOGGABLE_ACTIVITIES } from "@/constants/lead";
import type { Lead, LeadActivity } from "@/types/domain";
import { apiLeadActivities, apiLogActivity } from "@/modules/leads/api";

const props = defineProps<{ lead: Lead; canEdit: boolean }>();
const { t } = useLocaleSettings();
const { te } = useI18n();
const queryClient = useQueryClient();

const ICONS: Record<string, string> = {
  created: "lucide:sparkle", updated: "lucide:pencil", note: "lucide:sticky-note", call: "lucide:phone", email: "lucide:mail",
  meeting: "lucide:calendar-days", whatsapp: "lucide:message-circle", stage_changed: "lucide:git-commit-horizontal",
  owner_changed: "lucide:user-round-cog", task_created: "lucide:list-plus", task_completed: "lucide:check-circle-2",
  ai_classified: "lucide:sparkles", automation: "lucide:workflow", imported: "lucide:file-down", do_not_contact: "lucide:ban",
};

const { data, isLoading } = useFetch({
  queryKey: computed(() => ["leads", props.lead.id, "activities"]),
  queryFn: () => apiLeadActivities(props.lead.id),
});
const items = computed<LeadActivity[]>(() => data.value?.data ?? []);

const type = ref<string>("note");
const note = ref("");
const outcome = ref("");
const saving = ref(false);
const typeOptions = useOptions("activity", LOGGABLE_ACTIVITIES);
const outcomeOptions = useOptions("outcome", CALL_OUTCOMES);

const log = async () => {
  if (type.value === "note" && !note.value.trim()) return;
  saving.value = true;
  try {
    await apiLogActivity(props.lead.id, { type: type.value, note: note.value.trim() || undefined, outcome: outcome.value || undefined });
    note.value = "";
    outcome.value = "";
    toast.success(t("leads.activityLogged"));
    queryClient.invalidateQueries({ queryKey: ["leads"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  } finally {
    saving.value = false;
  }
};

// one readable line per activity, built from its structured payload
const describe = (a: LeadActivity) => {
  const p = a.payload ?? {};
  switch (a.type) {
    case "stage_changed": return t("timeline.stageChanged", { from: p.from ?? "—", to: p.to }) + (p.lostReason ? ` (${te(`options.lostReason.${String(p.lostReason).split(":")[0]}`) ? t(`options.lostReason.${String(p.lostReason).split(":")[0]}`) : p.lostReason})` : "");
    case "owner_changed": return t("timeline.ownerChanged", { to: p.to ?? t("leads.unassigned") }) + (p.reason && p.reason !== "manual" ? ` · ${p.reason}` : "");
    case "task_created": return t(p.automated ? "timeline.taskCreatedAuto" : "timeline.taskCreated", { title: p.title });
    case "task_completed": return t("timeline.taskCompleted", { title: p.title });
    case "ai_classified": return t("timeline.aiClassified", { classification: p.classification, confidence: Math.round((p.confidence ?? 0) * 100) });
    case "created": return t("timeline.created", { source: p.source ?? "—" });
    case "updated": return p.reason ? t(`timeline.updatedReason.${p.reason}`, p.reason) : t("timeline.updated", { fields: (p.fields ?? []).join(", ") });
    case "do_not_contact": return p.value ? t("timeline.optedOut") : t("timeline.optedIn");
    default: return t(`options.activity.${a.type}`);
  }
};
</script>

<template>
  <div class="flex flex-col gap-4">
    <form v-if="canEdit" class="rounded border border-line p-3 flex flex-col gap-2" @submit.prevent="log">
      <div class="flex flex-wrap gap-1" role="radiogroup" :aria-label="t('fields.type')">
        <button
            v-for="o in typeOptions"
            :key="o.id"
            type="button"
            role="radio"
            :aria-checked="type === o.id"
            class="h-8 px-3 rounded text-xs flex items-center gap-1.5 border"
            :class="type === o.id ? 'bg-primary-700 text-[#fff] border-primary-700' : 'border-line text-neural-400 hover:bg-gray-300'"
            @click="type = o.id"
        >
          <Icon :icon="ICONS[o.id]" class="w-3.5 h-3.5" />{{ o.name }}
        </button>
      </div>
      <textarea v-model="note" rows="2" class="w-full rounded border border-line bg-white px-3 py-2 text-sm text-black resize-none" :placeholder="type === 'note' ? t('leads.notePlaceholder') : t('leads.activityPlaceholder')" :aria-label="t('fields.notes')" />
      <div class="flex flex-wrap items-center justify-between gap-2">
        <select v-if="type === 'call'" v-model="outcome" class="h-8 rounded border border-line bg-white px-2 text-sm text-black" :aria-label="t('fields.callOutcome')">
          <option value="">{{ t("fields.callOutcome") }}…</option>
          <option v-for="o in outcomeOptions" :key="o.id" :value="o.id">{{ o.name }}</option>
        </select>
        <span v-else-if="type !== 'note'" class="text-xs text-neural-300">{{ t("leads.marksContacted") }}</span>
        <span v-else />
        <MainButton type="submit" text="buttons.log" :loading="saving" :disabled="type === 'note' && !note.trim()" class="!h-8" />
      </div>
      <p v-if="lead.doNotContact && type !== 'note'" class="text-xs text-errors-100">{{ t("leads.dncWarning") }}</p>
    </form>

    <div v-if="isLoading" class="py-6"><SpinnerLoading /></div>
    <ol v-else class="relative border-s border-line ms-4">
      <li v-for="a in items" :key="a.id" class="ms-6 pb-5 last:pb-0">
        <span class="absolute -start-4 flex items-center justify-center w-8 h-8 rounded-full bg-white border border-line text-primary-700">
          <Icon :icon="ICONS[a.type] ?? 'lucide:dot'" class="w-4 h-4" />
        </span>
        <p class="text-sm text-heading">{{ describe(a) }}</p>
        <p v-if="a.payload?.note" class="text-sm text-neural-400 mt-1 whitespace-pre-line bg-gray-300 rounded px-3 py-2">{{ a.payload.note }}</p>
        <p v-if="a.payload?.outcome" class="text-xs text-neural-300 mt-1">{{ t("fields.callOutcome") }}: {{ te(`options.outcome.${a.payload.outcome}`) ? t(`options.outcome.${a.payload.outcome}`) : a.payload.outcome }}</p>
        <p v-if="a.payload?.message && a.type === 'updated'" class="text-xs text-neural-400 mt-1 italic">“{{ a.payload.message }}”</p>
        <p class="text-xs text-neural-300 mt-1">
          {{ a.actor?.name ?? t("timeline.system") }} · <span v-tooltip="changeDateFormat(a.createdAt)">{{ fromNow(a.createdAt) }}</span>
        </p>
      </li>
      <li v-if="!items.length" class="ms-6 text-sm text-neural-300">{{ t("timeline.empty") }}</li>
    </ol>
  </div>
</template>
