import InterceptorHelper, { newId, USE_MOCK } from "@/InterceptorHelper.ts";
import * as backend from "@/api/backend";
import type {
    AutomationRun, DuplicateMatch, ImportJob, ImportPreviewRow, ItemResponse, Lead, LeadActivity, LeadAiInsights, ListResponse, Task,
} from "@/types/domain";

// Each function returns the same domain shape whether it talks to the mock (VITE_USE_MOCK=true)
// or to the LeadFlow backend through src/api/backend.ts.

export const apiLeads = (query: Record<string, any>): Promise<ListResponse<Lead>> =>
    USE_MOCK ? InterceptorHelper.get("leads", query) : backend.leads.list(query);

// CSV of the filtered list (blob)
export const apiExportLeads = (query: Record<string, any>) =>
    USE_MOCK ? InterceptorHelper.get("leads/export", { format: "csv", ...query }) : backend.leads.export(query);

export const apiLead = (id: string): Promise<ItemResponse<Lead>> =>
    USE_MOCK ? InterceptorHelper.get(`leads/${id}`) : backend.leads.get(id);

// the form keeps one key per open dialog, so a double-submit or retry is applied once
export const apiCreateLead = (data: any, idempotencyKey: string = newId()): Promise<ItemResponse<Lead>> =>
    USE_MOCK ? InterceptorHelper.post("leads", data, { idempotencyKey }) : backend.leads.create(data, idempotencyKey);

export const apiUpdateLead = (id: string, data: any): Promise<ItemResponse<Lead>> =>
    USE_MOCK ? InterceptorHelper.patch(`leads/${id}`, data) : backend.leads.update(id, data);

export const apiDeleteLead = (id: string) => (USE_MOCK ? InterceptorHelper.delete(`leads/${id}`) : backend.leads.remove(id));

export const apiMoveLead = (id: string, data: { stageId: string; lostReason?: string | null }): Promise<ItemResponse<Lead>> =>
    USE_MOCK ? InterceptorHelper.post(`leads/${id}/move`, data) : backend.leads.move(id, data.stageId, data.lostReason);

export const apiDoNotContact = (id: string, value: boolean, reason?: string): Promise<ItemResponse<Lead>> =>
    USE_MOCK ? InterceptorHelper.post(`leads/${id}/do-not-contact`, { value, reason }) : backend.leads.doNotContact(id, value, reason);

export const apiCheckDuplicates = (data: { email?: string | null; phone?: string | null; excludeId?: string }): Promise<{ data: DuplicateMatch[] }> =>
    USE_MOCK ? InterceptorHelper.post("leads/check-duplicates", data, { silent: true }) : backend.leads.checkDuplicates(data);

export const apiBulkLeads = (data: { ids: string[]; action: "assign" | "stage" | "add_tags" | "delete"; [k: string]: any }): Promise<{ data: { updated: number; failed: Array<{ id: string; message: string }> } }> =>
    USE_MOCK ? InterceptorHelper.post("leads/bulk", data) : backend.leads.bulk(data);

export const apiLeadActivities = (id: string): Promise<ListResponse<LeadActivity>> =>
    USE_MOCK ? InterceptorHelper.get(`leads/${id}/activities`) : backend.leads.activities(id);

export const apiLogActivity = (id: string, data: { type: string; note?: string; outcome?: string }): Promise<ItemResponse<LeadActivity>> =>
    USE_MOCK ? InterceptorHelper.post(`leads/${id}/activities`, data) : backend.leads.logActivity(id, data);

export const apiLeadTasks = (id: string): Promise<{ data: Task[] }> =>
    USE_MOCK ? InterceptorHelper.get(`leads/${id}/tasks`) : backend.leads.tasks(id);

export const apiCreateLeadTask = (id: string, data: any): Promise<ItemResponse<Task>> =>
    USE_MOCK ? InterceptorHelper.post(`leads/${id}/tasks`, data, { idempotencyKey: newId() }) : backend.leads.createTask(id, data);

/* ---------- AI insights ---------- */

export const apiLeadAi = async (id: string): Promise<LeadAiInsights | null> =>
    USE_MOCK ? (await apiLead(id)).data.ai : backend.insights.forLead(id);

// mock: synchronous classification; backend: queues insights for n8n (status "pending")
export const apiClassifyLead = (id: string) =>
    USE_MOCK ? InterceptorHelper.post(`leads/${id}/ai/classify`) : backend.insights.request(id);

export const apiReviewAi = (id: string, ai: LeadAiInsights, data: { status: "confirmed" | "rejected"; apply?: boolean; applyPriority?: boolean }) =>
    USE_MOCK ? InterceptorHelper.patch(`leads/${id}/ai`, data) : backend.insights.review(ai, data.status, !!data.apply);

export const apiLeadRuns = (id: string): Promise<{ data: AutomationRun[] }> =>
    USE_MOCK ? InterceptorHelper.get(`leads/${id}/automation-runs`) : backend.leads.runs(id);

/* ---------- CSV import ---------- */

type PreviewResult = { importId?: string; data: { totals: { rows: number; valid: number; duplicate: number; invalid: number }; rows: ImportPreviewRow[] } };

// mock validates parsed rows; the backend receives the file itself and parses it server-side
export const apiImportPreview = (input: { file: File; rows: Record<string, string>[]; mapping: Record<string, string> }): Promise<PreviewResult> =>
    USE_MOCK
        ? InterceptorHelper.post("leads/imports/preview", { rows: input.rows, mapping: input.mapping })
        : backend.imports.preview(input.file, input.mapping);

export const apiImportCommit = (input: { importId?: string; rows: Record<string, string>[]; mapping: Record<string, string>; duplicatePolicy: "skip" | "merge"; fileName: string }): Promise<ItemResponse<ImportJob>> =>
    USE_MOCK
        ? InterceptorHelper.post("leads/imports", input, { idempotencyKey: newId() })
        : backend.imports.commit(input.importId!, input.duplicatePolicy);

export const apiImportCancel = (importId?: string) => (USE_MOCK || !importId ? Promise.resolve({}) : backend.imports.cancel(importId));

/* ---------- pipeline board ---------- */

export const apiPipelineBoard = (query: Record<string, any>): Promise<{ data: { stages: Array<{ id: string; name: string; type: string; color: string; total: number; leads: Lead[] }> } }> =>
    USE_MOCK ? InterceptorHelper.get("pipeline/board", query) : backend.board(query);
