<script setup lang="ts">
import { computed, ref, watch } from "vue";
import draggable from "vuedraggable";
import { useRouter } from "vue-router";
import { Icon } from "@iconify/vue";
import { toast } from "vue3-toastify";
import { useQueryClient } from "@tanstack/vue-query";
import Box from "@/components/UI/Box.vue";
import MainTitle from "@/components/UI/MainTitle.vue";
import SpinnerLoading from "@/components/UI/SpinnerLoading.vue";
import StatusBadge from "@/components/UI/StatusBadge.vue";
import UserAvatar from "@/components/UI/UserAvatar.vue";
import useFetch from "@/composables/useFetch";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import { useAuthorization } from "@/composables/useAuthorization.ts";
import { useActiveMembers } from "@/composables/useLookups.ts";
import { useAuthStore } from "@/store/auth.ts";
import { formatMoney, fromNow, isOverdue } from "@/utils";
import { P } from "@/config/permissions";
import type { Lead } from "@/types/domain";
import { apiMoveLead, apiPipelineBoard } from "@/modules/leads/api";
import MoveStageModal from "@/modules/leads/components/MoveStageModal.vue";

const { t } = useLocaleSettings();
const { can } = useAuthorization();
const auth = useAuthStore();
const router = useRouter();
const queryClient = useQueryClient();
const { memberOptions } = useActiveMembers();

const search = ref("");
const ownerId = ref("");
const debounced = ref("");
let timer: any;
watch(search, (v) => {
  clearTimeout(timer);
  timer = setTimeout(() => (debounced.value = v), 300);
});

const { data, isLoading, isError, refetch } = useFetch({
  queryKey: computed(() => ["pipeline", debounced.value, ownerId.value]),
  queryFn: () => apiPipelineBoard({ search: debounced.value, ownerId: ownerId.value }),
});

// local copy so cards move instantly; the server response replaces it after each change
const columns = ref<any[]>([]);
watch(() => data.value?.data?.stages, (stages) => {
  columns.value = (stages ?? []).map((s: any) => ({ ...s, leads: [...s.leads] }));
}, { immediate: true });

const canMove = computed(() => can(P.leadsUpdate));
const pendingLost = ref<{ lead: Lead; stageId: string } | null>(null);
const showLost = ref(false);

const refresh = () => ["pipeline", "leads", "dashboard", "tasks"].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));

const onChange = async (stage: any, evt: any) => {
  const lead: Lead | undefined = evt.added?.element;
  if (!lead) return;
  if (stage.type === "lost") {
    // Lost needs a reason: ask first, and put the card back if the user cancels
    pendingLost.value = { lead, stageId: stage.id };
    showLost.value = true;
    return;
  }
  try {
    await apiMoveLead(lead.id, { stageId: stage.id });
    toast.success(t("leads.movedTo", { stage: stage.name }));
  } catch {
    // revert happens through the refetch
  } finally {
    refresh();
  }
};

const onLostCancel = () => {
  pendingLost.value = null;
  refetch();
};

const total = (col: any) => col.total;
const sum = (col: any) => col.leads.reduce((acc: number, l: Lead) => acc + (Number(l.customFields?.budget) || 0), 0);
</script>

<template>
  <div class="flex flex-col gap-4">
    <MoveStageModal
        v-model:visible="showLost"
        :lead-id="pendingLost?.lead.id"
        :preset-stage-id="pendingLost?.stageId"
        @moved="pendingLost = null; refresh()"
        @cancel="onLostCancel"
    />

    <Box>
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <MainTitle title="sidebar.pipeline" />
        <div class="flex flex-wrap items-center gap-2">
          <div class="flex items-center gap-2 h-9 px-3 rounded border border-line bg-white focus-within:border-primary-700">
            <Icon icon="lucide:search" class="w-4 h-4 text-neural-300" />
            <input v-model="search" type="search" class="bg-transparent border-0 p-0 text-sm text-black focus:outline-none focus:ring-0 w-44" :placeholder="t('leads.searchPlaceholder')" :aria-label="t('buttons.search')" />
          </div>
          <select v-if="can(P.leadsViewAll)" v-model="ownerId" class="h-9 rounded border border-line bg-white px-2 text-sm text-black" :aria-label="t('fields.owner')">
            <option value="">{{ t("pipeline.allOwners") }}</option>
            <option value="unassigned">{{ t("leads.unassigned") }}</option>
            <option v-for="m in memberOptions" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
          <router-link :to="{ name: 'leads' }" class="details-btn-light inline-flex items-center gap-2"><Icon icon="lucide:table" class="w-4 h-4" />{{ t("pipeline.tableView") }}</router-link>
        </div>
      </div>
      <p v-if="!canMove" class="text-xs text-neural-300 mt-2">{{ t("pipeline.readOnly") }}</p>
    </Box>

    <div v-if="isLoading" class="py-20"><SpinnerLoading /></div>
    <Box v-else-if="isError" class="text-center py-10 text-sm text-neural-300">
      {{ t("messages.loadFailed") }} <button type="button" class="text-primary-700 font-medium" @click="refetch()">{{ t("buttons.retry") }}</button>
    </Box>

    <div v-else class="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x" role="list" :aria-label="t('sidebar.pipeline')">
      <section
          v-for="col in columns"
          :key="col.id"
          role="listitem"
          class="snap-start shrink-0 w-[78vw] sm:w-72 bg-gray-300 rounded border border-line flex flex-col max-h-[calc(100vh-15rem)]"
      >
        <header class="px-3 py-2.5 border-b border-line bg-white rounded-t" :style="{ borderTop: `3px solid ${col.color}` }">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-semibold text-heading">{{ col.name }}</h2>
            <span class="text-xs px-2 py-0.5 rounded-full bg-neural-100 text-neural-400 tabular-nums">{{ total(col) }}</span>
          </div>
          <p v-if="sum(col)" class="text-[11px] text-neural-300 mt-0.5">{{ t("pipeline.budgetSum") }}: {{ formatMoney(sum(col), auth.organization?.currency) }}</p>
        </header>

        <draggable
            :list="col.leads"
            item-key="id"
            group="pipeline"
            :disabled="!canMove"
            :animation="180"
            ghost-class="opacity-40"
            class="flex-1 overflow-y-auto p-2 flex flex-col gap-2 min-h-[6rem]"
            @change="(evt: any) => onChange(col, evt)"
        >
          <template #item="{ element: lead }">
            <article
                class="bg-white rounded border border-line p-3 cursor-pointer hover:border-primary-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-300"
                :class="{ 'cursor-grab active:cursor-grabbing': canMove }"
                tabindex="0"
                @click="router.push({ name: 'leadDetails', params: { id: lead.id } })"
                @keydown.enter="router.push({ name: 'leadDetails', params: { id: lead.id } })"
            >
              <div class="flex items-start justify-between gap-2">
                <p class="text-sm font-semibold text-heading line-clamp-2">{{ lead.name }}</p>
                <StatusBadge :status="lead.priority" />
              </div>
              <p class="text-xs text-neural-300 mt-1 truncate">{{ lead.source?.name ?? "—" }}<span v-if="lead.customFields?.area"> · {{ lead.customFields.area }}</span></p>
              <p v-if="lead.customFields?.budget" class="text-xs text-neural-400 mt-0.5">{{ formatMoney(lead.customFields.budget, auth.organization?.currency) }}</p>
              <div class="flex items-center justify-between mt-2 pt-2 border-t border-line">
                <span class="flex items-center gap-1.5 text-xs text-neural-400 min-w-0">
                  <UserAvatar :name="lead.owner?.name" size="xs" />
                  <span class="truncate">{{ lead.owner?.name ?? t("leads.unassigned") }}</span>
                </span>
                <span v-if="lead.nextFollowUpAt" class="text-[11px] shrink-0" :class="isOverdue(lead.nextFollowUpAt) ? 'text-errors-100 font-medium' : 'text-neural-300'">
                  <Icon icon="lucide:clock" class="inline w-3 h-3 -mt-0.5" /> {{ fromNow(lead.nextFollowUpAt) }}
                </span>
              </div>
            </article>
          </template>
          <template #footer>
            <p v-if="!col.leads.length" class="text-xs text-neural-300 text-center py-6">{{ t("pipeline.emptyColumn") }}</p>
            <p v-else-if="col.total > col.leads.length" class="text-xs text-neural-300 text-center py-2">
              {{ t("pipeline.moreInTable", { count: col.total - col.leads.length }) }}
            </p>
          </template>
        </draggable>
      </section>
    </div>
  </div>
</template>
