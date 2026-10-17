<script setup lang="ts">
import { ref } from "vue";
import { Icon } from "@iconify/vue";
import { toast } from "vue3-toastify";
import { useQueryClient } from "@tanstack/vue-query";
import StatusBadge from "@/components/UI/StatusBadge.vue";
import { useI18n } from "vue-i18n";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import { changeDateFormat, fromNow, isOverdue } from "@/utils";
import type { Task } from "@/types/domain";
import { apiPostponeTask } from "@/modules/tasks/api";

const TYPE_ICONS: Record<string, string> = {
  call: "lucide:phone", email: "lucide:mail", meeting: "lucide:calendar-days", follow_up: "lucide:repeat",
  send_quote: "lucide:file-text", viewing: "lucide:house", whatsapp: "lucide:message-circle", other: "lucide:check-square",
};

const props = withDefaults(defineProps<{ task: Task; showLead?: boolean; canManage?: boolean }>(), { showLead: true, canManage: true });
const emit = defineEmits<{ (e: "complete", task: Task): void; (e: "edit", task: Task): void }>();

const { t } = useLocaleSettings();
const { te } = useI18n();
// outcomes are option keys, but older/free-text values are shown as-is
const outcomeLabel = (o: string) => (te(`options.outcome.${o}`) ? t(`options.outcome.${o}`) : o);
const queryClient = useQueryClient();
const postponing = ref(false);

// quick snooze: +1 hour or tomorrow at 10:00
const postpone = async (mode: "hour" | "tomorrow") => {
  const due = new Date();
  if (mode === "hour") due.setTime(Math.max(Date.now(), new Date(props.task.dueAt).getTime()) + 36e5);
  else { due.setDate(due.getDate() + 1); due.setHours(10, 0, 0, 0); }
  postponing.value = true;
  try {
    await apiPostponeTask(props.task.id, due.toISOString());
    toast.success(t("tasks.postponed"));
    ["tasks", "leads", "dashboard"].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
  } finally {
    postponing.value = false;
  }
};
</script>

<template>
  <div class="flex items-start gap-3 py-3">
    <span class="w-8 h-8 rounded flex items-center justify-center shrink-0" :class="task.status === 'open' && isOverdue(task.dueAt) ? 'bg-errors-100/10 text-errors-100' : 'bg-primary-50 text-primary-700'">
      <Icon :icon="TYPE_ICONS[task.type] ?? 'lucide:check-square'" class="w-4 h-4" />
    </span>
    <div class="flex-1 min-w-0">
      <p class="text-sm font-medium text-heading flex flex-wrap items-center gap-2" :class="{ 'line-through text-neural-300': task.status !== 'open' }">
        {{ task.title }}
        <span v-if="task.automated" v-tooltip="t('tasks.automated')" class="text-[10px] px-1.5 py-0.5 rounded bg-neural-100 text-neural-300 no-underline">{{ t("tasks.auto") }}</span>
      </p>
      <p class="text-xs text-neural-300 flex flex-wrap gap-x-2">
        <span :class="{ 'text-errors-100 font-medium': task.status === 'open' && isOverdue(task.dueAt) }" v-tooltip="changeDateFormat(task.dueAt)">{{ task.status === "open" ? fromNow(task.dueAt) : changeDateFormat(task.completedAt) }}</span>
        <router-link v-if="showLead && task.lead" :to="{ name: 'leadDetails', params: { id: task.lead.id } }" class="text-primary-700 hover:underline">{{ task.lead.name }}</router-link>
        <span v-if="task.assignee">· {{ task.assignee.name }}</span>
      </p>
      <p v-if="task.outcome" class="text-xs text-neural-400 mt-1">{{ outcomeLabel(task.outcome) }}<span v-if="task.notes"> — {{ task.notes }}</span></p>
    </div>
    <StatusBadge :status="task.priority" class="hidden sm:inline-flex" />
    <div v-if="task.status === 'open' && canManage" class="flex items-center gap-1 shrink-0">
      <button type="button" class="w-8 h-8 rounded border border-line hover:bg-primary-50 flex items-center justify-center text-neural-300 hover:text-primary-700" :disabled="postponing" v-tooltip="t('tasks.postponeHour')" :aria-label="t('tasks.postponeHour')" @click="postpone('hour')">
        <Icon icon="lucide:alarm-clock-plus" class="w-4 h-4" />
      </button>
      <button type="button" class="w-8 h-8 rounded border border-line hover:bg-primary-50 flex items-center justify-center text-neural-300 hover:text-primary-700" :disabled="postponing" v-tooltip="t('tasks.postponeTomorrow')" :aria-label="t('tasks.postponeTomorrow')" @click="postpone('tomorrow')">
        <Icon icon="lucide:calendar-arrow-up" class="w-4 h-4" />
      </button>
      <button type="button" class="w-8 h-8 rounded border border-line hover:bg-primary-50 flex items-center justify-center text-neural-300 hover:text-primary-700" v-tooltip="t('buttons.edit')" :aria-label="t('buttons.edit')" @click="emit('edit', task)">
        <Icon icon="lucide:pencil" class="w-4 h-4" />
      </button>
      <button type="button" class="h-8 px-3 rounded bg-primary-700 text-[#fff] text-xs font-medium hover:bg-primary-600" @click="emit('complete', task)">{{ t("tasks.done") }}</button>
    </div>
  </div>
</template>
