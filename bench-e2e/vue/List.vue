<template>
  <ul>
    <li v-for="(item, index) in items" :key="item.id">
      <span>#{{ index }}</span> <span>{{ item.label }}</span>
    </li>
  </ul>
</template>
<script setup>
defineProps({ items: Array })
</script>
