<script setup lang="ts">
import { computed } from "vue";
import { Icon } from "@iconify/vue";
import useFetch from "@/composables/useFetch";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import { PERMISSION_GROUPS } from "@/config/permissions";
import { apiRoles } from "@/modules/settings/api";

const { t } = useLocaleSettings();
const { data } = useFetch({ queryKey: ["roles"], queryFn: apiRoles });
const roles = computed(() => data.value?.data ?? []);
</script>

<template>
  <div class="flex flex-col gap-4">
    <div>
      <h2 class="text-base font-semibold">{{ t("settings.roles") }}</h2>
      <p class="text-sm text-neural-300">{{ t("settings.rolesHint") }}</p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      <div v-for="role in roles" :key="role.key" class="rounded border border-line p-3">
        <p class="text-sm font-semibold text-heading">{{ t(`roles.${role.key}`) }} <span class="text-xs text-neural-300 font-normal">· {{ t("settings.membersCount", { count: role.members }) }}</span></p>
        <p class="text-xs text-neural-300 mt-1">{{ t(`roleDescriptions.${role.key}`) }}</p>
      </div>
    </div>
    <div class="overflow-x-auto border border-line rounded">
      <table class="w-full text-sm">
        <thead class="bg-tableHeader">
          <tr>
            <th class="text-start">{{ t("settings.permission") }}</th>
            <th v-for="role in roles" :key="role.key" class="text-center whitespace-nowrap">{{ t(`roles.${role.key}`) }}</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="group in PERMISSION_GROUPS" :key="group.key">
            <tr class="bg-gray-300"><td :colspan="roles.length + 1" class="!py-1.5 text-xs font-semibold uppercase tracking-wide text-neural-300">{{ t(`permissionGroups.${group.key}`) }}</td></tr>
            <tr v-for="perm in group.permissions" :key="perm" class="border-t border-line">
              <td>{{ t(`permissions.${perm}`) }}</td>
              <td v-for="role in roles" :key="role.key" class="text-center">
                <Icon v-if="role.permissions.includes(perm)" icon="lucide:check" class="w-4 h-4 inline text-[#03894A]" :aria-label="t('settings.allowed')" />
                <span v-else class="text-neural-200" :aria-label="t('settings.notAllowed')">—</span>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>
