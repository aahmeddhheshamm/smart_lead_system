<script setup lang="ts">
import { computed, ref } from "vue";
import { useField } from "vee-validate";

// Free-entry tags (Enter / comma to add, Backspace to remove), with suggestions
const props = withDefaults(defineProps<{ name: string; label?: string; placeholder?: string; suggestions?: string[] }>(), {
  label: "",
  placeholder: "",
  suggestions: () => [],
});

const { value, errorMessage, setValue } = useField<string[]>(() => props.name, undefined, { initialValue: [] });
const draft = ref("");
const listId = `tags-${Math.random().toString(36).slice(2, 8)}`;
const tags = computed(() => value.value ?? []);

const add = (raw: string) => {
  const tag = raw.trim().toLowerCase().replace(/,+$/, "");
  if (tag && !tags.value.includes(tag) && tag.length <= 30) setValue([...tags.value, tag]);
  draft.value = "";
};
const remove = (tag: string) => setValue(tags.value.filter((t) => t !== tag));
const onKey = (e: KeyboardEvent) => {
  if (e.key === "Enter" || e.key === ",") {
    e.preventDefault();
    add(draft.value);
  } else if (e.key === "Backspace" && !draft.value && tags.value.length) {
    remove(tags.value[tags.value.length - 1]);
  }
};
</script>

<template>
  <div>
    <label v-if="label" :for="listId + '-input'" class="flex gap-1 items-center leading-normal text-heading mb-1.5 font-medium text-sm">{{ label }}</label>
    <div class="min-h-10 w-full rounded border border-line bg-white px-2 py-1.5 flex flex-wrap items-center gap-1.5 focus-within:border-primary-700" :class="{ 'is-invalid': errorMessage }">
      <span v-for="tag in tags" :key="tag" class="inline-flex items-center gap-1 rounded bg-primary-50 text-primary-700 text-xs px-2 py-1">
        {{ tag }}
        <button type="button" class="leading-none hover:text-errors-100" :aria-label="`${$t('buttons.remove')} ${tag}`" @click="remove(tag)">×</button>
      </span>
      <input
          :id="listId + '-input'"
          v-model="draft"
          :list="listId"
          class="flex-1 min-w-[6rem] border-0 bg-transparent p-0 text-sm text-black focus:outline-none focus:ring-0"
          :placeholder="tags.length ? '' : placeholder"
          @keydown="onKey"
          @blur="draft && add(draft)"
      />
      <datalist :id="listId">
        <option v-for="s in suggestions.filter((x) => !tags.includes(x))" :key="s" :value="s" />
      </datalist>
    </div>
    <div class="min-h-6 pt-1"><span v-if="errorMessage" class="text-errors-100 text-xs">{{ errorMessage }}</span></div>
  </div>
</template>
