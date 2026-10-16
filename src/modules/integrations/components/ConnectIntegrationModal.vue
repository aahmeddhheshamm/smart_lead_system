<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { toast } from "vue3-toastify";
import { useQueryClient } from "@tanstack/vue-query";
import MainModal from "@/components/UI/modals/MainModal.vue";
import MainButton from "@/components/buttons/MainButton.vue";
import InterceptorHelper from "@/InterceptorHelper";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import type { Integration } from "@/types/domain";
import { apiConnect } from "@/modules/integrations/api";

const props = defineProps<{ integration: Integration | null }>();
const visible = defineModel<boolean>("visible", { default: false });
const { t } = useLocaleSettings();
const queryClient = useQueryClient();

const origins = ref("");
const fromAddress = ref("");
const secret = ref<string | null>(null);
const saving = ref(false);
const error = ref("");

watch(visible, (open) => {
  if (!open) return;
  secret.value = null;
  error.value = "";
  origins.value = (props.integration?.config?.allowedOrigins ?? []).join("\n");
  fromAddress.value = props.integration?.config?.fromAddress ?? "";
});

const provider = computed(() => props.integration?.provider);
const endpoint = computed(() => (props.integration?.config?.endpoint ? `${InterceptorHelper.baseUrl}${props.integration.config.endpoint}` : ""));

const connect = async () => {
  if (!provider.value) return;
  saving.value = true;
  error.value = "";
  try {
    const body =
        provider.value === "website_form"
            ? { allowedOrigins: origins.value.split(/\s+/).map((s) => s.trim()).filter(Boolean) }
            : provider.value === "email"
                ? { fromAddress: fromAddress.value.trim() }
                : {};
    const res = await apiConnect(provider.value, body);
    queryClient.invalidateQueries({ queryKey: ["integrations"] });
    if (res.secret) secret.value = res.secret;
    else {
      toast.success(t("integrations.connected"));
      visible.value = false;
    }
  } catch (e: any) {
    error.value = e?.error?.message ?? t("messages.error");
  } finally {
    saving.value = false;
  }
};

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(t("ai.copied"));
  } catch {
    /* clipboard blocked */
  }
};

const snippet = computed(() => `curl -X POST "${endpoint.value}" \\
  -H "Content-Type: application/json" \\
  -H "X-Event-Id: <unique id per submission>" \\
  -H "X-Signature: <HMAC-SHA256 of the raw body with your secret>" \\
  -d '{"name":"Ahmed Hassan","phone":"+201001234567","email":"ahmed@example.com","message":"…","campaign":"Summer Launch"}'`);
</script>

<template>
  <MainModal v-model:visible="visible" :header-title="integration ? t(`integrations.providers.${integration.provider}.name`) : ''" width="min(40rem, 95vw)">
    <div v-if="integration" class="flex flex-col gap-4 text-sm">
      <p class="text-neural-300">{{ t(`integrations.providers.${integration.provider}.description`) }}</p>

      <!-- the signing secret is only ever shown here, once -->
      <div v-if="secret" class="flex flex-col gap-3">
        <div class="rounded border border-[#E0A800]/40 bg-[#FFF9E9] p-3 text-[#8A6700]" role="alert">{{ t("integrations.secretOnce") }}</div>
        <label class="flex flex-col gap-1">
          <span class="font-medium text-heading">{{ t("integrations.signingSecret") }}</span>
          <span class="flex gap-2"><code class="flex-1 rounded border border-line bg-gray-300 px-3 py-2 break-all">{{ secret }}</code><button type="button" class="details-btn-outline" @click="copy(secret)">{{ t("buttons.copy") }}</button></span>
        </label>
        <label class="flex flex-col gap-1">
          <span class="font-medium text-heading">{{ t("integrations.endpoint") }}</span>
          <span class="flex gap-2"><code class="flex-1 rounded border border-line bg-gray-300 px-3 py-2 break-all">{{ endpoint }}</code><button type="button" class="details-btn-outline" @click="copy(endpoint)">{{ t("buttons.copy") }}</button></span>
        </label>
        <pre class="rounded bg-brand-navy text-[#e2e8f0] text-xs p-3 overflow-x-auto" dir="ltr">{{ snippet }}</pre>
        <div class="flex justify-end"><MainButton text="buttons.done" @action="visible = false" /></div>
      </div>

      <template v-else>
        <template v-if="integration.provider === 'website_form'">
          <label class="flex flex-col gap-1.5">
            <span class="font-medium text-heading">{{ t("integrations.allowedOrigins") }}</span>
            <textarea v-model="origins" rows="3" class="rounded border border-line bg-white px-3 py-2 text-sm text-black" placeholder="https://www.example.com" dir="ltr" />
            <span class="text-xs text-neural-300">{{ t("integrations.allowedOriginsHint") }}</span>
          </label>
          <p v-if="integration.status === 'connected'" class="text-xs text-[#8A6700]">{{ t("integrations.rotateWarning") }}</p>
        </template>
        <label v-else-if="integration.provider === 'email'" class="flex flex-col gap-1.5">
          <span class="font-medium text-heading">{{ t("integrations.fromAddress") }}</span>
          <input v-model="fromAddress" type="email" class="h-10 rounded border border-line bg-white px-3 text-sm text-black" placeholder="no-reply@yourcompany.com" dir="ltr" />
          <span class="text-xs text-neural-300">{{ t("integrations.emailHint") }}</span>
        </label>
        <p v-else class="text-neural-300">{{ t("integrations.genericConnect") }}</p>

        <ul class="text-xs text-neural-300 list-disc ps-5 flex flex-col gap-1">
          <li>{{ t("integrations.rules.secrets") }}</li>
          <li>{{ t("integrations.rules.dedupe") }}</li>
          <li>{{ t("integrations.rules.retry") }}</li>
        </ul>
        <p v-if="error" class="text-sm text-errors-100" role="alert">{{ error }}</p>
        <div class="flex justify-end gap-3 pt-3 border-t border-line">
          <button type="button" class="details-btn-light" @click="visible = false">{{ t("buttons.cancel") }}</button>
          <MainButton :text="integration.status === 'connected' ? 'integrations.reconnect' : 'integrations.connect'" :loading="saving" @action="connect" />
        </div>
      </template>
    </div>
  </MainModal>
</template>
