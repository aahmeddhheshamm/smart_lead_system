<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Icon } from "@iconify/vue";
import { toast } from "vue3-toastify";
import { useQueryClient } from "@tanstack/vue-query";
import Box from "@/components/UI/Box.vue";
import MainTitle from "@/components/UI/MainTitle.vue";
import StatusBadge from "@/components/UI/StatusBadge.vue";
import UserAvatar from "@/components/UI/UserAvatar.vue";
import SpinnerLoading from "@/components/UI/SpinnerLoading.vue";
import MainModal from "@/components/UI/modals/MainModal.vue";
import DeleteModal from "@/components/UI/modals/DeleteModal.vue";
import MainButton from "@/components/buttons/MainButton.vue";
import useFetch from "@/composables/useFetch";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import { useAuthorization } from "@/composables/useAuthorization.ts";
import { useActiveMembers } from "@/composables/useLookups.ts";
import { useAuthStore } from "@/store/auth.ts";
import { changeDateFormat, formatMoney, fromNow, isOverdue } from "@/utils";
import { P } from "@/config/permissions";
import { CUSTOM_FIELDS_BY_INDUSTRY } from "@/constants/lead";
import type { Lead, Task } from "@/types/domain";
import { apiDoNotContact, apiLead, apiLeadTasks, apiUpdateLead } from "@/modules/leads/api";
import LeadForm from "@/modules/leads/components/LeadForm.vue";
import MoveStageModal from "@/modules/leads/components/MoveStageModal.vue";
import ActivityTimeline from "@/modules/leads/components/ActivityTimeline.vue";
import AiInsightsPanel from "@/modules/leads/components/AiInsightsPanel.vue";
import LeadRunsPanel from "@/modules/leads/components/LeadRunsPanel.vue";
import TaskForm from "@/modules/tasks/components/TaskForm.vue";
import TaskRow from "@/modules/tasks/components/TaskRow.vue";
import CompleteTaskModal from "@/modules/tasks/components/CompleteTaskModal.vue";

const { t } = useLocaleSettings();
const { can } = useAuthorization();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const queryClient = useQueryClient();
const id = computed(() => String(route.params.id));

const { data, isLoading, isError, error, refetch } = useFetch({
  queryKey: computed(() => ["leads", id.value]),
  queryFn: () => apiLead(id.value),
});
const lead = computed<Lead | null>(() => data.value?.data ?? null);

const { data: tasksData } = useFetch({
  queryKey: computed(() => ["leads", id.value, "tasks"]),
  queryFn: () => apiLeadTasks(id.value),
  enabled: computed(() => !!lead.value),
});
const openTasks = computed<Task[]>(() => (tasksData.value?.data ?? []).filter((x) => x.status === "open"));
const closedTasks = computed<Task[]>(() => (tasksData.value?.data ?? []).filter((x) => x.status !== "open").slice(0, 5));

const { memberOptions } = useActiveMembers();
const customFieldDefs = computed(() => CUSTOM_FIELDS_BY_INDUSTRY[auth.organization?.industry ?? "other"] ?? []);
const currency = computed(() => auth.organization?.currency ?? "");

const canEdit = computed(() => can(P.leadsUpdate));
const showEdit = ref(false);
const showMove = ref(false);
const showTaskForm = ref(false);
const editingTask = ref<Task | null>(null);
const completing = ref<Task | null>(null);
const showComplete = ref(false);
const showDelete = ref(false);
const showDnc = ref(false);
const changingOwner = ref(false);

const invalidate = () => ["leads", "pipeline", "dashboard", "tasks"].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));

const changeOwner = async (ownerId: string) => {
  changingOwner.value = true;
  try {
    await apiUpdateLead(id.value, { ownerId: ownerId || null });
    toast.success(t("leads.ownerChanged"));
    invalidate();
  } finally {
    changingOwner.value = false;
  }
};

const toggleDnc = async () => {
  await apiDoNotContact(id.value, !lead.value!.doNotContact);
  toast.success(lead.value!.doNotContact ? t("leads.optedIn") : t("leads.optedOut"));
  showDnc.value = false;
  invalidate();
};

const openTaskForm = (task: Task | null = null) => {
  editingTask.value = task;
  showTaskForm.value = true;
};
const completeTask = (task: Task) => {
  completing.value = task;
  showComplete.value = true;
};
const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(t("ai.copied"));
  } catch {
    /* clipboard blocked */
  }
};
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-if="isLoading" class="py-20"><SpinnerLoading /></div>

    <Box v-else-if="isError || !lead" class="py-14 flex flex-col items-center gap-3 text-center">
      <p class="text-sm text-neural-300">{{ (error as any)?.error?.message || t("messages.notFound") }}</p>
      <div class="flex gap-3">
        <button type="button" class="details-btn-outline" @click="refetch()">{{ t("buttons.retry") }}</button>
        <button type="button" class="details-btn-light" @click="router.push({ name: 'leads' })">{{ t("buttons.back") }}</button>
      </div>
    </Box>

    <template v-else>
      <!-- modals -->
      <MainModal v-model:visible="showEdit" header-title="leads.editLead" position="right" width="min(44rem, 100vw)">
        <LeadForm v-if="showEdit" :lead="lead" @saved="showEdit = false" @close="showEdit = false" />
      </MainModal>
      <MoveStageModal v-model:visible="showMove" :lead-id="lead.id" :current-stage-id="lead.stage?.id" />
      <MainModal v-model:visible="showTaskForm" :header-title="editingTask ? 'tasks.editTask' : 'tasks.newTask'" width="36rem">
        <TaskForm v-if="showTaskForm" :task="editingTask" :lead-id="lead.id" :default-assignee-id="lead.owner?.id" @saved="showTaskForm = false" @close="showTaskForm = false" />
      </MainModal>
      <CompleteTaskModal v-model:visible="showComplete" :task="completing" />
      <DeleteModal v-model:visible="showDelete" header-title="leads.deleteLead" :delete-data="{ id: lead.id, key: 'leads', text: lead.name, url: 'leads' }" @deleted="router.push({ name: 'leads' })" />
      <MainModal v-model:visible="showDnc" :header-title="lead.doNotContact ? 'leads.allowContact' : 'leads.doNotContact'" width="30rem">
        <p class="text-sm text-neural-400">{{ lead.doNotContact ? t("leads.allowContactBody") : t("leads.dncBody") }}</p>
        <div class="flex justify-end gap-3 pt-4">
          <button type="button" class="details-btn-light" @click="showDnc = false">{{ t("buttons.cancel") }}</button>
          <MainButton text="buttons.confirm" @action="toggleDnc" />
        </div>
      </MainModal>

      <!-- header -->
      <Box>
        <MainTitle :breadcrumb-title="t('sidebar.leads')" route-name="leads" dynamic-title :title="lead.name" class="mb-4" />
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div class="flex items-center gap-4 min-w-0">
            <UserAvatar :name="lead.name" size="lg" />
            <div class="min-w-0">
              <h1 class="text-xl font-bold flex flex-wrap items-center gap-2">
                {{ lead.name }}
                <span v-if="lead.doNotContact" class="text-xs font-medium px-2 py-0.5 rounded bg-errors-100/10 text-errors-100">{{ t("leads.doNotContact") }}</span>
              </h1>
              <div class="flex flex-wrap items-center gap-2 mt-1.5 text-sm">
                <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-line text-neural-400">
                  <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: lead.stage?.color }" />{{ lead.stage?.name }}
                </span>
                <StatusBadge :status="lead.priority" />
                <span v-for="tag in lead.tags" :key="tag" class="text-xs px-2 py-0.5 rounded bg-primary-50 text-primary-700">#{{ tag }}</span>
              </div>
              <p v-if="lead.lostReason" class="text-xs text-errors-100 mt-1">{{ t("fields.lostReason") }}: {{ lead.lostReason }}</p>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <label v-if="can(P.leadsAssign)" class="flex items-center gap-2 text-sm">
              <span class="text-neural-300">{{ t("fields.owner") }}</span>
              <select :value="lead.owner?.id ?? ''" :disabled="changingOwner" class="h-9 rounded border border-line bg-white px-2 text-sm text-black" @change="changeOwner(($event.target as HTMLSelectElement).value)">
                <option value="">{{ t("leads.unassigned") }}</option>
                <option v-for="m in memberOptions" :key="m.id" :value="m.id">{{ m.name }}</option>
              </select>
            </label>
            <span v-else class="text-sm text-neural-400">{{ t("fields.owner") }}: {{ lead.owner?.name ?? t("leads.unassigned") }}</span>
            <MainButton v-if="canEdit" text="leads.changeStage" @action="showMove = true" />
            <button v-if="can(P.tasksManage)" type="button" class="details-btn-outline" @click="openTaskForm()">{{ t("tasks.newTask") }}</button>
            <button v-if="canEdit" type="button" class="details-btn-light" @click="showEdit = true">{{ t("buttons.edit") }}</button>
          </div>
        </div>
      </Box>

      <div class="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_22rem] gap-4 items-start">
        <div class="flex flex-col gap-4 min-w-0">
          <!-- tasks -->
          <Box>
            <div class="flex items-center justify-between mb-2">
              <h2 class="text-base font-semibold">{{ t("leads.tasksAndFollowUps") }}</h2>
              <span v-if="lead.nextFollowUpAt" class="text-xs" :class="isOverdue(lead.nextFollowUpAt) ? 'text-errors-100 font-medium' : 'text-neural-300'">
                {{ t("fields.nextFollowUp") }}: {{ fromNow(lead.nextFollowUpAt) }}
              </span>
            </div>
            <div v-if="openTasks.length" class="divide-y divide-line">
              <TaskRow v-for="task in openTasks" :key="task.id" :task="task" :show-lead="false" :can-manage="can(P.tasksManage)" @complete="completeTask" @edit="openTaskForm" />
            </div>
            <div v-else class="rounded bg-[#FFF9E9] text-[#8A6700] text-sm px-3 py-2 flex items-center justify-between gap-3">
              {{ t("leads.noNextStep") }}
              <button v-if="can(P.tasksManage) && lead.stage?.type === 'open'" type="button" class="text-sm font-medium text-primary-700 shrink-0" @click="openTaskForm()">{{ t("tasks.newTask") }}</button>
            </div>
            <details v-if="closedTasks.length" class="mt-3">
              <summary class="text-xs text-neural-300 cursor-pointer">{{ t("leads.recentlyClosedTasks", { count: closedTasks.length }) }}</summary>
              <div class="divide-y divide-line">
                <TaskRow v-for="task in closedTasks" :key="task.id" :task="task" :show-lead="false" :can-manage="false" />
              </div>
            </details>
          </Box>

          <!-- timeline -->
          <Box>
            <h2 class="text-base font-semibold mb-3">{{ t("leads.timeline") }}</h2>
            <ActivityTimeline :lead="lead" :can-edit="canEdit" />
          </Box>
        </div>

        <aside class="flex flex-col gap-4 min-w-0">
          <Box>
            <h2 class="text-base font-semibold mb-3">{{ t("leads.contactDetails") }}</h2>
            <dl class="flex flex-col gap-3 text-sm">
              <div v-if="lead.phone" class="flex items-center justify-between gap-2">
                <dt class="sr-only">{{ t("fields.phone") }}</dt>
                <dd class="flex items-center gap-2 min-w-0"><Icon icon="lucide:phone" class="w-4 h-4 text-neural-300" /><a :href="`tel:${lead.phone}`" class="text-heading hover:text-primary-700 truncate" dir="ltr">{{ lead.phone }}</a></dd>
                <button type="button" class="text-xs text-primary-700" @click="copy(lead.phone)">{{ t("buttons.copy") }}</button>
              </div>
              <div v-if="lead.email" class="flex items-center justify-between gap-2">
                <dt class="sr-only">{{ t("fields.email") }}</dt>
                <dd class="flex items-center gap-2 min-w-0"><Icon icon="lucide:mail" class="w-4 h-4 text-neural-300" /><a :href="`mailto:${lead.email}`" class="text-heading hover:text-primary-700 truncate">{{ lead.email }}</a></dd>
                <button type="button" class="text-xs text-primary-700" @click="copy(lead.email)">{{ t("buttons.copy") }}</button>
              </div>
              <div class="grid grid-cols-2 gap-3 pt-3 border-t border-line">
                <div><dt class="text-xs text-neural-300">{{ t("fields.source") }}</dt><dd class="text-heading">{{ lead.source?.name ?? "—" }}</dd></div>
                <div><dt class="text-xs text-neural-300">{{ t("fields.campaign") }}</dt><dd class="text-heading">{{ lead.campaign ?? "—" }}</dd></div>
                <div><dt class="text-xs text-neural-300">{{ t("fields.company") }}</dt><dd class="text-heading">{{ lead.company ?? "—" }}</dd></div>
                <div><dt class="text-xs text-neural-300">{{ t("fields.lastContacted") }}</dt><dd class="text-heading">{{ lead.lastContactedAt ? fromNow(lead.lastContactedAt) : t("leads.neverContacted") }}</dd></div>
                <div><dt class="text-xs text-neural-300">{{ t("fields.createdAt") }}</dt><dd class="text-heading">{{ changeDateFormat(lead.createdAt, "ll") }}</dd></div>
                <div><dt class="text-xs text-neural-300">{{ t("fields.updatedAt") }}</dt><dd class="text-heading" v-tooltip="changeDateFormat(lead.updatedAt)">{{ fromNow(lead.updatedAt) }}</dd></div>
                <div v-for="f in customFieldDefs" :key="f.key">
                  <dt class="text-xs text-neural-300">{{ t(`customFields.${f.key}`) }}</dt>
                  <dd class="text-heading">{{ f.key === "budget" ? formatMoney(lead.customFields?.[f.key], currency) : lead.customFields?.[f.key] ?? "—" }}</dd>
                </div>
              </div>
              <div v-if="lead.message" class="pt-3 border-t border-line">
                <dt class="text-xs text-neural-300 mb-1">{{ t("fields.originalMessage") }}</dt>
                <dd class="text-heading whitespace-pre-line" dir="auto">{{ lead.message }}</dd>
              </div>
            </dl>
          </Box>

          <AiInsightsPanel :lead="lead" :can-edit="canEdit" />

          <Box v-if="can(P.automationsView)">
            <h2 class="text-base font-semibold mb-2">{{ t("leads.automationHistory") }}</h2>
            <LeadRunsPanel :lead-id="lead.id" />
          </Box>

          <Box v-if="canEdit || can(P.leadsDelete)">
            <h2 class="text-base font-semibold mb-3">{{ t("leads.privacyAndDanger") }}</h2>
            <div class="flex flex-col gap-2">
              <button v-if="canEdit" type="button" class="details-btn-outline text-start" @click="showDnc = true">
                {{ lead.doNotContact ? t("leads.allowContact") : t("leads.doNotContact") }}
              </button>
              <button v-if="can(P.leadsDelete)" type="button" class="details-btn-danger" @click="showDelete = true">{{ t("leads.deleteLead") }}</button>
            </div>
          </Box>
        </aside>
      </div>
    </template>
  </div>
</template>
