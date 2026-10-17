import InterceptorHelper, { USE_MOCK } from "@/InterceptorHelper.ts";
import * as backend from "@/api/backend";
import type { AppNotification, ListResponse, NotificationPreferences } from "@/types/domain";

export const apiNotifications = (query: Record<string, any> = {}): Promise<ListResponse<AppNotification> & { unread: number }> =>
    USE_MOCK ? InterceptorHelper.get("notifications", query, { silent: true }) : backend.notifications.list(query);

export const apiMarkRead = (id: string) => (USE_MOCK ? InterceptorHelper.post(`notifications/${id}/read`) : backend.notifications.read(id));

export const apiMarkAllRead = () => (USE_MOCK ? InterceptorHelper.post("notifications/read-all") : backend.notifications.readAll());

export const apiPreferences = (): Promise<{ data: NotificationPreferences }> =>
    USE_MOCK ? InterceptorHelper.get("notification-preferences") : backend.notifications.preferences();

export const apiSavePreferences = (data: NotificationPreferences): Promise<{ data: NotificationPreferences }> =>
    USE_MOCK ? InterceptorHelper.put("notification-preferences", data) : backend.notifications.savePreferences(data);
