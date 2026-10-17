<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useQueryClient } from "@tanstack/vue-query";
import { toast } from "vue3-toastify";
import MainModal from "@/components/UI/modals/MainModal.vue";
import MainButton from "@/components/buttons/MainButton.vue";
import StatusBadge from "@/components/UI/StatusBadge.vue";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import { parseCsv } from "@/utils";
import { IMPORT_FIELDS } from "@/constants/lead";
import type { ImportJob, ImportPreviewRow } from "@/types/domain";
import { useCustomFields } from "@/composables/useLookups.ts";
import { apiImportCancel, apiImportCommit, apiImportPreview } from "@/modules/leads/api";

// CSV import in four steps: upload → map columns → server-side preview → import.
// Nothing is written until the user confirms the preview (PRD 3.2).
const visible = defineModel<boolean>("visible", { default: false });
const { t } = useLocaleSettings();
const queryClient = useQueryClient();

type Step = "upload" | "map" | "preview" | "done";
const step = ref<Step>("upload");
const file = ref<File | null>(null);
// the backend parses the upload and keeps a preview record until commit/cancel
const importId = ref<string | undefined>(undefined);
const { fields: customFieldDefs } = useCustomFields();
const mappableFields = computed(() => [
  ...IMPORT_FIELDS.map((f) => ({ id: f as string, name: t(`fields.${f}`) })),
  ...customFieldDefs.value.filter((f) => f.label).map((f) => ({ id: `custom:${f.key}`, name: f.label })),
]);
const fileName = ref("");
const columns = ref<string[]>([]);
const rows = ref<Record<string, string>[]>([]);
const mapping = ref<Record<string, string>>({});
const preview = ref<{ totals: any; rows: ImportPreviewRow[] } | null>(null);
const duplicatePolicy = ref<"skip" | "merge">("skip");
const result = ref<ImportJob | null>(null);
const busy = ref(false);
const fileError = ref("");
const previewFilter = ref<"all" | "duplicate" | "invalid">("all");

watch(visible, (open) => {
  if (!open) {
    // closing before importing discards the server-side preview
    if (importId.value && step.value === "preview") apiImportCancel(importId.value).catch(() => null);
    return;
  }
  step.value = "upload";
  file.value = null;
  importId.value = undefined;
  fileName.value = "";
  columns.value = [];
  rows.value = [];
  mapping.value = {};
  preview.value = null;
  result.value = null;
  fileError.value = "";
});

// guess the lead field from common header names (English + Arabic)
const GUESS: Record<string, RegExp> = {
  name: /^(full ?name|name|الاسم|اسم)/i,
  email: /e-?mail|البريد/i,
  phone: /phone|mobile|tel|whats|الهاتف|موبايل|رقم/i,
  company: /company|الشركة/i,
  source: /source|المصدر/i,
  campaign: /campaign|الحملة/i,
  priority: /priority|الأولوية/i,
  tags: /tags?|التصنيف/i,
  message: /message|notes?|comment|الرسالة|ملاحظات/i,
};

const onFile = async (e: Event) => {
  fileError.value = "";
  const picked = (e.target as HTMLInputElement).files?.[0];
  if (!picked) return;
  if (!/\.csv$/i.test(picked.name)) return (fileError.value = t("import.onlyCsv"));
  if (picked.size > 5 * 1024 * 1024) return (fileError.value = t("import.tooLarge"));
  // parsed locally only to show the headers for mapping; the API re-parses the original file
  const parsed = parseCsv(await picked.text());
  if (!parsed.rows.length) return (fileError.value = t("import.empty"));
  if (parsed.rows.length > 5000) return (fileError.value = t("import.tooManyRows"));
  file.value = picked;
  fileName.value = picked.name;
  columns.value = parsed.columns;
  rows.value = parsed.rows;
  mapping.value = Object.fromEntries(
      parsed.columns.map((c) => [c, Object.entries(GUESS).find(([, re]) => re.test(c))?.[0] ?? ""])
  );
  step.value = "map";
};

const mappedFields = computed(() => Object.values(mapping.value).filter(Boolean));
// preview rows may be keyed by field (name, phone) or by the original CSV header
const cell = (values: Record<string, string>, field: string) => {
  const header = Object.keys(mapping.value).find((h) => mapping.value[h] === field);
  return values[field] || (header ? values[header] : "") || "";
};

const mappingError = computed(() => {
  if (!mappedFields.value.includes("name")) return t("import.mapName");
  if (!mappedFields.value.includes("phone") && !mappedFields.value.includes("email")) return t("import.mapContact");
  if (new Set(mappedFields.value).size !== mappedFields.value.length) return t("import.mapDuplicateField");
  return "";
});

const runPreview = async () => {
  if (mappingError.value) return;
  busy.value = true;
  try {
    if (importId.value) apiImportCancel(importId.value).catch(() => null);
    const res = await apiImportPreview({ file: file.value!, rows: rows.value, mapping: mapping.value });
    importId.value = res.importId;
    preview.value = res.data;
    step.value = "preview";
  } finally {
    busy.value = false;
  }
};

const visiblePreviewRows = computed(() =>
    (preview.value?.rows ?? []).filter((r) => previewFilter.value === "all" || r.status === previewFilter.value)
);

const commit = async () => {
  busy.value = true;
  try {
    const res = await apiImportCommit({ importId: importId.value, rows: rows.value, mapping: mapping.value, duplicatePolicy: duplicatePolicy.value, fileName: fileName.value });
    result.value = res.data;
    step.value = "done";
    ["leads", "pipeline", "dashboard", "tags"].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
    toast.success(t("import.finished"));
  } finally {
    busy.value = false;
  }
};

const downloadTemplate = () => {
  const csv = "name,phone,email,company,source,campaign,priority,tags,message\nAhmed Hassan,+201001234567,ahmed@example.com,,Website,Summer Launch,high,investor|vip,Looking for an apartment in New Cairo\n";
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.download = "leadflow-import-template.csv";
  link.click();
};
</script>

<template>
  <MainModal v-model:visible="visible" header-title="import.title" width="min(56rem, 95vw)">
    <ol class="flex items-center gap-2 text-xs mb-5" :aria-label="t('import.steps')">
      <li v-for="(s, i) in ['upload', 'map', 'preview', 'done']" :key="s" class="flex items-center gap-2">
        <span class="w-6 h-6 rounded-full flex items-center justify-center font-semibold" :class="step === s ? 'bg-primary-700 text-[#fff]' : 'bg-neural-100 text-neural-300'">{{ i + 1 }}</span>
        <span :class="step === s ? 'text-heading font-semibold' : 'text-neural-300'">{{ t(`import.step.${s}`) }}</span>
        <span v-if="i < 3" class="w-6 h-px bg-line" />
      </li>
    </ol>

    <!-- 1. upload -->
    <div v-if="step === 'upload'" class="flex flex-col gap-4">
      <p class="text-sm text-neural-300">{{ t("import.hint") }}</p>
      <label class="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-line rounded p-10 cursor-pointer hover:border-primary-300 hover:bg-primary-20 text-center">
        <span class="text-sm font-medium text-heading">{{ t("import.chooseFile") }}</span>
        <span class="text-xs text-neural-300">{{ t("import.limits") }}</span>
        <input type="file" accept=".csv,text/csv" class="sr-only" @change="onFile" />
      </label>
      <p v-if="fileError" class="text-sm text-errors-100" role="alert">{{ fileError }}</p>
      <button type="button" class="self-start text-sm text-primary-700 font-medium" @click="downloadTemplate">{{ t("buttons.downloadTemplate") }}</button>
    </div>

    <!-- 2. mapping -->
    <div v-else-if="step === 'map'" class="flex flex-col gap-4">
      <p class="text-sm text-neural-300">{{ t("import.mapHint", { file: fileName, rows: rows.length }) }}</p>
      <div class="border border-line rounded divide-y divide-line max-h-[50vh] overflow-y-auto">
        <div v-for="col in columns" :key="col" class="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1.2fr] gap-3 items-center px-3 py-2">
          <span class="text-sm font-medium text-heading truncate">{{ col }}</span>
          <span class="text-xs text-neural-300 truncate">{{ rows[0]?.[col] || "—" }}</span>
          <select v-model="mapping[col]" class="h-9 rounded border border-line bg-white px-2 text-sm text-black" :aria-label="t('import.mapColumn', { column: col })">
            <option value="">{{ t("import.skipColumn") }}</option>
            <option v-for="f in mappableFields" :key="f.id" :value="f.id">{{ f.name }}</option>
          </select>
        </div>
      </div>
      <p v-if="mappingError" class="text-sm text-errors-100" role="alert">{{ mappingError }}</p>
      <div class="flex justify-between gap-3 pt-3 border-t border-line">
        <button type="button" class="details-btn-light" @click="step = 'upload'">{{ t("buttons.back") }}</button>
        <MainButton text="import.validate" :loading="busy" :disabled="!!mappingError" @action="runPreview" />
      </div>
    </div>

    <!-- 3. preview -->
    <div v-else-if="step === 'preview' && preview" class="flex flex-col gap-4">
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="rounded border border-line p-3"><p class="text-xs text-neural-300">{{ t("import.totalRows") }}</p><p class="text-xl font-bold text-heading">{{ preview.totals.rows }}</p></div>
        <div class="rounded border border-line p-3"><p class="text-xs text-neural-300">{{ t("status.valid") }}</p><p class="text-xl font-bold text-[#03894A]">{{ preview.totals.valid }}</p></div>
        <div class="rounded border border-line p-3"><p class="text-xs text-neural-300">{{ t("status.duplicate") }}</p><p class="text-xl font-bold text-[#B58500]">{{ preview.totals.duplicate }}</p></div>
        <div class="rounded border border-line p-3"><p class="text-xs text-neural-300">{{ t("status.invalid") }}</p><p class="text-xl font-bold text-errors-100">{{ preview.totals.invalid }}</p></div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex gap-2 text-sm">
          <button v-for="f in ['all', 'duplicate', 'invalid']" :key="f" type="button" class="px-3 h-8 rounded border" :class="previewFilter === f ? 'border-primary-700 text-primary-700 bg-primary-50' : 'border-line text-neural-400'" @click="previewFilter = f as any">
            {{ f === "all" ? t("import.allRows") : t(`status.${f}`) }}
          </button>
        </div>
        <label v-if="preview.totals.duplicate" class="flex items-center gap-2 text-sm text-neural-400">
          {{ t("import.duplicates") }}
          <select v-model="duplicatePolicy" class="h-8 rounded border border-line bg-white px-2 text-sm text-black">
            <option value="skip">{{ t("import.policySkip") }}</option>
            <option value="merge">{{ t("import.policyMerge") }}</option>
          </select>
        </label>
      </div>

      <div class="border border-line rounded max-h-[40vh] overflow-auto">
        <table class="w-full text-sm">
          <thead class="bg-tableHeader sticky top-0">
            <tr>
              <th class="text-start px-3 py-2">{{ t("fields.row") }}</th>
              <th class="text-start px-3 py-2">{{ t("fields.name") }}</th>
              <th class="text-start px-3 py-2">{{ t("fields.contact") }}</th>
              <th class="text-start px-3 py-2">{{ t("fields.status") }}</th>
              <th class="text-start px-3 py-2">{{ t("fields.details") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in visiblePreviewRows" :key="r.row" class="border-t border-line">
              <td class="px-3 py-1.5 text-neural-300">{{ r.row }}</td>
              <td class="px-3 py-1.5 text-black">{{ cell(r.values, "name") || "—" }}</td>
              <td class="px-3 py-1.5 text-neural-300" dir="ltr">{{ cell(r.values, "phone") || cell(r.values, "email") || "—" }}</td>
              <td class="px-3 py-1.5"><StatusBadge :status="r.status" /></td>
              <td class="px-3 py-1.5 text-xs text-neural-400">{{ r.errors.join("; ") || (r.duplicateOf ? t("import.duplicateOf", { name: r.duplicateOf.name }) : "") }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="preview.totals.rows > preview.rows.length" class="text-xs text-neural-300">{{ t("import.previewTruncated", { count: preview.rows.length }) }}</p>

      <div class="flex justify-between gap-3 pt-3 border-t border-line">
        <button type="button" class="details-btn-light" @click="step = 'map'">{{ t("buttons.back") }}</button>
        <MainButton
            :text="t('import.importRows', { count: preview.totals.valid + (duplicatePolicy === 'merge' ? preview.totals.duplicate : 0) })"
            :loading="busy"
            :disabled="!preview.totals.valid && duplicatePolicy === 'skip'"
            @action="commit"
        />
      </div>
    </div>

    <!-- 4. result -->
    <div v-else-if="step === 'done' && result" class="flex flex-col gap-4">
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="rounded border border-line p-3"><p class="text-xs text-neural-300">{{ t("import.created") }}</p><p class="text-xl font-bold text-[#03894A]">{{ result.created }}</p></div>
        <div class="rounded border border-line p-3"><p class="text-xs text-neural-300">{{ t("import.updated") }}</p><p class="text-xl font-bold text-heading">{{ result.updated }}</p></div>
        <div class="rounded border border-line p-3"><p class="text-xs text-neural-300">{{ t("import.skipped") }}</p><p class="text-xl font-bold text-[#B58500]">{{ result.skipped }}</p></div>
        <div class="rounded border border-line p-3"><p class="text-xs text-neural-300">{{ t("import.failed") }}</p><p class="text-xl font-bold text-errors-100">{{ result.failed.length }}</p></div>
      </div>
      <div v-if="result.failed.length" class="border border-errors-100/30 rounded max-h-48 overflow-y-auto">
        <p class="px-3 py-2 text-sm font-medium bg-errors-100/10 text-errors-100">{{ t("import.failedRows") }}</p>
        <p v-for="f in result.failed" :key="f.row" class="px-3 py-1.5 text-sm border-t border-line"><span class="text-neural-300">{{ t("fields.row") }} {{ f.row }}:</span> {{ f.message }}</p>
      </div>
      <div class="flex justify-end pt-3 border-t border-line">
        <MainButton text="buttons.done" @action="visible = false" />
      </div>
    </div>
  </MainModal>
</template>
