<template><p>count: {{ count }}</p></template>
<script setup>
import { ref } from 'vue'
const count = ref(0)
defineExpose({ set: (v)=> { count.value = v } })
</script>
