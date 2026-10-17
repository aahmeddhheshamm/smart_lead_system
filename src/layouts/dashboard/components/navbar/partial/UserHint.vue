<script setup lang="ts">
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/vue";
import { useAuthStore } from "@/store/auth.ts";
import UserAvatar from "@/components/UI/UserAvatar.vue";

const auth = useAuthStore();
</script>

<template>
  <Menu as="div" class="relative">
    <MenuButton class="relative flex items-center gap-2 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-300" :aria-label="$t('myProfile')">
      <UserAvatar :name="auth.username" size="sm" />
      <span class="hidden lg:flex flex-col items-start leading-tight">
        <span class="text-sm font-semibold text-heading max-w-[10rem] truncate">{{ auth.username }}</span>
        <span class="text-xs text-neural-300 max-w-[10rem] truncate">{{ auth.organization?.name }}</span>
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
      <MenuItems class="headlessui-menu-body !w-[280px] !end-0 !top-[115%]">
        <div class="px-4 py-3 border-b border-line flex items-center gap-3">
          <UserAvatar :name="auth.username" size="md" />
          <div class="min-w-0">
            <p class="text-sm font-semibold text-heading truncate">{{ auth.username }}</p>
            <p class="text-xs text-neural-300 truncate">{{ auth.user?.email }}</p>
            <p class="text-xs text-primary-700 mt-0.5">{{ $te(`roles.${auth.role}`) ? $t(`roles.${auth.role}`) : auth.role }} · {{ auth.organization?.name }}</p>
          </div>
        </div>
        <div v-if="auth.organizations.length > 1" class="border-b border-line py-1">
          <p class="px-4 pt-1 pb-1 text-[11px] uppercase tracking-wide text-neural-300">{{ $t("navbar.switchOrganization") }}</p>
          <MenuItem v-for="org in auth.organizations" :key="org.id" v-slot="{ active }">
            <button
                type="button"
                class="headlessui-menu-item w-full text-start flex items-center justify-between gap-2"
                :class="{ '!text-primary-700 bg-primary-50': active }"
                :disabled="org.id === auth.organization?.id"
                @click="auth.switchOrganization(org.id)"
            >
              <span class="truncate">{{ org.name }}</span>
              <span v-if="org.id === auth.organization?.id" class="text-[10px] text-primary-700">✓</span>
            </button>
          </MenuItem>
        </div>
        <MenuItem v-slot="{ active, close }">
          <router-link :to="{ name: 'profile' }" class="headlessui-menu-item block" :class="{ '!text-primary-700 bg-primary-50': active }" @click="close">
            {{ $t("myProfile") }}
          </router-link>
        </MenuItem>
        <MenuItem v-slot="{ active, close }">
          <router-link :to="{ name: 'settings' }" class="headlessui-menu-item block" :class="{ '!text-primary-700 bg-primary-50': active }" @click="close">
            {{ $t("sidebar.settings") }}
          </router-link>
        </MenuItem>
        <MenuItem v-slot="{ active }">
          <button type="button" class="headlessui-menu-item w-full text-start" :class="{ '!text-errors-100 bg-errors-100/10': active }" @click="auth.logout()">
            {{ $t("logout") }}
          </button>
        </MenuItem>
      </MenuItems>
    </transition>
  </Menu>
</template>
