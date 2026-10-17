import InterceptorHelper, { USE_MOCK } from "@/InterceptorHelper.ts";
import * as backend from "@/api/backend";
import type {
    AuditLog, Invitation, ItemResponse, LeadSource, ListResponse, Member, Organization, PipelineStage, Plan, Subscription,
} from "@/types/domain";

export const apiOrganization = (): Promise<ItemResponse<Organization>> =>
    USE_MOCK ? InterceptorHelper.get("organizations/current") : backend.organization.current().then((data) => ({ data }));

export const apiUpdateOrganization = (data: Partial<Organization>): Promise<ItemResponse<Organization>> =>
    USE_MOCK ? InterceptorHelper.patch("organizations/current", data) : backend.organization.update(data).then((data) => ({ data }));

// The API has no onboarding flag: the wizard is shown once right after sign-up
export const apiCompleteOnboarding = (): Promise<ItemResponse<Organization>> =>
    USE_MOCK ? InterceptorHelper.post("organizations/current/complete-onboarding") : apiOrganization();

export const apiMembers = (query: Record<string, any> = {}): Promise<ListResponse<Member>> =>
    USE_MOCK ? InterceptorHelper.get("members", query) : backend.team.members(query);

export const apiUpdateMember = (id: string, data: { role?: string; status?: string; specialties?: string[] }): Promise<ItemResponse<Member>> =>
    USE_MOCK ? InterceptorHelper.patch(`members/${id}`, data) : backend.team.updateMember(id, data);

export const apiInvitations = (): Promise<{ data: Invitation[] }> =>
    USE_MOCK ? InterceptorHelper.get("invitations") : backend.team.invitations();

export const apiInvite = (data: { email: string; role: string }): Promise<ItemResponse<Invitation> & { debugInviteToken?: string }> =>
    USE_MOCK ? InterceptorHelper.post("invitations", data) : backend.team.invite(data.email, data.role);

export const apiRevokeInvitation = (id: string) =>
    USE_MOCK ? InterceptorHelper.delete(`invitations/${id}`) : backend.team.revokeInvitation(id);

export const apiResendInvitation = (id: string) => (USE_MOCK ? Promise.resolve({}) : backend.team.resendInvitation(id));

export const apiRoles = (): Promise<{ data: Array<{ key: string; name?: string; permissions: string[]; members: number }> }> =>
    USE_MOCK ? InterceptorHelper.get("roles") : backend.team.roles();

export const apiSaveStages = (stages: Array<Partial<PipelineStage>>): Promise<{ data: PipelineStage[] }> =>
    USE_MOCK ? InterceptorHelper.put("pipeline-stages", { stages }) : backend.settings.saveStages(stages);

export const apiCreateSource = (data: { name: string; type: string }): Promise<ItemResponse<LeadSource>> =>
    USE_MOCK ? InterceptorHelper.post("lead-sources", data) : backend.settings.createSource(data);

export const apiUpdateSource = (id: string, data: Partial<LeadSource>): Promise<ItemResponse<LeadSource>> =>
    USE_MOCK ? InterceptorHelper.patch(`lead-sources/${id}`, data) : backend.settings.updateSource(id, data);

export const apiDeleteSource = (id: string) =>
    USE_MOCK ? InterceptorHelper.delete(`lead-sources/${id}`) : backend.settings.deleteSource(id);

export const apiSubscription = (): Promise<ItemResponse<Subscription>> =>
    USE_MOCK ? InterceptorHelper.get("billing/subscription") : backend.billing.subscription();

export const apiPlans = (): Promise<{ data: Plan[] }> => (USE_MOCK ? Promise.resolve({ data: [] }) : backend.billing.plans());

export const apiChangePlan = (planCode: string) => (USE_MOCK ? Promise.resolve({}) : backend.billing.changePlan(planCode));

export const apiAuditLogs = (query: Record<string, any>): Promise<ListResponse<AuditLog>> =>
    USE_MOCK ? InterceptorHelper.get("audit-logs", query) : backend.auditLogs(query);
