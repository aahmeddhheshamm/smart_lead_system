import InterceptorHelper from "@/InterceptorHelper.ts";
import type { AppNotification, ListResponse, NotificationPreferences } from "@/types/domain";

export const apiNotifications = (query: Record<string, any> = {}) =>
    InterceptorHelper.get<ListResponse<AppNotification> & { unread: number }>("notifications", query, { silent: true });

export const apiMarkRead = (id: string) => InterceptorHelper.post(`notifications/${id}/read`);

export const apiMarkAllRead = () => InterceptorHelper.post("notifications/read-all");

export const apiPreferences = () => InterceptorHelper.get<{ data: NotificationPreferences }>("notification-preferences");

export const apiSavePreferences = (data: NotificationPreferences) =>
    InterceptorHelper.put<{ data: NotificationPreferences }>("notification-preferences", data);
