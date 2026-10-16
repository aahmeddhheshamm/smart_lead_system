<script setup>
defineProps({
  fileExtensions: {
    type: String,
    required: true
  }
})
</script>

<template>
  <div dir="ltr">
    <svg
      height="64px"
      width="64px"
      id="Layer_1"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      xml:space="preserve"
    >
      <path
        style="fill: #e2e5e7"
        d="M128,0c-17.6,0-32,14.4-32,32v448c0,17.6,14.4,32,32,32h320c17.6,0,32-14.4,32-32V128L352,0H128z"
      />
      <path style="fill: #b0b7bd" d="M384,128h96L352,0v96C352,113.6,366.4,128,384,128z" />
      <polygon style="fill: #cad1d8" points="480,224 384,128 480,128 " />
      <path
        style="fill: #f15642"
        d="M416,416c0,8.8-7.2,16-16,16H48c-8.8,0-16-7.2-16-16V256c0-8.8,7.2-16,16-16h352c8.8,0,16,7.2,16,16
	V416z"
      />
      <g>
        <text x="125" y="365" fill="#fff" class="font-black uppercase text-[7rem]">
          {{ fileExtensions }}
        </text>
      </g>
      <path
        style="fill: #cad1d8"
        d="M400,432H96v16h304c8.8,0,16-7.2,16-16v-16C416,424.8,408.8,432,400,432z"
      />
    </svg>
  </div>
</template>

<style scoped></style>
