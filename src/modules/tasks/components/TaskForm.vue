<script setup lang="ts">
import { computed } from "vue";
import { useForm } from "vee-validate";
import * as yup from "yup";
import { toast } from "vue3-toastify";
import { useQueryClient } from "@tanstack/vue-query";
import InputTextField from "@/components/form/InputTextField.vue";
import SelectBox from "@/components/form/SelectBox.vue";
import DatePickerField from "@/components/form/DatePickerField.vue";
import TextAreaField from "@/components/form/TextAreaField.vue";
import MainButton from "@/components/buttons/MainButton.vue";
import useMutate from "@/composables/useMutate";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import { useAuthorization } from "@/composables/useAuthorization.ts";
import { useActiveMembers, useOptions } from "@/composables/useLookups.ts";
import { P } from "@/config/permissions";
import { PRIORITIES, TASK_TYPES } from "@/constants/lead";
import type { Task } from "@/types/domain";
import { apiCreateLeadTask } from "@/modules/leads/api";
import { apiCreateTask, apiUpdateTask } from "@/modules/tasks/api";

// Create (optionally for a lead) or edit an open task
const props = defineProps<{ task?: Task | null; leadId?: string | null; defaultAssigneeId?: string | null }>();
const emit = defineEmits<{ (e: "saved", task: Task): void; (e: "close"): void }>();

const { t } = useLocaleSettings();
const { can } = useAuthorization();
const queryClient = useQueryClient();
const { memberOptions } = useActiveMembers();
const typeOptions = useOptions("taskType", TASK_TYPES);
const priorityOptions = useOptions("priority", PRIORITIES);

const tomorrowMorning = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d;
};

const schema = computed(() =>
    yup.object({
      title: yup.string().trim().required(t("validations.required", { field: t("fields.title") })).max(160),
      type: yup.string().required(),
      priority: yup.string().required(),
      dueDate: yup.date().typeError(t("validations.required", { field: t("fields.dueDate") })).required(t("validations.required", { field: t("fields.dueDate") })),
      dueTime: yup.date().typeError(t("validations.required", { field: t("fields.dueTime") })).required(t("validations.required", { field: t("fields.dueTime") })),
    })
);

const due = props.task ? new Date(props.task.dueAt) : tomorrowMorning();
const { handleSubmit } = useForm<any>({
  validationSchema: schema,
  initialValues: {
    title: props.task?.title ?? "",
    type: props.task?.type ?? "call",
    priority: props.task?.priority ?? "medium",
    assigneeId: props.task?.assignee?.id ?? props.defaultAssigneeId ?? null,
    dueDate: due,
    dueTime: due,
    notes: props.task?.notes ?? "",
  },
});

const { mutate, isPending } = useMutate({
  mutationKey: ["save-task"],
  mutationFn: (payload: any) =>
      props.task ? apiUpdateTask(props.task.id, payload) : props.leadId ? apiCreateLeadTask(props.leadId, payload) : apiCreateTask(payload),
});

const onSubmit = handleSubmit((v: any) => {
  const dueAt = new Date(v.dueDate);
  const time = new Date(v.dueTime);
  dueAt.setHours(time.getHours(), time.getMinutes(), 0, 0);
  const payload: Record<string, any> = { title: v.title.trim(), type: v.type, priority: v.priority, dueAt: dueAt.toISOString(), notes: v.notes || null };
  if (can(P.tasksViewAll) && v.assigneeId) payload.assigneeId = v.assigneeId;
  mutate(payload, {
    onSuccess: (res: any) => {
      toast.success(t("messages.saved"));
      ["tasks", "leads", "dashboard"].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      emit("saved", res.data);
    },
  });
});
</script>

<template>
  <form class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 items-start" novalidate @submit.prevent="onSubmit">
    <div class="sm:col-span-2">
      <InputTextField name="title" :label="t('fields.title')" :placeholder="t('tasks.titlePlaceholder')" required />
    </div>
    <SelectBox name="type" :label="t('fields.type')" :multi="false" :static-options="typeOptions" option-label="name" option-value="id" :placeholder="t('fields.select')" required />
    <SelectBox name="priority" :label="t('fields.priority')" :multi="false" :static-options="priorityOptions" option-label="name" option-value="id" :placeholder="t('fields.select')" required />
    <DatePickerField name="dueDate" :label="t('fields.dueDate')" :placeholder="t('fields.selectDate')" required />
    <DatePickerField name="dueTime" :label="t('fields.dueTime')" :placeholder="t('fields.selectTime')" show-time-only required />
    <div v-if="can(P.tasksViewAll)" class="sm:col-span-2">
      <SelectBox name="assigneeId" :label="t('fields.assignee')" :multi="false" :static-options="memberOptions" option-label="name" option-value="id" filter :placeholder="t('tasks.assignToMe')" />
    </div>
    <div class="sm:col-span-2">
      <TextAreaField name="notes" :label="t('fields.notes')" :placeholder="t('fields.optional')" :rows="3" />
    </div>
    <div class="sm:col-span-2 flex justify-end gap-3 pt-2 border-t border-line">
      <button type="button" class="details-btn-light" @click="emit('close')">{{ t("buttons.cancel") }}</button>
      <MainButton type="submit" text="buttons.save" :loading="isPending" />
    </div>
  </form>
</template>
