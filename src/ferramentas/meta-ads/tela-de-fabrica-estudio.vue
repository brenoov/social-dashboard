<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { hasPermission } from '../../compartilhado/controle-de-login-e-usuario.js'
import PainelGerar from './painel-gerar.vue'
import PainelCurar from './painel-curar.vue'
import PainelSubir from './painel-subir.vue'
import PainelConferir from './painel-conferir.vue'
const router = useRouter()
const passo = ref('gerar'); const campanhaId = ref(null); const subirResultado = ref(null)
onMounted(() => { if (!hasPermission('module:meta:fabrica')) router.push({ name: 'meta-ads' }) })
function aoGerar(id) { campanhaId.value = id; passo.value = 'curar' }
function aoSubir(res) { subirResultado.value = res; passo.value = 'conferir' }
</script>
<template>
  <div class="estudio">
    <nav><button :class="{on:passo==='gerar'}" @click="passo='gerar'">1. Gerar</button>
      <button :class="{on:passo==='curar'}" :disabled="!campanhaId" @click="passo='curar'">2. Curar</button>
      <button :class="{on:passo==='subir'}" :disabled="!campanhaId" @click="passo='subir'">3. Subir</button>
      <button :class="{on:passo==='conferir'}" :disabled="!subirResultado" @click="passo='conferir'">4. Conferir</button></nav>
    <PainelGerar v-if="passo==='gerar'" @gerado="aoGerar" />
    <PainelCurar v-else-if="passo==='curar'" :campanha-id="campanhaId" />
    <PainelSubir v-else-if="passo==='subir'" :campanha-id="campanhaId" @subido="aoSubir" />
    <PainelConferir v-else :subir-resultado="subirResultado" />
  </div>
</template>
