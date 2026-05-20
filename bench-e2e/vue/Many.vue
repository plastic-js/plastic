<template>
  <div>
    <div class="row" v-for="i in n" :key="i - 1">
      <span>item {{ i - 1 }}</span>
    </div>
  </div>
</template>
<script setup>
defineProps({ n: Number })
</script>
