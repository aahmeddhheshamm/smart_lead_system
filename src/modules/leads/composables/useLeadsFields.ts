import { ref } from "vue";

// Table columns; `ordering` is the API sort key when it differs from `key`
export default function useLeadsFields() {
    const fields = ref([
        { key: "name", label: "fields.lead", sortable: true },
        { key: "stage", label: "fields.stage" },
        { key: "owner", label: "fields.owner" },
        { key: "source", label: "fields.source" },
        { key: "priority", label: "fields.priority", sortable: true },
        { key: "nextFollowUpAt", label: "fields.nextFollowUp", sortable: true },
        { key: "lastContactedAt", label: "fields.lastContacted", sortable: true },
        { key: "createdAt", label: "fields.createdAt", sortable: true },
    ]);
    return { fields };
}
