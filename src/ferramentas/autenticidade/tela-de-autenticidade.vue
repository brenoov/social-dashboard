<template>
  <div class="tela-autenticidade">
    <barra-de-topo voltar="Gestão Interna" titulo="Autenticidade e Garantia" @voltar="voltar" />

    <div class="abas" role="tablist">
      <button v-for="ab in ABAS" :key="ab.chave" role="tab" type="button"
              :class="{ on: aba === ab.chave }" @click="aba = ab.chave">{{ ab.rotulo }}</button>
    </div>

    <p v-if="carregando" class="au-vazio">Carregando…</p>
    <p v-else-if="falha" class="au-erro">{{ falha }}</p>

    <!-- ── LOTES ────────────────────────────────────────────────────────── -->
    <template v-else-if="aba === 'lotes'">
      <div class="au-topo-acao" v-if="podeCriar">
        <button class="au-botao" type="button" @click="abrirFormulario">Gerar lote de etiquetas</button>
      </div>

      <p v-if="!lotes.length" class="au-vazio">
        Nenhum lote criado ainda. Um lote é uma fornada de bolsas do mesmo modelo — cada
        peça sai com o seu próprio código.
      </p>

      <div class="au-lista">
        <div v-for="l in lotes" :key="l.id" class="au-card">
          <div class="au-card-topo">
            <span class="au-modelo">{{ l.modelo }}</span>
            <span class="au-progresso">{{ progressoDoLote(pecasDoLote(l.id)).texto }} gravadas</span>
          </div>
          <div class="au-card-linha">
            <span v-if="l.cor">{{ l.cor }}</span>
            <span v-if="l.sku" class="au-ref">ref. {{ l.sku }}</span>
            <span>{{ l.quantidade }} {{ l.quantidade === 1 ? 'peça' : 'peças' }}</span>
            <span>{{ dataCurta(l.fabricado_em) }}</span>
          </div>
          <button class="au-link" type="button" @click="irGravar(l.id)">Gravar as etiquetas deste lote →</button>
        </div>
      </div>
    </template>

    <!-- ── GRAVAR ───────────────────────────────────────────────────────── -->
    <template v-else-if="aba === 'gravar'">
      <p v-if="!lotes.length" class="au-vazio">Crie um lote antes de gravar etiquetas.</p>

      <template v-else>
        <label class="au-campo">
          <span class="au-rot">Lote</span>
          <select v-model="loteEscolhido">
            <option v-for="l in lotes" :key="l.id" :value="l.id">
              {{ l.modelo }}<span v-if="l.cor"> · {{ l.cor }}</span> — {{ progressoDoLote(pecasDoLote(l.id)).texto }}
            </option>
          </select>
        </label>

        <p v-if="!proxima" class="au-pronto">
          Todas as etiquetas deste lote já foram gravadas. Nada a fazer aqui.
        </p>

        <div v-else class="au-gravacao">
          <p class="au-passo">
            Peça {{ proxima.numero_na_serie }} de {{ loteAtual?.quantidade }} ·
            {{ progressoDoLote(pecasDoLote(loteEscolhido)).texto }} prontas
          </p>

          <p class="au-instrucao">
            Copie o endereço abaixo e grave na etiqueta pelo aplicativo do celular.
            Depois toque em “Gravei essa” — é isso que impede de perder a conta no meio
            de {{ loteAtual?.quantidade }} etiquetas iguais.
          </p>

          <div class="au-endereco">{{ enderecoDaTag(proxima.codigo) }}</div>

          <div class="au-acoes">
            <button class="au-botao secundario" type="button" @click="copiar">{{ textoCopiar }}</button>
            <button class="au-botao" type="button" v-if="podeEditar" @click="marcarGravada">✓ Gravei essa</button>
          </div>
        </div>
      </template>
    </template>

    <!-- ── REGISTROS ────────────────────────────────────────────────────── -->
    <template v-else-if="aba === 'registros'">
      <div class="au-topo-acao">
        <input v-model="busca" class="au-busca" type="search" placeholder="Buscar por nome ou código">
        <button class="au-botao secundario" type="button" v-if="registros.length" @click="baixarPlanilha">
          Baixar planilha
        </button>
      </div>

      <p v-if="!registros.length" class="au-vazio">
        Nenhuma cliente registrou a garantia ainda.
      </p>
      <p v-else-if="!registrosFiltrados.length" class="au-vazio">
        Nada encontrado para “{{ busca }}”.
      </p>

      <div class="au-lista">
        <div v-for="r in registrosFiltrados" :key="r.codigo" class="au-card">
          <div class="au-card-topo">
            <span class="au-modelo">{{ r.nome }}</span>
            <span class="au-progresso">até {{ dataCurta(r.garantia_ate) }}</span>
          </div>
          <div class="au-card-linha">
            <span class="au-ref">{{ r.codigo }}</span>
            <span>{{ r.whatsapp }}</span>
            <span v-if="r.onde_comprou">{{ r.onde_comprou }}</span>
            <span v-if="r.comprado_em">comprou {{ dataCurta(r.comprado_em) }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- ── ALERTAS ──────────────────────────────────────────────────────── -->
    <template v-else>
      <p class="au-instrucao">
        A etiqueta guarda um endereço, e endereço se copia — por isso a etiqueta sozinha
        não impede falsificação. O que denuncia a cópia é o mesmo código sendo lido de
        muitos aparelhos diferentes, ou alguém tentando adivinhar códigos.
      </p>

      <p v-if="resumo.limpo" class="au-pronto">
        Nada suspeito nos últimos 30 dias. Foram {{ alertas?.total_leituras || 0 }} leituras.
      </p>

      <template v-else>
        <h2 class="au-secao" v-if="resumo.repetidas">Peças lidas de muitos aparelhos</h2>
        <div class="au-lista">
          <div v-for="a in (alertas?.repetidas || [])" :key="a.codigo" class="au-card alerta">
            <div class="au-card-topo">
              <span class="au-modelo">{{ a.codigo }}</span>
              <span class="au-progresso">{{ a.aparelhos }} aparelhos</span>
            </div>
            <div class="au-card-linha">
              <span>{{ a.leituras }} leituras</span>
              <span>última em {{ dataCurta(a.ultima) }}</span>
            </div>
          </div>
        </div>

        <h2 class="au-secao" v-if="resumo.invalidas">Códigos que não existem, tentados</h2>
        <div class="au-lista">
          <div v-for="a in (alertas?.invalidas || [])" :key="a.codigo" class="au-card alerta">
            <div class="au-card-topo">
              <span class="au-modelo">{{ a.codigo }}</span>
              <span class="au-progresso">{{ a.tentativas }} tentativas</span>
            </div>
            <div class="au-card-linha"><span>última em {{ dataCurta(a.ultima) }}</span></div>
          </div>
        </div>
      </template>
    </template>

    <!-- ── FORMULÁRIO DE LOTE ───────────────────────────────────────────── -->
    <div v-if="formulario" class="au-fundo" @click.self="formulario = false">
      <form class="au-folha" @submit.prevent="gerarLote">
        <h2>Gerar lote de etiquetas</h2>
        <p class="au-instrucao">
          Um código diferente para cada peça. Depois de criar, a aba “Gravar” conduz
          etiqueta por etiqueta.
        </p>

        <label class="au-campo"><span class="au-rot">Modelo</span>
          <input v-model="novo.modelo" type="text" maxlength="80" required placeholder="Mônaco"></label>
        <label class="au-campo"><span class="au-rot">Cor</span>
          <input v-model="novo.cor" type="text" maxlength="60" placeholder="Quartz"></label>
        <label class="au-campo"><span class="au-rot">Referência</span>
          <input v-model="novo.sku" type="text" maxlength="40" placeholder="LV1021"></label>
        <label class="au-campo"><span class="au-rot">Quantidade de peças</span>
          <input v-model.number="novo.quantidade" type="number" min="1" max="500" required></label>
        <label class="au-campo"><span class="au-rot">Data de fabricação</span>
          <input v-model="novo.fabricado_em" type="date"></label>

        <p class="au-erro" v-if="erroForm">{{ erroForm }}</p>

        <div class="au-acoes">
          <button class="au-botao secundario" type="button" @click="formulario = false">Cancelar</button>
          <button class="au-botao" type="submit" :disabled="salvando">
            {{ salvando ? 'Gerando…' : 'Gerar' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
/*
 * Painel do Selo Vessel — o lado de dentro da página pública /verify.
 *
 * A tela não inventa código nenhum: quem sorteia é o banco (vessel_gerar_lote),
 * porque a garantia de "nenhum código repetido" é da chave primária. Ver
 * db/migrations/2026-08-05-vessel-painel.sql.
 */
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import BarraDeTopo from '../../compartilhado/barra-de-topo.vue'
import { sbClient } from '../../compartilhado/conectar-no-banco-de-dados.js'
import { hasPermission } from '../../compartilhado/controle-de-login-e-usuario.js'
import { adminToast } from '../../compartilhado/avisos.js'
import { enderecoDaTag, progressoDoLote, proximaPorGravar, linhasDoCsv, resumoDeAlertas } from './lotes.js'

const ABAS = [
  { chave: 'lotes', rotulo: 'Lotes' },
  { chave: 'gravar', rotulo: 'Gravar' },
  { chave: 'registros', rotulo: 'Registros' },
  { chave: 'alertas', rotulo: 'Alertas' },
]

const router = useRouter()
const aba = ref('lotes')
const carregando = ref(true)
const falha = ref('')

const lotes = ref([])
const pecas = ref([])
const registros = ref([])
const alertas = ref(null)

const loteEscolhido = ref('')
const busca = ref('')
const formulario = ref(false)
const salvando = ref(false)
const erroForm = ref('')
const textoCopiar = ref('Copiar endereço')

const novo = reactive({ modelo: '', cor: '', sku: '', quantidade: 20, fabricado_em: '' })

const podeCriar = computed(() => hasPermission('autenticidade', 'criar'))
const podeEditar = computed(() => hasPermission('autenticidade', 'editar'))

const pecasDoLote = (id) => pecas.value.filter((p) => p.lote_id === id)
const loteAtual = computed(() => lotes.value.find((l) => l.id === loteEscolhido.value) || null)
const proxima = computed(() => proximaPorGravar(pecasDoLote(loteEscolhido.value)))
const resumo = computed(() => resumoDeAlertas(alertas.value))

const registrosFiltrados = computed(() => {
  const termo = busca.value.trim().toLowerCase()
  if (!termo) return registros.value
  return registros.value.filter((r) =>
    (r.nome || '').toLowerCase().includes(termo) || (r.codigo || '').toLowerCase().includes(termo))
})

// Data sempre no fuso de São Paulo: o banco guarda em UTC, e sem isso um
// registro feito às 22h aparece com a data do dia seguinte.
function dataCurta(valor) {
  if (!valor) return '—'
  const d = new Date(String(valor).length === 10 ? `${valor}T12:00:00Z` : valor)
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(d)
}

function voltar() { router.push({ name: 'gestao-interna' }) }

function irGravar(id) {
  loteEscolhido.value = id
  aba.value = 'gravar'
}

function abrirFormulario() {
  erroForm.value = ''
  formulario.value = true
}

async function carregar() {
  carregando.value = true
  falha.value = ''
  try {
    const [l, p, r, a] = await Promise.all([
      sbClient.from('vessel_lotes').select('*').order('criado_em', { ascending: false }),
      sbClient.from('vessel_pecas').select('codigo,lote_id,numero_na_serie,gravada_em'),
      sbClient.from('vessel_registros').select('*').order('registrado_em', { ascending: false }),
      sbClient.rpc('vessel_alertas'),
    ])
    if (l.error) throw l.error
    lotes.value = l.data || []
    pecas.value = p.data || []
    registros.value = r.data || []
    alertas.value = a.data || null
    if (!loteEscolhido.value && lotes.value.length) loteEscolhido.value = lotes.value[0].id
  } catch (e) {
    falha.value = 'Não consegui carregar. Confira sua conexão e tente de novo.'
  } finally {
    carregando.value = false
  }
}

async function gerarLote() {
  erroForm.value = ''
  if (!novo.modelo.trim()) { erroForm.value = 'Escreva o modelo da bolsa.'; return }
  if (!(novo.quantidade >= 1 && novo.quantidade <= 500)) {
    erroForm.value = 'A quantidade precisa ser de 1 a 500 peças.'; return
  }
  salvando.value = true
  try {
    const { data, error } = await sbClient.rpc('vessel_gerar_lote', {
      p_modelo: novo.modelo, p_cor: novo.cor, p_sku: novo.sku,
      p_quantidade: novo.quantidade,
      p_fabricado_em: novo.fabricado_em || null,
      p_fotos: null,
    })
    if (error) throw error
    if (!data?.ok) {
      erroForm.value = data?.motivo === 'sem_permissao'
        ? 'Você não tem permissão para gerar lotes.'
        : 'Não consegui gerar. Confira os dados.'
      return
    }
    formulario.value = false
    adminToast(`Lote criado com ${novo.quantidade} códigos`)
    novo.modelo = ''; novo.cor = ''; novo.sku = ''; novo.quantidade = 20; novo.fabricado_em = ''
    await carregar()
    irGravar(data.lote_id)
  } catch (e) {
    erroForm.value = 'Não consegui gerar o lote agora. Tente de novo.'
  } finally {
    salvando.value = false
  }
}

async function copiar() {
  if (!proxima.value) return
  try {
    await navigator.clipboard.writeText(enderecoDaTag(proxima.value.codigo))
    textoCopiar.value = 'Copiado!'
    setTimeout(() => { textoCopiar.value = 'Copiar endereço' }, 1800)
  } catch (e) {
    adminToast('Não consegui copiar — selecione o endereço na mão', false)
  }
}

async function marcarGravada() {
  const codigo = proxima.value?.codigo
  if (!codigo) return
  try {
    const { data, error } = await sbClient.rpc('vessel_marcar_gravada', { p_codigo: codigo })
    if (error) throw error
    if (!data?.ok) { adminToast('Sem permissão para marcar', false); return }
    // atualiza só a peça, sem recarregar tudo: a equipe está gravando em
    // sequência e uma recarga inteira a cada etiqueta trava o ritmo
    const alvo = pecas.value.find((p) => p.codigo === codigo)
    if (alvo) alvo.gravada_em = new Date().toISOString()
    textoCopiar.value = 'Copiar endereço'
  } catch (e) {
    adminToast('Não consegui marcar agora', false)
  }
}

function baixarPlanilha() {
  const csv = linhasDoCsv(registrosFiltrados.value)
  // BOM na frente: sem ele o Excel abre "Mônaco" como "MÃ´naco"
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'garantias-vessel.csv'
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(carregar)
</script>

<style scoped>
.tela-autenticidade{min-height:100vh;background:transparent;position:relative;z-index:1;padding-bottom:48px;}
.abas{display:flex;gap:8px;padding:16px 24px 0;flex-wrap:wrap;}
.abas button{font-family:var(--fonte-principal);font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);background:none;border:1px solid var(--border);border-radius:5px;padding:7px 13px;cursor:pointer;transition:all .15s;}
.abas button.on{color:var(--accent);border-color:var(--accent);}

.au-vazio,.au-erro,.au-pronto{font-family:var(--fonte-principal);font-size:13px;color:var(--muted);padding:28px 24px;line-height:1.7;max-width:620px;}
.au-erro{color:#b91c1c;}
.au-pronto{color:var(--accent);}
.au-instrucao{font-family:var(--fonte-principal);font-size:12.5px;color:var(--muted);line-height:1.7;padding:16px 24px 0;max-width:620px;}
.au-secao{font-family:var(--fonte-principal);font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--text);padding:24px 24px 4px;}

.au-topo-acao{display:flex;gap:10px;align-items:center;padding:18px 24px 0;flex-wrap:wrap;}
.au-busca{flex:1;min-width:180px;font-family:var(--fonte-principal);font-size:13px;padding:9px 12px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);}

.au-botao{font-family:var(--fonte-principal);font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#fff;background:var(--accent);border:1px solid var(--accent);border-radius:6px;padding:10px 16px;cursor:pointer;}
.au-botao[disabled]{opacity:.6;cursor:default;}
.au-botao.secundario{color:var(--accent);background:transparent;}

.au-lista{display:flex;flex-direction:column;gap:10px;padding:16px 24px 0;max-width:720px;}
.au-card{border:1px solid var(--border);border-radius:8px;background:var(--surface);padding:14px 16px;}
.au-card.alerta{border-color:#b45309;}
.au-card-topo{display:flex;justify-content:space-between;align-items:baseline;gap:12px;}
.au-modelo{font-family:var(--fonte-principal);font-size:14px;font-weight:600;color:var(--text);}
.au-progresso{font-family:var(--fonte-principal);font-size:11px;color:var(--accent);white-space:nowrap;}
.au-card-linha{display:flex;gap:14px;flex-wrap:wrap;margin-top:6px;font-family:var(--fonte-principal);font-size:12px;color:var(--muted);}
.au-ref{font-family:var(--fonte-dados);}
.au-link{margin-top:10px;font-family:var(--fonte-principal);font-size:11px;font-weight:600;color:var(--accent);background:none;border:none;padding:0;cursor:pointer;}

.au-campo{display:block;padding:16px 24px 0;max-width:520px;}
.au-rot{display:block;font-family:var(--fonte-principal);font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin-bottom:6px;}
.au-campo input,.au-campo select{width:100%;font-family:var(--fonte-principal);font-size:14px;padding:9px 12px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);}

.au-gravacao{padding:8px 24px 0;max-width:620px;}
.au-passo{font-family:var(--fonte-principal);font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--accent);padding-top:18px;}
/* O endereço é o que a pessoa vai conferir letra por letra na hora de gravar:
   fonte de dados, tamanho grande e quebra garantida em tela de celular. */
.au-endereco{font-family:var(--fonte-dados);font-size:17px;line-height:1.6;color:var(--text);background:var(--surface);border:1px solid var(--accent);border-radius:8px;padding:16px;margin-top:14px;word-break:break-all;user-select:all;}
.au-acoes{display:flex;gap:10px;padding:16px 24px 0;flex-wrap:wrap;}
.au-gravacao .au-acoes{padding-left:0;padding-right:0;}

.au-fundo{position:fixed;inset:0;background:rgba(15,15,15,.55);display:flex;align-items:center;justify-content:center;padding:20px;z-index:50;}
.au-folha{background:var(--surface);border:1px solid var(--border);border-radius:10px;max-width:520px;width:100%;max-height:90dvh;overflow-y:auto;padding:22px 0;}
.au-folha h2{font-family:var(--fonte-principal);font-size:16px;font-weight:600;color:var(--text);padding:0 24px;}
.au-folha .au-erro{padding:12px 24px 0;}

@media (max-width:520px){
  .abas,.au-topo-acao,.au-lista,.au-campo,.au-gravacao,.au-acoes{padding-left:16px;padding-right:16px;}
  .au-vazio,.au-erro,.au-instrucao,.au-secao{padding-left:16px;padding-right:16px;}
  .au-gravacao .au-acoes{padding-left:0;padding-right:0;}
  .au-botao{flex:1;}
}
</style>
