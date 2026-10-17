<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue3-toastify";
import { useQueryClient } from "@tanstack/vue-query";
import MainModal from "@/components/UI/modals/MainModal.vue";
import MainButton from "@/components/buttons/MainButton.vue";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import type { AutomationRule } from "@/types/domain";
import { apiResetAutomation, apiUpdateAutomation } from "@/modules/automations/api";
import { USE_MOCK } from "@/InterceptorHelper";

// Edits the template's config object. The editor is driven by the config the API returns
// (number / boolean / text / list / known choices), so new backend options appear without
// frontend changes; the API validates every value again.
const props = defineProps<{ rule: AutomationRule | null }>();
const visible = defineModel<boolean>("visible", { default: false });
const { t } = useLocaleSettings();
const { te } = useI18n();
const queryClient = useQueryClient();
const config = ref<Record<string, any>>({});
const errors = ref<Record<string, string>>({});
const saving = ref(false);

// Known option sets for enum-like keys
const CHOICES: Record<string, string[]> = {
  strategy: ["round_robin", "specialty", "manual"],
  dedupePolicy: ["merge", "flag", "reject"],
};
const LIST_CHOICES: Record<string, string[]> = {
  matchOn: ["email", "phone"],
  channels: ["in_app", "email"],
};

watch(visible, (open) => {
  if (open && props.rule) {
    config.value = JSON.parse(JSON.stringify(props.rule.config ?? {}));
    errors.value = {};
  }
});

const entries = computed(() =>
    Object.entries(config.value).filter(([, v]) => v === null || ["number", "boolean", "string"].includes(typeof v) || Array.isArray(v))
);
const kind = (key: string, v: any) =>
    CHOICES[key] ? "choice" : LIST_CHOICES[key] ? "multi" : Array.isArray(v) ? "list" : typeof v === "boolean" ? "bool" : typeof v === "number" ? "number" : "text";

const label = (key: string) => (te(`automations.config.keys.${key}`) ? t(`automations.config.keys.${key}`) : key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()));
const choiceLabel = (key: string, v: string) => {
  const k = key === "strategy" ? `automations.config.strategies.${v}` : key === "dedupePolicy" ? `automations.config.policy.${v}` : `automations.config.values.${v}`;
  return te(k) ? t(k) : v;
};
const toggleIn = (key: string, v: string) => {
  const list: string[] = config.value[key] ?? [];
  config.value[key] = list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
};

const save = async () => {
  if (!props.rule) return;
  saving.value = true;
  errors.value = {};
  try {
    await apiUpdateAutomation(props.rule.id, { config: config.value });
    toast.success(t("messages.saved"));
    queryClient.invalidateQueries({ queryKey: ["automations"] });
    visible.value = false;
  } catch (e: any) {
    const details = e?.error?.details ?? {};
    const flat = details.config && typeof details.config === "object" ? details.config : details;
    errors.value = Object.fromEntries(Object.entries(flat).map(([k, v]) => [k, ([] as any[]).concat(v)[0]]));
  } finally {
    saving.value = false;
  }
};

const reset = async () => {
  if (!props.rule) return;
  await apiResetAutomation(props.rule.id);
  toast.success(t("automations.resetDone"));
  queryClient.invalidateQueries({ queryKey: ["automations"] });
  visible.value = false;
};

const input = "h-10 w-full rounded border border-line bg-white px-3 text-sm text-black";
const ruleName = computed(() => (props.rule ? props.rule.name || t(`automations.types.${props.rule.type}.name`) : ""));
</script>

<template>
  <MainModal v-model:visible="visible" :header-title="ruleName" width="34rem">
    <div v-if="rule" class="flex flex-col gap-4 text-sm">
      <p class="text-neural-300">{{ rule.description || t(`automations.types.${rule.type}.description`) }}</p>

      <p v-if="!entries.length" class="text-neural-300">{{ t("automations.config.noSettings") }}</p>

      <template v-for="[key, value] in entries" :key="key">
        <fieldset v-if="kind(key, value) === 'choice'" class="flex flex-col gap-2">
          <legend class="font-medium text-heading mb-1">{{ label(key) }}</legend>
          <label v-for="opt in CHOICES[key]" :key="opt" class="flex items-start gap-2 cursor-pointer">
            <input v-model="config[key]" type="radio" :value="opt" class="mt-1 accent-primary-700" />
            <span>
              <span class="text-heading">{{ choiceLabel(key, opt) }}</span>
              <span v-if="key === 'strategy'" class="block text-xs text-neural-300">{{ t(`automations.config.strategyHint.${opt}`) }}</span>
              <span v-if="key === 'dedupePolicy'" class="block text-xs text-neural-300">{{ t(`automations.config.policyHint.${opt}`) }}</span>
            </span>
          </label>
        </fieldset>

        <fieldset v-else-if="kind(key, value) === 'multi'">
          <legend class="font-medium text-heading mb-1">{{ label(key) }}</legend>
          <label v-for="opt in LIST_CHOICES[key]" :key="opt" class="inline-flex items-center gap-2 me-4 cursor-pointer">
            <input type="checkbox" class="accent-primary-700" :checked="(config[key] ?? []).includes(opt)" @change="toggleIn(key, opt)" />
            {{ $te(`fields.${opt}`) ? t(`fields.${opt}`) : choiceLabel(key, opt) }}
          </label>
        </fieldset>

        <label v-else-if="kind(key, value) === 'bool'" class="flex items-center gap-2 cursor-pointer">
          <input v-model="config[key]" type="checkbox" class="accent-primary-700" />{{ label(key) }}
        </label>

        <label v-else-if="key === 'minConfidence'" class="flex flex-col gap-1.5">
          <span class="font-medium text-heading">{{ label(key) }}: {{ Math.round(Number(config[key]) * 100) }}%</span>
          <input v-model.number="config[key]" type="range" min="0.3" max="0.95" step="0.05" class="accent-primary-700" />
          <span class="text-xs text-neural-300">{{ t("automations.config.minConfidenceHint") }}</span>
        </label>

        <label v-else-if="kind(key, value) === 'list'" class="flex flex-col gap-1.5">
          <span class="font-medium text-heading">{{ label(key) }}</span>
          <input :value="(config[key] ?? []).join(', ')" :class="input" @change="config[key] = ($event.target as HTMLInputElement).value.split(',').map((s) => s.trim()).filter(Boolean)" />
          <span class="text-xs text-neural-300">{{ t("automations.config.commaSeparated") }}</span>
        </label>

        <label v-else class="flex flex-col gap-1.5">
          <span class="font-medium text-heading">{{ label(key) }}</span>
          <input
              v-if="kind(key, value) === 'number'"
              v-model.number="config[key]"
              type="number"
              :class="input"
          />
          <input v-else v-model="config[key]" type="text" :class="input" />
        </label>
        <p v-if="errors[key]" class="text-xs text-errors-100 -mt-2">{{ errors[key] }}</p>
      </template>

      <p v-if="rule.type === 'first_response_sla'" class="text-xs text-neural-300">{{ t("automations.config.slaDisclaimer") }}</p>
      <p v-if="rule.type === 'ai_classification'" class="text-xs text-neural-300 rounded bg-gray-300 px-3 py-2">{{ t("automations.config.aiPrivacy") }}</p>
      <p v-if="rule.type === 'lead_assignment'" class="text-xs text-neural-300 rounded bg-gray-300 px-3 py-2">{{ t("automations.config.assignmentRules") }}</p>
      <p v-if="errors.non_field_errors || errors.detail" class="text-xs text-errors-100">{{ errors.non_field_errors || errors.detail }}</p>

      <div class="flex flex-wrap justify-between gap-3 pt-3 border-t border-line">
        <button v-if="!USE_MOCK" type="button" class="text-xs text-neural-300 hover:text-primary-700" @click="reset">{{ t("automations.resetDefaults") }}</button>
        <span v-else />
        <span class="flex gap-3">
          <button type="button" class="details-btn-light" @click="visible = false">{{ t("buttons.cancel") }}</button>
          <MainButton text="buttons.save" :loading="saving" @action="save" />
        </span>
      </div>
    </div>
  </MainModal>
</template>
