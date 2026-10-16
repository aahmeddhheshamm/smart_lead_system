<script setup lang="ts">
import { computed } from "vue";
import { useForm } from "vee-validate";
import * as yup from "yup";
import { toast } from "vue3-toastify";
import FormSection from "@/components/form/FormSection.vue";
import InputTextField from "@/components/form/InputTextField.vue";
import SelectBox from "@/components/form/SelectBox.vue";
import MainButton from "@/components/buttons/MainButton.vue";
import useMutate from "@/composables/useMutate";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import { useAuthorization } from "@/composables/useAuthorization.ts";
import { useAuthStore } from "@/store/auth.ts";
import { P } from "@/config/permissions";
import { CURRENCIES, INDUSTRIES, TIMEZONES } from "@/constants/lead";
import { apiUpdateOrganization } from "@/modules/settings/api";

const { t } = useLocaleSettings();
const { can } = useAuthorization();
const auth = useAuthStore();
const readonly = computed(() => !can(P.settingsManage));

const DAYS = [0, 1, 2, 3, 4, 5, 6];
const org = auth.organization!;
const schema = computed(() =>
    yup.object({
      name: yup.string().trim().required(t("validations.required", { field: t("fields.organizationName") })),
      start: yup.string().matches(/^\d{2}:\d{2}$/),
      end: yup.string().matches(/^\d{2}:\d{2}$/).test("after", t("validations.endAfterStart"), function (v) {
        return !v || !this.parent.start || v > this.parent.start;
      }),
    })
);
const { handleSubmit, values, setFieldValue } = useForm<any>({
  validationSchema: schema,
  initialValues: {
    name: org.name, industry: org.industry, timezone: org.timezone, locale: org.locale, currency: org.currency,
    start: org.businessHours.start, end: org.businessHours.end, days: [...org.businessHours.days],
  },
});

const industryOptions = computed(() => INDUSTRIES.map((id) => ({ id, name: t(`options.industry.${id}`) })));
const localeOptions = [{ id: "en", name: "English" }, { id: "ar", name: "العربية" }];
const tz = TIMEZONES.map((id) => ({ id, name: id }));
const currencies = CURRENCIES.map((id) => ({ id, name: id }));

const toggleDay = (d: number) => setFieldValue("days", values.days.includes(d) ? values.days.filter((x: number) => x !== d) : [...values.days, d].sort());

const { mutate, isPending } = useMutate({ mutationKey: ["org-update"], mutationFn: apiUpdateOrganization });
const onSubmit = handleSubmit((v: any) => {
  mutate(
      { name: v.name.trim(), industry: v.industry, timezone: v.timezone, locale: v.locale, currency: v.currency, businessHours: { start: v.start, end: v.end, days: v.days } },
      {
        onSuccess: (res) => {
          auth.organization = res.data;
          toast.success(t("messages.saved"));
        },
      }
  );
});
</script>

<template>
  <form class="flex flex-col gap-8 max-w-3xl" novalidate @submit.prevent="onSubmit">
    <FormSection :title="t('settings.organization')" :description="t('settings.organizationHint')">
      <div class="md:col-span-2"><InputTextField name="name" :label="t('fields.organizationName')" :placeholder="t('fields.enterOrganizationName')" :disabled="readonly" required /></div>
      <SelectBox name="industry" :label="t('fields.industry')" :multi="false" :static-options="industryOptions" option-label="name" option-value="id" :placeholder="t('fields.select')" :disabled="readonly" />
      <SelectBox name="currency" :label="t('fields.currency')" :multi="false" :static-options="currencies" option-label="name" option-value="id" :placeholder="t('fields.select')" :disabled="readonly" />
      <SelectBox name="timezone" :label="t('fields.timezone')" :multi="false" :static-options="tz" option-label="name" option-value="id" filter :placeholder="t('fields.select')" :disabled="readonly" />
      <SelectBox name="locale" :label="t('fields.defaultLanguage')" :multi="false" :static-options="localeOptions" option-label="name" option-value="id" :placeholder="t('fields.select')" :disabled="readonly" />
    </FormSection>

    <FormSection :title="t('settings.businessHours')" :description="t('settings.businessHoursHint')">
      <InputTextField name="start" type="time" :label="t('fields.opensAt')" placeholder="09:00" :disabled="readonly" />
      <InputTextField name="end" type="time" :label="t('fields.closesAt')" placeholder="18:00" :disabled="readonly" />
      <fieldset class="md:col-span-2 mb-4">
        <legend class="text-sm font-medium text-heading mb-2">{{ t("fields.workingDays") }}</legend>
        <div class="flex flex-wrap gap-2">
          <button
              v-for="d in DAYS"
              :key="d"
              type="button"
              :disabled="readonly"
              :aria-pressed="values.days.includes(d)"
              class="h-9 px-3 rounded border text-sm"
              :class="values.days.includes(d) ? 'border-primary-700 bg-primary-50 text-primary-700' : 'border-line text-neural-400'"
              @click="toggleDay(d)"
          >
            {{ t(`days.${d}`) }}
          </button>
        </div>
      </fieldset>
    </FormSection>
    <div v-if="!readonly" class="flex justify-end"><MainButton type="submit" text="buttons.save" :loading="isPending" /></div>
    <p v-else class="text-sm text-neural-300">{{ t("settings.readOnly") }}</p>
  </form>
</template>
