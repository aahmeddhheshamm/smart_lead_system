<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import Box from "@/components/UI/Box.vue";
import TabsNav from "@/components/UI/TabsNav.vue";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import { useAuthorization } from "@/composables/useAuthorization.ts";
import { P } from "@/config/permissions";
import GeneralSettings from "@/modules/settings/components/GeneralSettings.vue";
import MembersSettings from "@/modules/settings/components/MembersSettings.vue";
import RolesSettings from "@/modules/settings/components/RolesSettings.vue";
import PipelineSettings from "@/modules/settings/components/PipelineSettings.vue";
import SourcesSettings from "@/modules/settings/components/SourcesSettings.vue";
import NotificationSettings from "@/modules/settings/components/NotificationSettings.vue";
import BillingSettings from "@/modules/settings/components/BillingSettings.vue";
import AuditLogSettings from "@/modules/settings/components/AuditLogSettings.vue";

const { t } = useLocaleSettings();
const { can } = useAuthorization();
const route = useRoute();
const router = useRouter();

// every member sees at least their notification preferences
const all = [
  { key: "general", component: GeneralSettings, permission: [P.settingsManage, P.membersView] },
  { key: "members", component: MembersSettings, permission: [P.membersView] },
  { key: "roles", component: RolesSettings, permission: [P.membersView] },
  { key: "pipeline", component: PipelineSettings, permission: [P.pipelineManage, P.settingsManage] },
  { key: "sources", component: SourcesSettings, permission: [P.settingsManage] },
  { key: "notifications", component: NotificationSettings, permission: [] as string[] },
  { key: "billing", component: BillingSettings, permission: [P.billingManage, P.settingsManage] },
  { key: "audit", component: AuditLogSettings, permission: [P.auditView] },
];
const available = computed(() => all.filter((tab) => can(...tab.permission)));
const tabs = computed(() => available.value.map((tab) => ({ key: tab.key, label: t(`settings.tabs.${tab.key}`) })));
const active = computed({
  get: () => (available.value.some((x) => x.key === route.params.tab) ? String(route.params.tab) : available.value[0]?.key),
  set: (tab: string) => router.replace({ name: "settings", params: { tab } }),
});
const current = computed(() => available.value.find((x) => x.key === active.value)?.component);
</script>

<template>
  <Box>
    <h1 class="text-xl mb-4">{{ t("sidebar.settings") }}</h1>
    <TabsNav v-model="active" :tabs="tabs" />
    <div class="pt-6"><component :is="current" :key="active" /></div>
  </Box>
</template>
