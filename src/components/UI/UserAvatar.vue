<script setup lang="ts">
import { computed } from "vue";
import { initials } from "@/utils";

const props = withDefaults(defineProps<{ name?: string | null; size?: "xs" | "sm" | "md" | "lg" }>(), { name: "", size: "sm" });

// stable color per name so the same person always gets the same avatar
const palette = ["#4F5BEA", "#378FF5", "#8B5CF6", "#03A66F", "#E0A800", "#E2583E", "#0EA5B7"];
const color = computed(() => {
  const s = props.name ?? "";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
});
const sizeClass = computed(() => ({ xs: "w-6 h-6 text-[10px]", sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-14 h-14 text-lg" })[props.size]);
</script>

<template>
  <span
      class="inline-flex items-center justify-center rounded-full font-semibold text-[#fff] shrink-0"
      :class="sizeClass"
      :style="{ backgroundColor: name ? color : '#94a3b8' }"
      :title="name || ''"
      aria-hidden="true"
  >{{ name ? initials(name) : "?" }}</span>
</template>
