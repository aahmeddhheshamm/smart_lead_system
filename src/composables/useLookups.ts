import { computed } from "vue";
import useFetch from "@/composables/useFetch";
import InterceptorHelper from "@/InterceptorHelper";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import type { LeadSource, Member, PipelineStage } from "@/types/domain";

// Cached option lists shared by forms, filters and the board.
// Query keys start with the resource name so a mutation on it refreshes them.

export function useStages() {
    const q = useFetch({
        queryKey: ["pipeline-stages"],
        queryFn: () => InterceptorHelper.get<{ data: PipelineStage[] }>("pipeline-stages"),
        options: { staleTime: 60_000 },
    });
    const stages = computed<PipelineStage[]>(() => q.data.value?.data ?? []);
    const stageOptions = computed(() => stages.value.map((s) => ({ id: s.id, name: s.name })));
    return { ...q, stages, stageOptions };
}

export function useSources() {
    const q = useFetch({
        queryKey: ["lead-sources"],
        queryFn: () => InterceptorHelper.get<{ data: Array<LeadSource & { leads: number }> }>("lead-sources"),
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
        queryFn: () => InterceptorHelper.get<{ data: Member[] }>("members", { status: "active", pageSize: 100 }),
        options: { staleTime: 60_000 },
    });
    const members = computed<Member[]>(() => q.data.value?.data ?? []);
    const memberOptions = computed(() => members.value.map((m) => ({ id: m.user.id, name: m.user.name })));
    return { ...q, members, memberOptions };
}

export function useTags() {
    const q = useFetch({
        queryKey: ["tags"],
        queryFn: () => InterceptorHelper.get<{ data: string[] }>("tags"),
        options: { staleTime: 60_000 },
    });
    return { ...q, tags: computed<string[]>(() => q.data.value?.data ?? []) };
}

// Translated option list from a key array: options.<group>.<key>
export function useOptions(group: string, keys: readonly string[]) {
    const { t } = useLocaleSettings();
    return computed(() => keys.map((id) => ({ id, name: t(`options.${group}.${id}`) })));
}
