import { computed } from "vue";
import { useQueryClient } from "@tanstack/vue-query";
import { useRouter } from "vue-router";
import useFetch from "@/composables/useFetch";
import useMutate from "@/composables/useMutate";
import type { AppNotification } from "@/types/domain";
import { apiMarkAllRead, apiMarkRead, apiNotifications } from "@/modules/notifications/api";

export const NOTIFICATION_ICONS: Record<string, string> = {
    lead_assigned: "lucide:user-plus",
    task_due: "lucide:alarm-clock",
    follow_up_overdue: "lucide:timer-off",
    integration_failed: "lucide:plug-zap",
    import_failed_rows: "lucide:file-warning",
    automation_finished: "lucide:workflow",
    usage_limit: "lucide:gauge",
};

// Polls the unread feed for the navbar bell (a websocket push can replace this later)
export function useRecentNotifications() {
    const { data } = useFetch({
        queryKey: ["notifications", "recent"],
        queryFn: () => apiNotifications({ pageSize: 8 }),
        options: { refetchInterval: 30_000, refetchOnWindowFocus: true },
    });
    const items = computed<AppNotification[]>(() => data.value?.data ?? []);
    const unreadCount = computed<number>(() => data.value?.unread ?? 0);
    const unreadLabel = computed(() => (unreadCount.value > 9 ? "9+" : unreadCount.value || ""));
    return { items, unreadCount, unreadLabel };
}

export function useOpenNotification() {
    const router = useRouter();
    const queryClient = useQueryClient();
    return async (n: AppNotification) => {
        if (!n.readAt) {
            await apiMarkRead(n.id).catch(() => null);
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
        }
        if (n.link?.name && router.hasRoute(n.link.name)) router.push({ name: n.link.name, params: n.link.params });
    };
}

export function useMarkAllRead() {
    const { mutate, isPending } = useMutate({ mutationKey: ["notifications-read-all"], queryKey: ["notifications"], mutationFn: apiMarkAllRead });
    return { markAllRead: () => mutate(undefined as any), isPending };
}
