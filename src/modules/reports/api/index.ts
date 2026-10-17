import InterceptorHelper, { USE_MOCK } from "@/InterceptorHelper.ts";
import * as backend from "@/api/backend";
import type { ReportsResponse } from "@/types/domain";

// backend: combines reports/{sources,team,conversion,response-time,pipeline,lost-reasons}
export const apiReports = (query: { from: string; to: string; ownerId?: string; sourceId?: string }): Promise<{ data: ReportsResponse }> =>
    USE_MOCK ? InterceptorHelper.get("reports", query) : backend.reports(query);
