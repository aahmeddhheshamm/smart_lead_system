<template>
  <div>
    <div class="hidden mx-auto sm:block">
      <div class="relative">
        <input
          type="text"
          id="icon"
          name="icon"
          class="px-4 pe-20 block w-92 md:w-[25rem] bg-transparent border-line rounded text-sm text-neural-300 focus:z-10 focus:border-primary-300 transition placeholder:font-light placeholder:text-xs placeholder:text-neural-300"
          placeholder="Search anything here..."
        />

        <!-- search icon -->
        <div
          class="absolute inset-y-0 end-0 flex items-center pointer-events-none z-20 pe-4 shadow-search"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="13"
            height="14"
            viewBox="0 0 13 14"
            class="fill-black/40"
          >
            <path
              d="M9.85478 2.1884C7.60362 -0.0627997 3.93997 -0.0627997 1.68883 2.1884C0.599843 3.27741 0 4.72742 0 6.27145C0 7.81547 0.599843 9.26548 1.68883 10.3545C2.77782 11.4435 4.22781 12.0432 5.77181 12.0432C7.10687 12.0432 8.37052 11.593 9.39239 10.7677L11.9433 13.3186C12.0603 13.4356 12.2157 13.5 12.3811 13.5C12.5464 13.5 12.7018 13.4356 12.8188 13.3186C13.0604 13.0772 13.0604 12.6845 12.8188 12.443L10.2679 9.89209C11.0933 8.8702 11.5436 7.60653 11.5436 6.27145C11.5436 4.72742 10.9438 3.27741 9.85478 2.1884ZM8.97923 9.47892C7.2106 11.2473 4.33301 11.247 2.56439 9.47892C0.795743 7.71027 0.795743 4.83262 2.56439 3.06397C3.41968 2.20881 4.55886 1.73778 5.77181 1.73778C6.98507 1.73778 8.12394 2.20881 8.97923 3.06397C10.7479 4.83262 10.7479 7.71027 8.97923 9.47892Z"
            />
          </svg>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup></script>

<style scoped></style>
