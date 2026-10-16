<script setup lang="ts">
import { computed, ref } from "vue";
import { toast } from "vue3-toastify";
import { useQueryClient } from "@tanstack/vue-query";
import MainButton from "@/components/buttons/MainButton.vue";
import MainModal from "@/components/UI/modals/MainModal.vue";
import StatusBadge from "@/components/UI/StatusBadge.vue";
import UserAvatar from "@/components/UI/UserAvatar.vue";
import SpinnerLoading from "@/components/UI/SpinnerLoading.vue";
import useFetch from "@/composables/useFetch";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import { useAuthorization } from "@/composables/useAuthorization.ts";
import { useAuthStore } from "@/store/auth.ts";
import { fromNow } from "@/utils";
import { ASSIGNABLE_ROLES, P } from "@/config/permissions";
import type { Member } from "@/types/domain";
import { apiInvitations, apiInvite, apiMembers, apiRevokeInvitation, apiUpdateMember } from "@/modules/settings/api";

const { t } = useLocaleSettings();
const { can } = useAuthorization();
const auth = useAuthStore();
const queryClient = useQueryClient();
const canManage = computed(() => can(P.membersManage));

const { data, isLoading } = useFetch({ queryKey: ["members", "all"], queryFn: () => apiMembers({ pageSize: 100 }) });
const { data: invData } = useFetch({ queryKey: ["invitations"], queryFn: apiInvitations, enabled: computed(() => can(P.membersView)) });
const members = computed<Member[]>(() => data.value?.data ?? []);
const pending = computed(() => (invData.value?.data ?? []).filter((i) => i.status === "pending"));

// only an owner may grant the owner role
const roleOptions = computed(() => ASSIGNABLE_ROLES.filter((r) => r !== "owner" || auth.role === "owner"));

const refresh = () => ["members", "invitations"].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));

const update = async (m: Member, patch: Record<string, any>) => {
  await apiUpdateMember(m.id, patch);
  toast.success(t("messages.saved"));
  refresh();
};

/* invite */
const showInvite = ref(false);
const inviteEmail = ref("");
const inviteRole = ref("sales_agent");
const inviting = ref(false);
const inviteLink = ref<string | null>(null);
const invite = async () => {
  inviting.value = true;
  try {
    const res = await apiInvite({ email: inviteEmail.value.trim().toLowerCase(), role: inviteRole.value });
    toast.success(t("settings.invitationSent", { email: res.data.email }));
    inviteLink.value = res.debugInviteToken ? `${location.origin}/invite/${res.debugInviteToken}` : null;
    inviteEmail.value = "";
    if (!inviteLink.value) showInvite.value = false;
    refresh();
  } finally {
    inviting.value = false;
  }
};
const revoke = async (id: string) => {
  await apiRevokeInvitation(id);
  toast.success(t("settings.invitationRevoked"));
  refresh();
};

/* specialties (used by the "by specialty" assignment strategy) */
const editingSpecialties = ref<Member | null>(null);
const specialtiesText = ref("");
const openSpecialties = (m: Member) => {
  editingSpecialties.value = m;
  specialtiesText.value = m.specialties.join(", ");
};
const saveSpecialties = async () => {
  await update(editingSpecialties.value!, { specialties: specialtiesText.value.split(",").map((s) => s.trim()).filter(Boolean) });
  editingSpecialties.value = null;
};
</script>

<template>
  <div class="flex flex-col gap-6">
    <MainModal v-model:visible="showInvite" header-title="settings.inviteMember" width="30rem" @update:visible="(v: boolean) => !v && (inviteLink = null)">
      <form class="flex flex-col gap-3 text-sm" @submit.prevent="invite">
        <label class="flex flex-col gap-1.5">
          <span class="font-medium text-heading">{{ t("fields.email") }}</span>
          <input v-model="inviteEmail" type="email" required class="h-10 rounded border border-line bg-white px-3 text-sm text-black" :placeholder="t('fields.enterEmail')" dir="ltr" />
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="font-medium text-heading">{{ t("fields.role") }}</span>
          <select v-model="inviteRole" class="h-10 rounded border border-line bg-white px-2 text-sm text-black">
            <option v-for="r in roleOptions" :key="r" :value="r">{{ t(`roles.${r}`) }}</option>
          </select>
          <span class="text-xs text-neural-300">{{ t(`roleDescriptions.${inviteRole}`) }}</span>
        </label>
        <div v-if="inviteLink" class="rounded bg-primary-50 p-3 text-xs break-all">
          <p class="font-medium text-heading mb-1">{{ t("settings.demoInviteLink") }}</p>
          <a :href="inviteLink" class="text-primary-700">{{ inviteLink }}</a>
        </div>
        <p class="text-xs text-neural-300">{{ t("settings.inviteExpiry") }}</p>
        <div class="flex justify-end gap-3 pt-2">
          <button type="button" class="details-btn-light" @click="showInvite = false">{{ t("buttons.close") }}</button>
          <MainButton type="submit" text="settings.sendInvite" :loading="inviting" :disabled="!inviteEmail" />
        </div>
      </form>
    </MainModal>

    <MainModal :visible="!!editingSpecialties" header-title="settings.specialties" width="28rem" @update:visible="(v: boolean) => !v && (editingSpecialties = null)">
      <p class="text-sm text-neural-300 mb-2">{{ t("settings.specialtiesHint") }}</p>
      <input v-model="specialtiesText" class="h-10 w-full rounded border border-line bg-white px-3 text-sm text-black" :placeholder="t('settings.specialtiesPlaceholder')" />
      <div class="flex justify-end gap-3 pt-4">
        <button type="button" class="details-btn-light" @click="editingSpecialties = null">{{ t("buttons.cancel") }}</button>
        <MainButton text="buttons.save" @action="saveSpecialties" />
      </div>
    </MainModal>

    <div class="flex items-center justify-between gap-3">
      <div>
        <h2 class="text-base font-semibold">{{ t("settings.members") }}</h2>
        <p class="text-sm text-neural-300">{{ t("settings.membersHint") }}</p>
      </div>
      <MainButton v-if="canManage" text="settings.inviteMember" is-add-btn @action="showInvite = true" />
    </div>

    <div v-if="isLoading" class="py-10"><SpinnerLoading /></div>
    <div v-else class="overflow-x-auto border border-line rounded">
      <table class="w-full text-sm">
        <thead class="bg-tableHeader">
          <tr>
            <th class="text-start">{{ t("fields.member") }}</th>
            <th class="text-start">{{ t("fields.role") }}</th>
            <th class="text-start">{{ t("settings.specialties") }}</th>
            <th class="text-start">{{ t("fields.status") }}</th>
            <th class="text-start">{{ t("settings.lastActive") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in members" :key="m.id" class="border-t border-line">
            <td>
              <span class="flex items-center gap-2">
                <UserAvatar :name="m.user.name" size="sm" />
                <span class="min-w-0"><span class="block font-medium text-heading">{{ m.user.name }} <span v-if="m.user.id === auth.userId" class="text-xs text-neural-300">({{ t("settings.you") }})</span></span><span class="block text-xs text-neural-300">{{ m.user.email }}</span></span>
              </span>
            </td>
            <td>
              <select v-if="canManage && m.user.id !== auth.userId && (m.role !== 'owner' || auth.role === 'owner')" :value="m.role" class="h-8 rounded border border-line bg-white px-2 text-sm text-black" :aria-label="t('fields.role')" @change="update(m, { role: ($event.target as HTMLSelectElement).value })">
                <option v-for="r in roleOptions" :key="r" :value="r">{{ t(`roles.${r}`) }}</option>
              </select>
              <span v-else>{{ t(`roles.${m.role}`) }}</span>
            </td>
            <td>
              <button v-if="canManage && m.role === 'sales_agent'" type="button" class="text-xs text-primary-700 text-start" @click="openSpecialties(m)">{{ m.specialties.length ? m.specialties.join(", ") : t("settings.addSpecialties") }}</button>
              <span v-else class="text-xs text-neural-300">{{ m.specialties.join(", ") || "—" }}</span>
            </td>
            <td>
              <span class="flex items-center gap-2">
                <StatusBadge :status="m.status" />
                <button v-if="canManage && m.user.id !== auth.userId" type="button" class="text-xs" :class="m.status === 'active' ? 'text-errors-100' : 'text-primary-700'" @click="update(m, { status: m.status === 'active' ? 'inactive' : 'active' })">
                  {{ m.status === "active" ? t("settings.deactivate") : t("settings.activate") }}
                </button>
              </span>
            </td>
            <td class="text-neural-300">{{ m.lastActiveAt ? fromNow(m.lastActiveAt) : "—" }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="text-xs text-neural-300">{{ t("settings.deactivateHint") }}</p>

    <div v-if="pending.length">
      <h3 class="text-sm font-semibold text-heading mb-2">{{ t("settings.pendingInvitations") }}</h3>
      <ul class="border border-line rounded divide-y divide-line">
        <li v-for="inv in pending" :key="inv.id" class="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
          <span>{{ inv.email }} · <span class="text-neural-300">{{ t(`roles.${inv.role}`) }}</span></span>
          <span class="flex items-center gap-3 text-xs text-neural-300">
            {{ t("settings.expires", { when: fromNow(inv.expiresAt) }) }}
            <button v-if="canManage" type="button" class="text-errors-100" @click="revoke(inv.id)">{{ t("settings.revoke") }}</button>
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>
