import InterceptorHelper from "@/InterceptorHelper.ts";
import type { AutomationRule, AutomationRun, ItemResponse, ListResponse } from "@/types/domain";

export const apiAutomations = () => InterceptorHelper.get<{ data: AutomationRule[] }>("automations");

export const apiUpdateAutomation = (id: string, data: { enabled?: boolean; config?: Record<string, any> }) =>
    InterceptorHelper.patch<ItemResponse<AutomationRule>>(`automations/${id}`, data);

export const apiRuns = (query: Record<string, any>) => InterceptorHelper.get<ListResponse<AutomationRun>>("automation-runs", query);

export const apiRetryRun = (id: string) => InterceptorHelper.post<ItemResponse<AutomationRun>>(`automation-runs/${id}/retry`);
