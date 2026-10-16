import InterceptorHelper, { newId } from "@/InterceptorHelper.ts";
import type {
    AutomationRun, DuplicateMatch, ImportJob, ImportPreviewRow, ItemResponse, Lead, LeadActivity, ListResponse, Task,
} from "@/types/domain";

export const apiLeads = (query: Record<string, any>) => InterceptorHelper.get<ListResponse<Lead>>("leads", query);

export const apiLead = (id: string) => InterceptorHelper.get<ItemResponse<Lead>>(`leads/${id}`);

// Idempotency-Key protects against double-submits creating two leads
// the form keeps one key per open dialog, so a double-submit or retry is applied once
export const apiCreateLead = (data: any, idempotencyKey: string = newId()) =>
    InterceptorHelper.post<ItemResponse<Lead>>("leads", data, { idempotencyKey });

export const apiUpdateLead = (id: string, data: any) => InterceptorHelper.patch<ItemResponse<Lead>>(`leads/${id}`, data);

export const apiDeleteLead = (id: string) => InterceptorHelper.delete(`leads/${id}`);

export const apiMoveLead = (id: string, data: { stageId: string; lostReason?: string | null }) =>
    InterceptorHelper.post<ItemResponse<Lead>>(`leads/${id}/move`, data);

export const apiDoNotContact = (id: string, value: boolean, reason?: string) =>
    InterceptorHelper.post<ItemResponse<Lead>>(`leads/${id}/do-not-contact`, { value, reason });

export const apiCheckDuplicates = (data: { email?: string | null; phone?: string | null; excludeId?: string }) =>
    InterceptorHelper.post<{ data: DuplicateMatch[] }>("leads/check-duplicates", data, { silent: true });

export const apiBulkLeads = (data: { ids: string[]; action: "assign" | "stage" | "add_tags" | "delete"; [k: string]: any }) =>
    InterceptorHelper.post<{ data: { updated: number; failed: Array<{ id: string; message: string }> } }>("leads/bulk", data);

export const apiLeadActivities = (id: string) => InterceptorHelper.get<ListResponse<LeadActivity>>(`leads/${id}/activities`);

export const apiLogActivity = (id: string, data: { type: string; note?: string; outcome?: string }) =>
    InterceptorHelper.post<ItemResponse<LeadActivity>>(`leads/${id}/activities`, data);

export const apiLeadTasks = (id: string) => InterceptorHelper.get<{ data: Task[] }>(`leads/${id}/tasks`);

export const apiCreateLeadTask = (id: string, data: any) =>
    InterceptorHelper.post<ItemResponse<Task>>(`leads/${id}/tasks`, data, { idempotencyKey: newId() });

export const apiClassifyLead = (id: string) => InterceptorHelper.post<ItemResponse<Lead>>(`leads/${id}/ai/classify`);

export const apiReviewAi = (id: string, data: { status: "confirmed" | "rejected"; apply?: boolean; applyPriority?: boolean; corrections?: any }) =>
    InterceptorHelper.patch<ItemResponse<Lead>>(`leads/${id}/ai`, data);

export const apiLeadRuns = (id: string) => InterceptorHelper.get<{ data: AutomationRun[] }>(`leads/${id}/automation-runs`);

export const apiImportPreview = (data: { rows: Record<string, string>[]; mapping: Record<string, string> }) =>
    InterceptorHelper.post<{ data: { totals: { rows: number; valid: number; duplicate: number; invalid: number }; rows: ImportPreviewRow[] } }>(
        "leads/imports/preview", data
    );

export const apiImportCommit = (data: { rows: Record<string, string>[]; mapping: Record<string, string>; duplicatePolicy: "skip" | "merge"; fileName: string; ownerId?: string | null }) =>
    InterceptorHelper.post<ItemResponse<ImportJob>>("leads/imports", data, { idempotencyKey: newId() });

export const apiPipelineBoard = (query: Record<string, any>) =>
    InterceptorHelper.get<{ data: { stages: Array<{ id: string; name: string; type: string; color: string; total: number; leads: Lead[] }> } }>("pipeline/board", query);
