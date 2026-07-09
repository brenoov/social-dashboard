<template>
  <div class="gc-rel">
    <div class="gc-rel-placeholder">Relatórios comerciais — em construção…</div>
  </div>
</template>

<script setup>
// Módulo Relatórios Comerciais (ABC, BCG, mais/menos vendidos, categoria×canal,
// ruptura). Lê gc_vendas_item / gc_estoque_item (pré-agregados pelo job
// coletor/relatorios-comerciais.mjs). Conteúdo preenchido na Task 7.
</script>

<style scoped>
.gc-rel{max-width:min(98vw,1860px);margin:0 auto;width:100%;padding:clamp(22px,2vw,34px) clamp(20px,2.8vw,46px) 96px;}
.gc-rel-placeholder{padding:60px 0;text-align:center;color:var(--muted);font-family:'IBM Plex Sans',sans-serif;}
</style>
