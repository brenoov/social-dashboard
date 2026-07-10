<template>
  <div class="tela-fabrica">
    <div class="smenu-topbar">
      <button class="smenu-back" @click="voltar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>Meta Ads
      </button>
      <span class="smenu-title">Fábrica de Anúncios</span>
      <span class="fab-rodada">{{ rodadaLabel }}</span>
    </div>

    <div class="fab-body">
      <p v-if="carregando" class="fab-msg">Carregando…</p>
      <p v-else-if="!lojas.length" class="fab-msg">Nenhuma rodada disponível. Rode o job <code>coletor/fabrica-anuncios.mjs</code>.</p>

      <div v-for="loja in lojas" :key="loja.nome" class="fab-loja">
        <h3>{{ loja.nome }} <span class="fab-cont">{{ loja.itens.filter(i => i.selecionado).length }}/{{ loja.itens.length }}</span></h3>
        <label v-for="item in loja.itens" :key="item.id" class="fab-item">
          <input type="checkbox" :checked="item.selecionado" @change="alternar(item, $event.target.checked)" />
          <span class="fab-tag" :data-fonte="item.fonte">{{ item.fonte }}</span>
          <span class="fab-nome">{{ item.nome }}</span>
          <span class="fab-preco">{{ item.preco ? ('R$ ' + Number(item.preco).toFixed(2)) : '—' }}</span>
          <span class="fab-estoque">{{ item.estoque }} un</span>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { hasPermission } from '../../compartilhado/controle-de-login-e-usuario.js'
import { adminToast } from '../../compartilhado/avisos.js'
import { sb } from '../../compartilhado/buscar-e-salvar-dados.js'
import { sbClient } from '../../compartilhado/conectar-no-banco-de-dados.js'

const router = useRouter()
const carregando = ref(true)
const rodadaLabel = ref('')
const candidatos = ref([])

function voltar() { router.push({ name: 'meta-ads' }) }

// Agrupa candidatos por loja (nome), preservando a ordem de chegada.
const lojas = computed(() => {
  const mapa = new Map()
  for (const c of candidatos.value) {
    if (!mapa.has(c.loja_nome)) mapa.set(c.loja_nome, { nome: c.loja_nome, itens: [] })
    mapa.get(c.loja_nome).itens.push(c)
  }
  return [...mapa.values()]
})

async function carregar() {
  carregando.value = true
  // última rodada
  const rod = await sb('fabrica_rodadas?select=id,rodada,periodo&order=created_at.desc&limit=1')
  if (!rod.length) { carregando.value = false; return }
  rodadaLabel.value = rod[0].periodo || rod[0].rodada
  candidatos.value = await sb(`fabrica_candidatos?select=id,sku,nome,fonte,angulo,preco,loja_nome,estoque,selecionado&rodada_id=eq.${rod[0].id}&order=loja_nome,fonte`)
  carregando.value = false
}

async function alternar(item, valor) {
  const anterior = item.selecionado
  item.selecionado = valor // otimista
  const { error } = await sbClient.from('fabrica_candidatos').update({ selecionado: valor }).eq('id', item.id)
  if (error) {
    item.selecionado = anterior // desfaz
    adminToast('Não foi possível salvar a seleção', false)
  }
}

onMounted(() => {
  if (!hasPermission('module:meta:fabrica')) {
    adminToast('Sem acesso', false)
    router.push({ name: 'inicio' })
    return
  }
  carregar()
})
</script>

<style scoped>
.tela-fabrica{min-height:100vh;display:flex;flex-direction:column;background:var(--bg);position:relative;z-index:1;}
.tela-fabrica .smenu-topbar{display:flex;align-items:center;justify-content:space-between;padding:13px 24px;border-bottom:1px solid var(--border);background:var(--surface);gap:16px;position:sticky;top:0;z-index:10;}
.tela-fabrica .smenu-back{font-family:'IBM Plex Sans',sans-serif;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--accent);cursor:pointer;background:none;border:1px solid var(--accent-mid);border-radius:5px;padding:5px 10px;display:flex;align-items:center;gap:5px;}
.tela-fabrica .smenu-title{font-family:'Oswald',sans-serif;font-size:15px;font-weight:500;letter-spacing:2.5px;text-transform:uppercase;color:var(--text);}
.fab-rodada{font-family:'IBM Plex Sans',sans-serif;font-size:11px;color:var(--muted);}
.fab-body{flex:1;padding:24px;max-width:820px;margin:0 auto;width:100%;}
.fab-msg{color:var(--muted);font-family:'IBM Plex Sans',sans-serif;font-size:13px;}
.fab-loja{margin-bottom:26px;}
.fab-loja h3{font-family:'Oswald',sans-serif;font-size:16px;letter-spacing:1.5px;text-transform:uppercase;color:var(--text);margin-bottom:10px;border-bottom:1px solid var(--border);padding-bottom:6px;}
.fab-cont{font-size:11px;color:var(--muted);font-family:'IBM Plex Sans',sans-serif;letter-spacing:0;}
.fab-item{display:flex;align-items:center;gap:12px;padding:8px 10px;border-radius:8px;cursor:pointer;font-family:'IBM Plex Sans',sans-serif;font-size:13px;color:var(--text);}
.fab-item:hover{background:var(--accent-light);}
.fab-tag{font-size:9px;letter-spacing:1px;text-transform:uppercase;padding:2px 6px;border-radius:4px;background:var(--border);color:var(--muted);}
.fab-tag[data-fonte="oportunidade"]{background:#dcfce7;color:#166534;}
.fab-tag[data-fonte="estrela"]{background:#fef9c3;color:#854d0e;}
.fab-tag[data-fonte="interrogacao"]{background:#e0e7ff;color:#3730a3;}
.fab-nome{flex:1;}
.fab-preco{font-variant-numeric:tabular-nums;color:var(--text);}
.fab-estoque{font-size:11px;color:var(--muted);min-width:52px;text-align:right;}
@media(max-width:640px){
  .fab-item{flex-wrap:wrap;gap:8px;}
  .fab-nome{flex-basis:100%;order:5;}
}
</style>
