<template>
  <div class="esc-pessoa">
    <div class="esc-pessoa-linha">
      <select class="esc-pessoa-campo" :value="modelValue" :disabled="desabilitado"
              :aria-label="rotulo" @change="$emit('update:modelValue', $event.target.value)">
        <option value="">{{ textoVazio }}</option>
        <option v-for="p in pessoas" :key="p.id" :value="p.id">{{ p.nome }}</option>
        <!-- A Frota põe aqui a opção "de fora da empresa": quem não é da casa
             continua tendo por onde entrar, sem virar cadastro. -->
        <slot />
      </select>
      <button v-if="podeCriar" type="button" class="esc-pessoa-mais"
              :title="'Cadastrar um colaborador novo'" aria-label="Cadastrar um colaborador novo"
              @click="abrirCaixinha">+</button>
    </div>

    <!-- A caixinha nasce e morre aqui: some ao criar, ao cancelar e ao trocar de
         ficha, pra nunca ficar aberta numa pergunta que já foi respondida. -->
    <div v-if="aberta" class="esc-pessoa-caixa">
      <p class="esc-pessoa-titulo">Cadastrar quem ainda não está na lista</p>

      <label class="esc-pessoa-rotulo">
        Nome completo
        <input v-model="novo.nome" ref="campoNome" type="text" class="esc-pessoa-entrada"
               placeholder="Ex.: Maria Souza"
               @keyup.enter="confirmar" @keyup.esc.stop="cancelar">
      </label>

      <label class="esc-pessoa-rotulo">
        Cargo <em class="esc-pessoa-opcional">(opcional)</em>
        <input v-model="novo.cargo" type="text" class="esc-pessoa-entrada"
               :list="idDaListaDeCargos" placeholder="Ex.: Modelista"
               @keyup.enter="confirmar" @keyup.esc.stop="cancelar">
      </label>
      <!-- Sugestão, não trava: digitar um cargo que não existe continua valendo. -->
      <datalist :id="idDaListaDeCargos">
        <option v-for="c in cargos" :key="c" :value="c"></option>
      </datalist>

      <label class="esc-pessoa-rotulo">
        Marca <em class="esc-pessoa-opcional">(opcional)</em>
        <span class="esc-pessoa-linha">
          <select v-model="novo.marcaId" class="esc-pessoa-campo">
            <option value="">—</option>
            <option v-for="m in marcas" :key="m.id" :value="m.id">{{ m.nome }}</option>
          </select>
          <button type="button" class="esc-pessoa-mais" title="Cadastrar uma marca nova"
                  aria-label="Cadastrar uma marca nova" @click="abrirSub('marca')">+</button>
        </span>
      </label>

      <label class="esc-pessoa-rotulo">
        Setor <em class="esc-pessoa-opcional">(opcional)</em>
        <span class="esc-pessoa-linha">
          <select v-model="novo.setorId" class="esc-pessoa-campo">
            <option value="">—</option>
            <option v-for="s in setores" :key="s.id" :value="s.id">{{ s.nome }}</option>
          </select>
          <button type="button" class="esc-pessoa-mais" title="Cadastrar um setor novo"
                  aria-label="Cadastrar um setor novo" @click="abrirSub('setor')">+</button>
        </span>
      </label>

      <!-- A caixinha de dentro: criar a marca ou o setor que falta, sem fechar a
           de fora e sem perder o nome já digitado. -->
      <div v-if="sub" class="esc-pessoa-sub">
        <input v-model="subNome" ref="campoSub" type="text" class="esc-pessoa-entrada"
               :placeholder="sub === 'marca' ? 'Nome da marca nova…' : 'Nome do setor novo…'"
               @keyup.enter.stop="confirmarSub" @keyup.esc.stop="cancelarSub">
        <div class="esc-pessoa-botoes">
          <button type="button" class="btn btn-principal" :disabled="criando" @click="confirmarSub">
            {{ criando ? 'Criando…' : 'Criar' }}
          </button>
          <button type="button" class="btn" @click="cancelarSub">Cancelar</button>
        </div>
      </div>

      <p v-if="recado" class="esc-pessoa-recado">{{ recado }}</p>
      <p v-if="recadoDeErro" class="esc-pessoa-recado esc-pessoa-recado-erro">{{ recadoDeErro }}</p>

      <div class="esc-pessoa-botoes">
        <button type="button" class="btn btn-principal" :disabled="criando" @click="confirmar">
          {{ criando ? 'Criando…' : 'Criar e usar' }}
        </button>
        <button type="button" class="btn" @click="cancelar">Cancelar</button>
      </div>

      <p class="esc-pessoa-nota">
        Isto cria só a ficha da pessoa, para o bem ou o carro sair no nome certo. E-mail,
        telefone e acesso ao aplicativo continuam sendo cadastrados em Colaboradores e Acessos.
      </p>
    </div>
  </div>
</template>

<script setup>
/* ESCOLHER A PESSOA — E CADASTRAR NA HORA A QUE FALTAR.
 *
 * Pedido do dono em 13/08/2026: "quando vou cadastrar um patrimônio ou veículo
 * em um colaborador não cadastrado, quero que permita eu cadastrar de forma
 * rápida ali na hora só para sair no nome da pessoa correta" — e, logo depois,
 * "campos como marca, setor, cargo, também com possibilidade de adicionar novos".
 *
 * É a regra do "+" (que já vale para marca, local, ambiente e tipo desde
 * 07/08/2026) chegando ao campo de pessoa. A exceção escrita naquela época
 * ("pessoa vem de outro cadastro, criar gente aqui seria errado") foi derrubada
 * pelo dono depois de ver que ela trava quem está cadastrando.
 *
 * MESMO CONTRATO do escolha-de-local-e-ambiente.vue, de propósito: o componente
 * NÃO toca no banco. Ele avisa "criar isto" e espera o nome aparecer nas props.
 * Quem sabe de tabela e de permissão é a tela. Se a gravação falhar, a caixinha
 * fica aberta com o que foi digitado, em vez de sumir fingindo que criou. */
import { ref, reactive, computed, watch, nextTick, getCurrentInstance } from 'vue'
import { resolverNovaOpcao, normalizarNome } from './nova-opcao.js'
import { cargosConhecidos, dadosDaPessoaRapida } from './pessoas-para-escolher.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  // Já vem pronta da tela: mesclada e só com as ativas.
  pessoas: { type: Array, default: () => [] },   // { id, nome, status, cargo }
  marcas: { type: Array, default: () => [] },    // { id, nome }
  setores: { type: Array, default: () => [] },   // { id, nome }

  // Quem não pode cadastrar não vê o "+", mas continua escolhendo da lista.
  podeCriar: { type: Boolean, default: false },
  // A tela avisa que está gravando, pro botão dizer "Criando…" e não aceitar
  // dois toques.
  criando: { type: Boolean, default: false },
  // O erro da gravação, em português, vindo da tela.
  recadoDeErro: { type: String, default: '' },

  desabilitado: { type: Boolean, default: false },
  rotulo: { type: String, default: 'Pessoa' },
  textoVazio: { type: String, default: '— ninguém —' },
})

const emit = defineEmits(['update:modelValue', 'criar', 'criar-setor', 'criar-marca'])

// Um id por instância: há mais de um campo de pessoa na mesma tela, e datalist
// com id repetido faz a sugestão de um campo aparecer no outro. O uid da
// instância do Vue já é único; um contador em `<script setup>` NÃO serve,
// porque esse bloco roda de novo a cada instância e sempre daria 1.
const idDaListaDeCargos = `esc-pessoa-cargos-${getCurrentInstance()?.uid ?? 0}`

const cargos = computed(() => cargosConhecidos(props.pessoas))

const aberta = ref(false)
const novo = reactive({ nome: '', cargo: '', marcaId: '', setorId: '' })
const recado = ref('')
const campoNome = ref(null)
// O nome que foi mandado criar e ainda não voltou nas props.
const esperando = ref(null)

async function abrirCaixinha() {
  aberta.value = true
  novo.nome = ''
  novo.cargo = ''
  novo.marcaId = ''
  novo.setorId = ''
  recado.value = ''
  esperando.value = null
  await nextTick()
  if (campoNome.value && campoNome.value.focus) campoNome.value.focus()
}

function cancelar() {
  aberta.value = false
  sub.value = ''
  subNome.value = ''
  recado.value = ''
  esperando.value = null
}

function confirmar() {
  const dados = dadosDaPessoaRapida({
    nome: novo.nome, cargo: novo.cargo, marcaId: novo.marcaId, setorId: novo.setorId,
  })
  if (!dados.ok) { recado.value = dados.mensagem; return }

  // Nome repetido não cria a segunda pessoa: aponta pra que já está lá. O banco
  // faz a mesma checagem — aqui é só pra pessoa saber na hora, sem ida e volta.
  const r = resolverNovaOpcao(novo.nome, props.pessoas)
  if (r.ok && r.jaExistia) {
    emit('update:modelValue', r.item.id)
    recado.value = `“${r.item.nome}” já estava cadastrada — deixei essa selecionada.`
    aberta.value = false
    return
  }

  esperando.value = normalizarNome(dados.dados.p_nome)
  emit('criar', {
    nome: dados.dados.p_nome, cargo: dados.dados.p_cargo,
    marcaId: dados.dados.p_marca_id, setorId: dados.dados.p_setor_id,
  })
}

// A caixinha fecha quando a pessoa nova APARECE NAS PROPS — ou seja, quando a
// tela gravou e recarregou de verdade.
watch(() => props.pessoas, () => {
  if (!esperando.value) return
  const achada = (props.pessoas || []).find((p) => normalizarNome(p?.nome) === esperando.value)
  if (!achada) return
  emit('update:modelValue', achada.id)
  esperando.value = null
  aberta.value = false
  recado.value = ''
})

// ── O "+" de dentro: marca e setor ──────────────────────────────────────────
const sub = ref('')          // '' | 'marca' | 'setor'
const subNome = ref('')
const campoSub = ref(null)
const esperandoSub = ref(null)

async function abrirSub(qual) {
  sub.value = qual
  subNome.value = ''
  recado.value = ''
  esperandoSub.value = null
  await nextTick()
  if (campoSub.value && campoSub.value.focus) campoSub.value.focus()
}

function cancelarSub() {
  sub.value = ''
  subNome.value = ''
  esperandoSub.value = null
}

function confirmarSub() {
  const lista = sub.value === 'marca' ? props.marcas : props.setores
  const r = resolverNovaOpcao(subNome.value, lista)
  if (!r.ok) { recado.value = r.mensagem; return }

  if (r.jaExistia) {
    if (sub.value === 'marca') novo.marcaId = r.item.id
    else novo.setorId = r.item.id
    recado.value = `“${r.item.nome}” já existia — deixei essa selecionada.`
    cancelarSub()
    return
  }

  esperandoSub.value = { qual: sub.value, chave: normalizarNome(r.nome) }
  emit(sub.value === 'marca' ? 'criar-marca' : 'criar-setor', { nome: r.nome })
}

watch(() => [props.marcas, props.setores], () => {
  const alvo = esperandoSub.value
  if (!alvo) return
  const lista = alvo.qual === 'marca' ? props.marcas : props.setores
  const achado = (lista || []).find((x) => normalizarNome(x?.nome) === alvo.chave)
  if (!achado) return
  if (alvo.qual === 'marca') novo.marcaId = achado.id
  else novo.setorId = achado.id
  recado.value = `“${achado.nome}” criado.`
  cancelarSub()
})
</script>

<style scoped>
/* Nomes prefixados com esc-pessoa- de propósito: o estilos-globais.css tem
   classes genéricas e já houve colisão entre global e scoped neste projeto.
   Toda cor sai de token — este componente vive em ficha dentro de modal, no
   tema claro e no escuro. */
.esc-pessoa{ display:flex; flex-direction:column; gap:var(--sp-2); min-width:0; }

.esc-pessoa-linha{ display:flex; gap:var(--sp-2); align-items:stretch; min-width:0; }

/* 16px não é estética: abaixo disso o iOS dá zoom ao focar e a tela salta. */
.esc-pessoa-campo{
  flex:1; min-width:0; min-height:44px;
  padding:0 var(--sp-3);
  font-family:inherit; font-size:max(16px, calc(16px * var(--escala-texto, 1))); color:var(--text);
  background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-md);
}
.esc-pessoa-campo:focus{ outline:2px solid var(--accent); outline-offset:-1px; }

/* Mesmo "+" da escolha de local: um jeito só de cadastrar o que falta em toda a
   Central. 44px de alvo porque o dedo erra. */
.esc-pessoa-mais{
  flex-shrink:0; width:44px; min-height:44px;
  border:1px solid var(--border); border-radius:var(--radius-md);
  background:var(--surface); color:var(--accent);
  font-family:inherit; font-size:max(16px, calc(20px * var(--escala-texto, 1))); line-height:1;
  cursor:pointer; touch-action:manipulation;
}
.esc-pessoa-mais:hover:not(:disabled){ border-color:var(--accent); }
.esc-pessoa-mais:disabled{ opacity:.4; cursor:not-allowed; }

.esc-pessoa-caixa{
  display:flex; flex-direction:column; gap:var(--sp-2);
  padding:var(--sp-3);
  border:1px solid var(--accent-mid); border-radius:var(--radius-lg);
  background:var(--surface2);
}
.esc-pessoa-titulo{
  margin:0; font-size:max(9px, calc(13px * var(--escala-texto, 1))); font-weight:600;
  color:var(--text); line-height:1.4; overflow-wrap:anywhere;
}
.esc-pessoa-rotulo{
  display:flex; flex-direction:column; gap:var(--sp-1);
  font-size:max(9px, calc(12px * var(--escala-texto, 1))); color:var(--muted); line-height:1.4;
}
.esc-pessoa-opcional{ font-style:italic; }
.esc-pessoa-entrada{
  min-height:44px; padding:0 var(--sp-3); min-width:0;
  font-family:inherit; font-size:max(16px, calc(16px * var(--escala-texto, 1))); color:var(--text);
  background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-md);
}
.esc-pessoa-entrada:focus{ outline:2px solid var(--accent); outline-offset:-1px; }

.esc-pessoa-sub{
  display:flex; flex-direction:column; gap:var(--sp-2);
  padding:var(--sp-2); background:var(--surface); border-radius:var(--radius-md);
}
/* Quebra de linha permitida: dois botões lado a lado não cabem em 375px com o
   texto inteiro, e texto cortado é o defeito que o padrão da casa proíbe. */
.esc-pessoa-botoes{ display:flex; flex-wrap:wrap; gap:var(--sp-2); }
.esc-pessoa-recado{
  margin:0; font-size:max(9px, calc(12px * var(--escala-texto, 1))); line-height:1.5;
  color:var(--muted); overflow-wrap:anywhere;
}
/* O texto usa --text e não --orange: laranja sobre esta superfície fica em 4,14
   de contraste, abaixo do mínimo de 4,5. */
.esc-pessoa-recado-erro{
  padding:var(--sp-2); border-radius:var(--radius-md); color:var(--text);
  background:color-mix(in srgb, var(--orange) 12%, var(--surface));
  border:1px solid color-mix(in srgb, var(--orange) 38%, var(--surface));
}
.esc-pessoa-nota{
  margin:0; font-size:max(9px, calc(11px * var(--escala-texto, 1))); line-height:1.5;
  color:var(--muted); overflow-wrap:anywhere;
}
</style>
