<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { toast } from "vue3-toastify";
import { useQueryClient } from "@tanstack/vue-query";
import MainModal from "@/components/UI/modals/MainModal.vue";
import MainButton from "@/components/buttons/MainButton.vue";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import type { AutomationRule } from "@/types/domain";
import { apiUpdateAutomation } from "@/modules/automations/api";

// Settings for one template; the allowed keys per type are validated again by the API
const props = defineProps<{ rule: AutomationRule | null }>();
const visible = defineModel<boolean>("visible", { default: false });
const { t } = useLocaleSettings();
const queryClient = useQueryClient();
const config = ref<Record<string, any>>({});
const errors = ref<Record<string, string>>({});
const saving = ref(false);

watch(visible, (open) => {
  if (open && props.rule) {
    config.value = JSON.parse(JSON.stringify(props.rule.config ?? {}));
    errors.value = {};
  }
});

const type = computed(() => props.rule?.type);
const toggleMatch = (field: string) => {
  const list: string[] = config.value.matchOn ?? [];
  config.value.matchOn = list.includes(field) ? list.filter((x) => x !== field) : [...list, field];
};

const save = async () => {
  if (!props.rule) return;
  saving.value = true;
  errors.value = {};
  try {
    const payload = { ...config.value };
    for (const key of ["minutes", "businessDays", "hour"]) if (key in payload) payload[key] = Number(payload[key]);
    if ("minConfidence" in payload) payload.minConfidence = Number(payload.minConfidence);
    await apiUpdateAutomation(props.rule.id, { config: payload });
    toast.success(t("messages.saved"));
    queryClient.invalidateQueries({ queryKey: ["automations"] });
    visible.value = false;
  } catch (e: any) {
    const details = e?.error?.details ?? {};
    errors.value = Object.fromEntries(Object.entries(details).map(([k, v]) => [k, (v as string[])[0]]));
  } finally {
    saving.value = false;
  }
};

const input = "h-10 w-full rounded border border-line bg-white px-3 text-sm text-black";
</script>

<template>
  <MainModal v-model:visible="visible" :header-title="rule ? t(`automations.types.${rule.type}.name`) : ''" width="34rem">
    <div v-if="rule" class="flex flex-col gap-4 text-sm">
      <p class="text-neural-300">{{ t(`automations.types.${rule.type}.description`) }}</p>

      <template v-if="type === 'lead_ingestion'">
        <fieldset class="flex flex-col gap-2">
          <legend class="font-medium text-heading mb-1">{{ t("automations.config.dedupePolicy") }}</legend>
          <label v-for="p in ['merge', 'flag', 'reject']" :key="p" class="flex items-start gap-2 cursor-pointer">
            <input v-model="config.dedupePolicy" type="radio" :value="p" class="mt-1 accent-primary-700" />
            <span><span class="text-heading">{{ t(`automations.config.policy.${p}`) }}</span><span class="block text-xs text-neural-300">{{ t(`automations.config.policyHint.${p}`) }}</span></span>
          </label>
        </fieldset>
        <fieldset>
          <legend class="font-medium text-heading mb-1">{{ t("automations.config.matchOn") }}</legend>
          <label v-for="f in ['email', 'phone']" :key="f" class="inline-flex items-center gap-2 me-4 cursor-pointer">
            <input type="checkbox" class="accent-primary-700" :checked="(config.matchOn ?? []).includes(f)" @change="toggleMatch(f)" /> {{ t(`fields.${f}`) }}
          </label>
          <p v-if="errors.matchOn" class="text-xs text-errors-100 mt-1">{{ errors.matchOn }}</p>
        </fieldset>
      </template>

      <template v-else-if="type === 'lead_assignment'">
        <fieldset class="flex flex-col gap-2">
          <legend class="font-medium text-heading mb-1">{{ t("automations.config.strategy") }}</legend>
          <label v-for="s in ['round_robin', 'specialty', 'manual']" :key="s" class="flex items-start gap-2 cursor-pointer">
            <input v-model="config.strategy" type="radio" :value="s" class="mt-1 accent-primary-700" />
            <span><span class="text-heading">{{ t(`automations.config.strategies.${s}`) }}</span><span class="block text-xs text-neural-300">{{ t(`automations.config.strategyHint.${s}`) }}</span></span>
          </label>
        </fieldset>
        <p class="text-xs text-neural-300 rounded bg-gray-300 px-3 py-2">{{ t("automations.config.assignmentRules") }}</p>
      </template>

      <template v-else-if="type === 'first_response_sla'">
        <label class="flex flex-col gap-1.5">
          <span class="font-medium text-heading">{{ t("automations.config.minutes") }}</span>
          <input v-model="config.minutes" type="number" min="5" max="1440" :class="input" />
          <span v-if="errors.minutes" class="text-xs text-errors-100">{{ errors.minutes }}</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer"><input v-model="config.businessHoursOnly" type="checkbox" class="accent-primary-700" />{{ t("automations.config.businessHoursOnly") }}</label>
        <p class="text-xs text-neural-300">{{ t("automations.config.slaDisclaimer") }}</p>
      </template>

      <template v-else-if="type === 'stale_lead_follow_up'">
        <label class="flex flex-col gap-1.5">
          <span class="font-medium text-heading">{{ t("automations.config.businessDays") }}</span>
          <input v-model="config.businessDays" type="number" min="1" max="30" :class="input" />
          <span v-if="errors.businessDays" class="text-xs text-errors-100">{{ errors.businessDays }}</span>
        </label>
      </template>

      <template v-else-if="type === 'ai_classification'">
        <label class="flex flex-col gap-1.5">
          <span class="font-medium text-heading">{{ t("automations.config.minConfidence") }}: {{ Math.round(Number(config.minConfidence) * 100) }}%</span>
          <input v-model="config.minConfidence" type="range" min="0.3" max="0.95" step="0.05" class="accent-primary-700" />
          <span class="text-xs text-neural-300">{{ t("automations.config.minConfidenceHint") }}</span>
        </label>
        <p class="text-xs text-neural-300 rounded bg-gray-300 px-3 py-2">{{ t("automations.config.aiPrivacy") }}</p>
      </template>

      <template v-else-if="type === 'daily_report'">
        <label class="flex flex-col gap-1.5">
          <span class="font-medium text-heading">{{ t("automations.config.hour") }}</span>
          <input v-model="config.hour" type="number" min="0" max="23" :class="input" />
          <span class="text-xs text-neural-300">{{ t("automations.config.hourHint") }}</span>
        </label>
      </template>

      <p v-else class="text-neural-300">{{ t("automations.config.noSettings") }}</p>

      <div class="flex justify-end gap-3 pt-3 border-t border-line">
        <button type="button" class="details-btn-light" @click="visible = false">{{ t("buttons.cancel") }}</button>
        <MainButton text="buttons.save" :loading="saving" @action="save" />
      </div>
    </div>
  </MainModal>
</template>
