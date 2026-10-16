import InterceptorHelper from "@/InterceptorHelper.ts";
import type { Integration, ItemResponse } from "@/types/domain";

export const apiIntegrations = () => InterceptorHelper.get<{ data: Integration[] }>("integrations");

// For website_form the response carries the signing `secret` once; store it now or rotate later
export const apiConnect = (provider: string, data: Record<string, any> = {}) =>
    InterceptorHelper.post<ItemResponse<Integration> & { secret?: string }>(`integrations/${provider}/connect`, data);

export const apiDisconnect = (provider: string) => InterceptorHelper.post<ItemResponse<Integration>>(`integrations/${provider}/disconnect`);

export const apiTestIntegration = (provider: string) =>
    InterceptorHelper.post<{ data: { ok: boolean; created?: boolean; lead?: { id: string; name: string } } }>(`integrations/${provider}/test`);
