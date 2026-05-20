<template>
  <ul>
    <li v-for="(item, index) in items" :key="item.id">
      <span>#{{ index }}</span> <span>{{ item.label }}</span>
    </li>
  </ul>
</template>
<script setup>
import { ref } from 'vue'
const props = defineProps({ initial: Array })
const items = ref(props.initial)
defineExpose({ set: (v)=> { items.value = v } })
</script>
