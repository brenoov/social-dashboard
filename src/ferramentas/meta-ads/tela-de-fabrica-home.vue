<!-- STUB: substituído pela Home completa na Task 7 -->
<script setup>
import { useRouter } from 'vue-router'
const router = useRouter()
</script>
<template>
  <div style="padding:2rem">
    <h1>Fábrica de Anúncios</h1>
    <button @click="router.push({ name: 'fabrica-nova' })">Nova campanha</button>
  </div>
</template>
