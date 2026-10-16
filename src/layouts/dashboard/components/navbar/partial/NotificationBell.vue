<script setup lang="ts">
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/vue";
import { Icon } from "@iconify/vue";
import { useRouter } from "vue-router";
import RoundedButton from "@/components/buttons/RoundedButton.vue";
import { fromNow } from "@/utils";
import {
  NOTIFICATION_ICONS,
  useMarkAllRead,
  useOpenNotification,
  useRecentNotifications,
} from "@/modules/notifications/composables/useNotifications.ts";

const router = useRouter();
const { items, unreadCount, unreadLabel } = useRecentNotifications();
const { markAllRead, isPending } = useMarkAllRead();
const open = useOpenNotification();
</script>

<template>
  <Menu as="div" class="relative">
    <MenuButton as="div" class="relative" :aria-label="$t('sidebar.notifications')">
      <RoundedButton>
        <Icon icon="lucide:bell" class="w-4 h-4" />
      </RoundedButton>
      <span
          v-if="unreadLabel"
          class="absolute -top-1 -end-1 min-w-[18px] h-[18px] px-1 rounded-full bg-errors-100 text-[#fff] text-[10px] font-semibold flex items-center justify-center"
      >
        {{ unreadLabel }}
      </span>
    </MenuButton>

    <transition
        enter-active-class="transition ease-out duration-100"
        enter-from-class="transform opacity-0 scale-95"
        enter-to-class="transform opacity-100 scale-100"
        leave-active-class="transition ease-in duration-75"
        leave-from-class="transform opacity-100 scale-100"
        leave-to-class="transform opacity-0 scale-95"
    >
      <MenuItems class="absolute -end-16 sm:end-0 mt-2 w-[min(20rem,calc(100vw-2rem))] z-50 bg-white rounded border border-line shadow-lg focus:outline-none">
        <div class="flex items-center justify-between px-4 py-3 border-b border-line">
          <span class="text-sm font-semibold text-heading">{{ $t('sidebar.notifications') }}</span>
          <button
              v-if="unreadCount"
              type="button"
              class="text-xs text-primary-700 hover:text-primary-600 disabled:opacity-50"
              :disabled="isPending"
              @click.stop="markAllRead()"
          >
            {{ $t('buttons.markAllRead') }}
          </button>
        </div>

        <div class="max-h-80 overflow-y-auto">
          <MenuItem v-for="n in items" :key="n.id" v-slot="{ active, close }">
            <button
                type="button"
                class="w-full text-start px-4 py-3 border-b border-line last:border-b-0 flex gap-3"
                :class="active ? 'bg-primary-50' : ''"
                @click="close(); open(n)"
            >
              <Icon :icon="NOTIFICATION_ICONS[n.type] ?? 'lucide:bell'" class="w-4 h-4 mt-0.5 shrink-0" :class="n.readAt ? 'text-neural-200' : 'text-primary-700'" />
              <span class="flex flex-col gap-0.5 min-w-0">
                <span class="text-sm truncate" :class="n.readAt ? 'text-neural-400' : 'text-black font-semibold'">{{ n.title }}</span>
                <span class="text-xs text-neural-300 line-clamp-2">{{ n.body }}</span>
                <span class="text-[11px] text-neural-200">{{ fromNow(n.createdAt) }}</span>
              </span>
            </button>
          </MenuItem>
          <p v-if="!items.length" class="px-4 py-6 text-center text-sm text-neural-300">{{ $t('notifications.empty') }}</p>
        </div>

        <MenuItem v-slot="{ close }">
          <button
              type="button"
              class="w-full px-4 py-2.5 text-sm text-primary-700 border-t border-line hover:bg-primary-50"
              @click="close(); router.push({ name: 'notifications' })"
          >
            {{ $t('buttons.viewAll') }}
          </button>
        </MenuItem>
      </MenuItems>
    </transition>
  </Menu>
</template>
