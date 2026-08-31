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

          <div v-if="podeEditar" class="au-lote-acoes">
            <button class="au-link" type="button" @click="abrirEdicao(l)">Editar</button>
            <button class="au-link" type="button" @click="pedirExcluir(l.id)">Excluir</button>
          </div>

          <!-- A PERGUNTA DE EXCLUIR MORA NA PRÓPRIA TELA: a caixinha nativa do
               navegador é proibida neste projeto e `uiConfirm` não existe aqui — e
               há um teste que reprova até a palavra escrita. Quem recusa de verdade
               é o banco; a tela só traduz a recusa para português. -->
          <div v-if="excluindo === l.id" class="au-confirma">
            <p class="au-confirma-texto">
              Excluir o lote <strong>{{ l.modelo }}</strong> e as {{ l.quantidade }} etiquetas dele?
            </p>
            <p class="au-aviso-menor">
              Só dá para excluir lote em que nenhuma etiqueta foi gravada. Se alguma já foi,
              a tela vai dizer quantas.
            </p>
            <div class="au-acoes">
              <button class="au-botao secundario" type="button" @click="excluindo = null">Cancelar</button>
              <button class="au-botao" type="button" @click="excluirLote(l.id)">Sim, excluir</button>
            </div>
          </div>

          <div v-if="editando === l.id" class="au-edicao">
            <label class="au-campo"><span class="au-rot">Modelo</span>
              <input v-model="edicao.modelo" type="text" maxlength="80"></label>
            <label class="au-campo"><span class="au-rot">Cor</span>
              <input v-model="edicao.cor" type="text" maxlength="60"></label>
            <label class="au-campo"><span class="au-rot">Referência</span>
              <input v-model="edicao.sku" type="text" maxlength="40"></label>
            <label class="au-campo"><span class="au-rot">Fabricado em</span>
              <input v-model="edicao.fabricado_em" type="date"></label>
            <label class="au-campo"><span class="au-rot">Quantidade</span>
              <input v-model="edicao.quantidade" type="number" min="1" max="500"></label>
            <p class="au-aviso-menor">
              Aumentar cria etiquetas novas. Diminuir tira só as que ainda não foram gravadas.
            </p>
            <div class="au-acoes">
              <button class="au-botao secundario" type="button" @click="editando = null">Cancelar</button>
              <button class="au-botao" type="button" @click="salvarEdicao">Salvar</button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ── GRAVAR ───────────────────────────────────────────────────────── -->
    <template v-else-if="aba === 'gravar'">
      <!-- O PASSO A PASSO. Ele existe porque o dono abriu a tela pronta e disse
           "ficou muito mal explicado": ela dizia "Crie um lote", "Gravei essa" e
           mais nada. Aqui a etapa de agora fica aberta e as outras recolhidas —
           quem já sabe o caminho passa direto, quem não sabe é conduzido. -->
      <ol class="au-passos">
        <li v-for="p in PASSOS" :key="p.n"
            :class="['au-passo-item', { agora: p.n === passo, feito: p.n < passo }]">
          <span class="au-passo-n" aria-hidden="true">{{ p.n }}</span>
          <div class="au-passo-txt">
            <strong>{{ p.titulo }}</strong>
            <span v-if="p.n === passo" class="au-passo-resumo">{{ p.resumo }}</span>
          </div>
        </li>
      </ol>
      <p class="au-rever">
        <button class="au-link" type="button" @click="abrirGuia">Rever o passo a passo completo</button>
      </p>

      <p v-if="!lotes.length" class="au-vazio">
        Ainda não existe lote. Um lote é uma fornada de bolsas do mesmo modelo, e cada
        bolsa dele ganha um código diferente. Abra a aba <strong>Lotes</strong> para criar o primeiro.
      </p>

      <template v-else>
        <label class="au-campo">
          <span class="au-rot">Lote</span>
          <!-- travado durante a gravação: trocar de lote no meio dos 8 segundos
               era o caminho que gravava uma peça e marcava outra -->
          <select v-model="loteEscolhido" :disabled="gravando">
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
            A etiqueta vai costurada no forro interno, longe de fecho, rebite e corrente:
            NFC não funciona encostado em metal.
          </p>

          <!-- MODO NFC: só existe onde o navegador grava (Chrome no Android) -->
          <template v-if="gravaPorNfc">
            <div class="au-endereco">{{ enderecoDaTag(proxima.codigo) }}</div>
            <p v-if="recadoNfc" class="au-recado-nfc">{{ recadoNfc }}</p>
            <div class="au-acoes">
              <button class="au-botao" type="button" :disabled="gravando || !podeEditar"
                      @click="gravarNaEtiqueta">
                {{ gravando ? 'Encoste a etiqueta…' : 'Gravar nesta etiqueta' }}
              </button>
              <!-- travado durante a gravação: o recado (inclusive o "PARE: esta
                   etiqueta já tem OUTRA peça") só existe dentro deste v-if, e
                   trocar de modo no meio o faria sumir -->
              <button class="au-botao secundario" type="button" :disabled="gravando"
                      @click="gravaPorNfc = false">
                Gravar pelo aplicativo
              </button>
            </div>
            <label class="au-trava">
              <input type="checkbox" v-model="travarDepois">
              <span>Travar a etiqueta depois de gravar — <strong>não tem volta</strong></span>
            </label>
          </template>

          <!-- MODO DE HOJE: iPhone, computador, ou quem preferir o aplicativo -->
          <template v-else>
            <p class="au-instrucao">
              Copie o endereço abaixo e grave na etiqueta pelo aplicativo do celular.
              Depois toque em “Gravei essa” — é isso que impede de perder a conta no meio
              de {{ loteAtual?.quantidade }} etiquetas iguais.
            </p>
            <div class="au-endereco">{{ enderecoDaTag(proxima.codigo) }}</div>
            <div class="au-acoes">
              <button class="au-botao secundario" type="button" @click="copiar">{{ textoCopiar }}</button>
              <!-- `marcarGravada()` com os parênteses: sem eles o @click passaria o
                   evento do clique no lugar do código da peça -->
              <button class="au-botao" type="button" v-if="podeEditar" @click="marcarGravada()">✓ Gravei essa</button>
              <button v-if="temSuporte()" class="au-botao secundario" type="button" @click="gravaPorNfc = true">
                Gravar encostando o celular
              </button>
            </div>
          </template>

          <!-- OS DOIS CAMINHOS DA PEÇA DA VEZ, lado a lado.
               DAR BAIXA é o caminho de quem NÃO pode excluir: peça gravada pode
               estar dentro de uma bolsa, e excluir faria a página da cliente
               dizer "não consta".
               EXCLUIR é o caminho certo para a peça que ainda NÃO foi gravada —
               nada dela existe no mundo, e um lote com peça sobrando é para
               diminuir, não para encher de baixa. Sem este botão,
               `vessel_excluir_peca` estava no ar, concedida e provada, sem
               nenhum chamador.
               As duas perguntas moram na própria tela: a caixinha nativa do
               navegador é proibida neste projeto, e há um teste que reprova até
               a palavra escrita. -->
          <div v-if="podeEditar && !gravando && !baixando && !excluindoPeca" class="au-peca-acoes">
            <button class="au-link au-baixar" type="button"
                    @click="baixando = true">Dar baixa nesta peça</button>
            <!-- `proxima` é a primeira SEM gravação, então esta guarda é
                 redundante hoje — e está escrita assim de propósito: o dia em
                 que a fila mudar de regra, o botão de excluir some sozinho em
                 vez de aparecer sobre uma peça que já está dentro de uma bolsa. -->
            <button v-if="!proxima.gravada_em" class="au-link au-baixar" type="button"
                    @click="excluindoPeca = true">Excluir esta peça</button>
          </div>

          <div v-if="excluindoPeca" class="au-confirma">
            <p class="au-confirma-texto">
              Excluir a peça {{ proxima.numero_na_serie }}, de código
              <strong>{{ proxima.codigo }}</strong>?
            </p>
            <p class="au-aviso-menor">
              O código deixa de existir, e a página da cliente passa a dizer que ele não
              consta. Quem recusa é o banco: peça já gravada, ou com garantia registrada
              por uma cliente, não sai — nesses casos o caminho é dar baixa. As peças
              seguintes do lote são renumeradas.
            </p>
            <div class="au-acoes">
              <button class="au-botao secundario" type="button"
                      @click="excluindoPeca = false">Cancelar</button>
              <button class="au-botao" type="button" :disabled="exclusaoEmVoo"
                      @click="excluirPeca(proxima.codigo)">Sim, excluir</button>
            </div>
          </div>

          <div v-if="baixando" class="au-confirma">
            <p class="au-confirma-texto">Dar baixa na peça {{ proxima.numero_na_serie }}?</p>
            <label class="au-campo"><span class="au-rot">Motivo</span>
              <select v-model="motivoDaBaixa">
                <option v-for="m in MOTIVOS_DE_BAIXA" :key="m.chave" :value="m.chave">{{ m.rotulo }}</option>
              </select>
            </label>
            <p class="au-aviso-menor">
              A peça sai da fila de gravação e continua respondendo normalmente para a cliente.
              Dá para desfazer depois.
            </p>
            <div class="au-acoes">
              <button class="au-botao secundario" type="button" @click="baixando = false">Cancelar</button>
              <button class="au-botao" type="button" :disabled="baixaEmVoo"
                      @click="baixarPeca(proxima.codigo)">Dar baixa</button>
            </div>
          </div>

          <!-- GRAVADOR DE MESA -->
          <details class="au-mesa">
            <!-- A seta é desenhada aqui porque `display:flex` no <summary> apaga o
                 triângulo que o Chrome desenha sozinho — e o triângulo era a única
                 pista de que esta gaveta abre. Em SVG, nunca emoji. -->
            <summary>
              <svg class="au-seta" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"
                   fill="none" stroke="currentColor" stroke-width="2.4"
                   stroke-linecap="round" stroke-linejoin="round"><polyline points="9 5 16 12 9 19" /></svg>
              <span>Gravador de mesa</span>
            </summary>
            <button class="au-botao secundario" type="button" @click="baixarListaDoGravador">
              Baixar a lista das que faltam
            </button>
            <textarea v-model="textoDoGravador" class="au-colar"
                      placeholder="Cole aqui o que o gravador devolveu"></textarea>
            <button v-if="podeEditar && !confirmacaoDoGravador" class="au-botao" type="button"
                    @click="pedirParaMarcarPeloGravador">
              Marcar as gravadas
            </button>
            <div v-if="podeEditar && confirmacaoDoGravador" class="au-confirma">
              <p class="au-confirma-texto">
                Marcar {{ confirmacaoDoGravador.reconhecidos.length }} peça(s) como gravadas?
                Isso não confere etiqueta nenhuma — só use depois de gravar de verdade
                no gravador de mesa.
              </p>
              <div class="au-acoes">
                <button class="au-botao secundario" type="button"
                        @click="confirmacaoDoGravador = null">Cancelar</button>
                <button class="au-botao" type="button" @click="marcarPeloGravador">
                  Sim, marcar
                </button>
              </div>
            </div>
          </details>
        </div>

        <!-- A LISTA DAS BAIXADAS FICA FORA DO BLOCO DE GRAVAÇÃO de propósito:
             quando a última peça da fila é gravada aquele bloco inteiro some, e
             junto com ele sumiria o único caminho para desfazer uma baixa feita
             por engano. -->
        <div v-if="baixadasDoLote.length" class="au-baixadas-lote">
          <details class="au-mesa">
            <!-- a seta é desenhada aqui pelo mesmo motivo da gaveta do gravador
                 de mesa: `display:flex` no <summary> apaga o triângulo que o
                 navegador desenha sozinho. Em SVG, nunca emoji. -->
            <summary>
              <svg class="au-seta" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"
                   fill="none" stroke="currentColor" stroke-width="2.4"
                   stroke-linecap="round" stroke-linejoin="round"><polyline points="9 5 16 12 9 19" /></svg>
              <span>{{ baixadasDoLote.length }} peça(s) baixada(s) neste lote</span>
            </summary>
            <ul class="au-baixadas">
              <li v-for="pc in baixadasDoLote" :key="pc.codigo">
                <span>Peça {{ pc.numero_na_serie }} — {{ rotuloDoMotivo(pc.baixa_motivo) }}</span>
                <button v-if="podeEditar" class="au-link" type="button" :disabled="baixaEmVoo"
                        @click="desfazerBaixa(pc.codigo)">Desfazer</button>
              </li>
            </ul>
          </details>
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

        <!-- O ALERTA MAIS IMPORTANTE DESTA TELA. A página da cliente não avisa
             nada sobre baixa (decisão do dono) — então quem avisa é o painel,
             usando as leituras que a página já registra. Assim o dono fica
             sabendo que a bolsa extraviada apareceu, sem incomodar quem está
             com ela. -->
        <template v-if="resumo.baixadasLidas">
          <h2 class="au-secao">Peças baixadas que foram lidas</h2>
          <p class="au-instrucao">
            Estas peças estão baixadas e alguém encostou o celular nelas depois disso.
            Vale conferir onde a bolsa apareceu.
          </p>
          <div class="au-lista">
            <div v-for="b in (alertas?.baixadas_lidas || [])" :key="b.codigo" class="au-card alerta">
              <div class="au-card-topo">
                <span class="au-modelo">{{ b.codigo }}</span>
                <span class="au-progresso">{{ b.leituras }} leitura(s)</span>
              </div>
              <div class="au-card-linha">
                <span>{{ rotuloDoMotivo(b.motivo) }}</span>
                <span>última em {{ dataCurta(b.ultima) }}</span>
              </div>
            </div>
          </div>
        </template>
      </template>
    </template>

    <!-- O GUIA FICA FORA DA CORRENTE DAS ABAS. Ele estava ENTRE a aba Gravar e
         a aba Registros, e um `v-if` no meio de um `v-if`/`v-else-if` PARTE a
         corrente em duas: a segunda metade recomeçava do zero e o `v-else` dela
         — a aba Alertas inteira — vinha desenhado embaixo das abas Lotes e
         Gravar, e também embaixo do "Carregando…". Medido no navegador, a
         375px, em 30/08.
         Ele é sobreposição de tela cheia: onde mora no HTML não muda o desenho,
         muda só a corrente. -->
    <!-- ── O GUIA DA PRIMEIRA VEZ ──────────────────────────────────────────
         Abre sozinho na primeira visita e some depois. O "pular" fica sempre
         visível: guia que prende a pessoa vira estorvo, não ajuda. -->
    <div v-if="guiaAberto" class="au-guia-fundo" role="dialog" aria-modal="true"
         aria-label="Como gravar as etiquetas">
      <div class="au-guia">
        <p class="au-guia-conta">{{ telaDoGuia + 1 }} de {{ TELAS_DO_GUIA.length }}</p>
        <h3 class="au-guia-titulo">{{ TELAS_DO_GUIA[telaDoGuia].titulo }}</h3>
        <p class="au-guia-texto">{{ TELAS_DO_GUIA[telaDoGuia].texto }}</p>
        <div class="au-guia-acoes">
          <button class="au-botao secundario" type="button" @click="fecharGuia">Pular</button>
          <button class="au-botao" type="button" @click="avancarGuia">
            {{ telaDoGuia + 1 === TELAS_DO_GUIA.length ? 'Entendi, começar' : 'Continuar' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ── FORMULÁRIO DE LOTE ───────────────────────────────────────────── -->
    <div v-if="formulario" class="au-fundo" @click.self="formulario = false">
      <form class="au-folha" @submit.prevent="gerarLote">
        <h2>Gerar lote de etiquetas</h2>
        <p class="au-instrucao">
          Um código diferente para cada peça. Depois de criar, a aba “Gravar” conduz
          etiqueta por etiqueta.
        </p>

        <!-- ── ESCOLHER O PRODUTO NO BLING ───────────────────────────────
             Os três campos abaixo eram digitados à mão, e o que se digita aqui
             é o que a CLIENTE lê na página do selo — um erro de digitação vira
             uma bolsa original mostrando o nome errado, e ninguém descobre até
             alguém encostar o celular.
             Os campos continuam editáveis depois de escolher: o Bling preenche,
             a pessoa confere. -->
        <div class="au-escolha-produto">
          <label class="au-campo"><span class="au-rot">Produto no Bling</span>
            <!-- Enter num campo de busca é o gesto mais natural que existe, e este
                 campo mora dentro do `<form @submit.prevent="gerarLote">`: sem esta
                 linha, apertar Enter GRAVAVA o lote inteiro no banco, com a
                 quantidade padrão, sem ninguém ter pedido. -->
            <input v-model="buscaProduto" type="search" :disabled="carregandoProdutos"
                   @keydown.enter.prevent
                   :placeholder="carregandoProdutos ? 'Carregando os produtos…' : 'Busque por nome ou referência'"></label>

          <p v-if="erroProdutos" class="au-aviso-menor">
            {{ erroProdutos.titulo }}
            <template v-if="erroProdutos.detalhe">{{ erroProdutos.detalhe }}</template>
            Você ainda pode escrever à mão nos campos abaixo.
          </p>

          <ul v-else-if="produtosAchados.length" class="au-produtos">
            <li v-for="p in produtosAchados" :key="p.codigo">
              <button class="au-produto" type="button" @click="usarProduto(p)">
                <strong>{{ p.nome }}</strong>
                <span class="au-aviso-menor">{{ p.codigo }}</span>
              </button>
            </li>
          </ul>
          <p v-else-if="!carregandoProdutos && buscaProduto" class="au-aviso-menor">
            Nenhum produto da linha nova com esse nome ou referência.
          </p>
          <p v-else-if="!carregandoProdutos" class="au-aviso-menor">
            {{ produtos.length }} produto(s) da linha nova. Busque, ou escreva à mão abaixo.
          </p>
        </div>

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
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import BarraDeTopo from '../../compartilhado/barra-de-topo.vue'
import { sbClient } from '../../compartilhado/conectar-no-banco-de-dados.js'
import { hasPermission } from '../../compartilhado/controle-de-login-e-usuario.js'
import { adminToast } from '../../compartilhado/avisos.js'
import {
  enderecoDaTag, progressoDoLote, proximaPorGravar, linhasDoCsv, resumoDeAlertas,
  MOTIVOS_DE_BAIXA, fraseDaRecusa,
} from './lotes.js'
import { conferirLeitura, listaParaGravadorDeMesa, codigosNoTextoDoGravador } from './nfc-fila.js'
import { PASSOS, TELAS_DO_GUIA, passoAtual, guiaJaVisto, marcarGuiaVisto, proximaTelaDoGuia } from './tutorial.js'
import { produtosParaEscolher, procurarProduto } from './produtos-do-bling.js'
import { paginasDoBling, avisoDoErro } from '../../compartilhado/chamada-do-bling.js'
import { temSuporte, traduzirFalha, criarGravador } from './gravador-nfc.js'

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

// Chrome no Android grava NFC pelo navegador; iPhone e computador não. Quem
// não grava cai no modo de hoje, que continua inteiro logo abaixo.
const gravaPorNfc = ref(temSuporte())
const travarDepois = ref(false)            // ⚠️ PERMANENTE — nasce desligado

// ── O TUTORIAL ────────────────────────────────────────────────────────────
// O passo a passo fica sempre na tela; o guia abre uma vez só. O "já vi" mora
// no aparelho e não no banco: é conveniência de quem está usando, não dado da
// empresa. Quem trocar de celular vê de novo, e tudo bem.
const passo = computed(() => passoAtual({
  temLote: Boolean(loteEscolhido.value),
  pecas: pecasDoLote(loteEscolhido.value),
}))
const guiaAberto = ref(false)
const telaDoGuia = ref(0)

function abrirGuia() { telaDoGuia.value = 0; guiaAberto.value = true }
function fecharGuia() { guiaAberto.value = false; marcarGuiaVisto() }
function avancarGuia() {
  const proxima = proximaTelaDoGuia(telaDoGuia.value)
  if (proxima === null) fecharGuia()
  else telaDoGuia.value = proxima
}
const gravando = ref(false)
const recadoNfc = ref('')
const textoDoGravador = ref('')
const confirmacaoDoGravador = ref(null)  // { reconhecidos, ignorados } enquanto a pergunta está na tela

const novo = reactive({ modelo: '', cor: '', sku: '', quantidade: 20, fabricado_em: '' })

// EDITAR E EXCLUIR ABREM DENTRO DO MESMO CARTÃO, e só um de cada vez: dois
// blocos empilhados no mesmo lote fazem a tela perguntar duas coisas ao mesmo
// tempo, e aí nenhuma das duas é a pergunta principal.
const editando = ref(null)    // o lote com o formulário de editar aberto, ou null
const excluindo = ref(null)   // o lote com a pergunta de excluir na tela, ou null
const edicao = reactive({ modelo: '', cor: '', sku: '', fabricado_em: '', quantidade: 1 })

// A PERGUNTA DE DAR BAIXA, na aba Gravar. Ela é da peça da vez, então basta um
// sim/não: só existe uma peça da vez. O motivo nasce em "Extraviada" porque é o
// que o dono mais vai usar, e a lista inteira fica à vista para trocar.
const baixando = ref(false)
const motivoDaBaixa = ref('extraviada')
// A TRAVA DE "EM VOO". Dois toques rápidos disparam duas chamadas. O índice
// único do banco segura a segunda, então o dado nunca corrompe — mas a pessoa
// lê "Esta peça já está baixada" logo depois de baixá-la, e a tela parece estar
// contradizendo o que ela acabou de fazer.
const baixaEmVoo = ref(false)

// EXCLUIR A PEÇA DA VEZ. Mesma forma da pergunta de baixa, e as duas nunca
// aparecem juntas: duas perguntas na tela ao mesmo tempo é o mesmo que nenhuma
// ser a principal. A trava de "em voo" existe pelo mesmo motivo da baixa —
// dois toques rápidos disparam duas chamadas, e a segunda volta com
// "não encontrei esse registro" logo depois de a peça ter saído.
const excluindoPeca = ref(false)
const exclusaoEmVoo = ref(false)

const podeCriar = computed(() => hasPermission('autenticidade', 'criar'))
const podeEditar = computed(() => hasPermission('autenticidade', 'editar'))

const pecasDoLote = (id) => pecas.value.filter((p) => p.lote_id === id)
const loteAtual = computed(() => lotes.value.find((l) => l.id === loteEscolhido.value) || null)
const proxima = computed(() => proximaPorGravar(pecasDoLote(loteEscolhido.value)))
const resumo = computed(() => resumoDeAlertas(alertas.value))

// As baixadas saem da fila de gravação, então precisam de um lugar PRÓPRIO para
// aparecer: sem esta lista, dar baixa por engano não teria como ser desfeito.
const baixadasDoLote = computed(() => pecasDoLote(loteEscolhido.value)
  .filter((p) => p.baixada)
  .sort((a, b) => (a.numero_na_serie || 0) - (b.numero_na_serie || 0)))

function rotuloDoMotivo(chave) {
  return (MOTIVOS_DE_BAIXA.find((m) => m.chave === chave) || {}).rotulo || chave || '—'
}

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

// TROCAR DE LOTE APAGA OS RECADOS DO LOTE ANTERIOR.
// Os dois falam de uma peça específica: o `recadoNfc` (inclusive o "PARE: esta
// etiqueta já tem OUTRA peça gravada") e a pergunta do gravador de mesa, que já
// carrega a lista de códigos contada. Deixados na tela sob um lote novo, viram
// aviso do lote errado — e aviso do lote errado é pior que aviso nenhum.
// O seletor fica travado enquanto `gravando`, então isto nunca apaga o recado
// de uma gravação em curso.
watch(loteEscolhido, () => {
  recadoNfc.value = ''
  confirmacaoDoGravador.value = null
  baixando.value = false
  excluindoPeca.value = false
})

// TROCAR A PEÇA DA VEZ FECHA A PERGUNTA DE BAIXA, pelo mesmo cuidado do watch
// acima: a pergunta diz o número de UMA peça, e peça errada na pergunta é pior
// que pergunta nenhuma.
// Dois caminhos concretos: com a pergunta aberta, "Gravei essa" continua
// clicável — gravando a última, `proxima` vira nulo, o bloco todo some e
// `baixando` fica preso em `true`; depois um "Desfazer" devolve uma peça à fila
// e o bloco voltava COM A PERGUNTA JÁ ABERTA, para a peça que a pessoa acabou de
// restaurar. O outro é a pergunta trocar de peça calada por baixo da mão.
// O watch é pelo CÓDIGO, não pelo objeto: `carregar()` refaz `pecas.value`
// inteiro, e pelo objeto isto dispararia a cada recarga sem a peça ter mudado.
watch(() => proxima.value?.codigo, () => {
  baixando.value = false
  excluindoPeca.value = false
})

function voltar() { router.push({ name: 'gestao-interna' }) }

function irGravar(id) {
  loteEscolhido.value = id
  aba.value = 'gravar'
}

// ── OS PRODUTOS DO BLING ──────────────────────────────────────────────────
// Carregam UMA vez, quando o formulário abre pela primeira vez. Não no boot da
// tela: quem só vem gravar etiqueta não precisa esperar o Bling.
const produtos = ref([])
const buscaProduto = ref('')
const carregandoProdutos = ref(false)
const erroProdutos = ref(null)

const produtosAchados = computed(() =>
  buscaProduto.value.trim() ? procurarProduto(produtos.value, buscaProduto.value).slice(0, 12) : [])

async function carregarProdutos() {
  if (produtos.value.length || carregandoProdutos.value) return
  carregandoProdutos.value = true
  erroProdutos.value = null
  try {
    // `paginasDoBling` sobe a falha em vez de devolver lista vazia. Isso importa
    // aqui: "o Bling caiu" e "não há produto novo" ficariam iguais na tela, e a
    // pessoa criaria o lote à mão achando que a linha nova está vazia.
    // `criterio: 2` é "Ativos" na listagem de produtos da API v3 do Bling
    // (1 últimos incluídos · 2 ativos · 3 inativos · 4 excluídos · 5 todos).
    // Produto inativo é produto que saiu de linha: etiqueta de autenticidade
    // não se costura em bolsa que não se fabrica mais.
    const itens = await paginasDoBling(sbClient, 'produtos', { criterio: 2 })
    produtos.value = produtosParaEscolher(itens)
    if (!produtos.value.length) {
      erroProdutos.value = { titulo: 'Não encontrei nenhum produto da linha nova no Bling.', detalhe: '' }
    }
  } catch (e) {
    // A FÁBRICA NÃO PODE FICAR REFÉM DO BLING: a busca some, os campos à mão
    // ficam. Mesma regra do modo de queda da gravação.
    //
    // Quem traduz o erro em duas frases é o `avisoDoErro`, e não este `catch`:
    // aqui já se passou `e.message` (que é o texto TÉCNICO, nunca a causa) e já
    // se jogou o objeto do aviso inteiro na tela, onde a pessoa lia
    // `[object Object]`. Ver `src/compartilhado/chamada-do-bling.js`.
    //
    // O `ehAdmin` SEGUE QUEM ABRE O FORMULÁRIO, que é `podeCriar`. Com
    // `podeEditar` aqui, quem tem `criar` sem `editar` caía no ramo não-admin do
    // `textoDoAviso` e lia "Não foi possível buscar as vendas agora." — numa
    // tela de etiqueta, que não tem venda nenhuma.
    erroProdutos.value = avisoDoErro(e, { ehAdmin: podeCriar.value })
  } finally {
    carregandoProdutos.value = false
  }
}

// O Bling PREENCHE, a pessoa CONFERE. Os campos continuam editáveis de
// propósito: a cor sai vazia quando o código e o nome do produto não
// concordam, e é melhor a pessoa completar do que a tela chutar.
function usarProduto(p) {
  novo.modelo = p.modelo || p.nome
  novo.cor = p.cor
  novo.sku = p.codigo
  buscaProduto.value = ''
}

function abrirFormulario() {
  erroForm.value = ''
  formulario.value = true
  carregarProdutos()
}

async function carregar() {
  carregando.value = true
  falha.value = ''
  try {
    const [l, p, r, a, baixas] = await Promise.all([
      sbClient.from('vessel_lotes').select('*').order('criado_em', { ascending: false }),
      sbClient.from('vessel_pecas').select('codigo,lote_id,numero_na_serie,gravada_em'),
      sbClient.from('vessel_registros').select('*').order('registrado_em', { ascending: false }),
      sbClient.rpc('vessel_alertas'),
      // baixa ATIVA é a linha com `desfeita_em` nula. `vessel_baixas` tem a
      // mesma política de SELECT de `vessel_pecas`, então se lê do mesmo jeito.
      sbClient.from('vessel_baixas').select('codigo,motivo,baixada_em').is('desfeita_em', null),
    ])
    // NENHUMA DESTAS LEITURAS PODE FALHAR EM SILÊNCIO, e cada uma mente de um
    // jeito diferente quando falha (PADRAO-DA-CENTRAL item 9: a tela nunca
    // mente). Falhar à vista é sempre melhor:
    //
    //  · `baixas`  — sem a lista, nenhuma peça sai marcada e a peça baixada
    //                volta para a fila como se nada tivesse acontecido: alguém
    //                gravaria a etiqueta de uma peça dada como refugo;
    //  · `p`       — sem as peças, o lote aparece com a fila VAZIA, e a tela
    //                diz "todas as etiquetas já foram gravadas" sem nenhuma ter
    //                sido;
    //  · `a`       — sem os alertas, `resumoDeAlertas(null).limpo` dá `true` e a
    //                aba anuncia "Nada suspeito nos últimos 30 dias. Foram 0
    //                leituras" com uma bolsa extraviada sendo lida. Falha
    //                virando "está tudo bem" é o defeito mais caro deste
    //                projeto;
    //  · `r`       — sem os registros, a tela diz "Nenhuma cliente registrou a
    //                garantia ainda" para uma lista que existe.
    //
    // E `error` NÃO É A ÚNICA FORMA DE FALHAR. As funções do banco deste painel
    // respondem 200 com `{ ok:false, motivo:'sem_permissao' }` quando o portão
    // recusa — não é erro de rede, é a função dizendo não. `resumoDeAlertas`
    // desse objeto não acha NENHUMA das três chaves e devolve `limpo: true`: a
    // aba anunciava "Nada suspeito nos últimos 30 dias" para quem simplesmente
    // não podia ver os alertas. O caminho é real e tem nome: quem tem a chave
    // `autenticidade` no front e NÃO no `features[]` do banco — são dois
    // lugares, e o LEIA-ME desta pasta avisa disso.
    for (const leitura of [l, p, r, a, baixas]) {
      if (leitura.error) throw leitura.error
      if (leitura.data && leitura.data.ok === false) throw Object.assign(
        new Error(leitura.data.motivo), { recusa: leitura.data.motivo })
    }
    lotes.value = l.data || []
    pecas.value = p.data || []
    registros.value = r.data || []
    alertas.value = a.data || null
    // A PEÇA CARREGA A BAIXA JUNTO: é o campo `baixada` — este nome exato, e
    // booleano — que `naFila` usa em lotes.js para tirar a peça da fila de
    // gravação. Trocar o nome aqui não quebra teste nenhum: a fila simplesmente
    // pararia de filtrar, em silêncio.
    const porCodigo = new Map((baixas.data || []).map((b) => [b.codigo, b]))
    pecas.value.forEach((p2) => {
      const b = porCodigo.get(p2.codigo)
      p2.baixada = Boolean(b)
      p2.baixa_motivo = b?.motivo || null
      p2.baixada_em = b?.baixada_em || null
    })
    if (!loteEscolhido.value && lotes.value.length) loteEscolhido.value = lotes.value[0].id
  } catch (e) {
    // `e.recusa` só existe quando quem disse não foi a rede, e sim o BANCO.
    // Mandar "confira sua conexão" para quem está sem a chave `autenticidade`
    // é apontar o defeito errado, e a pessoa mexe na internet a manhã inteira.
    falha.value = e?.recusa
      ? fraseDaRecusa(e.recusa)
      : 'Não consegui carregar. Confira sua conexão e tente de novo.'
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

function abrirEdicao(l) {
  excluindo.value = null
  editando.value = l.id
  edicao.modelo = l.modelo || ''
  edicao.cor = l.cor || ''
  edicao.sku = l.sku || ''
  edicao.fabricado_em = l.fabricado_em || ''
  edicao.quantidade = l.quantidade || 1
}

function pedirExcluir(id) {
  editando.value = null
  excluindo.value = id
}

// `sbClient.rpc` NÃO ESTOURA: devolve `{ data, error }`. `error` é falha de rede
// ou de permissão; `data.ok === false` é a regra de negócio do banco recusando.
// Os dois precisam aparecer, e com frases diferentes — tratar só o `error` foi
// defeito real deste mesmo arquivo, e a tela anunciava sucesso quando nada
// tinha acontecido (PADRAO-DA-CENTRAL, item 9: a tela nunca mente).
async function salvarEdicao() {
  const { data, error } = await sbClient.rpc('vessel_editar_lote', {
    p_lote: editando.value,
    p_modelo: edicao.modelo,
    p_cor: edicao.cor,
    p_sku: edicao.sku,
    p_fabricado_em: edicao.fabricado_em || null,
    p_quantidade: Number(edicao.quantidade),
  })
  if (error) { adminToast('Não consegui salvar agora', false); return }
  if (!data?.ok) { adminToast(fraseDaRecusa(data?.motivo, data), false); return }
  editando.value = null
  await carregar()
  adminToast('Lote atualizado')
}

// QUEM RECUSA É O BANCO, NÃO A TELA. Lote com etiqueta já gravada não se exclui:
// a página da cliente passaria a dizer "não consta" e uma bolsa original
// pareceria falsa. A tela só traduz a recusa, com o número que o banco devolveu.
async function excluirLote(id) {
  const { data, error } = await sbClient.rpc('vessel_excluir_lote', { p_lote: id })
  if (error) { adminToast('Não consegui excluir agora', false); return }
  if (!data?.ok) { excluindo.value = null; adminToast(fraseDaRecusa(data?.motivo, data), false); return }
  excluindo.value = null
  await carregar()
  adminToast(`Lote excluído, com ${data.excluidas} etiqueta(s).`)
}

// DAR BAIXA É O CAMINHO DE QUEM NÃO PODE EXCLUIR. Peça gravada pode estar
// dentro de uma bolsa: excluir faria a página da cliente dizer "não consta" e
// uma bolsa original pareceria falsa. A baixa tira a peça da fila, guarda o
// motivo, e a página da cliente continua respondendo igual.
//
// `sbClient.rpc` NÃO ESTOURA: devolve `{ data, error }`. `error` é rede ou
// permissão; `data.ok === false` é a regra do banco recusando. Os dois aparecem,
// com frases diferentes.
async function baixarPeca(codigo) {
  if (baixaEmVoo.value) return
  baixaEmVoo.value = true
  try {
    const { data, error } = await sbClient.rpc('vessel_baixar_peca',
      { p_codigo: codigo, p_motivo: motivoDaBaixa.value })
    if (error) { adminToast('Não consegui dar baixa agora', false); return }
    if (!data?.ok) { adminToast(fraseDaRecusa(data?.motivo, data), false); return }
    baixando.value = false
    await carregar()
    const rotulo = rotuloDoMotivo(motivoDaBaixa.value)
    adminToast(`Peça baixada como ${rotulo}. Ela sai da fila e continua respondendo para a cliente.`)
  } finally {
    baixaEmVoo.value = false
  }
}

// EXCLUIR UMA PEÇA. Vale para a que ainda NÃO foi gravada: nada dela existe no
// mundo. Quem recusa continua sendo o banco — peça gravada volta 'esta_gravada'
// e peça com garantia registrada volta 'tem_garantia' —, e a tela só traduz.
// Esta é a razão de a frase `esta_gravada` existir: até aqui ela era
// inalcançável, porque `vessel_excluir_peca` não tinha nenhum chamador.
async function excluirPeca(codigo) {
  if (exclusaoEmVoo.value) return
  exclusaoEmVoo.value = true
  try {
    const { data, error } = await sbClient.rpc('vessel_excluir_peca', { p_codigo: codigo })
    if (error) { adminToast('Não consegui excluir agora', false); return }
    // a pergunta fecha ANTES do recado da recusa: deixá-la aberta convida a
    // apertar de novo, e a resposta seria a mesma
    excluindoPeca.value = false
    if (!data?.ok) { adminToast(fraseDaRecusa(data?.motivo, data), false); return }
    await carregar()
    adminToast('Peça excluída. As seguintes do lote foram renumeradas.')
  } finally {
    exclusaoEmVoo.value = false
  }
}

async function desfazerBaixa(codigo) {
  if (baixaEmVoo.value) return
  baixaEmVoo.value = true
  try {
    const { data, error } = await sbClient.rpc('vessel_desfazer_baixa', { p_codigo: codigo })
    if (error) { adminToast('Não consegui desfazer agora', false); return }
    if (!data?.ok) { adminToast(fraseDaRecusa(data?.motivo, data), false); return }
    await carregar()
    adminToast('Baixa desfeita. A peça voltou para a fila.')
  } finally {
    baixaEmVoo.value = false
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

// O CÓDIGO ENTRA POR ARGUMENTO, e isto não é preferência de estilo.
// `gravarNaEtiqueta` escolhe a peça no começo e leva até 8 segundos com o
// "Encoste a etiqueta…" na tela. Relendo `proxima.value` aqui no fim, quem
// trocasse de lote no meio gravava a etiqueta do lote A e marcava como pronta a
// peça do lote B — e a bolsa B saía da fábrica marcada como pronta com a
// etiqueta em branco costurada dentro. A leitura de volta não protegia nada
// nesse caminho: conferia A e marcava B.
//
// Devolve `true` só quando o banco confirmou. Quem chama decide o que dizer —
// recado de "pronta" sem marcação é a mesma mentira que a tela não conta.
async function marcarGravada(codigo = proxima.value?.codigo) {
  if (!codigo) return false
  try {
    const { data, error } = await sbClient.rpc('vessel_marcar_gravada', { p_codigo: codigo })
    if (error) throw error
    if (!data?.ok) { adminToast('Sem permissão para marcar', false); return false }
    // atualiza só a peça, sem recarregar tudo: a equipe está gravando em
    // sequência e uma recarga inteira a cada etiqueta trava o ritmo
    const alvo = pecas.value.find((p) => p.codigo === codigo)
    if (alvo) alvo.gravada_em = new Date().toISOString()
    textoCopiar.value = 'Copiar endereço'
    return true
  } catch (e) {
    adminToast('Não consegui marcar agora', false)
    return false
  }
}

// A REGRA INTEIRA ESTÁ AQUI: lê antes, grava, lê depois, e só então marca.
// Marcar porque o `write` não deu erro é marcar no escuro — e no escuro a peça
// entra como pronta com a etiqueta em branco costurada dentro da bolsa.
async function gravarNaEtiqueta() {
  const peca = proxima.value
  if (!peca || gravando.value) return
  const gravador = criarGravador()
  if (!gravador) { gravaPorNfc.value = false; return }

  gravando.value = true
  recadoNfc.value = 'Encoste a etiqueta no celular e segure parado…'
  try {
    // 1. LER ANTES: etiqueta com outra peça não pode ser sobrescrita
    const antes = await gravador.lerUmaVez()
    const situacao = conferirLeitura(antes, peca.codigo)
    if (situacao === 'outra-peca') {
      recadoNfc.value = 'PARE: esta etiqueta já tem OUTRA peça gravada. '
        + 'Separe ela e pegue uma etiqueta em branco.'
      return
    }
    if (situacao === 'confere') {
      // já estava gravada com esta peça: marca sem regravar
      recadoNfc.value = await marcarGravada(peca.codigo)
        ? 'Esta etiqueta já estava certa. Marquei e passei para a próxima.'
        : 'Esta etiqueta já estava certa, mas não consegui marcar a peça. Encoste de novo.'
      return
    }

    // 2. GRAVAR
    recadoNfc.value = 'Gravando… não tire o celular.'
    await gravador.gravar(enderecoDaTag(peca.codigo))

    // 3. LER DEPOIS: a prova de que gravou é a etiqueta devolver
    const depois = await gravador.lerUmaVez()
    if (conferirLeitura(depois, peca.codigo) !== 'confere') {
      recadoNfc.value = 'Gravei, mas a etiqueta não devolveu o endereço certo. '
        + 'Não marquei a peça. Encoste de novo.'
      return
    }

    if (travarDepois.value) await gravador.travar()
    recadoNfc.value = await marcarGravada(peca.codigo)
      ? `Peça ${peca.numero_na_serie} pronta. Pegue a próxima etiqueta.`
      : `Gravei a etiqueta da peça ${peca.numero_na_serie}, mas não consegui marcá-la `
        + 'como pronta. NÃO pegue outra etiqueta: encoste esta de novo.'
  } catch (erro) {
    recadoNfc.value = traduzirFalha(erro)
  } finally {
    gravando.value = false
  }
}

// ── O GRAVADOR DE MESA: a mesma fila, de ida e de volta ────────────────────

function baixarListaDoGravador() {
  const lista = listaParaGravadorDeMesa(pecasDoLote(loteEscolhido.value))
  if (!lista) { adminToast('Não falta nenhuma etiqueta neste lote', false); return }
  const url = URL.createObjectURL(new Blob([lista], { type: 'text/plain;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `etiquetas-${loteAtual.value?.modelo || 'lote'}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

// ESTE É O ÚNICO CAMINHO QUE MARCA PEÇA SEM CONFERIR ETIQUETA NENHUMA.
// `codigosNoTextoDoGravador` aceita qualquer texto que contenha os códigos —
// colar de volta o próprio arquivo que acabou de ser baixado marcaria o lote
// inteiro num clique, sem nenhuma etiqueta ter sido tocada. Por isso passa por
// uma pergunta que diz o número e diz o que NÃO foi conferido.
function pedirParaMarcarPeloGravador() {
  const { reconhecidos, ignorados } = codigosNoTextoDoGravador(
    textoDoGravador.value, pecasDoLote(loteEscolhido.value))
  if (!reconhecidos.length) {
    adminToast('Não achei nenhum código deste lote no texto colado', false)
    return
  }
  // guarda o que foi contado: é exatamente isso que a pergunta promete marcar,
  // mesmo que alguém mexa na caixa de colar antes de responder
  confirmacaoDoGravador.value = { reconhecidos, ignorados }
}

async function marcarPeloGravador() {
  const pedido = confirmacaoDoGravador.value
  if (!pedido) return
  const { reconhecidos, ignorados } = pedido
  confirmacaoDoGravador.value = null
  // `sbClient.rpc` NÃO estoura: devolve `{ data, error }`. Sem contar o que deu
  // certo, um bloco inteiro barrado pela permissão sairia com o aviso de
  // "marcadas" — e a tela nunca mente (PADRAO-DA-CENTRAL, item 9).
  let feitas = 0
  for (const codigo of reconhecidos) {
    const { data, error } = await sbClient.rpc('vessel_marcar_gravada', { p_codigo: codigo })
    if (!error && data?.ok) feitas += 1
  }
  // Aqui recarregar É certo: veio um bloco inteiro de uma vez. No caminho de
  // uma etiqueta por vez, `marcarGravada` atualiza SÓ a peça de propósito —
  // recarga inteira a cada etiqueta trava o ritmo de quem está gravando em
  // sequência.
  await carregar()
  textoDoGravador.value = ''
  if (feitas < reconhecidos.length) {
    adminToast(`Marquei ${feitas} de ${reconhecidos.length}. As outras não deram certo `
      + '— confira sua permissão e tente de novo.', false)
    return
  }
  adminToast(ignorados.length
    ? `${reconhecidos.length} marcadas. ${ignorados.length} código(s) de OUTRO lote foram ignorados — confira se o arquivo é deste lote.`
    : `${reconhecidos.length} etiqueta(s) marcadas como gravadas.`)
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

onMounted(() => {
  carregar()
  // só na primeira visita de quem grava — e nunca se o depósito estiver
  // bloqueado, porque aí `guiaJaVisto` devolve falso para sempre e o guia
  // voltaria a cada abertura, virando estorvo.
  if (podeEditar.value && !guiaJaVisto()) guiaAberto.value = true
})
</script>

<style scoped>
.tela-autenticidade{min-height:100vh;background:transparent;position:relative;z-index:1;padding-bottom:48px;}
.abas{display:flex;gap:8px;padding:16px 24px 0;flex-wrap:wrap;}
.abas button{font-family:var(--fonte-principal);font-size:max(9px, calc(10px * var(--escala-texto, 1)));font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);background:none;border:1px solid var(--border);border-radius:5px;padding:7px 13px;cursor:pointer;transition:all .15s;}
.abas button.on{color:var(--accent);border-color:var(--accent);}

.au-vazio,.au-erro,.au-pronto{font-family:var(--fonte-principal);font-size:max(9px, calc(13px * var(--escala-texto, 1)));color:var(--muted);padding:28px 24px;line-height:1.7;max-width:620px;}
.au-erro{color:var(--red);}
.au-pronto{color:var(--accent);}
.au-instrucao{font-family:var(--fonte-principal);font-size:max(9px, calc(12.5px * var(--escala-texto, 1)));color:var(--muted);line-height:1.7;padding:16px 24px 0;max-width:620px;}
.au-secao{font-family:var(--fonte-principal);font-size:max(9px, calc(11px * var(--escala-texto, 1)));font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--text);padding:24px 24px 4px;}

.au-topo-acao{display:flex;gap:10px;align-items:center;padding:18px 24px 0;flex-wrap:wrap;}
.au-busca{flex:1;min-width:180px;font-family:var(--fonte-principal);font-size:max(9px, calc(13px * var(--escala-texto, 1)));padding:9px 12px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);}

.au-botao{font-family:var(--fonte-principal);font-size:max(9px, calc(11px * var(--escala-texto, 1)));font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--sobre-cor);background:var(--accent);border:1px solid var(--accent);border-radius:6px;padding:10px 16px;cursor:pointer;}
.au-botao[disabled]{opacity:.6;cursor:default;}
/* O LINK DESABILITADO PRECISA PARECER DESABILITADO. `.au-link[disabled]` não
   existia: o "Desfazer" das baixadas fica `:disabled` durante a chamada e
   continuava com a MESMA cara de clicável, sem efeito nenhum. É a doutrina que
   esta própria tela escreve nas frases de recusa — botão desabilitado calado faz
   a pessoa achar que a ferramenta está quebrada. */
.au-link[disabled]{opacity:.6;cursor:default;}
.au-botao.secundario{color:var(--accent);background:transparent;}

.au-lista{display:flex;flex-direction:column;gap:10px;padding:16px 24px 0;max-width:720px;}
.au-card{border:1px solid var(--border);border-radius:8px;background:var(--surface);padding:14px 16px;}
.au-card.alerta{border-color:var(--orange);}
.au-card-topo{display:flex;justify-content:space-between;align-items:baseline;gap:12px;}
.au-modelo{font-family:var(--fonte-principal);font-size:max(9px, calc(14px * var(--escala-texto, 1)));font-weight:600;color:var(--text);}
.au-progresso{font-family:var(--fonte-principal);font-size:max(9px, calc(11px * var(--escala-texto, 1)));color:var(--accent);white-space:nowrap;}
.au-card-linha{display:flex;gap:14px;flex-wrap:wrap;margin-top:6px;font-family:var(--fonte-principal);font-size:max(9px, calc(12px * var(--escala-texto, 1)));color:var(--muted);}
.au-ref{font-family:var(--fonte-dados);}
.au-link{margin-top:10px;font-family:var(--fonte-principal);font-size:max(9px, calc(11px * var(--escala-texto, 1)));font-weight:600;color:var(--accent);background:none;border:none;padding:0;cursor:pointer;}

.au-campo{display:block;padding:16px 24px 0;max-width:520px;}
.au-rot{display:block;font-family:var(--fonte-principal);font-size:max(9px, calc(10px * var(--escala-texto, 1)));font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin-bottom:6px;}
.au-campo input,.au-campo select{width:100%;font-family:var(--fonte-principal);font-size:max(9px, calc(14px * var(--escala-texto, 1)));padding:9px 12px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);}
/* Medido a 375px: o seletor de lote saía com 39,5px de altura e 14px de fonte
   — abaixo dos 40px de alvo de dedo e dos 16px abaixo dos quais o iOS dá zoom
   ao focar. É o único `select` desta tela. */
.au-campo select{min-height:40px;box-sizing:border-box;font-size:max(16px, calc(16px * var(--escala-texto, 1)));}

.au-gravacao{padding:8px 24px 0;max-width:620px;}
.au-passo{font-family:var(--fonte-principal);font-size:max(9px, calc(11px * var(--escala-texto, 1)));font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--accent);padding-top:18px;}
/* O endereço é o que a pessoa vai conferir letra por letra na hora de gravar:
   fonte de dados, tamanho grande e quebra garantida em tela de celular. */
.au-endereco{font-family:var(--fonte-dados);font-size:max(16px, calc(17px * var(--escala-texto, 1)));line-height:1.6;color:var(--text);background:var(--surface);border:1px solid var(--accent);border-radius:8px;padding:16px;margin-top:14px;word-break:break-all;user-select:all;}
.au-acoes{display:flex;gap:10px;padding:16px 24px 0;flex-wrap:wrap;}
.au-gravacao .au-acoes{padding-left:0;padding-right:0;}
/* Mesmo motivo do `.au-acoes` logo acima: dentro do bloco de gravação o
   recuo já vem do `.au-gravacao`. Sem isto o texto de instrução ficava 24px
   mais para dentro que o endereço, e a coluna saía torta. */
.au-gravacao .au-instrucao{padding-left:0;padding-right:0;}
/* Medido a 375px: sem isto os botões da gaveta do gravador de mesa saíam com
   35,5px de altura — dedo não acerta menos que 40. */
.au-gravacao .au-botao{min-height:40px;box-sizing:border-box;}

/* O recado da gravação é o que a pessoa lê de pé, com o celular numa mão e a
   etiqueta na outra: corpo grande e contraste alto nos DOIS temas.
   Os tokens são --surface2 e --text (src/estilos/estilos-globais.css). */
.au-recado-nfc{margin:12px 0 0;padding:10px 12px;border-radius:var(--radius-md);background:var(--surface2);color:var(--text);font-family:var(--fonte-principal);font-size:max(9px, calc(15px * var(--escala-texto, 1)));line-height:1.45;overflow-wrap:anywhere;}
/* O alvo do dedo é a linha inteira, não o quadradinho: min-height 40px. */
.au-trava{display:flex;gap:8px;align-items:center;min-height:40px;margin-top:14px;font-family:var(--fonte-principal);font-size:max(9px, calc(13px * var(--escala-texto, 1)));line-height:1.5;color:var(--text);cursor:pointer;}
.au-trava input{width:20px;height:20px;flex-shrink:0;}
.au-mesa{margin-top:22px;}
/* Bloco de aviso pelo desenho do PADRAO-DA-CENTRAL: a cor é o sinal, o texto é
   para ler — por isso o `--text` e não o `--orange` na letra. */
.au-confirma{margin-top:10px;padding:12px 14px;border-radius:var(--radius-md);background:color-mix(in srgb, var(--orange) 10%, var(--surface));border:1px solid color-mix(in srgb, var(--orange) 38%, var(--surface));}
.au-confirma-texto{font-family:var(--fonte-principal);font-size:max(9px, calc(14px * var(--escala-texto, 1)));line-height:1.5;color:var(--text);overflow-wrap:anywhere;}
.au-confirma .au-acoes{padding:12px 0 0;}
/* `display:flex` no <summary> APAGA o triângulo que o Chrome desenha sozinho, e
   sem ele nada dizia que a gaveta abre. O marcador nativo sai de cena nos dois
   motores (`list-style` no padrão, `::-webkit-details-marker` no WebKit velho) e
   a seta vira o SVG do template, que gira ao abrir e existe igual em todo
   navegador. */
.au-mesa summary{display:flex;align-items:center;gap:8px;min-height:40px;cursor:pointer;font-family:var(--fonte-principal);font-size:max(9px, calc(13px * var(--escala-texto, 1)));font-weight:600;color:var(--text);list-style:none;}
.au-mesa summary::-webkit-details-marker{display:none;}
.au-seta{flex-shrink:0;color:var(--accent);transition:transform .15s;}
.au-mesa[open] > summary .au-seta{transform:rotate(90deg);}
/* 16px no campo não é estética: abaixo disso o iOS dá zoom ao focar e a tela
   salta na cara de quem está digitando. */
.au-colar{display:block;width:100%;min-height:90px;margin:10px 0;box-sizing:border-box;font-family:var(--fonte-principal);font-size:max(16px, calc(16px * var(--escala-texto, 1)));line-height:1.5;padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius-md);background:var(--surface);color:var(--text);}

.au-fundo{position:fixed;inset:0;background:rgba(15,15,15,.55);display:flex;align-items:center;justify-content:center;padding:20px;z-index:50;}
.au-folha{background:var(--surface);border:1px solid var(--border);border-radius:10px;max-width:520px;width:100%;max-height:90dvh;overflow-y:auto;padding:22px 0;}
.au-folha h2{font-family:var(--fonte-principal);font-size:max(16px, calc(16px * var(--escala-texto, 1)));font-weight:600;color:var(--text);padding:0 24px;}
.au-folha .au-erro{padding:12px 24px 0;}

@media (max-width:520px){
  .abas,.au-topo-acao,.au-lista,.au-campo,.au-gravacao,.au-acoes,.au-baixadas-lote{padding-left:16px;padding-right:16px;}
  .au-vazio,.au-erro,.au-instrucao,.au-secao{padding-left:16px;padding-right:16px;}
  .au-gravacao .au-acoes{padding-left:0;padding-right:0;}
  .au-botao{flex:1;}
}

/* ── O PASSO A PASSO ──────────────────────────────────────────────────────
   Cor sai de token, nunca escrita a mao (PADRAO-DA-CENTRAL). A etapa de agora
   e a unica que mostra o resumo: passo a passo que explica tudo ao mesmo tempo
   nao explica nada. */
.au-passos{
  list-style:none; margin:0 0 var(--sp-3); padding:0;
  display:flex; flex-direction:column; gap:var(--sp-1);
}
.au-passo-item{
  display:flex; gap:var(--sp-2); align-items:flex-start;
  padding:var(--sp-2); border-radius:var(--radius-md);
  color:var(--muted); background:transparent;
}
.au-passo-item.agora{background:var(--surface2); color:var(--text)}
.au-passo-n{
  flex:none; width:22px; height:22px; border-radius:50%;
  display:flex; align-items:center; justify-content:center;
  font-size:12px; font-weight:600;
  border:1px solid var(--border); background:var(--surface);
}
.au-passo-item.agora .au-passo-n{background:var(--accent); border-color:var(--accent); color:var(--bg)}
.au-passo-item.feito .au-passo-n{opacity:.55}
.au-passo-txt{display:flex; flex-direction:column; gap:2px; min-width:0}
.au-passo-txt strong{font-size:14px; font-weight:600}
.au-passo-resumo{font-size:13px; line-height:1.45; color:var(--muted)}
.au-rever{margin:0 0 var(--sp-2)}
/* O link de rever media 13px de altura — medido a 375px. Alvo de toque abaixo
   de 40px e defeito (PADRAO item 3), e este e usado com o celular na mao. Ganha
   area de toque sem virar botao: o texto continua link. */
.au-rever .au-link{
  display:inline-flex; align-items:center; min-height:40px; padding:0 2px;
}

/* ── O GUIA DA PRIMEIRA VEZ ───────────────────────────────────────────────
   `position:fixed` com inset zero, e nao `absolute`: dentro de um pai que
   rola, o absolute acompanha a rolagem e o guia sai da tela. */
.au-guia-fundo{
  position:fixed; inset:0; z-index:60;
  display:flex; align-items:center; justify-content:center;
  padding:var(--sp-3); background:rgba(0,0,0,.55);
  /* Sem isto o dedo arrasta a tela para os lados POR DENTRO do modal. A trava
     do projeto (padrao-da-central.test.mjs) exige nos dois, e pegou este aqui
     no primeiro `npm test`. */
  touch-action:none; overscroll-behavior:contain;
}
.au-guia{
  width:100%; max-width:420px; padding:var(--sp-4);
  border-radius:var(--radius-lg); border:1px solid var(--border);
  background:var(--surface); color:var(--text);
}
.au-guia-conta{margin:0 0 var(--sp-1); font-size:12px; color:var(--muted); letter-spacing:.06em}
.au-guia-titulo{margin:0 0 var(--sp-2); font-size:19px; line-height:1.25}
.au-guia-texto{margin:0 0 var(--sp-4); font-size:15px; line-height:1.55}
/* os botoes embaixo e lado a lado; a 375px eles empilham em vez de encolher,
   porque alvo de toque abaixo de 40px e defeito */
.au-guia-acoes{display:flex; gap:var(--sp-2); flex-wrap:wrap}
.au-guia-acoes .au-botao{flex:1 1 140px; min-height:40px}

/* ── EDITAR E EXCLUIR O LOTE ────────────────────────────────────
   Cor sai de token, nunca escrita a mao (PADRAO-DA-CENTRAL, item 2).
   A pergunta de excluir REAPROVEITA `.au-confirma`, o bloco de aviso que esta
   tela ja tem: repintar aquela regra mudaria a gaveta do gravador de mesa, la
   na aba Gravar, que nao e desta tarefa. */
.au-lote-acoes{display:flex; gap:var(--sp-3); margin-top:var(--sp-2); flex-wrap:wrap}
/* O link nasce com 13px de altura. Alvo de dedo abaixo de 40px e defeito
   (PADRAO item 6) — cresce a area, o texto continua link. */
.au-lote-acoes .au-link{display:inline-flex; align-items:center; min-height:40px; margin-top:0}
.au-edicao{
  margin-top:var(--sp-2); padding:var(--sp-3);
  border:1px solid var(--border); border-radius:var(--radius-md);
  background:var(--surface2);
}
/* O recuo lateral ja vem do bloco. Sem isto os campos saem 24px mais para
   dentro que o resto do cartao — mesmo motivo do `.au-gravacao .au-acoes`. */
.au-edicao .au-campo{padding:var(--sp-2) 0 0; max-width:none}
.au-edicao .au-acoes{padding:var(--sp-3) 0 0}
/* 16px no campo nao e estetica: abaixo disso o iOS da zoom ao focar e a tela
   salta na cara de quem esta digitando. */
.au-edicao input{min-height:40px; box-sizing:border-box; font-size:max(16px, calc(16px * var(--escala-texto, 1)))}
/* Os botoes destes dois blocos vivem dentro do cartao do lote; sem isto saem
   com 35,5px de altura, como os da gaveta do gravador saiam. */
.au-card .au-botao{min-height:40px; box-sizing:border-box}
.au-aviso-menor{
  margin:var(--sp-2) 0 0; font-family:var(--fonte-principal);
  font-size:max(9px, calc(13px * var(--escala-texto, 1)));
  line-height:1.45; color:var(--muted); overflow-wrap:anywhere;
}
/* ── DAR BAIXA E DESFAZER ─────────────────────────────────────────────────
   Cor sai de token, nunca escrita a mao (PADRAO-DA-CENTRAL, item 2). A pergunta
   de dar baixa REAPROVEITA `.au-confirma`, o bloco de aviso que esta tela ja
   tem — repintar aquela regra mexeria na gaveta do gravador de mesa e na
   pergunta de excluir lote, que nao sao desta tarefa. */
/* O link nasce com 13px de altura. Alvo de dedo abaixo de 40px e defeito
   (PADRAO item 6), e este e apertado com o celular na mao. */
.au-baixar{display:inline-flex; align-items:center; min-height:40px}
/* "Dar baixa" e "Excluir esta peça" ficam lado a lado, e empilham a 375px em
   vez de encolher: alvo de dedo abaixo de 40px e defeito (PADRAO item 6). */
.au-peca-acoes{display:flex; gap:var(--sp-3); flex-wrap:wrap}
/* O recuo lateral ja vem do bloco: sem isto o seletor de motivo sai 24px mais
   para dentro que o resto da caixa — mesmo motivo do `.au-edicao .au-campo`. */
.au-confirma .au-campo{padding:var(--sp-2) 0 0; max-width:none}
/* A lista das baixadas vive FORA do `.au-gravacao`, entao carrega o proprio
   recuo. O `@media` la em cima passa este bloco para 16px junto com os outros. */
.au-baixadas-lote{padding:0 24px; max-width:620px}
.au-baixadas{list-style:none; margin:var(--sp-2) 0 0; padding:0}
.au-baixadas li{
  display:flex; justify-content:space-between; align-items:center;
  gap:var(--sp-2); padding:var(--sp-1) 0;
  font-family:var(--fonte-principal); color:var(--text);
  font-size:max(9px, calc(14px * var(--escala-texto, 1)));
  overflow-wrap:anywhere;
  border-bottom:1px solid var(--border);
}
/* Mesma historia do `.au-baixar`: o "Desfazer" precisa de 40px de area de dedo,
   e o `margin-top` do `.au-link` desalinharia ele da linha. */
.au-baixadas .au-link{min-height:40px; display:inline-flex; align-items:center; margin-top:0; flex:none}

/* ── A BUSCA DE PRODUTO NO BLING ──────────────────────────────────────────
   Cor sai de token. Alvo de toque de 40px: quem cria lote pode estar no
   celular, e o resultado da busca e uma lista de alvos pequenos por natureza. */
.au-escolha-produto{
  margin-bottom:var(--sp-4); padding-bottom:var(--sp-3);
  border-bottom:1px solid var(--border);
}
/* O RECUO LATERAL DE CADA FILHO É POR CONTA DELE: a `.au-folha` tem
   `padding:22px 0`, e quem não pede recuo encosta na borda da caixa. Os campos
   pedem 24px (16px abaixo de 520px, no `@media` lá em cima) — a lista de
   resultados e os avisos deste bloco acompanham o mesmo, senão eles ficam
   colados na borda enquanto o resto do formulário está recuado.
   Na lista o recuo é 16px: os 8px de `padding` do botão completam os 24px, e o
   realce de foco/hover ainda sobra para fora do texto. */
.au-escolha-produto > .au-aviso-menor{padding-left:24px; padding-right:24px}
.au-produtos{list-style:none; margin:var(--sp-2) 0 0; padding:0 16px; max-height:240px; overflow-y:auto}
.au-produtos li + li{border-top:1px solid var(--border)}
.au-produto{
  display:flex; flex-direction:column; gap:2px; width:100%;
  min-height:44px; padding:var(--sp-2); text-align:left;
  background:none; border:0; cursor:pointer; color:var(--text); font:inherit;
}
.au-produto:hover, .au-produto:focus-visible{background:var(--surface2)}
.au-produto strong{font-size:14px; font-weight:600; line-height:1.3}
/* O `@media` do celular deste bloco fica AQUI, e não no de cima junto com os
   outros: as regras-base acima têm a mesma especificidade e vêm depois no
   arquivo, então lá em cima elas seriam simplesmente ignoradas a 375px.
   Medido no CSS do build antes de escrever esta linha. */
@media (max-width:520px){
  .au-escolha-produto > .au-aviso-menor{padding-left:16px;padding-right:16px;}
  .au-produtos{padding-left:8px;padding-right:8px;}
}
</style>
