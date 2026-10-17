<script setup lang="ts">
import { ref, computed, watch, watchEffect, type PropType } from "vue";
import draggable from 'vuedraggable'
import useFetch from "@/composables/useFetch";
import Box from "@/components/UI/Box.vue";
import PagesHeader from "@/components/UI/PagesHeader.vue";
import StatusBadge from "@/components/UI/StatusBadge.vue";
import { buildListParams, changeDateFormat, countActiveParams } from "@/utils";
import InterceptorHelper from "@/InterceptorHelper";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/vue";
import SpinnerLoading from "@/components/UI/SpinnerLoading.vue";
import TablePagination from "@/components/table/TablePagination.vue";
import {useI18n} from "vue-i18n";
import RoundedButton from "@/components/buttons/RoundedButton.vue";
import { useExportTable } from "@/composables/useExportTable";

const {t} = useI18n();
/* ===================== EMITS ===================== */

const emits = defineEmits([
  "update:searchQuery",
  "update:showSearchInput",
  "toggleFilter",
  "addActionBtn",
  "reorder",
  "resetFilters",
  "update:selected",
  "rowClick"
]);

/* ===================== PROPS ===================== */

const props = defineProps({
  columns: { type: Array as PropType<any[]>, required: true },
  items: { type: Array, default: () => [] },
  listUrl: { type: String, default: "" },
  // Optional data source (module API function) used instead of GET {listUrl}; must resolve to
  // { data, pagination }. listUrl is still the cache key, so mutations that invalidate it refresh.
  fetcher: { type: Function as PropType<(query: Record<string, any>) => Promise<any>>, default: null },
  exporter: { type: Function as PropType<(query: Record<string, any>) => Promise<any>>, default: null },

  title: String,
  hasPagination: { type: Boolean, default: true },
  hasSearchBtn: { type: Boolean, default: true },
  hasFilterBtn: { type: Boolean, default: true },
  actions: { type: Array as PropType<any[]>, default: () => [] },

  // Top-level query params (start_date, end_date, ...); empty values are dropped
  urlParams: { type: Object, default: () => ({}) },
  // Column filters, sent as filter[key]=value (or filter[key][op]=value for { op: value })
  filters: { type: Object, default: () => ({}) },
  showHeader: { type: Boolean, default: true },
  showAddBtn: { type: Boolean, default: true },
  showActionIcons: { type: Boolean, default: false },
  actionBtnTitle: String,
  actionBtnLoading: Boolean,
  sortable: { type: Boolean, default: false },
  hasExportBtn: { type: Boolean, default: false },
  // Row checkboxes for bulk actions (v-model:selected = array of row ids)
  selectable: { type: Boolean, default: false },
  selected: { type: Array, default: () => [] },
  searchPlaceholder: { type: String, default: "" },
  emptyText: { type: String, default: "" },
  rowClickable: { type: Boolean, default: false },
});

/* ===================== STATE ===================== */

const tableData = ref<any[]>([]);
const searchQuery = ref("");
const showSearchInput = ref(false);
const activeFilterSection = ref(false);

const page = ref(1);
const perPage = ref(20);
const pageSizes = [10, 20, 50, 100];
const pagination = ref({
  total: 0,
  lastPage: 1,
});

const orderBy = ref('')
const sortOrder = ref<'asc' | 'desc'>()
const sortedColumn = ref('')

/* ===================== MODE ===================== */

const isApiMode = computed(() => !!props.listUrl);

/* ===================== FETCH (API MODE ONLY) ===================== */

// Search, sort, top-level params and filter[...] in the API's query shape (shared by list + export)
const listParams = computed(() =>
    buildListParams(
        {
          search: searchQuery.value,
          sort: orderBy.value,
          order: orderBy.value ? sortOrder.value : "",
          ...props.urlParams,
        },
        props.filters as Record<string, any>
    )
);

const activeFiltersCount = computed(() => countActiveParams(props.urlParams, props.filters));

const { data, isLoading, isSuccess, isError, refetch } = useFetch({
  enabled: isApiMode,
  queryKey: computed(() => [
    props.listUrl,
    page.value,
    perPage.value,
    listParams.value,
  ]),
  queryFn: async () => {
    const query = { page: page.value, pageSize: perPage.value, ...listParams.value };
    return props.fetcher ? props.fetcher(query) : InterceptorHelper.intercept(props.listUrl, undefined, query);
  },
});

/* ===================== EXPORT (API MODE ONLY) ===================== */

const { isExporting, exportTable } = useExportTable(
    () => props.listUrl,
    () => listParams.value,
    props.exporter
);

/* ===================== SYNC DATA ===================== */

watchEffect(() => {
  if (!isApiMode.value) {
    tableData.value = props.items;
    return;
  }

  if (isSuccess.value && data.value) {
    tableData.value = data.value.data;
    const p = data.value?.pagination;
    pagination.value = {
      total: p?.total ?? data.value.data?.length ?? 0,
      lastPage: p?.totalPages ?? 1,
    };
  }
});

/* ===================== WATCHERS ===================== */

watch(
    () => props.items,
    (val) => {
      if (!isApiMode.value) {
        tableData.value = val;
      }
    },
    { immediate: true }
);

watch([searchQuery, perPage, () => props.urlParams, () => props.filters], () => {
  page.value = 1;
}, { deep: true });

/* ===================== SELECTION ===================== */

const selectedIds = computed<any[]>(() => props.selected as any[]);
const allOnPageSelected = computed(() =>
    !!tableData.value?.length && tableData.value.every((row) => selectedIds.value.includes(row.id))
);
const toggleRow = (id: any) => {
  const next = selectedIds.value.includes(id)
      ? selectedIds.value.filter((x) => x !== id)
      : [...selectedIds.value, id];
  emits("update:selected", next);
};
const togglePage = () => {
  const pageIds = tableData.value.map((row) => row.id);
  emits(
      "update:selected",
      allOnPageSelected.value
          ? selectedIds.value.filter((id) => !pageIds.includes(id))
          : Array.from(new Set([...selectedIds.value, ...pageIds]))
  );
};

defineExpose({ refetch });

/* ===================== PAGINATION ===================== */

const nextPage = () => {
  if (page.value < pagination.value.lastPage) page.value++;
};

const prevPage = () => {
  if (page.value > 1) page.value--;
};

const toggleFilter = () => {
  activeFilterSection.value = !activeFilterSection.value;
};

const handlePerPageUpdate = (val: number) => {
  perPage.value = val;
  page.value = 1;
};

/* ===================== SORT ===================== */

// Toggles desc -> asc on the same column; the API takes sort_by + sort_dir
const handleSort = (orderKey: string) => {
  if (sortOrder.value === 'desc' && sortedColumn.value === orderKey) {
    sortOrder.value = 'asc'
  } else {
    sortOrder.value = 'desc'
    sortedColumn.value = orderKey
  }
  orderBy.value = orderKey
};

/* ===================== DRAG ===================== */

// Define drag options
const dragOptions = ref({
  animation: 200,
  group: 'description',
  disabled: !props.sortable,
  ghostClass: 'ghost'
})

// Define component-data if necessary
const componentData = ref({
  tag: 'tbody',
  name: 'flip-list',
  type: 'transition'
})

const reorderData = () => {
  emits(
      'reorder',
      tableData.value.map((data) => data.id)
  )
}
</script>

<template>
  <Box>
    <!-- Table Header-->
    <template #header v-if="showHeader">
      <PagesHeader
          :title="title"
          :totalItems="pagination.total"
          :hasSearchBtn="hasSearchBtn"
          :showSearchInput="showSearchInput"
          :searchQuery="searchQuery"
          :hasFilterBtn="hasFilterBtn"
          :activeFilterSection="activeFilterSection"
          :showAddBtn="showAddBtn"
          :actionBtnTitle="actionBtnTitle"
          :actionBtnLoading="actionBtnLoading"
          :searchPlaceholder="searchPlaceholder"
          @update:searchQuery="searchQuery = $event"
          @update:showSearchInput="showSearchInput = $event"
          @toggleFilter="toggleFilter"
          @add="emits('addActionBtn')"
      >
      <template #tableBtns>
        <RoundedButton
            v-if="hasExportBtn && isApiMode"
            v-tooltip="$t('buttons.exportCsv')"
            :class="{ 'pointer-events-none opacity-50': isExporting }"
            :aria-label="$t('buttons.exportCsv')"
            @action="exportTable('csv')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="15" height="15">
            <path
                fill="currentColor"
                d="M288 32c0-17.7-14.3-32-32-32s-32 14.3-32 32V274.7l-73.4-73.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l128 128c12.5 12.5 32.8 12.5 45.3 0l128-128c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L288 274.7V32zM64 352c-35.3 0-64 28.7-64 64v32c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V416c0-35.3-28.7-64-64-64H346.5l-45.3 45.3c-25 25-65.5 25-90.5 0L165.5 352H64zm368 56a24 24 0 1 1 0 48 24 24 0 1 1 0-48z"
            />
          </svg>
        </RoundedButton>
        <slot name="tableBtns"></slot>
      </template>
      </PagesHeader>
    </template>
    <!-- Table Filter-->
    <transition name="fade" mode="out-in">
      <div v-if="activeFilterSection" class="mb-4">
        <slot name="filters" />
        <div v-if="activeFiltersCount" class="flex justify-end">
          <button
              type="button"
              class="text-primary-700 text-sm font-medium transition-colors duration-200 hover:text-primary-600"
              @click="emits('resetFilters')"
          >
            {{ $t('buttons.clearFilters') }} ({{ activeFiltersCount }})
          </button>
        </div>
      </div>
    </transition>

    <!-- Table Body-->
    <div class="overflow-x-auto -mx-5">
      <table  class="w-full">
        <thead>
        <tr class="bg-tableHeader transition-all duration-500">
          <th v-if="selectable" class="w-10">
            <input type="checkbox" class="w-4 h-4 accent-primary-700 cursor-pointer" :checked="allOnPageSelected" :aria-label="$t('buttons.selectAll')" @change="togglePage" />
          </th>
          <th v-for="(column, index) in columns" :key="index">
            <div class="flex w-full items-center gap-[0.315rem]">
              <span class="cursor-pointer" @click="handleSort(column.ordering ? column.ordering : column.key)">
                 <svg
                     xmlns="http://www.w3.org/2000/svg"
                     width="14"
                     height="14"
                     viewBox="0 0 14 14"
                     fill="none"
                     v-if="column?.sortable"
                 >
                  <path
                      d="M4.19371 0.478516L0.467041 4.20519H3.26204V7.93186H5.12538V4.20519H7.92038L4.19371 0.478516Z"
                      fill="#D5D5D5"
                      :class="{
                      'fill-[#636364]':
                         (sortedColumn === column.key || sortedColumn === column.ordering) &&
                            sortOrder === 'desc',
                    }"
                  />
                  <path
                      d="M10.7155 9.79503V6.06836H8.85213V9.79503H6.05713L9.7838 13.5217L13.5105 9.79503H10.7155Z"
                      fill="#D5D5D5"
                      :class="{
                      'fill-[#636364]':
                        (sortedColumn === column.key || sortedColumn === column.ordering) &&
                            sortOrder === 'asc',
                    }"
                  />
                </svg>
              </span>
              <h6 class="text-sm text-black font-semibold capitalize truncate">
                {{ $t(column.label) }}
              </h6>
            </div>
          </th>
          <th
              v-if="showActionIcons || actions?.length"
              class="end-0 bg-tableHeader transition-all duration-500"
          >
            <h6 class="text-sm text-black font-semibold capitalize">{{t('actions')}}</h6>
          </th>
        </tr>
        </thead>

        <tbody v-if="isLoading && columns">
        <tr>
          <td
              :colspan="`${columns.length + 2}`"
              class="p-6"
          >
          <span class="flex justify-center items-center">
            <SpinnerLoading></SpinnerLoading>
          </span>
          </td>
        </tr>
        </tbody>

        <tbody v-else-if="!tableData?.length && columns">
        <tr>
          <td
              :colspan="`${columns.length + 2}`"
              class="py-14"
          >
            <div class="flex flex-col items-center justify-center gap-3 text-center">
              <span class="flex items-center justify-center w-14 h-14 rounded-full bg-gray-300">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-black/30">
                  <rect x="3" y="7" width="18" height="13" rx="2" />
                  <path d="M3 10h18M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </span>
              <span class="text-sm text-neural-300">{{ isError ? $t('messages.loadFailed') : (emptyText || $t('noRecordsFound')) }}</span>
              <button v-if="isError" type="button" class="text-sm text-primary-700 font-medium" @click="refetch()">{{ $t('buttons.retry') }}</button>
            </div>
          </td>
        </tr>
        </tbody>

        <draggable
            v-else
            @change="reorderData"
            v-model="tableData"
            item-key="id"
            tag="tbody"
            class="list-group"
            :component-data="componentData"
            v-bind="dragOptions"
        >
          <template #item="{ element, index }">

            <tr
                :class="['whitespace-nowrap transition-colors duration-150 hover:bg-gray-300', { 'cursor-all-scroll': sortable, 'cursor-pointer': rowClickable, '!bg-primary-50': selectable && selectedIds.includes(element.id) }]"
                @click="rowClickable && emits('rowClick', element)"
            >
              <td v-if="selectable" @click.stop>
                <input type="checkbox" class="w-4 h-4 accent-primary-700 cursor-pointer" :checked="selectedIds.includes(element.id)" :aria-label="$t('buttons.select')" @change="toggleRow(element.id)" />
              </td>
              <td
                  class="duration-300 max-w-[250px] py-3"
                  v-for="column in columns"
                  :key="column.key"
              >
                <slot
                    :name="`${column.key}`"
                    v-bind="element"
                >
                  <div class="flex gap-2 items-center *:!text-sm max-w-full">

                    <!-- Status Type -->
                    <StatusBadge
                        v-if="column.type === 'status'"
                        :status="element[column.key]"
                    />

                    <!-- Date Type -->
                    <p
                        v-else-if="column.type === 'date'"
                        class="capitalize text-neural-300 truncate"
                    >
                      {{ changeDateFormat(element[column.key]) }}
                    </p>

                    <!-- Boolean False -->
                    <p
                        v-else-if="element[column.key] === false"
                        class="flex justify-start items-center w-full"
                    >
                      <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="20"
                          height="20"
                          viewBox="0 0 448 512"
                      >
                        <path
                            fill="rgb(200, 15, 15)"
                            d="M64 32C28.7 32 0 60.7 0 96L0 416c0 35.3 28.7 64 64 64l320 0c35.3 0 64-28.7 64-64l0-320c0-35.3-28.7-64-64-64L64 32zm79 143c9.4-9.4 24.6-9.4 33.9 0l47 47 47-47c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9l-47 47 47 47c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0l-47-47-47 47c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l47-47-47-47c-9.4-9.4-9.4-24.6 0-33.9z"
                        />
                      </svg>
                    </p>

                    <!-- Boolean True -->
                    <p
                        v-else-if="element[column.key] === true"
                        class="flex justify-start items-center w-full"
                    >
                      <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="20"
                          height="20"
                          viewBox="0 0 448 512"
                      >
                        <path
                            fill="#22c55e"
                            d="M64 32C28.7 32 0 60.7 0 96L0 416c0 35.3 28.7 64 64 64l320 0c35.3 0 64-28.7 64-64l0-320c0-35.3-28.7-64-64-64L64 32zM337 209L209 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L303 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z"
                        />
                      </svg>
                    </p>

                    <!-- Tooltip -->
                    <p
                        v-else-if="column.hasTooltip"
                        class="text-neural-300 truncate"
                        v-tooltip="`${element[column.key]}`"
                    >
                      {{ element[column.key] || "—" }}
                    </p>

                    <!-- Default -->
                    <p
                        v-else
                        class="text-neural-300 truncate"
                    >
                      {{ element[column.key] || "—" }}
                    </p>
                  </div>
                </slot>
              </td>
              <td v-if="showActionIcons" @click.stop>
                <slot name="actions" v-bind="element"></slot>
              </td>
              <td v-else-if="actions?.length"
                  class="end-0"
              >
                <Menu as="div">
                  <MenuButton
                      class="relative p-2 flex items-center justify-center w-full"
                  >
                    <svg
                        class="flex-none size-4 hs-dropdown-open:text-white text-gray-600 dark:text-neutral-500 hs-dropdown-open:dark:text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                      <circle cx="12" cy="12" r="1" />
                      <circle cx="12" cy="5" r="1" />
                      <circle cx="12" cy="19" r="1" />
                    </svg>

                    <transition
                        enter-active-class="transition ease-out duration-100"
                        enter-from-class="transform opacity-0 scale-95"
                        enter-to-class="transform opacity-100 scale-100"
                        leave-active-class="transition ease-in duration-75"
                        leave-from-class="transform opacity-100 scale-100"
                        leave-to-class="transform opacity-0 scale-95"
                    >
                      <MenuItems  v-if="actions?.length"
                                  class="absolute top-0 ltr:right-0 rtl:left-0 mt-2 w-48 z-50 py-1 bg-white rounded border border-line shadow-lg focus:outline-none"
                      >
                        <MenuItem
                            class=""
                            v-for="action in actions"
                            :key="action.key"
                            v-slot="{ active }"
                        >
                          <button
                              @click="action.action(element)"
                              class="w-full flex items-center gap-2 px-4 py-2 text-sm text-start text-neural-400"
                              :class="active ? 'bg-primary-50 !text-primary-700' : ''"
                          >
                        <span
                            class="w-4"
                            v-if="action.icon"
                            v-html="action.icon"
                        />
                            <span>{{ action.text }}</span>
                          </button>
                        </MenuItem>
                      </MenuItems>
                    </transition>
                  </MenuButton>
                </Menu>
              </td>
            </tr>
          </template>

        </draggable>

      </table>
    </div>

    <!-- Pagination -->
    <div
        class="pt-4 flex items-center gap-3 justify-between flex-col lg:flex-row"
        v-if="hasPagination && !isLoading && tableData?.length"
    >
      <TablePagination :tableData="tableData" :page="page" :perPage="perPage" :pageSizes="pageSizes" :pagination="pagination" @prevPage="prevPage" @nextPage="nextPage" @update:perPage="handlePerPageUpdate"/>
    </div>

  </Box>
</template>

<style scoped>
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(50px);
}

.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s ease-out;
}
</style>
