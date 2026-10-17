import InterceptorHelper, { USE_MOCK } from "@/InterceptorHelper.ts";
import * as backend from "@/api/backend";
import type { Integration, IntegrationProvider, ItemResponse } from "@/types/domain";

export const apiIntegrations = (): Promise<{ data: Integration[] }> =>
    USE_MOCK ? InterceptorHelper.get("integrations") : backend.integrations.list();

// For website_form the response carries the signing `secret` once; store it now or rotate later
export const apiConnect = (provider: IntegrationProvider, data: Record<string, any> = {}): Promise<ItemResponse<Integration> & { secret?: string }> =>
    USE_MOCK ? InterceptorHelper.post(`integrations/${provider}/connect`, data) : backend.integrations.connect(provider, data);

export const apiRotateSecret = (provider: IntegrationProvider): Promise<{ secret?: string }> =>
    USE_MOCK
        ? InterceptorHelper.post(`integrations/${provider}/connect`, {}).then((r: any) => ({ secret: r.secret }))
        : backend.integrations.rotateSecret(provider);

export const apiDisconnect = (provider: IntegrationProvider) =>
    USE_MOCK ? InterceptorHelper.post(`integrations/${provider}/disconnect`) : backend.integrations.disconnect(provider);

export const apiTestIntegration = (provider: IntegrationProvider): Promise<{ data: { ok: boolean; created?: boolean; lead?: { id: string; name: string }; message?: string } }> =>
    USE_MOCK ? InterceptorHelper.post(`integrations/${provider}/test`) : backend.integrations.test(provider);
