<template>
  <span
      v-if="resolvedLabel"
      class="inline-flex items-center gap-1 px-2 py-1 rounded-[4px] text-xs font-medium leading-none tracking-[0.5px] whitespace-nowrap"
      :class="SEVERITY_CLASSES[resolvedSeverity]"
  >
    <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="DOT_CLASSES[resolvedSeverity]" />
    {{ resolvedLabel }}
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { statusColor } from "@/constants/status.ts";

type Severity = "success" | "danger" | "warn" | "info" | "neutral";

const SEVERITY_CLASSES: Record<Severity, string> = {
  success: "bg-[#E8FAF0] text-[#03C95A]",
  danger: "bg-[#FAE7E7] text-[#E70D0D]",
  warn: "bg-[#FFF9E9] text-[#E0A800]",
  info: "bg-[#EBF4FF] text-[#1B84FF]",
  neutral: "bg-[#F3F4F6] text-[#6B7280]",
};

const DOT_CLASSES: Record<Severity, string> = {
  success: "bg-[#03C95A]",
  danger: "bg-[#E70D0D]",
  warn: "bg-[#E0A800]",
  info: "bg-[#1B84FF]",
  neutral: "bg-[#6B7280]",
};

const props = withDefaults(
    defineProps<{
      // Raw status value coming from the API, e.g. "active", "pending_otp"
      status?: string | null;
      // Overrides the color bucket derived from constants/status.ts
      severity?: Severity;
      // Overrides the translated label derived from the status.* locale namespace
      label?: string;
    }>(),
    { status: "" }
);

const { t, te } = useI18n();

const key = computed(() => String(props.status ?? "").trim());

const resolvedSeverity = computed<Severity>(() => {
  if (props.severity) return props.severity;
  const raw = key.value;
  return (statusColor[raw] ?? statusColor[raw.toLowerCase()] ?? "neutral") as Severity;
});

// Falls back to a humanized version of the raw value ("pending_otp" -> "Pending Otp")
// so an unmapped/untranslated status still reads cleanly instead of showing a raw key.
const humanize = (value: string) =>
    value
        .replace(/[_-]+/g, " ")
        .trim()
        .replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());

const resolvedLabel = computed(() => {
  if (props.label) return props.label;
  const raw = key.value;
  if (!raw) return "";

  if (te(`status.${raw}`)) return t(`status.${raw}`);

  const lower = raw.toLowerCase();
  if (te(`status.${lower}`)) return t(`status.${lower}`);

  return humanize(raw);
});
</script>
