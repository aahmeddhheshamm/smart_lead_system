import InterceptorHelper, { USE_MOCK } from "@/InterceptorHelper.ts";
import * as backend from "@/api/backend";
import type { AutomationRule, AutomationRun, ItemResponse, ListResponse } from "@/types/domain";

export const apiAutomations = (): Promise<{ data: AutomationRule[] }> =>
    USE_MOCK ? InterceptorHelper.get("automations") : backend.automations.list();

// backend: enable/disable are dedicated actions, config is a PATCH
export const apiUpdateAutomation = (id: string, data: { enabled?: boolean; config?: Record<string, any> }): Promise<ItemResponse<AutomationRule>> =>
    USE_MOCK ? InterceptorHelper.patch(`automations/${id}`, data) : backend.automations.update(id, data);

export const apiRunAutomationNow = (id: string) => (USE_MOCK ? Promise.resolve({}) : backend.automations.runNow(id));

export const apiResetAutomation = (id: string) => (USE_MOCK ? Promise.resolve({}) : backend.automations.resetConfig(id));

export const apiRuns = (query: Record<string, any>): Promise<ListResponse<AutomationRun>> =>
    USE_MOCK ? InterceptorHelper.get("automation-runs", query) : backend.automations.runs(query);

export const apiRetryRun = (id: string): Promise<ItemResponse<AutomationRun>> =>
    USE_MOCK ? InterceptorHelper.post(`automation-runs/${id}/retry`) : backend.automations.retry(id);
