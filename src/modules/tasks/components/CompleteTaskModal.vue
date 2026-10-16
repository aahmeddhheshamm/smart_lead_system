<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { toast } from "vue3-toastify";
import { useQueryClient } from "@tanstack/vue-query";
import MainModal from "@/components/UI/modals/MainModal.vue";
import MainButton from "@/components/buttons/MainButton.vue";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import { useOptions } from "@/composables/useLookups.ts";
import { CALL_OUTCOMES } from "@/constants/lead";
import type { Task } from "@/types/domain";
import { apiCompleteTask } from "@/modules/tasks/api";

// Close a task with its outcome + notes, and optionally schedule the next follow-up in one step
const props = defineProps<{ task: Task | null }>();
const emit = defineEmits<{ (e: "done"): void }>();
const visible = defineModel<boolean>("visible", { default: false });

const { t } = useLocaleSettings();
const queryClient = useQueryClient();
const outcomes = useOptions("outcome", CALL_OUTCOMES);

const outcome = ref<string>("");
const notes = ref("");
const scheduleNext = ref(false);
const nextTitle = ref("");
const nextDue = ref("");
const busy = ref(false);

const defaultNext = () => {
  const d = new Date(Date.now() + 2 * 864e5);
  d.setHours(10, 0, 0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
};

watch(visible, (open) => {
  if (!open) return;
  outcome.value = "";
  notes.value = "";
  scheduleNext.value = false;
  nextTitle.value = props.task ? t("tasks.followUpOn", { title: props.task.title }) : "";
  nextDue.value = defaultNext();
});

const isCall = computed(() => props.task?.type === "call");

const save = async () => {
  if (!props.task) return;
  busy.value = true;
  try {
    await apiCompleteTask(props.task.id, {
      outcome: outcome.value || null,
      notes: notes.value.trim() || null,
      followUp: scheduleNext.value && nextTitle.value.trim() && nextDue.value ? { title: nextTitle.value.trim(), dueAt: new Date(nextDue.value).toISOString() } : null,
    });
    toast.success(t("tasks.completed"));
    ["tasks", "leads", "dashboard", "pipeline"].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
    visible.value = false;
    emit("done");
  } finally {
    busy.value = false;
  }
};
</script>

<template>
  <MainModal v-model:visible="visible" header-title="tasks.completeTask" width="32rem">
    <div v-if="task" class="flex flex-col gap-4">
      <p class="text-sm text-heading font-medium">{{ task.title }}<span v-if="task.lead" class="text-neural-300 font-normal"> · {{ task.lead.name }}</span></p>
      <label class="flex flex-col gap-1.5 text-sm">
        <span class="font-medium text-heading">{{ isCall ? t("fields.callOutcome") : t("fields.outcome") }}</span>
        <select v-model="outcome" class="h-10 rounded border border-line bg-white px-2 text-sm text-black">
          <option value="">{{ t("fields.optional") }}</option>
          <option v-for="o in outcomes" :key="o.id" :value="o.id">{{ o.name }}</option>
        </select>
      </label>
      <label class="flex flex-col gap-1.5 text-sm">
        <span class="font-medium text-heading">{{ t("fields.notes") }}</span>
        <textarea v-model="notes" rows="3" class="rounded border border-line bg-white px-3 py-2 text-sm text-black resize-none" :placeholder="t('tasks.notesPlaceholder')" />
      </label>
      <label class="flex items-center gap-2 text-sm text-neural-400 cursor-pointer">
        <input v-model="scheduleNext" type="checkbox" class="w-4 h-4 accent-primary-700" /> {{ t("tasks.scheduleNext") }}
      </label>
      <div v-if="scheduleNext" class="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
        <input v-model="nextTitle" class="h-10 rounded border border-line bg-white px-3 text-sm text-black" :aria-label="t('fields.title')" />
        <input v-model="nextDue" type="datetime-local" class="h-10 rounded border border-line bg-white px-2 text-sm text-black" :aria-label="t('fields.dueDate')" />
      </div>
      <div class="flex justify-end gap-3 pt-3 border-t border-line">
        <button type="button" class="details-btn-light" @click="visible = false">{{ t("buttons.cancel") }}</button>
        <MainButton text="tasks.markDone" :loading="busy" @action="save" />
      </div>
    </div>
  </MainModal>
</template>
