<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useForm } from "vee-validate";
import { useRoute, useRouter } from "vue-router";
import MainDataTable from "@/components/table/MainDataTable.vue";
import MainModal from "@/components/UI/modals/MainModal.vue";
import StatusBadge from "@/components/UI/StatusBadge.vue";
import UserAvatar from "@/components/UI/UserAvatar.vue";
import RoundedButton from "@/components/buttons/RoundedButton.vue";
import SelectBox from "@/components/form/SelectBox.vue";
import DatePickerField from "@/components/form/DatePickerField.vue";
import { Icon } from "@iconify/vue";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import { useAuthorization } from "@/composables/useAuthorization.ts";
import { useActiveMembers, useOptions, useSources, useStages, useTags } from "@/composables/useLookups.ts";
import { changeDateFormat, fromNow, isOverdue } from "@/utils";
import { P } from "@/config/permissions";
import { PRIORITIES } from "@/constants/lead";
import useLeadsFields from "@/modules/leads/composables/useLeadsFields.ts";
import LeadForm from "@/modules/leads/components/LeadForm.vue";
import LeadImportModal from "@/modules/leads/components/LeadImportModal.vue";
import BulkActionsBar from "@/modules/leads/components/BulkActionsBar.vue";
import { apiExportLeads, apiLeads } from "@/modules/leads/api";

const { t } = useLocaleSettings();
const { can } = useAuthorization();
const router = useRouter();
const route = useRoute();
const { fields } = useLeadsFields();

const { stages, stageOptions } = useStages();
const { sourceOptions } = useSources();
const { memberOptions } = useActiveMembers();
const { tags } = useTags();
const priorityOptions = useOptions("priority", PRIORITIES);
const ownerOptions = computed(() => [{ id: "unassigned", name: t("leads.unassigned") }, ...memberOptions.value]);
const tagOptions = computed(() => tags.value.map((x) => ({ id: x, name: x })));

// Filters survive navigating to a lead and back (sessionStorage, per browser tab)
const STORAGE_KEY = "leadflow.leads.filters";
const emptyFilters = { stageId: [], sourceId: [], ownerId: null, priority: [], tag: null, createdFrom: null, createdTo: null, uncontacted: false, needsReview: false };
const restore = () => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
    return saved ? { ...emptyFilters, ...saved, createdFrom: saved.createdFrom ? new Date(saved.createdFrom) : null, createdTo: saved.createdTo ? new Date(saved.createdTo) : null } : { ...emptyFilters };
  } catch {
    return { ...emptyFilters };
  }
};

const { values, resetForm, setFieldValue } = useForm<any>({ initialValues: restore() });

// deep links from the dashboard: /leads?uncontacted=1 or ?needsReview=1
if (route.query.uncontacted === "1") setFieldValue("uncontacted", true);
if (route.query.needsReview === "1") setFieldValue("needsReview", true);

watch(values, (v) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  } catch {
    /* storage unavailable: filters just won't persist */
  }
}, { deep: true });

const filters = computed(() => ({
  stageId: values.stageId,
  // the backend filters stages by key (`status=new,contacted`); the mock by id
  stageKey: (values.stageId ?? []).map((id: string) => stages.value.find((s) => s.id === id)?.key).filter(Boolean),
  sourceId: values.sourceId,
  ownerId: values.ownerId,
  priority: values.priority,
  tag: values.tag,
  createdFrom: values.createdFrom,
  createdTo: values.createdTo,
  uncontacted: values.uncontacted || null,
  needsReview: values.needsReview || null,
}));

const clearFilters = () => resetForm({ values: { ...emptyFilters } });

const selected = ref<string[]>([]);
const showCreate = ref(false);
const showImport = ref(false);

const openLead = (lead: any) => router.push({ name: "leadDetails", params: { id: lead.id } });
</script>

<template>
  <div>
    <MainModal v-model:visible="showCreate" header-title="leads.newLead" position="right" width="min(44rem, 100vw)">
      <LeadForm v-if="showCreate" @saved="(lead) => { showCreate = false; openLead(lead) }" @close="showCreate = false" />
    </MainModal>
    <LeadImportModal v-model:visible="showImport" />

    <BulkActionsBar v-if="selected.length" :ids="selected" @done="selected = []" @clear="selected = []" />

    <MainDataTable
        v-model:selected="selected"
        title="sidebar.leads"
        :columns="fields"
        list-url="leads"
        :fetcher="apiLeads"
        :exporter="apiExportLeads"
        :filters="filters"
        :selectable="can(P.leadsUpdate, P.leadsAssign, P.leadsDelete)"
        :has-export-btn="can(P.leadsExport)"
        :show-add-btn="can(P.leadsCreate)"
        action-btn-title="buttons.addLead"
        :search-placeholder="t('leads.searchPlaceholder')"
        :empty-text="t('leads.empty')"
        row-clickable
        @row-click="openLead"
        @add-action-btn="showCreate = true"
        @reset-filters="clearFilters"
    >
      <template #tableBtns>
        <RoundedButton v-if="can(P.leadsImport)" v-tooltip="t('buttons.importCsv')" :aria-label="t('buttons.importCsv')" @action="showImport = true">
          <Icon icon="lucide:upload" class="w-4 h-4" />
        </RoundedButton>
      </template>

      <template #filters>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4">
          <SelectBox name="stageId" :label="t('fields.stage')" :static-options="stageOptions" option-label="name" option-value="id" :placeholder="t('fields.all')" />
          <SelectBox name="sourceId" :label="t('fields.source')" :static-options="sourceOptions" option-label="name" option-value="id" :placeholder="t('fields.all')" />
          <SelectBox v-if="can(P.leadsViewAll)" name="ownerId" :label="t('fields.owner')" :multi="false" :static-options="ownerOptions" option-label="name" option-value="id" filter :placeholder="t('fields.all')" />
          <SelectBox name="priority" :label="t('fields.priority')" :static-options="priorityOptions" option-label="name" option-value="id" :placeholder="t('fields.all')" />
          <SelectBox name="tag" :label="t('fields.tag')" :multi="false" :static-options="tagOptions" option-label="name" option-value="id" filter :placeholder="t('fields.all')" />
          <DatePickerField name="createdFrom" :label="t('fields.createdFrom')" :placeholder="t('fields.selectDate')" />
          <DatePickerField name="createdTo" :label="t('fields.createdTo')" :placeholder="t('fields.selectDate')" />
          <div class="flex flex-col justify-center gap-2 pb-6">
            <label class="flex items-center gap-2 text-sm text-neural-400 cursor-pointer">
              <input type="checkbox" class="w-4 h-4 accent-primary-700" :checked="values.uncontacted" @change="setFieldValue('uncontacted', ($event.target as HTMLInputElement).checked)" />
              {{ t("leads.onlyUncontacted") }}
            </label>
            <label class="flex items-center gap-2 text-sm text-neural-400 cursor-pointer">
              <input type="checkbox" class="w-4 h-4 accent-primary-700" :checked="values.needsReview" @change="setFieldValue('needsReview', ($event.target as HTMLInputElement).checked)" />
              {{ t("leads.onlyNeedsReview") }}
            </label>
          </div>
        </div>
      </template>

      <template #name="lead">
        <div class="flex items-center gap-3 min-w-0">
          <UserAvatar :name="lead.name" size="sm" />
          <div class="min-w-0">
            <p class="text-sm font-semibold text-heading truncate flex items-center gap-1.5">
              {{ lead.name }}
              <Icon v-if="lead.needsReview" v-tooltip="t('leads.needsReview')" icon="lucide:circle-alert" class="w-3.5 h-3.5 text-[#B58500]" />
              <Icon v-if="lead.doNotContact" v-tooltip="t('leads.doNotContact')" icon="lucide:ban" class="w-3.5 h-3.5 text-errors-100" />
            </p>
            <p class="text-xs text-neural-300 truncate" dir="ltr">{{ lead.phone || lead.email }}</p>
          </div>
        </div>
      </template>
      <template #stage="lead">
        <span class="inline-flex items-center gap-1.5 text-sm text-neural-400">
          <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: lead.stage?.color }" />{{ lead.stage?.name }}
        </span>
      </template>
      <template #owner="lead">
        <span v-if="lead.owner" class="text-sm text-neural-400">{{ lead.owner.name }}</span>
        <span v-else class="text-xs px-2 py-0.5 rounded bg-[#FFF9E9] text-[#8A6700]">{{ t("leads.unassigned") }}</span>
      </template>
      <template #source="lead"><span class="text-sm text-neural-300">{{ lead.source?.name ?? "—" }}</span></template>
      <template #priority="lead"><StatusBadge :status="lead.priority" /></template>
      <template #nextFollowUpAt="lead">
        <span v-if="lead.nextFollowUpAt" class="text-sm" :class="isOverdue(lead.nextFollowUpAt) ? 'text-errors-100 font-medium' : 'text-neural-300'" v-tooltip="changeDateFormat(lead.nextFollowUpAt)">
          {{ fromNow(lead.nextFollowUpAt) }}
        </span>
        <span v-else class="text-sm text-neural-200">—</span>
      </template>
      <template #lastContactedAt="lead">
        <span class="text-sm" :class="lead.lastContactedAt ? 'text-neural-300' : 'text-[#B58500]'">{{ lead.lastContactedAt ? fromNow(lead.lastContactedAt) : t("leads.neverContacted") }}</span>
      </template>
      <template #createdAt="lead"><span class="text-sm text-neural-300" v-tooltip="changeDateFormat(lead.createdAt)">{{ fromNow(lead.createdAt) }}</span></template>
    </MainDataTable>
  </div>
</template>
