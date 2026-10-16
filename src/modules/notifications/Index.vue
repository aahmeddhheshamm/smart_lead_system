<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Icon } from "@iconify/vue";
import Box from "@/components/UI/Box.vue";
import MainTitle from "@/components/UI/MainTitle.vue";
import TabsNav from "@/components/UI/TabsNav.vue";
import SpinnerLoading from "@/components/UI/SpinnerLoading.vue";
import TablePagination from "@/components/table/TablePagination.vue";
import useFetch from "@/composables/useFetch";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import { changeDateFormat, fromNow } from "@/utils";
import { apiNotifications } from "@/modules/notifications/api";
import { NOTIFICATION_ICONS, useMarkAllRead, useOpenNotification } from "@/modules/notifications/composables/useNotifications.ts";

const { t } = useLocaleSettings();
const filter = ref("all");
const page = ref(1);
const perPage = ref(20);
watch([filter, perPage], () => (page.value = 1));

const { data, isLoading } = useFetch({
  queryKey: computed(() => ["notifications", "page", filter.value, page.value, perPage.value]),
  queryFn: () => apiNotifications({ unread: filter.value === "unread" ? 1 : "", page: page.value, pageSize: perPage.value }),
});
const items = computed(() => data.value?.data ?? []);
const unread = computed(() => data.value?.unread ?? 0);
const pagination = computed(() => ({ total: data.value?.pagination?.total ?? 0, lastPage: data.value?.pagination?.totalPages ?? 1 }));
const tabs = computed(() => [{ key: "all", label: t("notifications.all") }, { key: "unread", label: t("notifications.unread"), count: unread.value }]);

const { markAllRead, isPending } = useMarkAllRead();
const open = useOpenNotification();
</script>

<template>
  <Box>
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <MainTitle title="sidebar.notifications" />
        <div class="flex items-center gap-3">
          <router-link :to="{ name: 'settings', params: { tab: 'notifications' } }" class="text-sm text-neural-300 hover:text-primary-700">{{ t("notifications.preferences") }}</router-link>
          <button v-if="unread" type="button" class="details-btn-outline !h-9" :disabled="isPending" @click="markAllRead()">{{ t("buttons.markAllRead") }}</button>
        </div>
      </div>
    </template>
    <TabsNav v-model="filter" :tabs="tabs" />
    <div v-if="isLoading" class="py-12"><SpinnerLoading /></div>
    <p v-else-if="!items.length" class="py-14 text-center text-sm text-neural-300">{{ t("notifications.empty") }}</p>
    <ul v-else class="divide-y divide-line">
      <li v-for="n in items" :key="n.id">
        <button type="button" class="w-full text-start flex items-start gap-3 py-3 px-2 -mx-2 rounded hover:bg-gray-300" @click="open(n)">
          <span class="w-9 h-9 rounded flex items-center justify-center shrink-0" :class="n.readAt ? 'bg-neural-100 text-neural-300' : 'bg-primary-50 text-primary-700'">
            <Icon :icon="NOTIFICATION_ICONS[n.type] ?? 'lucide:bell'" class="w-4 h-4" />
          </span>
          <span class="flex-1 min-w-0">
            <span class="block text-sm" :class="n.readAt ? 'text-neural-400' : 'text-heading font-semibold'">{{ n.title }}</span>
            <span class="block text-sm text-neural-300">{{ n.body }}</span>
          </span>
          <span class="text-xs text-neural-300 shrink-0" v-tooltip="changeDateFormat(n.createdAt)">{{ fromNow(n.createdAt) }}</span>
          <span v-if="!n.readAt" class="w-2 h-2 rounded-full bg-primary-700 mt-2 shrink-0" :aria-label="t('notifications.unread')" />
        </button>
      </li>
    </ul>
    <div v-if="items.length && pagination.lastPage > 1" class="pt-4 flex items-center gap-3 justify-between flex-col lg:flex-row">
      <TablePagination :table-data="items" :page="page" :per-page="perPage" :pagination="pagination" @prev-page="page--" @next-page="page++" @update:per-page="(v) => (perPage = v)" />
    </div>
  </Box>
</template>
