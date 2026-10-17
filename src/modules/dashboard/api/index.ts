import InterceptorHelper, { USE_MOCK } from "@/InterceptorHelper.ts";
import * as backend from "@/api/backend";
import type { DashboardSummary } from "@/types/domain";

export const apiDashboardSummary = (query: { from: string; to: string; ownerId?: string }): Promise<{ data: DashboardSummary }> =>
    USE_MOCK ? InterceptorHelper.get("dashboard/summary", query) : backend.dashboardSummary(query);
