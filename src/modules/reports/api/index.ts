import InterceptorHelper from "@/InterceptorHelper.ts";
import type { ReportsResponse } from "@/types/domain";

export const apiReports = (query: { from: string; to: string; ownerId?: string; sourceId?: string }) =>
    InterceptorHelper.get<{ data: ReportsResponse }>("reports", query);
