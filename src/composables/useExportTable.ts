import { ref } from "vue";
import { toast } from "vue3-toastify";
import InterceptorHelper from "@/InterceptorHelper";
import { useDownloadFile } from "@/composables/useDownloadFile";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";

// Downloads `{listUrl}/export?format=csv` with the list's current search/filters applied.
// The backend enforces the export permission and only exports rows the user may see.
export function useExportTable(getListUrl: () => string, getParams: () => Record<string, any> = () => ({})) {
    const { t } = useLocaleSettings();
    const { downloadFile } = useDownloadFile();
    const isExporting = ref(false);

    const exportTable = async (format: "csv" = "csv") => {
        const listUrl = getListUrl();
        if (!listUrl) return;

        isExporting.value = true;
        try {
            const response = await InterceptorHelper.intercept(`${listUrl}/export`, undefined, { format, ...getParams() });
            const stamp = new Date().toISOString().slice(0, 10);
            downloadFile(response, "text/csv;charset=utf-8", `${listUrl.split("/").pop() || "export"}-${stamp}`, format);
            toast.success(t("messages.exportReady"));
        } catch (e) {
            // the interceptor already showed the API error
        } finally {
            isExporting.value = false;
        }
    };

    return { isExporting, exportTable };
}
