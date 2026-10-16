import * as yup from "yup";
import { useLocaleSettings } from "@/composables/useLocaleSettings.ts";

// Same policy the API enforces: 8+ characters with letters and numbers
export function usePasswordRules() {
    const { t } = useLocaleSettings();
    const password = () =>
        yup
            .string()
            .required(t("validations.required", { field: t("fields.password") }))
            .min(8, t("validations.minLength", { field: t("fields.password"), length: 8 }))
            .matches(/[A-Za-z]/, t("validations.passwordLetters"))
            .matches(/\d/, t("validations.passwordNumbers"));
    const confirm = (ref = "password") =>
        yup
            .string()
            .oneOf([yup.ref(ref)], t("validations.passwordMatch"))
            .required(t("validations.required", { field: t("fields.confirmPassword") }));
    return { password, confirm };
}
