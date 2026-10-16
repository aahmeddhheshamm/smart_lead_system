import InterceptorHelper from "@/InterceptorHelper.ts";
import type { DashboardSummary } from "@/types/domain";

export const apiDashboardSummary = (query: { from: string; to: string; ownerId?: string }) =>
    InterceptorHelper.get<{ data: DashboardSummary }>("dashboard/summary", query);
