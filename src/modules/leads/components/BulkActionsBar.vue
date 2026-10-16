<script setup lang="ts">
import { ref } from "vue";
import { toast } from "vue3-toastify";
import { useQueryClient } from "@tanstack/vue-query";
import MainModal from "@/components/UI/modals/MainModal.vue";
import MainButton from "@/components/buttons/MainButton.vue";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import { useAuthorization } from "@/composables/useAuthorization.ts";
import { useActiveMembers } from "@/composables/useLookups.ts";
import { P } from "@/config/permissions";
import { apiBulkLeads } from "@/modules/leads/api";
import MoveStageModal from "@/modules/leads/components/MoveStageModal.vue";

const props = defineProps<{ ids: string[] }>();
const emit = defineEmits<{ (e: "done"): void; (e: "clear"): void }>();

const { t } = useLocaleSettings();
const { can } = useAuthorization();
const queryClient = useQueryClient();
const { memberOptions } = useActiveMembers();

const ownerId = ref<string>("");
const tagsText = ref("");
const showStage = ref(false);
const showTags = ref(false);
const showDelete = ref(false);
const busy = ref(false);

const run = async (action: "assign" | "add_tags" | "delete", extra: Record<string, any>) => {
  busy.value = true;
  try {
    const res = await apiBulkLeads({ ids: props.ids, action, ...extra });
    res.data.failed.length
        ? toast.warn(t("leads.bulkPartial", { ok: res.data.updated, failed: res.data.failed.length }))
        : toast.success(t("leads.bulkDone", { count: res.data.updated }));
    ["leads", "pipeline", "dashboard", "tags"].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
    showTags.value = showDelete.value = false;
    emit("done");
  } finally {
    busy.value = false;
  }
};

const assign = () => run("assign", { ownerId: ownerId.value === "__none" ? null : ownerId.value }).then(() => (ownerId.value = ""));
const addTags = () => run("add_tags", { tags: tagsText.value.split(",").map((s) => s.trim()).filter(Boolean) });
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 rounded border border-primary-200 bg-primary-50 px-3 py-2 mb-4" role="region" :aria-label="t('leads.bulkActions')">
    <span class="text-sm font-semibold text-primary-700 me-2">{{ t("leads.selectedCount", { count: ids.length }) }}</span>

    <template v-if="can(P.leadsAssign)">
      <select v-model="ownerId" class="h-8 rounded border border-line bg-white px-2 text-sm text-black" :aria-label="t('leads.assignTo')" @change="ownerId && assign()">
        <option value="">{{ t("leads.assignTo") }}…</option>
        <option value="__none">{{ t("leads.unassigned") }}</option>
        <option v-for="m in memberOptions" :key="m.id" :value="m.id">{{ m.name }}</option>
      </select>
    </template>
    <button v-if="can(P.leadsUpdate)" type="button" class="h-8 px-3 rounded border border-line bg-white text-sm text-neural-400 hover:text-primary-700" @click="showStage = true">{{ t("leads.changeStage") }}</button>
    <button v-if="can(P.leadsUpdate)" type="button" class="h-8 px-3 rounded border border-line bg-white text-sm text-neural-400 hover:text-primary-700" @click="showTags = true">{{ t("leads.addTags") }}</button>
    <button v-if="can(P.leadsDelete)" type="button" class="h-8 px-3 rounded border border-errors-100/40 bg-white text-sm text-errors-100 hover:bg-errors-100/10" @click="showDelete = true">{{ t("buttons.delete") }}</button>
    <button type="button" class="ms-auto text-sm text-neural-300 hover:text-primary-700" @click="emit('clear')">{{ t("buttons.clearSelection") }}</button>

    <MoveStageModal v-model:visible="showStage" :lead-ids="ids" @moved="emit('done')" />

    <MainModal v-model:visible="showTags" header-title="leads.addTags" width="28rem">
      <label class="text-sm font-medium text-heading" for="bulk-tags">{{ t("fields.tags") }}</label>
      <input id="bulk-tags" v-model="tagsText" class="mt-1.5 h-10 w-full rounded border border-line bg-white px-3 text-sm text-black" :placeholder="t('leads.tagsCommaHint')" />
      <div class="flex justify-end gap-3 pt-4">
        <button type="button" class="details-btn-light" @click="showTags = false">{{ t("buttons.cancel") }}</button>
        <MainButton text="buttons.apply" :loading="busy" :disabled="!tagsText.trim()" @action="addTags" />
      </div>
    </MainModal>

    <MainModal v-model:visible="showDelete" header-title="leads.deleteLeads" width="28rem">
      <p class="text-sm text-neural-400">{{ t("leads.deleteConfirm", { count: ids.length }) }}</p>
      <div class="flex justify-end gap-3 pt-4">
        <button type="button" class="details-btn-light" @click="showDelete = false">{{ t("buttons.cancel") }}</button>
        <MainButton text="buttons.delete" class="!bg-errors-100 !border-errors-100" :loading="busy" @action="run('delete', {})" />
      </div>
    </MainModal>
  </div>
</template>
