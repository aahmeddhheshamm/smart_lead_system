<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { toast } from "vue3-toastify";
import { useQueryClient } from "@tanstack/vue-query";
import MainModal from "@/components/UI/modals/MainModal.vue";
import MainButton from "@/components/buttons/MainButton.vue";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import { useOptions, useStages } from "@/composables/useLookups.ts";
import { LOST_REASONS } from "@/constants/lead";
import { apiBulkLeads, apiMoveLead } from "@/modules/leads/api";

// Moves one lead (leadId) or many (leadIds). Lost requires a reason (business rule).
const props = withDefaults(defineProps<{ leadId?: string | null; leadIds?: string[]; currentStageId?: string | null; presetStageId?: string | null }>(), {
  leadId: null,
  leadIds: () => [],
  currentStageId: null,
  presetStageId: null,
});
const emit = defineEmits<{ (e: "moved"): void; (e: "cancel"): void }>();
const visible = defineModel<boolean>("visible", { default: false });

const { t } = useLocaleSettings();
const queryClient = useQueryClient();
const { stages } = useStages();
const reasonOptions = useOptions("lostReason", LOST_REASONS);

const stageId = ref<string | null>(null);
const lostReason = ref<string | null>(null);
const lostNote = ref("");
const saving = ref(false);

watch(visible, (open) => {
  if (!open) return;
  stageId.value = props.presetStageId ?? null;
  lostReason.value = null;
  lostNote.value = "";
});

const target = computed(() => stages.value.find((s) => s.id === stageId.value));
const needsReason = computed(() => target.value?.type === "lost");
const canSave = computed(() => !!stageId.value && stageId.value !== props.currentStageId && (!needsReason.value || !!lostReason.value));

const save = async () => {
  if (!canSave.value) return;
  saving.value = true;
  const reason = needsReason.value ? (lostNote.value.trim() ? `${lostReason.value}: ${lostNote.value.trim()}` : lostReason.value) : null;
  try {
    if (props.leadId) {
      await apiMoveLead(props.leadId, { stageId: stageId.value!, lostReason: reason });
      toast.success(t("leads.movedTo", { stage: target.value?.name }));
    } else {
      const res = await apiBulkLeads({ ids: props.leadIds, action: "stage", stageId: stageId.value, lostReason: reason });
      res.data.failed.length
          ? toast.warn(t("leads.bulkPartial", { ok: res.data.updated, failed: res.data.failed.length }))
          : toast.success(t("leads.bulkDone", { count: res.data.updated }));
    }
    ["leads", "pipeline", "tasks", "dashboard"].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
    visible.value = false;
    emit("moved");
  } catch {
    // interceptor already showed the reason
  } finally {
    saving.value = false;
  }
};

const close = () => {
  visible.value = false;
  emit("cancel");
};
</script>

<template>
  <MainModal v-model:visible="visible" header-title="leads.changeStage" width="32rem" @update:visible="(v: boolean) => !v && emit('cancel')">
    <div class="flex flex-col gap-4">
      <p v-if="leadIds.length" class="text-sm text-neural-300">{{ t("leads.selectedCount", { count: leadIds.length }) }}</p>
      <div class="grid grid-cols-2 gap-2" role="radiogroup" :aria-label="t('fields.stage')">
        <button
            v-for="s in stages"
            :key="s.id"
            type="button"
            role="radio"
            :aria-checked="stageId === s.id"
            :disabled="s.id === currentStageId"
            class="flex items-center gap-2 px-3 h-10 rounded border text-sm text-start transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            :class="stageId === s.id ? 'border-primary-700 bg-primary-50 text-primary-700 font-semibold' : 'border-line text-neural-400 hover:bg-gray-300'"
            @click="stageId = s.id"
        >
          <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ backgroundColor: s.color }" />
          <span class="truncate">{{ s.name }}</span>
        </button>
      </div>

      <div v-if="needsReason" class="flex flex-col gap-2">
        <label class="text-sm font-medium text-heading">{{ t("fields.lostReason") }} <span class="text-errors-100">*</span></label>
        <select v-model="lostReason" class="h-10 rounded border border-line bg-white px-2 text-sm text-black">
          <option :value="null" disabled>{{ t("fields.select") }}</option>
          <option v-for="r in reasonOptions" :key="r.id" :value="r.id">{{ r.name }}</option>
        </select>
        <input v-model="lostNote" type="text" maxlength="200" class="h-10 rounded border border-line bg-white px-2 text-sm text-black" :placeholder="t('leads.lostNotePlaceholder')" />
        <p class="text-xs text-neural-300">{{ t("leads.closeStopsFollowUps") }}</p>
      </div>
      <p v-else-if="target?.type === 'won'" class="text-xs text-neural-300">{{ t("leads.closeStopsFollowUps") }}</p>
      <p v-else-if="target?.autoTask?.enabled" class="text-xs text-neural-300">{{ t("leads.autoTaskHint", { title: target.autoTask.title }) }}</p>

      <div class="flex justify-end gap-3 pt-3 border-t border-line">
        <button type="button" class="details-btn-light" @click="close">{{ t("buttons.cancel") }}</button>
        <MainButton text="buttons.move" :loading="saving" :disabled="!canSave" :class="{ 'opacity-50': !canSave }" @action="save" />
      </div>
    </div>
  </MainModal>
</template>
