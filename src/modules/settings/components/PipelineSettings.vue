<script setup lang="ts">
import { computed, ref, watch } from "vue";
import draggable from "vuedraggable";
import { Icon } from "@iconify/vue";
import { toast } from "vue3-toastify";
import { useQueryClient } from "@tanstack/vue-query";
import MainButton from "@/components/buttons/MainButton.vue";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import { useAuthorization } from "@/composables/useAuthorization.ts";
import { useOptions, useStages } from "@/composables/useLookups.ts";
import { P } from "@/config/permissions";
import { STAGE_COLORS, TASK_TYPES } from "@/constants/lead";
import { apiSaveStages } from "@/modules/settings/api";

const { t } = useLocaleSettings();
const { can } = useAuthorization();
const queryClient = useQueryClient();
const { stages } = useStages();
const taskTypes = useOptions("taskType", TASK_TYPES);
const editable = computed(() => can(P.pipelineManage));

const draft = ref<any[]>([]);
// _key is a stable local id so renaming a row doesn't re-mount it while typing
const reset = () => (draft.value = stages.value.map((s) => ({ ...s, _key: s.id, autoTask: s.autoTask ? { ...s.autoTask } : null })));
watch(stages, reset, { immediate: true });

const comparable = (list: any[]) => JSON.stringify(list.map(({ id, name, type, color, autoTask }) => ({ id: id ?? null, name, type, color, autoTask: autoTask ?? null })));
const dirty = computed(() => comparable(draft.value) !== comparable(stages.value));
const saving = ref(false);

const addStage = () => {
  const lostIndex = draft.value.findIndex((s) => s.type === "won");
  draft.value.splice(lostIndex < 0 ? draft.value.length : lostIndex, 0, { id: null, _key: `new-${Date.now()}`, name: t("settings.newStage"), type: "open", color: STAGE_COLORS[2], autoTask: null });
};
const remove = (i: number) => draft.value.splice(i, 1);
const toggleAutoTask = (s: any) => (s.autoTask = s.autoTask ? null : { enabled: true, title: t("settings.defaultAutoTask"), type: "follow_up", dueInHours: 24 });

const save = async () => {
  saving.value = true;
  try {
    await apiSaveStages(draft.value.map(({ id, name, type, color, autoTask }) => ({ ...(id ? { id } : {}), name, type, color, autoTask })));
    toast.success(t("messages.saved"));
    ["pipeline-stages", "pipeline", "leads"].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <div class="flex flex-col gap-4 max-w-3xl">
    <div>
      <h2 class="text-base font-semibold">{{ t("settings.pipeline") }}</h2>
      <p class="text-sm text-neural-300">{{ t("settings.pipelineHint") }}</p>
    </div>

    <draggable v-model="draft" item-key="_key" handle=".drag-handle" :disabled="!editable" class="flex flex-col gap-2" :animation="150">
      <template #item="{ element: s, index }">
        <div class="rounded border border-line bg-white p-3 flex flex-col gap-2">
          <div class="flex flex-wrap items-center gap-2">
            <Icon v-if="editable" icon="lucide:grip-vertical" class="drag-handle w-4 h-4 text-neural-300 cursor-grab" :aria-label="t('settings.dragToReorder')" />
            <input v-model="s.name" :disabled="!editable" maxlength="40" class="h-9 flex-1 min-w-[10rem] rounded border border-line bg-white px-3 text-sm text-black" :aria-label="t('fields.name')" />
            <span class="text-xs px-2 py-1 rounded bg-neural-100 text-neural-400">{{ t(`settings.stageType.${s.type}`) }}</span>
            <div class="flex gap-1" role="radiogroup" :aria-label="t('settings.color')">
              <button v-for="c in STAGE_COLORS" :key="c" type="button" :disabled="!editable" role="radio" :aria-checked="s.color === c" class="w-5 h-5 rounded-full border-2" :style="{ backgroundColor: c, borderColor: s.color === c ? 'rgb(var(--heading))' : 'transparent' }" :aria-label="c" @click="s.color = c" />
            </div>
            <button v-if="editable && s.type === 'open'" type="button" class="text-xs text-primary-700" @click="toggleAutoTask(s)">{{ s.autoTask ? t("settings.removeAutoTask") : t("settings.addAutoTask") }}</button>
            <button v-if="editable && s.type === 'open' && draft.filter((x) => x.type === 'open').length > 1" type="button" class="w-8 h-8 rounded hover:bg-errors-100/10 text-errors-100 flex items-center justify-center" :aria-label="t('buttons.remove')" @click="remove(index)">
              <Icon icon="lucide:trash-2" class="w-4 h-4" />
            </button>
          </div>
          <div v-if="s.autoTask" class="flex flex-wrap items-center gap-2 ps-6 text-xs text-neural-400">
            <span>{{ t("settings.autoTaskWhenEntering") }}</span>
            <input v-model="s.autoTask.title" :disabled="!editable" class="h-8 flex-1 min-w-[10rem] rounded border border-line bg-white px-2 text-sm text-black" :aria-label="t('fields.title')" />
            <select v-model="s.autoTask.type" :disabled="!editable" class="h-8 rounded border border-line bg-white px-2 text-sm text-black" :aria-label="t('fields.type')">
              <option v-for="o in taskTypes" :key="o.id" :value="o.id">{{ o.name }}</option>
            </select>
            <span>{{ t("settings.dueIn") }}</span>
            <input v-model.number="s.autoTask.dueInHours" :disabled="!editable" type="number" min="1" max="720" class="h-8 w-20 rounded border border-line bg-white px-2 text-sm text-black" :aria-label="t('settings.hours')" />
            <span>{{ t("settings.hours") }}</span>
          </div>
        </div>
      </template>
    </draggable>

    <div v-if="editable" class="flex flex-wrap items-center justify-between gap-3">
      <button type="button" class="details-btn-outline inline-flex items-center gap-2" :disabled="draft.length >= 12" @click="addStage"><Icon icon="lucide:plus" class="w-4 h-4" />{{ t("settings.addStage") }}</button>
      <div class="flex gap-3">
        <button v-if="dirty" type="button" class="details-btn-light" @click="reset">{{ t("buttons.discard") }}</button>
        <MainButton text="buttons.save" :loading="saving" :disabled="!dirty" @action="save" />
      </div>
    </div>
    <p class="text-xs text-neural-300">{{ t("settings.pipelineRules") }}</p>
  </div>
</template>
