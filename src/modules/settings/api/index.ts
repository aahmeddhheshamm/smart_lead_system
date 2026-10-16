import InterceptorHelper from "@/InterceptorHelper.ts";
import type { AuditLog, Invitation, ItemResponse, LeadSource, ListResponse, Member, Organization, PipelineStage, Subscription } from "@/types/domain";

export const apiOrganization = () => InterceptorHelper.get<ItemResponse<Organization>>("organizations/current");
export const apiUpdateOrganization = (data: Partial<Organization>) => InterceptorHelper.patch<ItemResponse<Organization>>("organizations/current", data);
export const apiCompleteOnboarding = () => InterceptorHelper.post<ItemResponse<Organization>>("organizations/current/complete-onboarding");

export const apiMembers = (query: Record<string, any> = {}) => InterceptorHelper.get<ListResponse<Member>>("members", query);
export const apiUpdateMember = (id: string, data: { role?: string; status?: string; specialties?: string[] }) =>
    InterceptorHelper.patch<ItemResponse<Member>>(`members/${id}`, data);

export const apiInvitations = () => InterceptorHelper.get<{ data: Invitation[] }>("invitations");
export const apiInvite = (data: { email: string; role: string }) =>
    InterceptorHelper.post<ItemResponse<Invitation> & { debugInviteToken?: string }>("invitations", data);
export const apiRevokeInvitation = (id: string) => InterceptorHelper.delete(`invitations/${id}`);

export const apiRoles = () => InterceptorHelper.get<{ data: Array<{ key: string; permissions: string[]; members: number }> }>("roles");

export const apiSaveStages = (stages: Array<Partial<PipelineStage>>) => InterceptorHelper.put<{ data: PipelineStage[] }>("pipeline-stages", { stages });

export const apiCreateSource = (data: { name: string; type: string }) => InterceptorHelper.post<ItemResponse<LeadSource>>("lead-sources", data);
export const apiUpdateSource = (id: string, data: Partial<LeadSource>) => InterceptorHelper.patch<ItemResponse<LeadSource>>(`lead-sources/${id}`, data);
export const apiDeleteSource = (id: string) => InterceptorHelper.delete(`lead-sources/${id}`);

export const apiSubscription = () => InterceptorHelper.get<ItemResponse<Subscription>>("billing/subscription");

export const apiAuditLogs = (query: Record<string, any>) => InterceptorHelper.get<ListResponse<AuditLog>>("audit-logs", query);
