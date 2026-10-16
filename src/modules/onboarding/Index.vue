<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { Icon } from "@iconify/vue";
import { toast } from "vue3-toastify";
import BrandLogo from "@/components/UI/BrandLogo.vue";
import MainButton from "@/components/buttons/MainButton.vue";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import { useStages } from "@/composables/useLookups.ts";
import { useAuthStore } from "@/store/auth.ts";
import { CURRENCIES, INDUSTRIES, TIMEZONES } from "@/constants/lead";
import { apiCompleteOnboarding, apiInvite, apiUpdateOrganization } from "@/modules/settings/api";
import { apiConnect } from "@/modules/integrations/api";

// Four short steps; everything here can be changed later in Settings
const { t } = useLocaleSettings();
const router = useRouter();
const auth = useAuthStore();
const { stages } = useStages();

const steps = ["company", "pipeline", "team", "website"] as const;
const step = ref(0);
const busy = ref(false);

const org = ref({
  name: auth.organization?.name ?? "",
  industry: auth.organization?.industry ?? "real_estate",
  timezone: auth.organization?.timezone ?? "Africa/Cairo",
  currency: auth.organization?.currency ?? "EGP",
});
const invites = ref([{ email: "", role: "sales_agent" }]);
const secret = ref<string | null>(null);
const endpoint = ref("");

const input = "h-10 w-full rounded border border-line bg-white px-3 text-sm text-black";

const saveCompany = async () => {
  if (!org.value.name.trim()) return toast.error(t("validations.required", { field: t("fields.organizationName") }));
  busy.value = true;
  try {
    const res = await apiUpdateOrganization({ ...org.value, name: org.value.name.trim() } as any);
    auth.organization = res.data;
    step.value++;
  } finally {
    busy.value = false;
  }
};

const sendInvites = async () => {
  const list = invites.value.filter((i) => i.email.trim());
  busy.value = true;
  try {
    for (const i of list) await apiInvite({ email: i.email.trim().toLowerCase(), role: i.role });
    if (list.length) toast.success(t("onboarding.invitesSent", { count: list.length }));
    step.value++;
  } finally {
    busy.value = false;
  }
};

const connectWebsite = async () => {
  busy.value = true;
  try {
    const res = await apiConnect("website_form", {});
    secret.value = res.secret ?? null;
    endpoint.value = res.data.config?.endpoint ?? "";
  } finally {
    busy.value = false;
  }
};

const finish = async () => {
  busy.value = true;
  try {
    const res = await apiCompleteOnboarding();
    auth.organization = res.data;
    router.push({ name: "dashboard" });
  } finally {
    busy.value = false;
  }
};

const progress = computed(() => ((step.value + 1) / steps.length) * 100);
</script>

<template>
  <div class="min-h-screen bg-dashboardBg flex flex-col items-center px-4 py-8">
    <BrandLogo img-class="h-10" />
    <div class="w-full max-w-2xl mt-8 bg-white border border-line rounded p-6 sm:p-8">
      <div class="h-1.5 rounded bg-neural-100 overflow-hidden mb-6" role="progressbar" :aria-valuenow="step + 1" aria-valuemin="1" :aria-valuemax="steps.length">
        <div class="h-full bg-brand-gradient transition-[width] duration-500" :style="{ width: `${progress}%` }" />
      </div>
      <p class="text-xs text-neural-300 mb-1">{{ t("onboarding.stepOf", { n: step + 1, total: steps.length }) }}</p>
      <h1 class="text-2xl">{{ t(`onboarding.${steps[step]}.title`) }}</h1>
      <p class="text-sm text-neural-300 mt-1 mb-6">{{ t(`onboarding.${steps[step]}.subtitle`) }}</p>

      <!-- 1 company -->
      <form v-if="step === 0" class="grid grid-cols-1 sm:grid-cols-2 gap-4" @submit.prevent="saveCompany">
        <label class="sm:col-span-2 flex flex-col gap-1.5 text-sm"><span class="font-medium text-heading">{{ t("fields.organizationName") }}</span><input v-model="org.name" :class="input" required /></label>
        <label class="flex flex-col gap-1.5 text-sm"><span class="font-medium text-heading">{{ t("fields.industry") }}</span>
          <select v-model="org.industry" :class="input"><option v-for="i in INDUSTRIES" :key="i" :value="i">{{ t(`options.industry.${i}`) }}</option></select>
        </label>
        <label class="flex flex-col gap-1.5 text-sm"><span class="font-medium text-heading">{{ t("fields.currency") }}</span>
          <select v-model="org.currency" :class="input"><option v-for="c in CURRENCIES" :key="c" :value="c">{{ c }}</option></select>
        </label>
        <label class="sm:col-span-2 flex flex-col gap-1.5 text-sm"><span class="font-medium text-heading">{{ t("fields.timezone") }}</span>
          <select v-model="org.timezone" :class="input"><option v-for="z in TIMEZONES" :key="z" :value="z">{{ z }}</option></select>
          <span class="text-xs text-neural-300">{{ t("onboarding.company.timezoneHint") }}</span>
        </label>
        <div class="sm:col-span-2 flex justify-end"><MainButton type="submit" text="buttons.continue" :loading="busy" /></div>
      </form>

      <!-- 2 pipeline -->
      <div v-else-if="step === 1" class="flex flex-col gap-4">
        <ol class="flex flex-wrap items-center gap-2">
          <li v-for="(s, i) in stages" :key="s.id" class="flex items-center gap-2">
            <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-line text-sm"><span class="w-2 h-2 rounded-full" :style="{ backgroundColor: s.color }" />{{ s.name }}</span>
            <Icon v-if="i < stages.length - 1" icon="lucide:arrow-right" class="w-4 h-4 text-neural-200 rtl:rotate-180" />
          </li>
        </ol>
        <p class="text-sm text-neural-300">{{ t("onboarding.pipeline.hint") }}</p>
        <div class="flex justify-between"><button type="button" class="details-btn-light" @click="step--">{{ t("buttons.back") }}</button><MainButton text="buttons.continue" @action="step++" /></div>
      </div>

      <!-- 3 team -->
      <form v-else-if="step === 2" class="flex flex-col gap-3" @submit.prevent="sendInvites">
        <div v-for="(inv, i) in invites" :key="i" class="grid grid-cols-[1fr_auto_auto] gap-2">
          <input v-model="inv.email" type="email" :class="input" :placeholder="t('fields.enterEmail')" :aria-label="t('fields.email')" dir="ltr" />
          <select v-model="inv.role" class="h-10 rounded border border-line bg-white px-2 text-sm text-black" :aria-label="t('fields.role')">
            <option v-for="r in ['admin', 'sales_manager', 'sales_agent', 'analyst']" :key="r" :value="r">{{ t(`roles.${r}`) }}</option>
          </select>
          <button type="button" class="w-10 h-10 rounded border border-line text-neural-300 hover:text-errors-100" :aria-label="t('buttons.remove')" :disabled="invites.length === 1" @click="invites.splice(i, 1)">×</button>
        </div>
        <button type="button" class="self-start text-sm text-primary-700 font-medium" :disabled="invites.length >= 10" @click="invites.push({ email: '', role: 'sales_agent' })">+ {{ t("onboarding.team.addAnother") }}</button>
        <div class="flex justify-between pt-2">
          <button type="button" class="details-btn-light" @click="step--">{{ t("buttons.back") }}</button>
          <span class="flex gap-2">
            <button type="button" class="details-btn-light" @click="step++">{{ t("onboarding.skip") }}</button>
            <MainButton type="submit" text="onboarding.team.send" :loading="busy" />
          </span>
        </div>
      </form>

      <!-- 4 website -->
      <div v-else class="flex flex-col gap-4">
        <template v-if="!secret">
          <p class="text-sm text-neural-400">{{ t("onboarding.website.body") }}</p>
          <MainButton text="onboarding.website.connect" :loading="busy" class="self-start" @action="connectWebsite" />
        </template>
        <div v-else class="flex flex-col gap-2 text-sm">
          <p class="rounded bg-[#FFF9E9] text-[#8A6700] px-3 py-2">{{ t("integrations.secretOnce") }}</p>
          <p><span class="text-neural-300">{{ t("integrations.endpoint") }}:</span> <code class="break-all">{{ endpoint }}</code></p>
          <p><span class="text-neural-300">{{ t("integrations.signingSecret") }}:</span> <code class="break-all">{{ secret }}</code></p>
        </div>
        <div class="flex justify-between pt-2">
          <button type="button" class="details-btn-light" @click="step--">{{ t("buttons.back") }}</button>
          <MainButton text="onboarding.finish" :loading="busy" @action="finish" />
        </div>
      </div>
    </div>
  </div>
</template>
