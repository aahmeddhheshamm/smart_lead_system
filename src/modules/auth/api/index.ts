import InterceptorHelper from "@/InterceptorHelper.ts";
import type { ItemResponse, MeResponse, Session } from "@/types/domain";

type SessionResponse = ItemResponse<MeResponse & { token?: string }>;

export const apiLogin = (data: { email: string; password: string }) =>
    InterceptorHelper.post<SessionResponse>("auth/login", data, { silent: true });

export const apiRegister = (data: {
    name: string;
    email: string;
    password: string;
    organizationName: string;
    industry: string;
    timezone: string;
    locale: string;
}) => InterceptorHelper.post<SessionResponse>("auth/register", data);

export const apiForgetPassword = (data: { email: string }) =>
    InterceptorHelper.post<{ message: string; debugResetToken?: string }>("auth/forgot-password", data);

export const apiResetPassword = (data: { token: string; password: string }) =>
    InterceptorHelper.post<{ message: string }>("auth/reset-password", data);

export const getMe = () => InterceptorHelper.get<ItemResponse<MeResponse>>("auth/me", {}, { silent: true });

// Revokes the session server-side (not just locally)
export const apiLogout = () => InterceptorHelper.post("auth/logout", undefined, { silent: true });

export const apiChangePassword = (data: { currentPassword: string; password: string }) =>
    InterceptorHelper.post<{ message: string }>("auth/change-password", data);

export const apiSessions = () => InterceptorHelper.get<{ data: Session[] }>("auth/sessions");

export const apiRevokeSession = (id: string) => InterceptorHelper.delete(`auth/sessions/${id}`);

export const apiInvitation = (token: string) =>
    InterceptorHelper.get<{ data: { email: string; role: string; organization: { id: string; name: string }; expiresAt: string } }>(
        `invitations/token/${token}`, {}, { silent: true }
    );

export const apiAcceptInvitation = (token: string, data: { name?: string; password?: string }) =>
    InterceptorHelper.post<SessionResponse>(`invitations/token/${token}/accept`, data);
