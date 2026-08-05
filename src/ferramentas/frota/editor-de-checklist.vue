<script setup>
/* A lista de itens do checklist e os dias em que o semanal e o mensal caem.
 *
 * Igual ao plano de revisão: a repartição é do GESTOR, não do código. O
 * mecânico muda de opinião, a frota muda, e a lista tem que acompanhar sem
 * depender de programador. */
import { reactive, ref, computed } from 'vue'
import { CADENCIAS, problemasDoItemDeChecklist } from '../../../supabase/functions/_shared/checklist.js'

const props = defineProps({
  itens: { type: Array, default: () => [] },
  config: { type: Object, required: true },
  gravando: { type: Boolean, default: false },
})
const emit = defineEmits(['salvar-item', 'alternar-item', 'salvar-config'])

const ROTULO = { diario: 'Todo dia', semanal: 'Toda semana', mensal: 'Todo mês' }
const DIAS = [
  { valor: 1, nome: 'segunda-feira' }, { valor: 2, nome: 'terça-feira' },
  { valor: 3, nome: 'quarta-feira' }, { valor: 4, nome: 'quinta-feira' },
  { valor: 5, nome: 'sexta-feira' },
]
const SEMANAS = [
  { valor: 1, nome: '1ª' }, { valor: 2, nome: '2ª' },
  { valor: 3, nome: '3ª' }, { valor: 4, nome: '4ª' },
]

const novo = reactive({ item: '', cadencia: 'diario' })
const erros = ref([])
const cfg = reactive({ ...props.config })

const porCadencia = computed(() => CADENCIAS.map((c) => ({
  cadencia: c, rotulo: ROTULO[c],
  itens: props.itens.filter((i) => i.cadencia === c).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)),
})))

function adicionar() {
  erros.value = problemasDoItemDeChecklist({
    item: novo.item, cadencia: novo.cadencia, existentes: props.itens, idAtual: null })
  if (erros.value.length) return
  emit('salvar-item', { item: novo.item.trim(), cadencia: novo.cadencia,
    ordem: (props.itens.length + 1) * 10 })
  novo.item = ''
}
</script>

<template>
  <section class="ec">
    <h2 class="ec-titulo">Em que dia cai cada conferência</h2>
    <p class="ec-nota">
      O diário é de segunda a sexta. O semanal e o mensal têm dia próprio para
      nenhum dia ficar pesado demais.
    </p>
    <div class="ec-dias">
      <label class="ec-campo">
        <span class="ec-lab">O semanal cai na</span>
        <select v-model.number="cfg.dia_semanal">
          <option v-for="d in DIAS" :key="d.valor" :value="d.valor">{{ d.nome }}</option>
        </select>
      </label>
      <label class="ec-campo">
        <span class="ec-lab">O mensal cai na</span>
        <select v-model.number="cfg.semana_mensal">
          <option v-for="s in SEMANAS" :key="s.valor" :value="s.valor">{{ s.nome }}</option>
        </select>
      </label>
      <label class="ec-campo">
        <span class="ec-lab">do mês, na</span>
        <select v-model.number="cfg.dia_mensal">
          <option v-for="d in DIAS" :key="d.valor" :value="d.valor">{{ d.nome }}</option>
        </select>
      </label>
      <button class="ec-btn" :disabled="gravando" @click="emit('salvar-config', { ...cfg })">
        Salvar os dias
      </button>
    </div>

    <h2 class="ec-titulo">Os itens</h2>
    <div v-for="g in porCadencia" :key="g.cadencia" class="ec-grupo">
      <h3 class="ec-grupo-titulo">{{ g.rotulo }} <span class="ec-conta">{{ g.itens.length }}</span></h3>
      <ul class="ec-lista">
        <li v-for="i in g.itens" :key="i.id" class="ec-item" :class="{ desligado: !i.ativo }">
          <span>{{ i.item }}</span>
          <button class="ec-btn pequeno" :disabled="gravando" @click="emit('alternar-item', i)">
            {{ i.ativo ? 'Desligar' : 'Religar' }}
          </button>
        </li>
      </ul>
    </div>

    <h3 class="ec-grupo-titulo">Acrescentar item</h3>
    <div class="ec-novo">
      <input v-model="novo.item" type="text" placeholder="Ex.: Filtro de ar">
      <select v-model="novo.cadencia">
        <option v-for="c in CADENCIAS" :key="c" :value="c">{{ ROTULO[c] }}</option>
      </select>
      <button class="ec-btn" :disabled="gravando" @click="adicionar">Acrescentar</button>
    </div>
    <ul class="ec-erros" v-if="erros.length"><li v-for="e in erros" :key="e">{{ e }}</li></ul>
  </section>
</template>

<style scoped>
.ec-titulo { font-size: 1rem; font-weight: 700; margin: 20px 0 4px; }
.ec-nota { font-size: .85rem; opacity: .7; margin: 0 0 12px; }
.ec-dias { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px; margin-bottom: 8px; }
.ec-campo { display: block; }
.ec-lab { display: block; font-size: .8rem; opacity: .75; margin-bottom: 4px; }
.ec-campo select, .ec-novo input, .ec-novo select { padding: 8px; border-radius: 8px; border: 1px solid var(--borda, #e3e3e3); font: inherit; }
.ec-grupo-titulo { font-size: .9rem; font-weight: 600; margin: 16px 0 6px; }
.ec-conta { opacity: .6; font-weight: 400; }
.ec-lista { list-style: none; padding: 0; margin: 0; }
.ec-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--borda, #eee); }
.ec-item.desligado span { opacity: .45; text-decoration: line-through; }
.ec-novo { display: flex; flex-wrap: wrap; gap: 8px; }
.ec-novo input { flex: 1 1 200px; }
.ec-btn { padding: 8px 14px; border-radius: 8px; border: 1px solid var(--borda, #ddd); background: transparent; font: inherit; cursor: pointer; }
.ec-btn.pequeno { padding: 4px 10px; font-size: .85rem; }
.ec-btn:disabled { opacity: .6; cursor: default; }
.ec-erros { color: #a12727; font-size: .9rem; padding-left: 18px; }
</style>
</content>
</invoke>
