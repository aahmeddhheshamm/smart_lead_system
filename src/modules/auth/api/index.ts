import InterceptorHelper, { USE_MOCK } from "@/InterceptorHelper.ts";
import * as backend from "@/api/backend";
import type { ItemResponse, MeResponse, Session } from "@/types/domain";

// Every function resolves to the same shape in both modes: the backend adapter stores the
// JWT pair itself, the mock returns a `token` that the auth store persists.
type SessionResponse = ItemResponse<MeResponse & { token?: string }>;

export const apiLogin = (data: { email: string; password: string }): Promise<SessionResponse> =>
    USE_MOCK
        ? InterceptorHelper.post<SessionResponse>("auth/login", data, { silent: true })
        : backend.auth.login(data.email, data.password).then((me) => ({ data: me }));

export const apiRegister = (data: {
    name: string;
    email: string;
    password: string;
    organizationName: string;
    industry: string;
    timezone: string;
    locale: string;
}): Promise<SessionResponse> =>
    USE_MOCK ? InterceptorHelper.post<SessionResponse>("auth/register", data) : backend.auth.register(data).then((me) => ({ data: me }));

export const apiForgetPassword = (data: { email: string }): Promise<{ message?: string; debugResetToken?: string }> =>
    USE_MOCK ? InterceptorHelper.post("auth/forgot-password", data) : backend.auth.forgotPassword(data.email);

// Mock links carry `token`; the Django reset link carries `uid` + `token`
export const apiResetPassword = (data: { token: string; uid?: string; password: string }): Promise<{ message?: string }> =>
    USE_MOCK ? InterceptorHelper.post("auth/reset-password", data) : backend.auth.resetPassword(data.uid ?? "", data.token, data.password);

export const getMe = (): Promise<ItemResponse<MeResponse>> =>
    USE_MOCK ? InterceptorHelper.get("auth/me", {}, { silent: true }) : backend.loadSession().then((me) => ({ data: me }));

// Revokes the session server-side (not just locally)
export const apiLogout = () => (USE_MOCK ? InterceptorHelper.post("auth/logout", undefined, { silent: true }) : backend.auth.logout());

export const apiChangePassword = (data: { currentPassword: string; password: string }): Promise<{ message?: string }> =>
    USE_MOCK ? InterceptorHelper.post("auth/change-password", data) : backend.auth.changePassword(data.currentPassword, data.password);

export const apiSessions = (): Promise<{ data: Session[] }> =>
    USE_MOCK ? InterceptorHelper.get("auth/sessions") : backend.auth.sessions().then((data) => ({ data }));

export const apiRevokeSession = (id: string) =>
    USE_MOCK ? InterceptorHelper.delete(`auth/sessions/${id}`) : backend.auth.revokeSession(id);

export const apiRevokeOtherSessions = () => (USE_MOCK ? Promise.resolve({}) : backend.auth.revokeOtherSessions());

export const apiInvitation = (token: string): Promise<{ data: { email: string; role: string; organization: { id: string; name: string }; expiresAt: string } }> =>
    USE_MOCK
        ? InterceptorHelper.get(`invitations/token/${token}`, {}, { silent: true })
        : backend.auth.lookupInvitation(token).then((data) => ({ data }));

export const apiAcceptInvitation = (token: string, data: { name?: string; password?: string }): Promise<SessionResponse> =>
    USE_MOCK
        ? InterceptorHelper.post<SessionResponse>(`invitations/token/${token}/accept`, data)
        : backend.auth.acceptInvitation(token, data).then((me) => ({ data: me }));

export const apiVerifyEmail = (token: string) => (USE_MOCK ? Promise.resolve({}) : backend.auth.verifyEmail(token));

export const apiResendVerification = () => (USE_MOCK ? Promise.resolve({}) : backend.auth.resendVerification());

export const apiSwitchOrganization = (id: string): Promise<ItemResponse<MeResponse>> =>
    USE_MOCK ? getMe() : backend.auth.switchOrganization(id).then((me) => ({ data: me }));
