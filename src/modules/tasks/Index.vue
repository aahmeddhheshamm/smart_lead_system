<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Icon } from "@iconify/vue";
import Box from "@/components/UI/Box.vue";
import MainTitle from "@/components/UI/MainTitle.vue";
import TabsNav from "@/components/UI/TabsNav.vue";
import SpinnerLoading from "@/components/UI/SpinnerLoading.vue";
import MainModal from "@/components/UI/modals/MainModal.vue";
import MainButton from "@/components/buttons/MainButton.vue";
import TablePagination from "@/components/table/TablePagination.vue";
import useFetch from "@/composables/useFetch";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import { useAuthorization } from "@/composables/useAuthorization.ts";
import { useActiveMembers } from "@/composables/useLookups.ts";
import { useAuthStore } from "@/store/auth.ts";
import { changeDateFormat } from "@/utils";
import { P } from "@/config/permissions";
import type { Task } from "@/types/domain";
import { apiTasks } from "@/modules/tasks/api";
import TaskRow from "@/modules/tasks/components/TaskRow.vue";
import TaskForm from "@/modules/tasks/components/TaskForm.vue";
import CompleteTaskModal from "@/modules/tasks/components/CompleteTaskModal.vue";

const { t } = useLocaleSettings();
const { can } = useAuthorization();
const auth = useAuthStore();
const { memberOptions } = useActiveMembers();

const mode = ref<"list" | "week">("list");
const view = ref("today");
const page = ref(1);
const perPage = ref(20);
// managers default to "everyone", agents only ever see their own
const assigneeId = ref<string>(can(P.tasksViewAll) ? "" : auth.userId ?? "");
watch([view, assigneeId, perPage], () => (page.value = 1));

const weekStart = ref(new Date(new Date().setHours(0, 0, 0, 0)));
const weekEnd = computed(() => new Date(weekStart.value.getTime() + 7 * 864e5 - 1));
const shiftWeek = (days: number) => (weekStart.value = new Date(weekStart.value.getTime() + days * 864e5));

const { data, isLoading, isError, refetch } = useFetch({
  queryKey: computed(() => ["tasks", mode.value, view.value, assigneeId.value, page.value, perPage.value, weekStart.value.toISOString()]),
  queryFn: () =>
      mode.value === "week"
          ? apiTasks({ view: "range", from: weekStart.value.toISOString(), to: weekEnd.value.toISOString(), assigneeId: assigneeId.value, pageSize: 100 })
          : apiTasks({ view: view.value, assigneeId: assigneeId.value, page: page.value, pageSize: perPage.value }),
});

const tasks = computed<Task[]>(() => data.value?.data ?? []);
const counts = computed(() => data.value?.counts);
const pagination = computed(() => ({ total: data.value?.pagination?.total ?? 0, lastPage: data.value?.pagination?.totalPages ?? 1 }));

const tabs = computed(() => [
  { key: "today", label: t("tasks.today"), count: counts.value?.today ?? null },
  { key: "overdue", label: t("tasks.overdue"), count: counts.value?.overdue ?? null },
  { key: "upcoming", label: t("tasks.upcoming"), count: counts.value?.upcoming ?? null },
  { key: "completed", label: t("tasks.completedTab") },
]);

const days = computed(() =>
    Array.from({ length: 7 }, (_, i) => {
      const date = new Date(weekStart.value.getTime() + i * 864e5);
      const key = date.toDateString();
      return { date, key, tasks: tasks.value.filter((x) => new Date(x.dueAt).toDateString() === key) };
    })
);

const showForm = ref(false);
const editing = ref<Task | null>(null);
const completing = ref<Task | null>(null);
const showComplete = ref(false);
const openForm = (task: Task | null = null) => {
  editing.value = task;
  showForm.value = true;
};
const complete = (task: Task) => {
  completing.value = task;
  showComplete.value = true;
};
</script>

<template>
  <div class="flex flex-col gap-4">
    <MainModal v-model:visible="showForm" :header-title="editing ? 'tasks.editTask' : 'tasks.newTask'" width="36rem">
      <TaskForm v-if="showForm" :task="editing" @saved="showForm = false" @close="showForm = false" />
    </MainModal>
    <CompleteTaskModal v-model:visible="showComplete" :task="completing" />

    <Box>
      <template #header>
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <MainTitle title="sidebar.tasks" />
          <div class="flex flex-wrap items-center gap-2">
            <select v-if="can(P.tasksViewAll)" v-model="assigneeId" class="h-9 rounded border border-line bg-white px-2 text-sm text-black" :aria-label="t('fields.assignee')">
              <option value="">{{ t("tasks.everyone") }}</option>
              <option v-for="m in memberOptions" :key="m.id" :value="m.id">{{ m.name }}</option>
            </select>
            <div class="inline-flex rounded border border-line overflow-hidden" role="group">
              <button type="button" class="h-9 px-3 text-sm flex items-center gap-1.5" :class="mode === 'list' ? 'bg-primary-700 text-[#fff]' : 'bg-white text-neural-400'" :aria-pressed="mode === 'list'" @click="mode = 'list'">
                <Icon icon="lucide:list" class="w-4 h-4" />{{ t("tasks.list") }}
              </button>
              <button type="button" class="h-9 px-3 text-sm flex items-center gap-1.5 border-s border-line" :class="mode === 'week' ? 'bg-primary-700 text-[#fff]' : 'bg-white text-neural-400'" :aria-pressed="mode === 'week'" @click="mode = 'week'">
                <Icon icon="lucide:calendar-range" class="w-4 h-4" />{{ t("tasks.week") }}
              </button>
            </div>
            <MainButton v-if="can(P.tasksManage)" text="tasks.newTask" is-add-btn @action="openForm()" />
          </div>
        </div>
      </template>

      <template v-if="mode === 'list'">
        <TabsNav v-model="view" :tabs="tabs" />
        <div v-if="isLoading" class="py-12"><SpinnerLoading /></div>
        <p v-else-if="isError" class="py-12 text-center text-sm text-neural-300">{{ t("messages.loadFailed") }} <button type="button" class="text-primary-700" @click="refetch()">{{ t("buttons.retry") }}</button></p>
        <div v-else-if="tasks.length" class="divide-y divide-line">
          <TaskRow v-for="task in tasks" :key="task.id" :task="task" :can-manage="can(P.tasksManage)" @complete="complete" @edit="openForm" />
        </div>
        <div v-else class="py-14 text-center">
          <Icon icon="lucide:party-popper" class="w-8 h-8 text-primary-300 mx-auto mb-2" />
          <p class="text-sm text-neural-300">{{ t(`tasks.empty.${view}`) }}</p>
        </div>
        <div v-if="tasks.length && pagination.lastPage > 1" class="pt-4 flex items-center gap-3 justify-between flex-col lg:flex-row">
          <TablePagination :table-data="tasks" :page="page" :per-page="perPage" :pagination="pagination" @prev-page="page--" @next-page="page++" @update:per-page="(v) => (perPage = v)" />
        </div>
      </template>

      <template v-else>
        <div class="flex items-center justify-between mb-3">
          <button type="button" class="details-btn-light !h-9" :aria-label="t('tasks.prevWeek')" @click="shiftWeek(-7)"><Icon icon="lucide:chevron-left" class="w-4 h-4 rtl:rotate-180" /></button>
          <p class="text-sm font-semibold text-heading">{{ changeDateFormat(weekStart, "ll") }} – {{ changeDateFormat(weekEnd, "ll") }}</p>
          <button type="button" class="details-btn-light !h-9" :aria-label="t('tasks.nextWeek')" @click="shiftWeek(7)"><Icon icon="lucide:chevron-right" class="w-4 h-4 rtl:rotate-180" /></button>
        </div>
        <div v-if="isLoading" class="py-12"><SpinnerLoading /></div>
        <div v-else class="grid grid-cols-1 md:grid-cols-7 gap-2">
          <section v-for="day in days" :key="day.key" class="rounded border border-line min-h-[8rem] flex flex-col" :class="{ 'border-primary-300 bg-primary-20': day.key === new Date().toDateString() }">
            <h3 class="px-2 py-1.5 text-xs font-semibold text-heading border-b border-line">{{ changeDateFormat(day.date, "ddd D") }}</h3>
            <ul class="p-1.5 flex flex-col gap-1">
              <li v-for="task in day.tasks" :key="task.id">
                <button type="button" class="w-full text-start rounded px-2 py-1.5 text-xs border" :class="task.status === 'open' ? 'bg-white border-line hover:border-primary-200' : 'bg-neural-100 border-transparent line-through text-neural-300'" @click="task.status === 'open' && can(P.tasksManage) && complete(task)">
                  <span class="block text-neural-300">{{ changeDateFormat(task.dueAt, "HH:mm") }}</span>
                  <span class="block text-heading truncate">{{ task.title }}</span>
                  <span v-if="task.lead" class="block text-primary-700 truncate">{{ task.lead.name }}</span>
                </button>
              </li>
              <li v-if="!day.tasks.length" class="text-[11px] text-neural-200 text-center py-3">—</li>
            </ul>
          </section>
        </div>
      </template>
    </Box>
  </div>
</template>
