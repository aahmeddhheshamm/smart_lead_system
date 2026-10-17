import { computed } from "vue";
import useFetch from "@/composables/useFetch";
import InterceptorHelper, { USE_MOCK } from "@/InterceptorHelper";
import * as backend from "@/api/backend";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import { useAuthStore } from "@/store/auth.ts";
import { CUSTOM_FIELDS_BY_INDUSTRY, LOST_REASONS } from "@/constants/lead";
import type { CustomFieldDefinition, LeadSource, Member, PipelineStage } from "@/types/domain";

// Cached option lists shared by forms, filters and the board.
// Query keys start with the resource name so a mutation on it refreshes them.

export function useStages() {
    const q = useFetch({
        queryKey: ["pipeline-stages"],
        queryFn: (): Promise<{ data: PipelineStage[] }> => (USE_MOCK ? InterceptorHelper.get("pipeline-stages") : backend.lookups.stages()),
        options: { staleTime: 60_000 },
    });
    const stages = computed<PipelineStage[]>(() => q.data.value?.data ?? []);
    const stageOptions = computed(() => stages.value.map((s) => ({ id: s.id, name: s.name })));
    return { ...q, stages, stageOptions };
}

export function useSources() {
    const q = useFetch({
        queryKey: ["lead-sources"],
        queryFn: (): Promise<{ data: Array<LeadSource & { leads: number }> }> => (USE_MOCK ? InterceptorHelper.get("lead-sources") : backend.lookups.sources()),
        options: { staleTime: 60_000 },
    });
    const sources = computed(() => q.data.value?.data ?? []);
    const sourceOptions = computed(() => sources.value.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name })));
    return { ...q, sources, sourceOptions };
}

// Active teammates only: inactive members can never be picked as owner/assignee
export function useActiveMembers() {
    const q = useFetch({
        queryKey: ["members", "active"],
        queryFn: (): Promise<{ data: Member[] }> =>
            USE_MOCK
                ? InterceptorHelper.get("members", { status: "active", pageSize: 100 })
                : backend.team.members({ status: "active", pageSize: 100 }),
        options: { staleTime: 60_000, retry: false },
    });
    const members = computed<Member[]>(() => q.data.value?.data ?? []);
    const memberOptions = computed(() => members.value.map((m) => ({ id: m.user.id, name: m.user.name })));
    return { ...q, members, memberOptions };
}

export function useTags() {
    const q = useFetch({
        queryKey: ["tags"],
        queryFn: (): Promise<{ data: string[] }> => (USE_MOCK ? InterceptorHelper.get("tags") : backend.lookups.tags()),
        options: { staleTime: 60_000 },
    });
    return { ...q, tags: computed<string[]>(() => q.data.value?.data ?? []) };
}

// Lead custom fields: the organization's definitions from the API, or the industry presets in mock mode
export function useCustomFields() {
    const auth = useAuthStore();
    const q = useFetch({
        queryKey: ["custom-fields"],
        queryFn: (): Promise<{ data: CustomFieldDefinition[] }> => backend.lookups.customFields(),
        enabled: !USE_MOCK,
        options: { staleTime: 5 * 60_000 },
    });
    const fields = computed<CustomFieldDefinition[]>(() =>
        USE_MOCK
            ? (CUSTOM_FIELDS_BY_INDUSTRY[auth.organization?.industry ?? "other"] ?? []).map((f) => ({
                id: f.key, key: f.key, label: "", fieldType: f.type, options: [], isRequired: false,
            }))
            : q.data.value?.data ?? []
    );
    return { ...q, fields };
}

// Lost reasons: the organization's own list when the API provides one, else the built-in keys
export function useLostReasons() {
    const auth = useAuthStore();
    const builtIn = useOptions("lostReason", LOST_REASONS);
    return computed(() => {
        const custom = auth.organization?.leadSettings?.lostReasons ?? [];
        return custom.length ? custom.map((r) => ({ id: r, name: r })) : builtIn.value;
    });
}

// Translated option list from a key array: options.<group>.<key>
export function useOptions(group: string, keys: readonly string[]) {
    const { t } = useLocaleSettings();
    return computed(() => keys.map((id) => ({ id, name: t(`options.${group}.${id}`) })));
}
