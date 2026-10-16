<script setup lang="ts">
import MainTitle from "@/components/UI/MainTitle.vue";
import RoundedButton from "@/components/buttons/RoundedButton.vue";
import MainButton from "@/components/buttons/MainButton.vue";

interface Props {
  title?: string;
  isLowerCaseTitle?: boolean;
  totalItems?: number;

  // Search
  hasSearchBtn?: boolean;
  searchQuery?: string;
  showSearchInput?: boolean;

  // Filters
  hasFilterBtn?: boolean;
  activeFilterSection?: boolean;

  // Add Action
  showAddBtn?: boolean;
  actionBtnTitle?: string;
  actionBtnLoading?: boolean;
  searchPlaceholder?: string;

  // Classes
  boxClass?: string;
}

const props = defineProps<Props>();


const emits = defineEmits([
  "update:searchQuery",
  "update:showSearchInput",
  "toggleFilter",
  "add",
]);

const handleSearchInput = (e: Event) => {
  emits("update:searchQuery", (e.target as HTMLInputElement).value);
};

const clearSearch = () => {
  emits("update:searchQuery", "");
  emits("update:showSearchInput", false);
};
</script>

<template>
  <div class="w-full flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
    <div class="flex gap-2">
      <MainTitle :title="title" v-if="title" :class="{ 'md:hidden lg:flex': showSearchInput }" />
    </div>
    <div class="flex flex-col-reverse md:flex-row items-center gap-4 self-center">
      <div class="flex flex-wrap items-center gap-2 justify-center">
        <!-- Search Button -->
        <RoundedButton v-if="hasSearchBtn && !showSearchInput" :aria-label="$t('buttons.search')" @action="emits('update:showSearchInput', true)">
          <svg xmlns="http://www.w3.org/2000/svg" width="17" height="16" viewBox="0 0 17 16" fill="none">
            <path
                d="M7.91895 12.5C10.8184 12.5 13.1689 10.1495 13.1689 7.25C13.1689 4.35051 10.8184 2 7.91895 2C5.01945 2 2.66895 4.35051 2.66895 7.25C2.66895 10.1495 5.01945 12.5 7.91895 12.5Z"
                stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M11.6313 10.9624L14.6688 13.9999" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
                  stroke-linejoin="round" />
          </svg>
        </RoundedButton>

        <!-- Search Input -->
        <div v-if="showSearchInput"
             class="w-full sm:w-[300px] h-9 rounded overflow-hidden bg-white border border-line focus-within:border-primary-700 items-center flex justify-between px-3">
          <div class="flex justify-start items-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="17" height="16" viewBox="0 0 17 16" fill="none"
                 class="stroke-neural-300">
              <path
                  d="M7.91895 12.5C10.8184 12.5 13.1689 10.1495 13.1689 7.25C13.1689 4.35051 10.8184 2 7.91895 2C5.01945 2 2.66895 4.35051 2.66895 7.25C2.66895 10.1495 5.01945 12.5 7.91895 12.5Z"
                  stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M11.6313 10.9624L14.6688 13.9999" stroke-width="1.5" stroke-linecap="round"
                    stroke-linejoin="round" />
            </svg>
            <input autofocus type="text"
                   class="mx-2 bg-transparent border-none active:border-none focus:outline-none focus:ring-0 text-sm placeholder:text-sm placeholder:text-neural-200 text-black"
                   :placeholder="searchPlaceholder || $t('buttons.search')" :value="searchQuery" @input="handleSearchInput" />
          </div>
          <svg @click="clearSearch" width="10" height="10" viewBox="0 0 16 16" fill="none"
               class="fill-neural-300 hover:fill-primary-700 cursor-pointer" xmlns="http://www.w3.org/2000/svg">
            <path
                d="M14.716 15.8675C14.5393 16.0442 14.2531 16.0442 14.0762 15.8675L7.99986 9.79103L1.92354 15.8675C1.74701 16.044 1.46061 16.0442 1.28373 15.8675L0.132464 14.716C-0.0442435 14.5393 -0.0440657 14.2531 0.132464 14.0764L6.20878 7.99975L0.132642 1.92349C-0.0440658 1.74678 -0.043888 1.46055 0.132642 1.28384L1.28391 0.132555C1.46061 -0.0441555 1.74701 -0.0441555 1.92372 0.132378L7.99986 6.20899L14.0764 0.132555C14.2531 -0.0441555 14.5393 -0.0441555 14.7162 0.132555L15.8676 1.28384C16.0441 1.46055 16.0441 1.74678 15.8676 1.92349L9.79075 7.99992L15.8674 14.0765C16.044 14.2531 16.044 14.5395 15.8674 14.7162L14.716 15.8675Z" />
          </svg>
        </div>

        <!-- Filter Button -->
        <RoundedButton v-if="hasFilterBtn" @action="emits('toggleFilter')"  v-tooltip="$t('buttons.filters')"
                       :class="{ '!bg-primary-700 !border-primary-700': activeFilterSection === true }">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="16" viewBox="0 0 18 16" class="fill-current"
               :class="{ '!fill-[#fff]': activeFilterSection === true }">
            <path fill-rule="evenodd" clip-rule="evenodd"
                  d="M11.4964 9.38022H5.84153V15.5L11.4964 12.2057V9.38022ZM0.777123 1.99376H16.5608C17.3241 1.99376 17.25 0.918876 16.9791 0.664001C16.8717 0.562864 16.7235 0.5 16.5608 0.5H0.777123C0.0137682 0.5 0.0878537 1.57488 0.358743 1.82976C0.466236 1.93089 0.614407 1.99376 0.777123 1.99376ZM5.632 8.54289H11.7057L15.7324 2.83108H1.60502L5.632 8.54289Z" />
          </svg>
        </RoundedButton>
        <slot name="tableBtns"></slot>
        <!-- Add Button -->
        <MainButton v-if="showAddBtn" :text="actionBtnTitle!" :isAddBtn="showAddBtn"
                    :loading="actionBtnLoading" @action="emits('add')">
        </MainButton>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
