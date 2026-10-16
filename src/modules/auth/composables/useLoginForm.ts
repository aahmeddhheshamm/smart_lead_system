import useMutate from "@/composables/useMutate";
import { useForm } from "vee-validate";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";
import * as yup from "yup";
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { apiLogin } from "@/modules/auth/api";
import { useAuthStore } from "@/store/auth.ts";

export function useLoginForm() {
    const authStore = useAuthStore();
    const router = useRouter();
    const route = useRoute();
    const { t, changeLocale } = useLocaleSettings();
    const errorMessage = ref("");

    const schema = computed(() =>
        yup.object({
            email: yup.string().trim().email(t("validations.email")).required(t("validations.required", { field: t("fields.email") })),
            password: yup.string().required(t("validations.required", { field: t("fields.password") })),
        })
    );

    const { handleSubmit, setValues } = useForm<{ email: string; password: string }>({
        validationSchema: schema,
        initialValues: { email: "", password: "" },
    });

    const { mutate, isPending } = useMutate({
        mutationKey: ["login"],
        mutationFn: apiLogin,
    });

    const onSubmit = handleSubmit((values) => {
        errorMessage.value = "";
        mutate(
            { email: values.email.trim().toLowerCase(), password: values.password },
            {
                onSuccess: (res) => {
                    authStore.setSession(res.data);
                    // first login on this device: follow the organization's language
                    if (!localStorage.getItem("locale")) changeLocale(res.data.organization.locale === "ar" ? "AR" : "EN");
                    const redirect = typeof route.query.redirect === "string" && route.query.redirect.startsWith("/") ? route.query.redirect : null;
                    router.push(redirect ?? { name: "dashboard" });
                },
                onError: (err: any) => {
                    errorMessage.value = err?.error?.message ?? t("messages.error");
                },
            }
        );
    });

    return { onSubmit, isPending, errorMessage, setValues };
}
