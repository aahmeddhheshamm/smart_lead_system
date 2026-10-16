<script setup lang="ts">
// LeadFlow AI logo. `full` = mark + wordmark, `mark` = icon only. Pure SVG + text so it
// follows the theme tokens in both light and dark mode.
withDefaults(defineProps<{ variant?: "full" | "mark"; imgClass?: string; inverted?: boolean }>(), {
  variant: "full",
  imgClass: "h-9",
  inverted: false,
});
</script>

<template>
  <span class="inline-flex items-center gap-2 select-none" :class="imgClass" aria-label="LeadFlow AI">
    <svg viewBox="0 0 40 40" class="h-full w-auto shrink-0" aria-hidden="true">
      <defs>
        <linearGradient id="lf-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="rgb(var(--brand-cyan))" />
          <stop offset="0.5" stop-color="rgb(var(--brand-blue))" />
          <stop offset="1" stop-color="rgb(var(--brand-violet))" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="10" fill="url(#lf-grad)" />
      <path d="M11 11v18h9" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M20 20c3-6 6-8 10-8M24 27c2-3 4-4 6-4" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" />
    </svg>
    <span
        v-if="variant === 'full'"
        class="font-bold text-lg leading-none whitespace-nowrap"
        :class="inverted ? 'text-[#fff]' : 'text-heading'"
    >
      LeadFlow <span class="bg-brand-gradient bg-clip-text text-transparent">AI</span>
    </span>
  </span>
</template>
