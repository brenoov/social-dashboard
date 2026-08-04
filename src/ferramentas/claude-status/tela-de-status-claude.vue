<template>
  <!-- Painel de Status do Claude: mission control em linguagem simples (pra quem não é
       técnico). Robôs de IA em produção (custo/tempo/volume reais de ia_execucoes) +
       status dos projetos (projetos_status, derivado dos planos). Classes .csc- para não
       colidir com o CSS global. Full-bleed e responsivo. -->
  <div class="csc-tela">
    <div class="csc-topbar">
      <div class="csc-tb-left">
        <button class="csc-back" @click="voltar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>Central</button>
        <img class="rbv-logo rbv-logo-light" :src="logoClaroUrl" alt="RBV">
        <img class="rbv-logo rbv-logo-dark" :src="logoEscuroUrl" alt="RBV">
      </div>
      <span class="csc-title">Status do Claude</span>
      <div class="csc-tb-right">
        <span class="csc-live"><i></i>Ao vivo</span>
        <div class="csc-clock">{{ relogio }}</div>
        <div class="csc-upd">{{ statusCarga }}</div>
      </div>
    </div>

    <div class="csc-body">
      <!-- Abas: Visão geral | Extrato de gastos -->
      <div class="csc-tabs">
        <button :class="{ on: aba === 'visao' }" @click="aba = 'visao'">Visão geral</button>
        <button :class="{ on: aba === 'extrato' }" @click="aba = 'extrato'">Extrato de gastos</button>
      </div>

      <div v-show="aba === 'visao'" class="csc-wrap">
      <!-- HERO: resumo do mês em uma frase + total gasto -->
      <section class="csc-hero">
        <div class="csc-hero-txt">
          <span class="csc-hero-eyebrow">Central de robôs de inteligência artificial</span>
          <h1 class="csc-hero-h1">O que a IA fez por você</h1>
          <p class="csc-hero-p">
            Nos últimos 30 dias, os robôs fizeram <b>{{ kpis.acoes }} tarefas</b>,
            produziram <b>{{ fmtNum(kpis.itens) }} itens</b> (criativos, anúncios, relatórios…)
            e trabalharam por <b>{{ fmtDur(kpis.tempoMs) }}</b> no total.
          </p>
        </div>
        <div class="csc-hero-gasto">
          <span class="csc-hero-gasto-lbl">Gasto real da Anthropic · últimos 30 dias</span>
          <span v-if="gastoRealMesCarregando" class="csc-hero-gasto-val csc-carregando">…</span>
          <span v-else-if="gastoRealMes" class="csc-hero-gasto-val">{{ fmtBRL(gastoRealMes.totalBrl) }}</span>
          <span v-else class="csc-hero-gasto-val csc-hero-gasto-indisp">indisponível</span>
          <span v-if="gastoRealMes && !gastoRealMesCarregando" class="csc-hero-gasto-sub">valor de verdade cobrado — inclui <b>tudo</b>: os robôs, as buscas na web e as sessões de desenvolvimento com IA.</span>
          <span v-else-if="gastoRealMesErro && !gastoRealMesCarregando" class="csc-hero-gasto-erro">Não consegui puxar o gasto real da Anthropic agora. Tente recarregar a página em instantes.</span>
          <span class="csc-hero-gasto-est">Estimativa só dos robôs deste painel: <b>{{ fmtBRL(kpis.usdMes * CAMBIO) }}</b>. O número real acima costuma ser maior porque inclui muito mais que os robôs.</span>
        </div>
      </section>

      <!-- LEGENDA: o que é "custo zero" -->
      <div class="csc-legenda">
        <span class="csc-tag csc-tag-zero">Custo zero</span>
        <p>Tarefas que <b>criam imagens</b> ou <b>sobem anúncios</b> não usam a API paga (que cobra por uso) — só a assinatura. Então custam <b>R$ 0</b>. Já os <b>textos</b> (relatórios, análises, resumos) usam a API paga e têm custo em reais.</p>
      </div>

      <!-- SAÚDE DOS ROBÔS: só aparece quando há problema.
           Fica ANTES de tudo de propósito. Um alarme no rodapé não é alarme —
           e a razão de esta seção existir é que a falha era invisível: o painel
           do cron marca "succeeded" mesmo quando a função devolve erro. -->
      <section v-if="robosComProblema.length" class="csc-alerta">
        <h2 class="csc-alerta-t">⚠ Robô sem rodar direito</h2>
        <div v-for="r in robosComProblema" :key="r.robo" class="csc-alerta-item">
          <div class="csc-alerta-cab">
            <b>{{ r.robo }}</b>
            <span class="csc-alerta-selo" :class="{ critico: r.critico }">
              {{ r.critico ? 'crítico' : 'atenção' }}
            </span>
          </div>
          <p class="csc-alerta-txt">
            <template v-if="r.ultimo_sucesso">
              A última vez que funcionou foi {{ tempoRel(r.ultimo_sucesso) }}.
            </template>
            <template v-else>Nunca funcionou desde que passamos a medir.</template>
            <template v-if="r.falhas_24h"> Falhou {{ r.falhas_24h }}× nas últimas 24 horas.</template>
          </p>
          <p class="csc-alerta-porque">{{ r.porque }}</p>
        </div>
      </section>

      <!-- ROBÔS -->
      <div class="csc-sec">
        <h2 class="csc-sec-t">Os robôs de IA</h2>
        <p class="csc-sec-d">Programas que trabalham sozinhos pra você. Aqui está o que cada um fez por último.</p>
      </div>
      <div class="csc-robos">
        <article v-for="r in robosView" :key="r.slug" class="csc-robo" :class="'st-' + (r.ult ? r.ult.status : 'idle')">
          <header class="csc-robo-head">
            <span class="csc-robo-dot"></span>
            <div>
              <h3 class="csc-robo-nome">{{ r.label }}</h3>
              <p class="csc-robo-faz">{{ r.faz }}</p>
            </div>
          </header>
          <div v-if="r.ult" class="csc-robo-corpo">
            <p class="csc-robo-frase"><b>{{ r.verbo }} {{ fmtNum(r.ult.itens) }} {{ unid(r.ult.itens, r.ult.unidade) }}</b><span v-if="r.ult.status==='erro'"> — mas deu erro</span>.</p>
            <ul class="csc-robo-detalhes">
              <li><span class="csc-di-lbl">Última vez</span><span class="csc-di-val">{{ tempoRel(r.ult.run_at) }}</span></li>
              <li v-if="r.ult.duracao_ms"><span class="csc-di-lbl">Tempo que levou</span><span class="csc-di-val">{{ fmtDur(r.ult.duracao_ms) }}</span></li>
              <li><span class="csc-di-lbl">Custo</span><span class="csc-di-val" :class="{ 'csc-zero': Number(r.ult.usd)===0 }">{{ custoFrase(r.ult.usd) }}</span></li>
            </ul>
          </div>
          <div v-else class="csc-robo-corpo csc-robo-vazio">Ainda não rodou nenhuma vez.</div>
          <footer class="csc-robo-foot">Roda: {{ r.quando }}</footer>
        </article>
      </div>

      <faixa-de-erro :erro="erroCarregar" @tentar-de-novo="carregar" />

      <!-- PROJETOS -->
      <div class="csc-sec csc-sec-proj">
        <div>
          <h2 class="csc-sec-t">Projetos em construção</h2>
          <p class="csc-sec-d">Em que pé está cada coisa. Da esquerda pra direita é o caminho: <b>ainda não começou → sendo construído → pronto e no ar</b>. Você pode <b>arrastar os cards</b> entre as colunas, ou usar o lápis pra editar.</p>
        </div>
        <button class="csc-add-btn" @click="abrirNovo('em-andamento')">+ Novo projeto</button>
      </div>

      <!-- Alterna entre o quadro curado e o quadro completo -->
      <div class="csc-quadro-abas">
        <button class="csc-quadro-aba" :class="{ ativa: quadro === 'simples' }" @click="quadro = 'simples'">
          Acompanhamento
          <span class="csc-quadro-cont">{{ projetosSimples.length }}</span>
        </button>
        <button class="csc-quadro-aba" :class="{ ativa: quadro === 'tecnico' }" @click="quadro = 'tecnico'">
          Detalhado (automático)
          <span class="csc-quadro-cont">{{ projetosTecnicos.length }}</span>
        </button>
      </div>
      <p class="csc-quadro-desc">
        <template v-if="quadro === 'simples'">
          Só o que foi adicionado à mão — a lista curta do que vale acompanhar.
        </template>
        <template v-else>
          Lido sozinho dos planos, sem ninguém tocar. Mostra tudo, inclusive o que só interessa a quem constrói.
        </template>
      </p>

      <div class="csc-kanban">
        <div v-for="col in colunas" :key="col.key" class="csc-col" :class="{ 'is-over': arrastando }" @dragover.prevent @dragenter.prevent @drop="onDropCol(col.key)">
          <div class="csc-col-head" :class="'sit-' + col.key">
            <span class="csc-col-nome">{{ col.label }}</span>
            <span class="csc-col-acoes">
              <span class="csc-col-cont">{{ (porSitAtivo[col.key] || []).length }}</span>
              <button class="csc-col-add" title="Adicionar aqui" @click="abrirNovo(col.key)">+</button>
            </span>
          </div>
          <p class="csc-col-desc">{{ col.desc }}</p>
          <div class="csc-col-body">
            <div v-for="p in (porSitAtivo[col.key] || [])" :key="p.projeto" class="csc-proj" draggable="true" @dragstart="onDrag(p)" @dragend="arrastando = null">
              <div class="csc-proj-top">
                <span class="csc-proj-titulo">{{ p.titulo }}</span>
                <span class="csc-proj-tags">
                  <span v-if="p.etapa" class="csc-proj-etapa" title="Etapa/fase atual">{{ p.etapa }}</span>
                  <span v-if="p.manual" class="csc-proj-manual" title="Editado à mão (a leitura automática não mexe nele)">à mão</span>
                </span>
              </div>
              <div v-if="p.descricao" class="csc-proj-desc">{{ p.descricao }}</div>
              <template v-if="p.checkboxes_total">
                <div class="csc-bar"><i :style="{ width: p.progresso + '%' }"></i></div>
                <div class="csc-proj-prog">{{ p.progresso }}% pronto ({{ p.checkboxes_feitos }} de {{ p.checkboxes_total }} passos)</div>
              </template>
              <div class="csc-proj-ferramentas">
                <button title="Editar" @click="abrirEditar(p)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
                <button title="Remover" @click="excluir(p)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
              </div>
            </div>
            <div v-if="!(porSitAtivo[col.key] || []).length" class="csc-col-vazio">{{ quadro === 'simples' ? 'Nada por aqui. Arraste um card ou clique no +.' : 'Nenhum plano nesta etapa.' }}</div>
          </div>
        </div>
      </div>

      <!-- LINHA DO TEMPO -->
      <div class="csc-sec">
        <h2 class="csc-sec-t">Linha do tempo</h2>
        <p class="csc-sec-d">Tudo que os robôs fizeram recentemente, do mais novo para o mais antigo.</p>
      </div>
      <div class="csc-feed">
        <div v-for="(e, i) in feed" :key="e.id || i" class="csc-fi" :class="'st-' + e.status">
          <span class="csc-fi-dot"></span>
          <div class="csc-fi-main">
            <p class="csc-fi-frase"><b>{{ nomeRobo(e.robo) }}</b> {{ fraseAcao(e) }}</p>
            <p class="csc-fi-det">
              <span v-if="e.duracao_ms">Levou {{ fmtDur(e.duracao_ms) }}.</span>
              <span :class="{ 'csc-zero': Number(e.usd)===0 }">{{ custoFrase(e.usd) }}</span>
            </p>
          </div>
          <span class="csc-fi-quando">{{ tempoRel(e.run_at) }}</span>
        </div>
        <div v-if="!feed.length" class="csc-fi-vazio">Nenhuma tarefa registrada ainda. Quando um robô rodar, aparece aqui.</div>
      </div>
      </div><!-- fim aba visão geral -->

      <!-- ABA: EXTRATO DE GASTOS -->
      <div v-show="aba === 'extrato'" class="csc-wrap">
        <div class="csc-ex-head">
          <div>
            <h2 class="csc-sec-t">Extrato de gastos</h2>
            <p class="csc-sec-d">Quanto a IA custou, por período e por área. Só as tarefas que usam a API paga têm valor; as de "custo zero" entram como R$ 0.</p>
          </div>
          <div class="csc-periodo">
            <button v-for="op in periodos" :key="op.d" :class="{ on: periodo === op.d }" @click="periodo = op.d">{{ op.label }}</button>
          </div>
        </div>

        <!-- GASTO REAL: o número que realmente importa (a fatura da Anthropic). -->
        <div class="csc-real">
          <div class="csc-real-main">
            <span class="csc-real-lbl">Gasto real cobrado pela Anthropic · {{ periodoLabel }}</span>
            <span v-if="gastoRealCarregando" class="csc-real-val csc-carregando">…</span>
            <span v-else-if="gastoReal" class="csc-real-val">{{ fmtBRL(gastoReal.totalBrl) }}</span>
            <span v-else class="csc-real-val csc-real-indisp">indisponível</span>
            <span v-if="gastoReal && !gastoRealCarregando" class="csc-real-sub">equivale a {{ fmtUsd(gastoReal.totalUsd) }} · de {{ fmtDataCurta(gastoReal.desde) }} a {{ fmtDataCurta(gastoReal.ate) }}</span>
          </div>
          <p class="csc-real-exp">Este é o <b>valor de verdade</b> que a Anthropic cobrou no período. Inclui <b>tudo</b>: os robôs deste painel, as buscas na web, o cache e, principalmente, as <b>sessões de desenvolvimento com IA</b> (quando alguém programa junto com o Claude). Por isso costuma ser bem maior que a estimativa dos robôs logo abaixo.</p>
          <p v-if="gastoRealErro && !gastoRealCarregando" class="csc-real-erro-box">Não consegui puxar o gasto real da Anthropic agora — tente recarregar em instantes. Os números abaixo são só a <b>estimativa dos robôs</b>, não o total cobrado.</p>
        </div>

        <!-- DETALHAMENTO 1 — "Para onde o dinheiro foi" (por categoria): é o valor REAL
             cobrado pela Anthropic, quebrado por modelo e tipo de uso. Mesmo período do
             gasto real acima. Se a função devolver a lista vazia, mostramos "indisponível"
             — nunca inventamos um valor. -->
        <div class="csc-det">
          <div class="csc-det-head">
            <h2 class="csc-sec-t">Para onde o dinheiro foi</h2>
            <span class="csc-det-selo csc-det-selo-real">valor real</span>
          </div>
          <p class="csc-sec-d">É o valor <b>real</b> cobrado pela Anthropic, quebrado por modelo e tipo de uso (texto que entra, resposta que sai, cache…). A Anthropic não detalha chamada por chamada — <b>isto é o mais fino que existe</b>.</p>
          <div v-if="gastoRealCarregando" class="csc-det-vazio">Carregando…</div>
          <div v-else-if="detCategoria.length" class="csc-det-lista">
            <div v-for="(c, i) in detCategoria" :key="'cat' + i" class="csc-det-linha">
              <span class="csc-det-nome">{{ traduzCategoria(c.item) }}</span>
              <span class="csc-det-val">{{ fmtBRL(Number(c.usd) * CAMBIO) }}</span>
            </div>
          </div>
          <div v-else class="csc-det-vazio">Detalhamento por categoria indisponível agora.</div>
        </div>

        <!-- DETALHAMENTO 2 — "Quem gastou" (por robô): a Anthropic NÃO cobra separado por
             robô. Este valor é o custo real RATEADO pelo uso de cada chave — estimativa de
             atribuição, não fatura por robô. Deixamos isso explícito, sem esconder. -->
        <div class="csc-det">
          <div class="csc-det-head">
            <h2 class="csc-sec-t">Quem gastou</h2>
            <span class="csc-det-selo csc-det-selo-rateado">rateado por uso</span>
          </div>
          <p class="csc-sec-d">A Anthropic <b>não</b> cobra separado por robô. Este valor é o custo real <b>rateado</b> pelo uso de cada chave (quanto cada uma consumiu) — é uma <b>estimativa de atribuição, não uma fatura por robô</b>.</p>
          <div v-if="gastoRealCarregando" class="csc-det-vazio">Carregando…</div>
          <div v-else-if="detChave.length" class="csc-det-lista">
            <div v-for="(k, i) in detChave" :key="'chave' + i" class="csc-det-linha">
              <div class="csc-det-nome-wrap">
                <span class="csc-det-nome">{{ traduzChave(k.nome) }}</span>
                <span class="csc-det-tokens">{{ fmtNum(k.tokensIn) }} tokens enviados · {{ fmtNum(k.tokensOut) }} gerados</span>
              </div>
              <span class="csc-det-val">{{ fmtBRL(Number(k.usdEstimado) * CAMBIO) }}</span>
            </div>
          </div>
          <div v-else class="csc-det-vazio">Detalhamento por robô indisponível agora.</div>
        </div>

        <div class="csc-kpis">
          <div class="csc-kpi"><span class="csc-kpi-lbl">Estimativa dos robôs no período</span><span class="csc-kpi-val">{{ fmtBRL(exResumo.usd * CAMBIO) }}</span><span class="csc-kpi-sub">só as tarefas dos robôs abaixo — o real acima é maior</span></div>
          <div class="csc-kpi"><span class="csc-kpi-lbl">Tarefas que custaram</span><span class="csc-kpi-val">{{ exResumo.pagas }}</span><span class="csc-kpi-sub">de {{ exResumo.total }} no total</span></div>
          <div class="csc-kpi"><span class="csc-kpi-lbl">Tarefas de custo zero</span><span class="csc-kpi-val">{{ exResumo.zero }}</span><span class="csc-kpi-sub">não usaram API paga</span></div>
          <div class="csc-kpi"><span class="csc-kpi-lbl">Média por tarefa paga</span><span class="csc-kpi-val">{{ fmtBRL(exResumo.mediaPaga * CAMBIO) }}</span><span class="csc-kpi-sub">no período</span></div>
        </div>

        <div class="csc-sec"><h2 class="csc-sec-t">Quem está gastando mais</h2><p class="csc-sec-d">Total por área no período, do maior para o menor. Fábrica e Painel aparecem em R$ 0 (não usam API paga).</p></div>
        <div class="csc-ranking">
          <div v-for="(a, i) in gastoPorArea" :key="a.area" class="csc-rank" :class="{ topo: i === 0 && a.usd > 0 }">
            <div class="csc-rank-top">
              <span class="csc-rank-nome"><b>{{ i + 1 }}º</b> {{ a.area }}</span>
              <span class="csc-rank-val">{{ a.usd === 0 ? 'R$ 0' : fmtBRL(a.usd * CAMBIO) }}</span>
            </div>
            <div class="csc-rank-bar"><i :style="{ width: a.barPct + '%' }"></i></div>
            <div class="csc-rank-sub">{{ a.pct }}% do total · {{ a.acoes }} tarefa{{ a.acoes === 1 ? '' : 's' }}</div>
          </div>
          <div v-if="!gastoPorArea.length" class="csc-col-vazio">Nenhuma tarefa no período.</div>
        </div>

        <div class="csc-sec"><h2 class="csc-sec-t">Extrato detalhado</h2><p class="csc-sec-d">Cada tarefa do período, da mais recente para a mais antiga — como um extrato de banco.</p></div>
        <div class="csc-extrato">
          <div class="csc-ex-row csc-ex-cab"><span>Quando</span><span>Área</span><span>O que a IA fez</span><span class="csc-ex-v">Valor</span></div>
          <div v-for="(e, i) in execucoesPeriodo" :key="e.id || i" class="csc-ex-row">
            <span class="csc-ex-data">{{ fmtData(e.run_at) }}</span>
            <span class="csc-ex-area">{{ areaDe(e.robo) }}</span>
            <span class="csc-ex-oque">{{ fraseAcaoMaiuscula(e) }}</span>
            <span class="csc-ex-v" :class="{ 'csc-zero': Number(e.usd) === 0 }">{{ Number(e.usd) === 0 ? 'R$ 0' : fmtBRL(e.usd * CAMBIO) }}</span>
          </div>
          <div v-if="execucoesPeriodo.length" class="csc-ex-row csc-ex-tot"><span></span><span></span><span>Total estimado (só robôs)</span><span class="csc-ex-v">{{ fmtBRL(exResumo.usd * CAMBIO) }}</span></div>
          <div v-if="!execucoesPeriodo.length" class="csc-fi-vazio">Nenhuma tarefa nesse período.</div>
        </div>
      </div><!-- fim aba extrato -->
    </div>

    <!-- Modal criar/editar projeto -->
    <div v-if="modal.aberto" class="csc-modal-bg" @click.self="fecharModal">
      <div class="csc-modal">
        <h3 class="csc-modal-t">{{ modal.editando ? 'Editar projeto' : 'Novo projeto' }}</h3>
        <label class="csc-campo"><span>Nome do projeto</span><input v-model="modal.titulo" type="text" placeholder="Ex.: Portal de Notícias" @keyup.enter="salvarModal"></label>
        <label class="csc-campo"><span>Etapa (opcional)</span><input v-model="modal.etapa" type="text" placeholder="Ex.: Fase 2, SP6…"></label>
        <label class="csc-campo"><span>Descrição (opcional)</span><textarea v-model="modal.descricao" rows="3" placeholder="Em que pé está, em uma ou duas frases."></textarea></label>
        <label class="csc-campo"><span>Situação</span>
          <select v-model="modal.situacao">
            <option v-for="c in colunas" :key="c.key" :value="c.key">{{ c.label }}</option>
          </select>
        </label>
        <div class="csc-modal-foot">
          <button class="csc-btn-sec" @click="fecharModal">Cancelar</button>
          <button class="csc-btn-pri" @click="salvarModal">{{ modal.editando ? 'Salvar' : 'Criar' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref, reactive, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { sb } from '../../compartilhado/buscar-e-salvar-dados.js'
import { sbClient } from '../../compartilhado/conectar-no-banco-de-dados.js'
import { adminToast } from '../../compartilhado/avisos.js'
import FaixaDeErro from '../../compartilhado/faixa-de-erro.vue'

const router = useRouter()
const voltar = () => router.push({ name: 'inicio' })
const logoClaroUrl = '/midia/LOGOTIPOBRENOPRETO.png'
const logoEscuroUrl = '/midia/LOGOTIPOBRENOBRANCO.png'

const CAMBIO = 5.5 // US$ -> R$ (mesmo valor usado nos logs dos robôs)

// Robôs conhecidos: rótulo, o que faz (leigo), quando roda (leigo) e o verbo da produção.
const ROBOS = [
  { slug: 'gestor-comercial', label: 'Gestor Comercial', faz: 'Escreve o relatório comercial da semana (metas, concorrência, estoque).', quando: 'toda segunda de manhã', verbo: 'Escreveu' },
  { slug: 'budget-ia',        label: 'Consultor de Anúncios', faz: 'Analisa as campanhas do Meta e sugere o orçamento de cada uma.', quando: 'toda segunda de manhã', verbo: 'Analisou' },
  { slug: 'coletor-noticias', label: 'Coletor de Notícias', faz: 'Lê e resume as novidades dos concorrentes.', quando: 'toda segunda de manhã', verbo: 'Resumiu' },
  { slug: 'panorama',         label: 'Panorama do Mercado', faz: 'Escreve o resumão do que rolou no mercado.', quando: 'quando você pede', verbo: 'Escreveu' },
  { slug: 'fabrica-gerar',    label: 'Fábrica · Criar Criativos', faz: 'Cria as imagens (criativos) dos anúncios.', quando: 'quando você manda', verbo: 'Criou' },
  { slug: 'fabrica-subir',    label: 'Fábrica · Subir Campanha', faz: 'Monta a campanha e sobe os anúncios para o Meta.', quando: 'quando você manda', verbo: 'Subiu' },
  { slug: 'fabrica-ativar',   label: 'Fábrica · Ligar Anúncios', faz: 'Liga os anúncios no Gerenciador do Meta.', quando: 'quando você manda', verbo: 'Ligou' },
  { slug: 'status-projetos',  label: 'Atualizador do Painel', faz: 'Atualiza este painel com o andamento dos projetos.', quando: 'a cada mudança nos planos', verbo: 'Atualizou' },
  { slug: 'sugerir-interesses', label: 'Sugestões de Interesse', faz: 'Descobre os interesses de público de cada objetivo buscando no catálogo do Meta, e mostra na Fábrica.', quando: 'todo domingo de manhã', verbo: 'Sugeriu' },
]
const META = Object.fromEntries(ROBOS.map(r => [r.slug, r]))
const nomeRobo = (slug) => (META[slug]?.label) || slug

// Colunas do kanban, em linguagem bem literal.
// A ORDEM aqui é o caminho que um projeto percorre: começa, é construído, e fica
// pronto. Antes "Fazendo agora" vinha ANTES de "Ainda não começou" — o meio antes
// do início — e por isso o quadro não se lia como algo caminhando.
//
// "Parado" fica por último de propósito: não é uma etapa do caminho, é o desvio.
// Projeto parado saiu da esteira; deixá-lo no meio dava a impressão de que todo
// mundo passa por ali.
const colunas = [
  { key: 'planejado',    label: '1 · Ainda não começou', desc: 'Está na fila. O trabalho ainda não foi iniciado.' },
  { key: 'em-andamento', label: '2 · Sendo construído',  desc: 'Alguém está trabalhando nisso agora.' },
  { key: 'no-ar',        label: '3 · Pronto e no ar',    desc: 'Terminado e funcionando de verdade, em produção.' },
  { key: 'pausado',      label: '⏸ Parado',              desc: 'Começou e travou. Está esperando alguma coisa pra destravar.' },
]

const execucoes = ref([])
const projetos = ref([])
const relogio = ref('')
const statusCarga = ref('carregando…')

// ── formatação ──
const fmtUsd = (v) => 'US$ ' + Number(v || 0).toFixed(2)
const fmtBRL = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtNum = (v) => Number(v || 0).toLocaleString('pt-BR')
function fmtDur(ms) {
  const s = Math.round((ms || 0) / 1000)
  if (s < 1) return 'menos de 1 segundo'
  if (s < 60) return s + (s === 1 ? ' segundo' : ' segundos')
  const m = Math.floor(s / 60), r = s % 60
  if (m < 60) return r ? `${m} min e ${r}s` : `${m} minuto${m === 1 ? '' : 's'}`
  const h = Math.floor(m / 60), mm = m % 60
  return `${h}h${mm ? ' e ' + mm + 'min' : ''}`
}
function tempoRel(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.round(diff / 1000)
  if (s < 60) return 'agora há pouco'
  const m = Math.floor(s / 60); if (m < 60) return `há ${m} min`
  const h = Math.floor(m / 60); if (h < 24) return `há ${h} hora${h === 1 ? '' : 's'}`
  const d = Math.floor(h / 24)
  return d === 1 ? 'ontem' : `há ${d} dias`
}
// Frase do custo, em reais e explicando o "custo zero".
// Compacto (cabe numa linha nos cards). A explicação completa do "custo zero"
// (não usou API paga, só a assinatura) fica na legenda do topo.
function custoFrase(usd) {
  return Number(usd) === 0 ? 'R$ 0 · sem API paga' : `${fmtBRL(Number(usd) * CAMBIO)} · ${fmtUsd(usd)}`
}
// Coloca a unidade no singular quando a quantidade é 1 ("1 relatório", não "1 relatórios").
function unid(n, u) {
  return Number(n) === 1 ? String(u || '').replace(/s$/, '') : u
}
// Frase de ação para a linha do tempo, ex.: "criou 100 criativos".
function fraseAcao(e) {
  const verbo = (META[e.robo]?.verbo || 'Fez').toLowerCase()
  if (e.itens != null && e.unidade) return `${verbo} ${fmtNum(e.itens)} ${unid(e.itens, e.unidade)}`
  return e.acao
}

// ── agregações ──
const feed = computed(() => execucoes.value.slice(0, 30))

const kpis = computed(() => {
  const now = Date.now()
  const DIA = 86400000
  const inicioHoje = new Date(); inicioHoje.setHours(0, 0, 0, 0)
  let usdHoje = 0, usdMes = 0, acoes = 0, itens = 0, tempoMs = 0
  for (const e of execucoes.value) {
    const t = new Date(e.run_at).getTime()
    const usd = Number(e.usd) || 0
    if (t >= inicioHoje.getTime()) usdHoje += usd
    if (now - t <= 30 * DIA) { usdMes += usd; acoes++; itens += Number(e.itens) || 0; tempoMs += Number(e.duracao_ms) || 0 }
  }
  return { usdHoje, usdMes, acoes, itens, tempoMs }
})

// Robôs: mostra os que já rodaram primeiro (por última execução), depois os conhecidos que faltam.
const robosView = computed(() => {
  const ultimaPorRobo = {}
  for (const e of execucoes.value) if (!ultimaPorRobo[e.robo]) ultimaPorRobo[e.robo] = e // execucoes vem desc
  const lista = ROBOS.map(r => ({ ...r, ult: ultimaPorRobo[r.slug] || null }))
  return lista.sort((a, b) => {
    const ta = a.ult ? new Date(a.ult.run_at).getTime() : -1
    const tb = b.ult ? new Date(b.ult.run_at).getTime() : -1
    return tb - ta
  })
})

// Dois quadros, duas origens.
//
// O TÉCNICO é lido sozinho dos planos em docs/superpowers/plans/ (robô
// status-projetos). É detalhado e mostra tudo — inclusive coisa que só interessa
// a quem constrói. É o quadro que "atualiza sozinho".
//
// O SIMPLIFICADO tem só o que foi posto à mão. É a lista curta e curada: o que
// alguém decidiu que merece ser acompanhado, sem o ruído dos 31 planos.
//
// A separação é por origem (`manual`), não por conteúdo — é o mesmo card, no
// quadro certo.
function _agruparPorSituacao(lista) {
  const g = {}
  for (const p of lista) (g[p.situacao] = g[p.situacao] || []).push(p)
  return g
}
const projetosTecnicos = computed(() => projetos.value.filter(p => !p.manual))
const projetosSimples  = computed(() => projetos.value.filter(p => !!p.manual))
const porSitTecnico = computed(() => _agruparPorSituacao(projetosTecnicos.value))
const porSitSimples = computed(() => _agruparPorSituacao(projetosSimples.value))

// Qual quadro está na tela. Começa no curado: é a lista curta, a que responde
// "em que pé estamos" sem os 31 planos no meio.
const quadro = ref('simples')
const porSitAtivo = computed(() => quadro.value === 'simples' ? porSitSimples.value : porSitTecnico.value)

// ── extrato de gastos ──
const aba = ref('visao')
const periodos = [{ d: 7, label: '7 dias' }, { d: 14, label: '14 dias' }, { d: 30, label: '30 dias' }, { d: 3650, label: 'Tudo' }]
const periodo = ref(30)
const periodoLabel = computed(() => {
  if (periodo.value >= 3650) return 'últimos 90 dias'
  const p = periodos.find((x) => x.d === periodo.value)
  return p ? p.label : `${periodo.value} dias`
})

// ── GASTO REAL da Anthropic (a fatura de verdade) ──────────────────────────
// O total que a tela calcula (soma do campo `usd` que os robôs anotaram) é só
// uma ESTIMATIVA PARCIAL: conta apenas as tarefas dos robôs deste painel. A
// Anthropic cobra bem mais — a fatura real inclui também as sessões de
// desenvolvimento com IA (Claude Code), as buscas na web e o cache. A edge
// function `custo-anthropic` devolve esse número real (só admin tem acesso).
// Nunca inventamos um número: se a busca falhar, mostramos o erro, nunca R$ 0.
async function _buscarCustoReal(dias) {
  try {
    const { data, error } = await sbClient.functions.invoke('custo-anthropic', { body: { dias } })
    if (error) return { erro: error.message || 'não consegui falar com o servidor' }
    if (data && data.error) return { erro: data.detalhe || data.error }
    if (!data || typeof data.totalBrl !== 'number') return { erro: 'resposta sem valor' }
    return { dados: data }
  } catch (e) {
    return { erro: (e && e.message) || 'falha inesperada' }
  }
}

// Hero (visão geral): sempre 30 dias, pra casar com a frase "nos últimos 30 dias".
const gastoRealMes = ref(null)
const gastoRealMesCarregando = ref(false)
const gastoRealMesErro = ref(null)
async function carregarGastoRealMes() {
  gastoRealMesCarregando.value = true
  gastoRealMesErro.value = null
  const r = await _buscarCustoReal(30)
  gastoRealMesCarregando.value = false
  if (r.erro) { gastoRealMesErro.value = r.erro; gastoRealMes.value = null }
  else gastoRealMes.value = r.dados
}

// Extrato: segue o período escolhido (7/14/30 dias; "Tudo" → 90, o teto da função).
const gastoReal = ref(null)
const gastoRealCarregando = ref(false)
const gastoRealErro = ref(null)
let _gastoRealSeq = 0 // ignora respostas antigas se o período mudar durante a busca
async function carregarGastoReal() {
  const dias = periodo.value >= 3650 ? 90 : periodo.value
  const seq = ++_gastoRealSeq
  gastoRealCarregando.value = true
  gastoRealErro.value = null
  const r = await _buscarCustoReal(dias)
  if (seq !== _gastoRealSeq) return // chegou uma resposta mais nova; descarta esta
  gastoRealCarregando.value = false
  if (r.erro) { gastoRealErro.value = r.erro; gastoReal.value = null }
  else gastoReal.value = r.dados
}
// Ao trocar o período, rebusca o gasto real daquela janela.
watch(periodo, () => { carregarGastoReal() })

function fmtDataCurta(iso) {
  if (!iso) return ''
  const p = String(iso).split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}` : String(iso)
}

// ── DETALHAMENTO do gasto real (por categoria + por robô) ───────────────────
// Ambas as listas já vêm na MESMA resposta da função custo-anthropic (no ref
// gastoReal) — não fazemos uma segunda chamada, só lemos os campos.
//   • porCategoria → valor REAL cobrado, quebrado por modelo e tipo de token.
//   • porChave     → custo real RATEADO pelo uso de cada chave (atribuição, não fatura).
// Se a sub-chamada da função falhar, o campo vem como [] — a tela mostra
// "indisponível", nunca inventa número.
const detCategoria = computed(() => Array.isArray(gastoReal.value?.porCategoria) ? gastoReal.value.porCategoria : [])
const detChave = computed(() => Array.isArray(gastoReal.value?.porChave) ? gastoReal.value.porChave : [])

// Traduz o nome técnico da categoria da Anthropic pra algo que o dono entende.
// Nomes não reconhecidos voltam como vieram (nunca inventamos rótulo).
function traduzCategoria(item) {
  const raw = String(item || '').trim()
  const low = raw.toLowerCase()
  if (low.includes('web search')) return 'Buscas na web'
  if (low.includes('code execution')) return 'Execução de código'
  // Modelo, ex.: "Claude Opus 4.8" / "Claude Sonnet 4.6" / "Claude Haiku 4.5"
  const mMod = raw.match(/Claude\s+(Opus|Sonnet|Haiku)\s+[\d.]+/i)
  const modelo = mMod ? mMod[0].replace(/^Claude\s+/i, '') : ''
  let tipo = ''
  if (low.includes('cache write') || low.includes('cache creation')) tipo = 'gravação de cache'
  else if (low.includes('cache hit') || low.includes('cache read')) tipo = 'cache reaproveitado (mais barato)'
  else if (low.includes('output')) tipo = 'respostas geradas (saída)'
  else if (low.includes('input')) tipo = 'texto enviado (entrada)'
  if (modelo && tipo) return `${modelo} · ${tipo}`
  if (modelo) return modelo
  return raw
}

// Traduz o nome da chave (robô) pra um rótulo amigável. Chave desconhecida
// aparece como veio.
const ROBO_CHAVE = {
  desenvolvimentopilotos: 'Desenvolvimento & pilotos (sessões de IA, ex.: este trabalho)',
  spyconcorrente: 'Espião de concorrentes',
  gestortrafego: 'Gestor de Tráfego',
  gestorcomercial: 'Gestor Comercial',
  // Esta chave chega com hífen ('sugerir-interesses'). As duas formas ficam
  // mapeadas porque numa tela sobre DINHEIRO não pode aparecer nome técnico de
  // arquivo — e não vale a pena descobrir na produção qual das duas veio.
  'sugerir-interesses': 'Sugestões de Interesse (Fábrica de Anúncios)',
  sugeririnteresses: 'Sugestões de Interesse (Fábrica de Anúncios)',
}
const traduzChave = (nome) => ROBO_CHAVE[String(nome || '').toLowerCase()] || nome || '—'

// Cada robô pertence a uma "área" (o que o usuário chama de projeto) — pra consolidar o gasto.
const AREA = {
  'gestor-comercial': 'Gestão Comercial',
  'budget-ia': 'Anúncios (orçamento)',
  'coletor-noticias': 'Notícias',
  'panorama': 'Notícias',
  'fabrica-gerar': 'Fábrica de Anúncios',
  'fabrica-subir': 'Fábrica de Anúncios',
  'fabrica-ativar': 'Fábrica de Anúncios',
  'status-projetos': 'Painel do Sistema',
  'sugerir-interesses': 'Fábrica de Anúncios',
}
const areaDe = (robo) => AREA[robo] || nomeRobo(robo)

const execucoesPeriodo = computed(() => {
  const lim = Date.now() - periodo.value * 86400000
  return execucoes.value.filter((e) => new Date(e.run_at).getTime() >= lim)
})
const exResumo = computed(() => {
  let usd = 0, pagas = 0, zero = 0
  for (const e of execucoesPeriodo.value) {
    const v = Number(e.usd) || 0
    usd += v
    if (v > 0) pagas++; else zero++
  }
  return { usd, pagas, zero, total: execucoesPeriodo.value.length, mediaPaga: pagas ? usd / pagas : 0 }
})
const gastoPorArea = computed(() => {
  const g = {}
  for (const e of execucoesPeriodo.value) {
    const a = areaDe(e.robo)
    if (!g[a]) g[a] = { area: a, usd: 0, acoes: 0 }
    g[a].usd += Number(e.usd) || 0
    g[a].acoes++
  }
  const arr = Object.values(g).sort((x, y) => y.usd - x.usd || y.acoes - x.acoes)
  const max = arr.reduce((m, x) => Math.max(m, x.usd), 0) || 1
  const tot = arr.reduce((s, x) => s + x.usd, 0) || 1
  return arr.map((x) => ({ ...x, pct: Math.round((x.usd / tot) * 100), barPct: Math.max(2, Math.round((x.usd / max) * 100)) }))
})
function fmtData(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' · ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
// "Escreveu 1 relatório" (com maiúscula) + nome do robô, pra linha do extrato.
function fraseAcaoMaiuscula(e) {
  const f = fraseAcao(e)
  return nomeRobo(e.robo) + ' — ' + f.charAt(0).toUpperCase() + f.slice(1)
}

// ── carga ──
const erroCarregar = ref(null)

// Saúde dos robôs agendados (pg_cron → Edge Functions). É outra coisa dos robôs
// de IA acima: aqui não se mede custo, mede-se se a rodada DEU CERTO. Existe
// porque cron.job_run_details diz "succeeded" mesmo quando a função devolve erro
// — ver a migration 2026-07-31-saude-dos-robos.sql.
const saudeDosRobos = ref([])

// Só o que está com problema. Robô saudável não vira aviso: um painel que avisa
// sobre o que está normal ensina a ignorar aviso.
const robosComProblema = computed(() =>
  saudeDosRobos.value
    .filter(r => r.situacao === 'ATRASADO' || r.situacao === 'nunca deu certo')
    .sort((a, b) => Number(b.critico) - Number(a.critico)),
)

async function carregar() {
  const [ex, pr, sa] = await Promise.all([
    sb('ia_execucoes?select=*&order=run_at.desc&limit=200'),
    sb('projetos_status?select=*&arquivado=is.false&order=ordem.desc'),
    // Saúde dos robôs agendados. NÃO entra no erroCarregar abaixo: se esta
    // consulta falhar, o painel inteiro não pode sumir por causa dela — o pior
    // que acontece é o aviso não aparecer.
    sb('robos_saude?select=*'),
  ])
  if (!sa.erro) saudeDosRobos.value = sa
  // Antes: falha virava [] e a tela dizia "0 execuções, R$ 0" como se fosse
  // verdade. Só sobrescreve os dados bons quando a busca deu certo — assim um
  // blip de rede no refresh de 60s não apaga o que já estava na tela.
  erroCarregar.value = ex.erro || pr.erro || null
  if (!ex.erro) execucoes.value = ex
  if (!pr.erro) projetos.value = pr
  if (erroCarregar.value) return
  const hh = new Date()
  statusCarga.value = 'atualizado às ' + hh.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// ── kanban interativo: arrastar + criar/editar/excluir ──
const arrastando = ref(null)
function onDrag(p) { arrastando.value = p }
async function onDropCol(situacao) {
  const p = arrastando.value
  arrastando.value = null
  if (!p || p.situacao === situacao) return
  await moverPara(p, situacao)
}
async function moverPara(p, situacao) {
  p.situacao = situacao // otimista
  const { error } = await sbClient.from('projetos_status')
    .update({ situacao, manual: true, atualizado_em: new Date().toISOString() })
    .eq('projeto', p.projeto)
  if (error) { adminToast('Não consegui mover: ' + error.message, false); carregar() }
  else adminToast('Movido para "' + (colunas.find(c => c.key === situacao)?.label || situacao) + '"', true)
}

// Modal de criar/editar
const modal = reactive({ aberto: false, editando: null, titulo: '', etapa: '', descricao: '', situacao: 'em-andamento' })
function abrirNovo(situacao) {
  Object.assign(modal, { aberto: true, editando: null, titulo: '', etapa: '', descricao: '', situacao: situacao || 'em-andamento' })
}
function abrirEditar(p) {
  Object.assign(modal, { aberto: true, editando: p, titulo: p.titulo || '', etapa: p.etapa || '', descricao: p.descricao || '', situacao: p.situacao })
}
function fecharModal() { modal.aberto = false }
function slugDe(txt) {
  const base = (txt || 'projeto').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'projeto'
  return 'm-' + base + '-' + Math.random().toString(36).slice(2, 6)
}
async function salvarModal() {
  const t = modal.titulo.trim()
  if (!t) { adminToast('Dá um nome pro projeto.', false); return }
  const campos = { titulo: t, etapa: modal.etapa.trim() || null, descricao: modal.descricao.trim() || null, situacao: modal.situacao, manual: true, atualizado_em: new Date().toISOString() }
  if (modal.editando) {
    const { error } = await sbClient.from('projetos_status').update(campos).eq('projeto', modal.editando.projeto)
    if (error) { adminToast('Erro ao salvar: ' + error.message, false); return }
    adminToast('Projeto atualizado.', true)
  } else {
    const { error } = await sbClient.from('projetos_status').insert({ ...campos, projeto: slugDe(t), progresso: 0, arquivado: false, ordem: Math.floor(Date.now() / 86400000) })
    if (error) { adminToast('Erro ao criar: ' + error.message, false); return }
    adminToast('Projeto criado.', true)
  }
  modal.aberto = false
  await carregar()
}
async function excluir(p) {
  if (!window.confirm(`Tirar "${p.titulo}" do painel?`)) return
  const { error } = await sbClient.from('projetos_status').update({ arquivado: true, manual: true }).eq('projeto', p.projeto)
  if (error) { adminToast('Erro ao excluir: ' + error.message, false); return }
  adminToast('Removido do painel.', true)
  await carregar()
}

let _clockTimer = null, _refreshTimer = null
function tickRelogio() {
  relogio.value = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
onMounted(() => {
  tickRelogio()
  _clockTimer = setInterval(tickRelogio, 1000)
  carregar()
  carregarGastoRealMes()
  carregarGastoReal()
  _refreshTimer = setInterval(() => { carregar(); carregarGastoRealMes(); carregarGastoReal() }, 60000)
})
onUnmounted(() => {
  if (_clockTimer) clearInterval(_clockTimer)
  if (_refreshTimer) clearInterval(_refreshTimer)
})
</script>

<style scoped>
/* Fontes (Sora + IBM Plex Mono/Sans) carregadas no index.html, junto das demais do app. */
.csc-tela {
  --fs: 'IBM Plex Sans', system-ui, sans-serif;
  --fd: 'Sora', system-ui, sans-serif;
  --fm: 'IBM Plex Mono', ui-monospace, 'SF Mono', monospace;
  --violet: #8b5cf6;
  min-height: 100vh; background: var(--bg); color: var(--text); font-family: var(--fs);
}
@keyframes cscUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

/* Topbar */
.csc-topbar { display: flex; align-items: center; gap: 16px; padding: 13px clamp(16px, 2.5vw, 44px); border-bottom: 1px solid var(--border); background: color-mix(in srgb, var(--surface) 88%, transparent); backdrop-filter: saturate(1.4) blur(10px); position: sticky; top: 0; z-index: 20; }
.csc-tb-left { display: flex; align-items: center; gap: 14px; }
.csc-back { display: inline-flex; align-items: center; gap: 5px; background: none; border: 1px solid var(--border); color: var(--muted); font-size: 12px; font-weight: 500; padding: 6px 11px; border-radius: var(--radius-sm); cursor: pointer; transition: border-color .18s, color .18s; }
.csc-back:hover { border-color: var(--accent); color: var(--text); }
.rbv-logo { height: 22px; width: auto; }
.rbv-logo-light { display: block; } .rbv-logo-dark { display: none; }
:global([data-theme="dark"]) .rbv-logo-light { display: none; }
:global([data-theme="dark"]) .rbv-logo-dark { display: block; }
.csc-title { font-family: var(--fs); font-size: 15px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; color: var(--text); flex: 1; }
.csc-tb-right { display: flex; align-items: center; gap: 16px; }
.csc-live { display: inline-flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--green); }
.csc-live i { width: 7px; height: 7px; border-radius: 50%; background: var(--green); animation: cscPulse 1.8s infinite; }
@keyframes cscPulse { 0% { box-shadow: 0 0 0 0 rgba(34,197,94,.5); } 70% { box-shadow: 0 0 0 7px rgba(34,197,94,0); } 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); } }
.csc-clock { font-family: var(--fm); font-size: 15px; font-weight: 500; letter-spacing: .5px; color: var(--text); font-variant-numeric: tabular-nums; }
.csc-upd { font-size: 10px; color: var(--muted); letter-spacing: .2px; }

.csc-body { padding: clamp(16px, 2vw, 40px) clamp(16px, 2.5vw, 48px) 64px; display: flex; flex-direction: column; gap: clamp(20px, 2.2vw, 32px); width: 100%; }

/* HERO */
.csc-hero { display: flex; flex-wrap: wrap; align-items: stretch; justify-content: space-between; gap: 28px; padding: clamp(24px, 3.2vw, 44px); border-radius: 20px; border: 1px solid var(--border); animation: cscUp .5s cubic-bezier(.22,1,.36,1) both; background:
    radial-gradient(85% 130% at 100% 0%, color-mix(in srgb, var(--accent) 20%, transparent) 0%, transparent 58%),
    radial-gradient(70% 120% at 0% 100%, color-mix(in srgb, var(--violet) 15%, transparent) 0%, transparent 52%),
    var(--surface); box-shadow: var(--shadow-md); overflow: hidden; }
.csc-hero-txt { flex: 1 1 380px; display: flex; flex-direction: column; justify-content: center; }
.csc-hero-eyebrow { font-size: 11px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase; color: var(--accent); }
.csc-hero-h1 { font-family: var(--fd); font-size: clamp(30px, 4.6vw, 52px); font-weight: 600; letter-spacing: -.5px; color: var(--text); margin: 10px 0 14px; line-height: 1.02; }
.csc-hero-p { font-size: clamp(14px, 1.1vw, 16px); line-height: 1.65; color: var(--muted); max-width: 620px; }
.csc-hero-p b { color: var(--text); font-weight: 600; }
.csc-hero-gasto { flex: 0 0 auto; display: flex; flex-direction: column; justify-content: center; gap: 5px; padding: 4px 4px 4px 26px; border-left: 1px solid var(--border); }
.csc-hero-gasto-lbl { font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: var(--muted); }
.csc-hero-gasto-val { font-family: var(--fm); font-size: clamp(32px, 5.2vw, 56px); font-weight: 600; color: var(--text); line-height: 1; letter-spacing: -1px; font-variant-numeric: tabular-nums; }
.csc-hero-gasto-sub { font-size: 12px; color: var(--muted); line-height: 1.5; max-width: 300px; }
.csc-hero-gasto-sub b { color: var(--text); font-weight: 600; }
.csc-hero-gasto-indisp { font-size: clamp(20px, 3vw, 28px); color: var(--red); }
.csc-hero-gasto-erro { font-size: 12.5px; color: var(--red); line-height: 1.5; max-width: 300px; font-weight: 500; }
.csc-hero-gasto-est { margin-top: 8px; font-size: 11.5px; color: var(--muted); line-height: 1.5; max-width: 300px; padding-top: 8px; border-top: 1px dashed var(--border); }
.csc-hero-gasto-est b { color: var(--text); font-weight: 600; }
.csc-carregando { color: var(--muted); }

/* SAÚDE DOS ROBÔS: o aviso de que algo parou. Vermelho de propósito — é a única
   coisa nesta tela que pede ação, e só aparece quando existe problema. */
.csc-alerta {
  display: flex; flex-direction: column; gap: 12px;
  border: 1px solid color-mix(in srgb, var(--red) 45%, transparent);
  background: color-mix(in srgb, var(--red) 8%, var(--surface));
  border-radius: 16px; padding: clamp(16px, 2.2vw, 24px);
  animation: cscUp .5s cubic-bezier(.22,1,.36,1) both;
}
.csc-alerta-t { font-family: var(--fd); font-size: 17px; font-weight: 600; color: var(--red); }
.csc-alerta-item {
  display: flex; flex-direction: column; gap: 4px;
  padding-top: 10px; border-top: 1px solid color-mix(in srgb, var(--red) 20%, transparent);
}
.csc-alerta-item:first-of-type { border-top: none; padding-top: 0; }
.csc-alerta-cab { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.csc-alerta-cab b { font-family: var(--fm); font-size: 14px; color: var(--text); }
.csc-alerta-selo {
  font-size: 10px; font-weight: 700; letter-spacing: .6px; text-transform: uppercase;
  padding: 2px 8px; border-radius: 20px; border: 1px solid var(--border); color: var(--muted);
}
.csc-alerta-selo.critico { border-color: var(--red); color: var(--red); }
.csc-alerta-txt { font-size: 13.5px; line-height: 1.6; color: var(--text); }
.csc-alerta-porque { font-size: 12.5px; line-height: 1.55; color: var(--muted); max-width: 80ch; }

/* GASTO REAL (extrato): bloco de destaque com a fatura de verdade da Anthropic */
.csc-real { border-radius: 18px; border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border)); padding: clamp(18px, 2.4vw, 26px); display: flex; flex-direction: column; gap: 12px; box-shadow: var(--shadow-md); animation: cscUp .5s cubic-bezier(.22,1,.36,1) both; background:
    radial-gradient(90% 130% at 100% 0%, color-mix(in srgb, var(--accent) 16%, transparent) 0%, transparent 60%),
    radial-gradient(70% 120% at 0% 100%, color-mix(in srgb, var(--violet) 12%, transparent) 0%, transparent 55%),
    var(--surface); }
.csc-real-main { display: flex; flex-direction: column; gap: 4px; }
.csc-real-lbl { font-size: 11.5px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: var(--accent); }
.csc-real-val { font-family: var(--fm); font-size: clamp(34px, 6vw, 60px); font-weight: 600; color: var(--text); line-height: 1; letter-spacing: -1.5px; font-variant-numeric: tabular-nums; }
.csc-real-indisp { color: var(--red); letter-spacing: -.5px; font-size: clamp(24px, 3.4vw, 34px); }
.csc-real-sub { font-size: 12.5px; color: var(--muted); }
.csc-real-exp { font-size: 13px; line-height: 1.6; color: var(--muted); max-width: 78ch; }
.csc-real-exp b { color: var(--text); font-weight: 600; }
.csc-real-erro-box { font-size: 12.5px; line-height: 1.55; color: var(--red); background: color-mix(in srgb, var(--red) 8%, transparent); border: 1px solid color-mix(in srgb, var(--red) 28%, transparent); border-radius: var(--radius-md); padding: 10px 13px; }
.csc-real-erro-box b { font-weight: 700; }

/* DETALHAMENTO do gasto real: por categoria (real) e por robô (rateado) */
.csc-det { display: flex; flex-direction: column; gap: 10px; }
.csc-det-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.csc-det-selo { font-size: 10px; font-weight: 700; letter-spacing: .6px; text-transform: uppercase; padding: 3px 10px; border-radius: 20px; flex-shrink: 0; }
.csc-det-selo-real { color: var(--green); background: color-mix(in srgb, var(--green) 12%, transparent); border: 1px solid color-mix(in srgb, var(--green) 32%, transparent); }
.csc-det-selo-rateado { color: var(--yellow); background: color-mix(in srgb, var(--yellow) 14%, transparent); border: 1px solid color-mix(in srgb, var(--yellow) 34%, transparent); }
.csc-det-lista { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm); }
.csc-det-linha { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 12px 18px; border-bottom: 1px solid var(--border); }
.csc-det-linha:last-child { border-bottom: none; }
.csc-det-nome-wrap { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.csc-det-nome { font-size: 13.5px; color: var(--text); font-weight: 500; line-height: 1.35; }
.csc-det-tokens { font-size: 11px; color: var(--muted); font-family: var(--fm); font-variant-numeric: tabular-nums; }
.csc-det-val { font-family: var(--fm); font-size: 15px; font-weight: 600; color: var(--text); letter-spacing: -.3px; font-variant-numeric: tabular-nums; white-space: nowrap; text-align: right; }
.csc-det-vazio { background: var(--surface); border: 1px dashed var(--border); border-radius: var(--radius-md); padding: 18px; text-align: center; color: var(--muted); font-size: 13px; font-style: italic; }

/* LEGENDA */
.csc-legenda { display: flex; align-items: center; gap: 14px; padding: 13px 18px; border-radius: var(--radius-md); border: 1px dashed var(--border); background: var(--surface2); }
.csc-legenda p { font-size: 13px; line-height: 1.5; color: var(--muted); }
.csc-legenda b { color: var(--text); font-weight: 600; }
.csc-tag { flex-shrink: 0; font-size: 11px; font-weight: 700; letter-spacing: .5px; padding: 4px 10px; border-radius: 20px; }
.csc-tag-zero { color: var(--green); background: rgba(26,110,69,.10); border: 1px solid rgba(26,110,69,.30); }
:global([data-theme="dark"]) .csc-tag-zero { background: rgba(34,197,94,.14); border-color: rgba(34,197,94,.34); }

/* Seções */
.csc-sec { margin-top: 8px; }
.csc-sec-t { font-family: var(--fd); font-size: clamp(20px, 2.2vw, 26px); font-weight: 600; letter-spacing: -.3px; color: var(--text); line-height: 1.1; }
.csc-sec-d { font-size: 13.5px; color: var(--muted); margin-top: 4px; line-height: 1.5; max-width: 720px; }

/* KPIs (cards de resumo) */
.csc-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px; }
.csc-kpi { position: relative; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 16px 18px; display: flex; flex-direction: column; gap: 5px; box-shadow: var(--shadow-sm); overflow: hidden; animation: cscUp .5s cubic-bezier(.22,1,.36,1) both; }
.csc-kpi::before { content: ''; position: absolute; inset: 0 0 auto 0; height: 3px; background: linear-gradient(90deg, var(--accent), var(--violet)); opacity: .85; }
.csc-kpi-lbl { font-size: 10.5px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--muted); }
.csc-kpi-val { font-family: var(--fm); font-size: clamp(24px, 2.6vw, 30px); font-weight: 600; color: var(--text); line-height: 1.05; letter-spacing: -.5px; font-variant-numeric: tabular-nums; }
.csc-kpi-sub { font-size: 11.5px; color: var(--muted); }

/* Robôs */
.csc-robos { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
.csc-robo { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; box-shadow: var(--shadow-sm); border-top: 3px solid var(--border); transition: box-shadow .2s, transform .14s, border-color .2s; animation: cscUp .5s cubic-bezier(.22,1,.36,1) both; }
.csc-robo:hover { box-shadow: var(--shadow-lg); transform: translateY(-3px); }
.csc-robo.st-ok { border-top-color: var(--green); }
.csc-robo.st-erro { border-top-color: var(--red); }
.csc-robo.st-parcial { border-top-color: var(--orange); }
.csc-robo-head { display: flex; align-items: flex-start; gap: 10px; }
.csc-robo-head > div { flex: 1; min-width: 0; }
.csc-robo-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--muted); flex-shrink: 0; margin-top: 5px; }
.csc-robo.st-ok .csc-robo-dot { background: var(--green); }
.csc-robo.st-erro .csc-robo-dot { background: var(--red); }
.csc-robo.st-parcial .csc-robo-dot { background: var(--orange); }
.csc-robo-nome { font-size: 14px; font-weight: 600; color: var(--text); line-height: 1.25; letter-spacing: -.2px; }
.csc-robo-faz { font-size: 12.5px; color: var(--muted); line-height: 1.45; margin-top: 3px; }
.csc-robo-corpo { display: flex; flex-direction: column; gap: 10px; }
.csc-robo-frase { font-size: 15px; color: var(--text); line-height: 1.35; }
.csc-robo-frase b { font-weight: 600; }
.csc-robo-detalhes { list-style: none; display: flex; flex-direction: column; gap: 6px; }
.csc-robo-detalhes li { font-size: 13px; line-height: 1.5; color: var(--text); }
.csc-di-lbl { color: var(--muted); }
.csc-di-lbl::after { content: ': '; }
.csc-di-val { color: var(--text); font-weight: 600; }
.csc-di-val.csc-zero, .csc-zero { color: var(--green); }
.csc-robo-vazio { font-size: 13px; color: var(--muted); font-style: italic; }
.csc-robo-foot { margin-top: auto; font-size: 11px; color: var(--muted); border-top: 1px solid var(--border); padding-top: 9px; }

/* Kanban */
.csc-kanban { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; align-items: start; }
.csc-col { background: var(--surface2); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; animation: cscUp .5s cubic-bezier(.22,1,.36,1) both; transition: border-color .2s; }
.csc-col-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 15px 4px; }
.csc-col-nome { font-family: var(--fs); font-size: 12.5px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; }
.csc-col-head.sit-em-andamento .csc-col-nome { color: var(--accent); }
.csc-col-head.sit-no-ar .csc-col-nome { color: var(--green); }
.csc-col-head.sit-pausado .csc-col-nome { color: var(--yellow); }
.csc-col-head.sit-planejado .csc-col-nome { color: var(--muted); }
.csc-col-cont { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1px 9px; font-size: 12px; font-weight: 600; color: var(--text); }
.csc-col-desc { font-size: 11.5px; color: var(--muted); padding: 0 15px 10px; border-bottom: 1px solid var(--border); }
.csc-col-body { padding: 11px; display: flex; flex-direction: column; gap: 10px; }
.csc-proj { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 11px 13px; display: flex; flex-direction: column; gap: 7px; }
.csc-proj-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.csc-proj-titulo { font-weight: 600; font-size: 13.5px; color: var(--text); }
.csc-proj-etapa { font-size: 10px; font-weight: 700; letter-spacing: .5px; color: var(--accent); background: var(--accent-light); border: 1px solid var(--accent-mid); border-radius: 5px; padding: 2px 7px; flex-shrink: 0; }
.csc-proj-desc { font-size: 12px; line-height: 1.45; color: var(--muted); }
.csc-bar { height: 6px; background: var(--surface2); border-radius: 4px; overflow: hidden; }
.csc-bar i { display: block; height: 100%; background: var(--accent); border-radius: 4px; transition: width .4s ease; }
.csc-proj-prog { font-size: 11px; color: var(--muted); }
.csc-col-vazio { text-align: center; color: var(--muted); font-size: 12.5px; padding: 8px 6px; line-height: 1.4; }

/* Kanban interativo */
.csc-sec-proj { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.csc-sec-d b { color: var(--text); font-weight: 600; }
.csc-add-btn { flex-shrink: 0; background: var(--accent); color: #fff; border: none; border-radius: var(--radius-sm); padding: 9px 16px; font-size: 13px; font-weight: 600; cursor: pointer; transition: filter .15s, transform .12s; }
.csc-add-btn:hover { filter: brightness(1.08); transform: translateY(-1px); }
.csc-col.is-over { outline: 2px dashed var(--accent-mid); outline-offset: -2px; }
.csc-col-acoes { display: flex; align-items: center; gap: 7px; }
.csc-col-add { width: 22px; height: 22px; border-radius: 5px; border: 1px solid var(--border); background: var(--surface); color: var(--muted); font-size: 16px; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: border-color .15s, color .15s; }
.csc-col-add:hover { border-color: var(--accent); color: var(--accent); }
.csc-proj { cursor: grab; position: relative; }
.csc-proj:active { cursor: grabbing; }
.csc-proj-tags { display: flex; align-items: center; gap: 5px; flex-shrink: 0; }
.csc-proj-manual { font-size: 9px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; color: var(--muted); background: var(--surface2); border: 1px solid var(--border); border-radius: 4px; padding: 2px 5px; }
.csc-proj-ferramentas { position: absolute; top: 8px; right: 8px; display: flex; gap: 4px; opacity: 0; transition: opacity .15s; }
.csc-proj:hover .csc-proj-ferramentas, .csc-proj:focus-within .csc-proj-ferramentas { opacity: 1; }
.csc-proj-ferramentas button { width: 24px; height: 24px; border-radius: 5px; border: 1px solid var(--border); background: var(--surface); color: var(--muted); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: border-color .15s, color .15s; }
.csc-proj-ferramentas button:hover { border-color: var(--accent); color: var(--accent); }
.csc-proj-ferramentas button:last-child:hover { border-color: var(--red); color: var(--red); }

/* Modal */
.csc-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 16px; backdrop-filter: blur(2px);padding-top:max(16px,env(safe-area-inset-top));padding-bottom:max(16px,env(safe-area-inset-bottom));padding-left:max(12px,env(safe-area-inset-left));padding-right:max(12px,env(safe-area-inset-right));}
.csc-modal { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 22px; width: min(440px, 100%); box-shadow: var(--shadow-lg); display: flex; flex-direction: column; gap: 13px; }
.csc-modal-t { font-family: var(--fd); font-size: 23px; font-weight: 600; color: var(--text); letter-spacing: -.3px; }
.csc-campo { display: flex; flex-direction: column; gap: 5px; }
.csc-campo span { font-size: 12px; font-weight: 600; color: var(--muted); }
.csc-campo input, .csc-campo textarea, .csc-campo select { font-family: inherit; font-size: 14px; color: var(--text); background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 9px 11px; outline: none; transition: border-color .15s; }
.csc-campo input:focus, .csc-campo textarea:focus, .csc-campo select:focus { border-color: var(--accent); }
.csc-campo textarea { resize: vertical; }
.csc-modal-foot { display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px; }
.csc-btn-sec { background: none; border: 1px solid var(--border); color: var(--muted); border-radius: var(--radius-sm); padding: 9px 16px; font-size: 13px; font-weight: 500; cursor: pointer; }
.csc-btn-sec:hover { border-color: var(--muted); color: var(--text); }
.csc-btn-pri { background: var(--accent); color: #fff; border: none; border-radius: var(--radius-sm); padding: 9px 18px; font-size: 13px; font-weight: 600; cursor: pointer; }
.csc-btn-pri:hover { filter: brightness(1.08); }

/* Abas + extrato */
.csc-wrap { display: contents; }
/* Abas dos dois quadros de projeto (curado × automático). Prefixo csc- como o
   resto do arquivo — o estilos-globais.css tem classes genéricas e este projeto
   já teve bug de colisão entre global e tela scoped. */
.csc-quadro-abas { display: flex; gap: 4px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 4px; width: fit-content; margin: 4px 0 0; }
.csc-quadro-aba { display: flex; align-items: center; gap: 7px; border: none; background: none; color: var(--muted); font-family: inherit; font-size: 12.5px; font-weight: 600; padding: 7px 14px; border-radius: var(--radius-sm); cursor: pointer; transition: background .15s, color .15s; }
.csc-quadro-aba.ativa { background: var(--surface); color: var(--text); box-shadow: var(--shadow-sm); }
.csc-quadro-cont { font-size: 11px; font-weight: 700; min-width: 18px; padding: 1px 5px; border-radius: 9px; background: var(--border); color: var(--muted); }
.csc-quadro-aba.ativa .csc-quadro-cont { background: var(--text); color: var(--surface); }
.csc-quadro-desc { font-family: 'IBM Plex Sans', sans-serif; font-size: 12.5px; color: var(--muted); margin: 8px 0 14px; max-width: 70ch; }
@media (max-width: 640px) {
  .csc-quadro-abas { width: 100%; }
  .csc-quadro-aba { flex: 1; justify-content: center; padding: 8px 8px; font-size: 11.5px; }
  .csc-quadro-desc { font-size: 11.5px; }
}

.csc-tabs { display: flex; gap: 4px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 4px; width: fit-content; }
.csc-tabs button { border: none; background: none; color: var(--muted); font-family: inherit; font-size: 13.5px; font-weight: 600; padding: 8px 18px; border-radius: var(--radius-sm); cursor: pointer; transition: background .15s, color .15s; }
.csc-tabs button.on { background: var(--surface); color: var(--text); box-shadow: var(--shadow-sm); }
.csc-tabs button:not(.on):hover { color: var(--text); }
.csc-ex-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.csc-periodo { display: flex; gap: 4px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 4px; flex-shrink: 0; }
.csc-periodo button { border: none; background: none; color: var(--muted); font-family: inherit; font-size: 12.5px; font-weight: 600; padding: 6px 13px; border-radius: var(--radius-sm); cursor: pointer; transition: background .15s, color .15s; }
.csc-periodo button.on { background: var(--accent); color: #fff; }
.csc-periodo button:not(.on):hover { color: var(--text); }

/* Ranking por área */
.csc-ranking { display: flex; flex-direction: column; gap: 11px; }
.csc-rank { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 15px 18px; display: flex; flex-direction: column; gap: 8px; box-shadow: var(--shadow-sm); }
.csc-rank.topo { border-color: color-mix(in srgb, var(--accent) 40%, var(--border)); box-shadow: 0 4px 20px color-mix(in srgb, var(--accent) 12%, transparent); }
.csc-rank-top { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.csc-rank-nome { font-size: 15px; color: var(--text); }
.csc-rank-nome b { color: var(--accent); font-weight: 700; margin-right: 6px; font-family: var(--fm); }
.csc-rank-val { font-family: var(--fm); font-size: 20px; font-weight: 600; color: var(--text); letter-spacing: -.5px; font-variant-numeric: tabular-nums; }
.csc-rank-bar { height: 9px; background: var(--surface2); border-radius: 6px; overflow: hidden; }
.csc-rank-bar i { display: block; height: 100%; background: var(--accent); border-radius: 6px; opacity: .55; transition: width .6s cubic-bezier(.22,1,.36,1); }
.csc-rank.topo .csc-rank-bar i { opacity: 1; background: linear-gradient(90deg, var(--accent), var(--violet)); box-shadow: 0 0 14px color-mix(in srgb, var(--violet) 45%, transparent); }
.csc-rank-sub { font-size: 11.5px; color: var(--muted); }

/* Extrato (tabela estilo banco) */
.csc-extrato { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm); }
.csc-ex-row { display: grid; grid-template-columns: 130px 160px 1fr 120px; align-items: center; gap: 12px; padding: 11px 18px; border-bottom: 1px solid var(--border); font-size: 13.5px; }
.csc-ex-row:last-child { border-bottom: none; }
.csc-ex-cab { background: var(--surface2); font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--muted); }
.csc-ex-data { color: var(--muted); font-family: var(--fm); font-size: 12px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.csc-ex-area { font-weight: 600; color: var(--text); }
.csc-ex-oque { color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.csc-ex-v { text-align: right; font-family: var(--fm); font-size: 15px; font-weight: 600; color: var(--text); letter-spacing: -.3px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.csc-ex-v.csc-zero { color: var(--green); }
.csc-ex-tot { background: var(--surface2); font-weight: 700; }
.csc-ex-tot span:nth-child(3) { font-size: 12px; letter-spacing: .5px; text-transform: uppercase; color: var(--muted); }
.csc-ex-tot .csc-ex-v { font-size: 18px; color: var(--text); }

/* Linha do tempo */
.csc-feed { position: relative; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 6px 6px 6px 4px; box-shadow: var(--shadow-sm); }
.csc-fi { display: flex; align-items: flex-start; gap: 14px; padding: 13px 16px; border-bottom: 1px solid var(--border); position: relative; }
.csc-fi:last-child { border-bottom: none; }
.csc-fi-dot { width: 11px; height: 11px; border-radius: 50%; background: var(--green); flex-shrink: 0; margin-top: 3px; box-shadow: 0 0 0 4px color-mix(in srgb, var(--green) 15%, transparent); }
.csc-fi.st-erro .csc-fi-dot { background: var(--red); box-shadow: 0 0 0 4px color-mix(in srgb, var(--red) 15%, transparent); }
.csc-fi.st-parcial .csc-fi-dot { background: var(--orange); }
.csc-fi-main { flex: 1; min-width: 0; }
.csc-fi-frase { font-size: 14px; color: var(--text); line-height: 1.4; }
.csc-fi-frase b { font-weight: 600; }
.csc-fi-det { font-size: 12.5px; color: var(--muted); margin-top: 2px; display: flex; gap: 6px; flex-wrap: wrap; }
.csc-fi-quando { font-size: 12px; color: var(--muted); white-space: nowrap; flex-shrink: 0; margin-top: 1px; }
.csc-fi-vazio { padding: 26px; text-align: center; color: var(--muted); font-size: 13.5px; }

/* Mobile: nada estoura a tela */
@media (max-width: 680px) {
  .csc-topbar { padding: 9px 16px; gap: 10px; }   /* topbar mais baixa no celular */
  .csc-title { font-size: 13px; letter-spacing: 1px; }
  .csc-tb-right { gap: 8px; }
  .csc-clock { font-size: 14px; }
  .csc-upd { display: none; }
  .csc-hero { flex-direction: column; align-items: flex-start; }
  .csc-hero-gasto { text-align: left; padding-left: 16px; border-left-width: 3px; }
  .csc-robos { grid-template-columns: 1fr; }
  .csc-tabs, .csc-periodo { width: 100%; }
  .csc-tabs button, .csc-periodo button { flex: 1; text-align: center; }
  /* Extrato empilhado no celular */
  .csc-ex-cab { display: none; }
  .csc-ex-row { display: flex; flex-wrap: wrap; align-items: baseline; gap: 3px 10px; padding: 12px 14px; }
  .csc-ex-data { order: 1; flex-basis: 100%; font-size: 11px; }
  .csc-ex-area { order: 2; }
  .csc-ex-oque { order: 3; flex: 1 1 auto; white-space: normal; min-width: 0; }
  .csc-ex-v { order: 4; }
  .csc-ex-tot { flex-wrap: nowrap; justify-content: space-between; }
  .csc-ex-tot span:nth-child(1), .csc-ex-tot span:nth-child(2) { display: none; }
}
</style>
