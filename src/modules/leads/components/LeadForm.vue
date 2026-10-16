<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useForm } from "vee-validate";
import * as yup from "yup";
import { toast } from "vue3-toastify";
import { useRouter } from "vue-router";
import InputTextField from "@/components/form/InputTextField.vue";
import SelectBox from "@/components/form/SelectBox.vue";
import TextAreaField from "@/components/form/TextAreaField.vue";
import TagsInput from "@/components/form/TagsInput.vue";
import MainButton from "@/components/buttons/MainButton.vue";
import useMutate from "@/composables/useMutate";
import { newId } from "@/InterceptorHelper";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import { useAuthorization } from "@/composables/useAuthorization.ts";
import { useActiveMembers, useOptions, useSources, useStages, useTags } from "@/composables/useLookups.ts";
import { useAuthStore } from "@/store/auth.ts";
import { P } from "@/config/permissions";
import { CUSTOM_FIELDS_BY_INDUSTRY, PRIORITIES } from "@/constants/lead";
import type { DuplicateMatch, Lead } from "@/types/domain";
import { apiCheckDuplicates, apiCreateLead, apiUpdateLead } from "@/modules/leads/api";

const props = defineProps<{ lead?: Lead | null }>();
const emit = defineEmits<{ (e: "saved", lead: Lead): void; (e: "close"): void }>();

const { t } = useLocaleSettings();
const { can } = useAuthorization();
const router = useRouter();
const auth = useAuthStore();
const isEdit = computed(() => !!props.lead);

const { sourceOptions } = useSources();
const { stageOptions } = useStages();
const { memberOptions } = useActiveMembers();
const { tags: tagSuggestions } = useTags();
const priorityOptions = useOptions("priority", PRIORITIES);
const customFields = computed(() => CUSTOM_FIELDS_BY_INDUSTRY[auth.organization?.industry ?? "other"] ?? []);

const phoneOrEmail = (other: string) =>
    yup.string().trim().nullable().test("contact", t("validations.phoneOrEmail"), function (v) {
      return !!v || !!this.parent[other];
    });

const schema = computed(() =>
    yup.object({
      name: yup.string().trim().required(t("validations.required", { field: t("fields.name") })).max(120),
      phone: phoneOrEmail("email").matches(/^[+\d\s()-]{0,20}$/, { message: t("validations.phone"), excludeEmptyString: true }),
      email: phoneOrEmail("phone").email(t("validations.email")),
      company: yup.string().trim().nullable(),
      sourceId: yup.string().nullable(),
      campaign: yup.string().trim().nullable(),
      priority: yup.string().required(),
      message: yup.string().trim().nullable().max(5000),
    })
);

const initial = () => {
  const l = props.lead;
  return {
    name: l?.name ?? "",
    phone: l?.phone ?? "",
    email: l?.email ?? "",
    company: l?.company ?? "",
    sourceId: l?.source?.id ?? null,
    campaign: l?.campaign ?? "",
    stageId: l?.stage?.id ?? null,
    ownerId: l?.owner?.id ?? null,
    priority: l?.priority ?? "medium",
    tags: l?.tags ?? [],
    message: l?.message ?? "",
    customFields: { ...(l?.customFields ?? {}) },
  };
};

const { handleSubmit, values, resetForm, setFieldError } = useForm<any>({ validationSchema: schema, initialValues: initial() });

/* ---------- duplicate detection while typing ---------- */
const duplicates = ref<DuplicateMatch[]>([]);
let timer: any;
watch(
    () => [values.email, values.phone],
    ([email, phone]) => {
      clearTimeout(timer);
      if (!email && !phone) return (duplicates.value = []);
      timer = setTimeout(async () => {
        try {
          const res = await apiCheckDuplicates({ email, phone, excludeId: props.lead?.id });
          duplicates.value = res.data;
        } catch {
          duplicates.value = [];
        }
      }, 450);
    }
);

/* ---------- save ---------- */
const idempotencyKey = ref(newId());
const { mutate, isPending } = useMutate({
  mutationKey: ["save-lead"],
  queryKey: ["leads"],
  mutationFn: (payload: any) => (isEdit.value ? apiUpdateLead(props.lead!.id, payload) : apiCreateLead(payload, idempotencyKey.value)),
});

const clean = (v: any) => (v === "" ? null : v);

const onSubmit = handleSubmit((vals: any) => {
  const payload: Record<string, any> = {
    name: vals.name.trim(),
    phone: clean(vals.phone),
    email: clean(vals.email?.toLowerCase()),
    company: clean(vals.company),
    sourceId: clean(vals.sourceId),
    campaign: clean(vals.campaign),
    priority: vals.priority,
    tags: vals.tags ?? [],
    message: clean(vals.message),
    customFields: Object.fromEntries(
        customFields.value.map((f) => [f.key, vals.customFields?.[f.key] === "" || vals.customFields?.[f.key] === undefined ? null : f.type === "number" ? Number(vals.customFields[f.key]) : vals.customFields[f.key]])
    ),
  };
  if (!isEdit.value && vals.stageId) payload.stageId = vals.stageId;
  if (can(P.leadsAssign) && (!isEdit.value || vals.ownerId !== props.lead?.owner?.id)) payload.ownerId = clean(vals.ownerId);

  mutate(payload, {
    onSuccess: (res: any) => {
      toast.success(res?.message || t("messages.saved"));
      idempotencyKey.value = newId();
      resetForm({ values: initial() });
      emit("saved", res.data);
    },
    onError: (err: any) => {
      const details = err?.error?.details;
      if (details && !Array.isArray(details)) Object.entries(details).forEach(([k, v]) => setFieldError(k, (v as string[])[0]));
    },
  });
});
</script>

<template>
  <form class="grid grid-cols-1 md:grid-cols-2 items-start gap-x-4 w-full" novalidate @submit.prevent="onSubmit">
    <div class="md:col-span-2">
      <InputTextField name="name" :label="t('fields.name')" :placeholder="t('fields.enterName')" required />
    </div>
    <InputTextField name="phone" type="tel" :label="t('fields.phone')" :placeholder="t('fields.phonePlaceholder')" />
    <InputTextField name="email" type="email" :label="t('fields.email')" :placeholder="t('fields.enterEmail')" />

    <div v-if="duplicates.length" class="md:col-span-2 mb-4 rounded border border-[#E0A800]/40 bg-[#FFF9E9] p-3 text-sm" role="status">
      <p class="font-semibold text-[#8A6700]">{{ t("leads.possibleDuplicate") }}</p>
      <p class="text-xs text-[#8A6700] mb-2">{{ t("leads.duplicatePolicyHint") }}</p>
      <ul class="flex flex-col gap-1">
        <li v-for="d in duplicates" :key="d.lead.id ?? d.lead.name" class="flex items-center justify-between gap-2">
          <span class="text-black truncate">{{ d.lead.name }} <span class="text-xs text-neural-300">({{ d.matchedOn.map((m) => t(`fields.${m}`)).join(", ") }})</span></span>
          <button v-if="d.lead.id" type="button" class="text-xs text-primary-700 font-medium shrink-0" @click="emit('close'); router.push({ name: 'leadDetails', params: { id: d.lead.id } })">
            {{ t("buttons.open") }}
          </button>
        </li>
      </ul>
    </div>

    <InputTextField name="company" :label="t('fields.company')" :placeholder="t('fields.optional')" />
    <SelectBox name="sourceId" :label="t('fields.source')" :multi="false" :static-options="sourceOptions" option-label="name" option-value="id" :placeholder="t('fields.select')" />
    <InputTextField name="campaign" :label="t('fields.campaign')" :placeholder="t('fields.optional')" />
    <SelectBox name="priority" :label="t('fields.priority')" :multi="false" :static-options="priorityOptions" option-label="name" option-value="id" :placeholder="t('fields.select')" required />
    <SelectBox v-if="!isEdit" name="stageId" :label="t('fields.stage')" :multi="false" :static-options="stageOptions" option-label="name" option-value="id" :placeholder="t('leads.defaultStage')" />
    <SelectBox
        v-if="can(P.leadsAssign)"
        name="ownerId"
        :label="t('fields.owner')"
        :multi="false"
        :static-options="memberOptions"
        option-label="name"
        option-value="id"
        filter
        :placeholder="isEdit ? t('leads.unassigned') : t('leads.autoAssign')"
    />

    <div class="md:col-span-2">
      <TagsInput name="tags" :label="t('fields.tags')" :placeholder="t('fields.tagsPlaceholder')" :suggestions="tagSuggestions" />
    </div>

    <template v-if="customFields.length">
      <p class="md:col-span-2 text-sm font-semibold text-heading border-t border-line pt-4 mb-3">
        {{ t("leads.industryDetails") }} <span class="font-normal text-xs text-neural-300">({{ t("fields.optional") }})</span>
      </p>
      <InputTextField
          v-for="f in customFields"
          :key="f.key"
          :name="`customFields.${f.key}`"
          :type="f.type === 'number' ? 'number' : 'text'"
          :label="t(`customFields.${f.key}`)"
          :placeholder="t('fields.optional')"
      />
    </template>

    <div class="md:col-span-2">
      <TextAreaField name="message" :label="t('fields.message')" :placeholder="t('fields.messagePlaceholder')" :rows="3" />
    </div>

    <div class="md:col-span-2 flex justify-end gap-3 pt-2 border-t border-line">
      <button type="button" class="details-btn-light" @click="emit('close')">{{ t("buttons.cancel") }}</button>
      <MainButton type="submit" :text="isEdit ? 'buttons.save' : 'buttons.createLead'" :loading="isPending" />
    </div>
  </form>
</template>
