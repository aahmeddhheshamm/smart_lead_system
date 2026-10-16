import InterceptorHelper, { newId } from "@/InterceptorHelper.ts";
import type { ItemResponse, ListResponse, Task } from "@/types/domain";

export const apiTasks = (query: Record<string, any>) =>
    InterceptorHelper.get<ListResponse<Task> & { counts: { today: number; overdue: number; upcoming: number } }>("tasks", query);

export const apiCreateTask = (data: any) => InterceptorHelper.post<ItemResponse<Task>>("tasks", data, { idempotencyKey: newId() });

export const apiUpdateTask = (id: string, data: any) => InterceptorHelper.patch<ItemResponse<Task>>(`tasks/${id}`, data);

export const apiCompleteTask = (id: string, data: { outcome?: string | null; notes?: string | null; followUp?: { title: string; dueAt: string; type?: string } | null }) =>
    InterceptorHelper.post<ItemResponse<Task> & { followUp: Task | null }>(`tasks/${id}/complete`, data);

export const apiPostponeTask = (id: string, dueAt: string) => InterceptorHelper.post<ItemResponse<Task>>(`tasks/${id}/postpone`, { dueAt });

export const apiCancelTask = (id: string) => InterceptorHelper.post<ItemResponse<Task>>(`tasks/${id}/cancel`);
