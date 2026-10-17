import InterceptorHelper, { newId, USE_MOCK } from "@/InterceptorHelper.ts";
import * as backend from "@/api/backend";
import type { ItemResponse, ListResponse, Task } from "@/types/domain";

type TaskList = ListResponse<Task> & { counts: { today: number; overdue: number; upcoming: number } };

// view: today | overdue | upcoming | completed | range (with from/to)
export const apiTasks = (query: Record<string, any>): Promise<TaskList> =>
    USE_MOCK ? InterceptorHelper.get("tasks", query) : backend.tasks.list(query);

export const apiCreateTask = (data: any): Promise<ItemResponse<Task>> =>
    USE_MOCK ? InterceptorHelper.post("tasks", data, { idempotencyKey: newId() }) : backend.tasks.create(data);

export const apiUpdateTask = (id: string, data: any): Promise<ItemResponse<Task>> =>
    USE_MOCK ? InterceptorHelper.patch(`tasks/${id}`, data) : backend.tasks.update(id, data);

export const apiCompleteTask = (id: string, data: { outcome?: string | null; notes?: string | null; followUp?: { title: string; dueAt: string; type?: string } | null }): Promise<ItemResponse<Task> & { followUp: Task | null }> =>
    USE_MOCK ? InterceptorHelper.post(`tasks/${id}/complete`, data) : backend.tasks.complete(id, data);

// backend: POST tasks/{id}/snooze { until }
export const apiPostponeTask = (id: string, dueAt: string): Promise<ItemResponse<Task>> =>
    USE_MOCK ? InterceptorHelper.post(`tasks/${id}/postpone`, { dueAt }) : backend.tasks.postpone(id, dueAt);

export const apiCancelTask = (id: string): Promise<ItemResponse<Task>> =>
    USE_MOCK ? InterceptorHelper.post(`tasks/${id}/cancel`) : backend.tasks.cancel(id);
