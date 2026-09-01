<template>
  <div class="tela-autenticidade">
    <barra-de-topo voltar="Gestão Interna" titulo="Autenticidade e Garantia" @voltar="voltar" />

    <!-- ── O MENU DE ABAS ───────────────────────────────────────────────
         É A BARRA `.abas` DA CASA, a mesma da Frota, do Patrimônio e dos
         Acessos — e não uma barra própria. A entrega anterior inventou uma
         (`.abas-barra`, com fundo e moldura, rolando por dentro) e o dono viu
         na hora que esta tela tinha ficado diferente das irmãs. A barra global
         já resolve o que a nova foi inventar, inclusive os 40px de alvo de
         toque, corrigidos para as quatro telas em 19/08.
         Ela tem `flex-wrap:wrap`: com cinco itens quebra em duas linhas no
         celular, e é assim que as irmãs se comportam.

         A BARRA MOSTRA A SEQUÊNCIA, porque a ferramenta é um caminho e não um
         armário: 1 Lotes → 2 Gravar → 3 Etiquetas é a ordem em que se faz.
         Garantias e Alertas ficam do outro lado do separador porque não são
         passos: são consulta. Numerar os cinco mentiria sobre o fluxo.

         O `aria-selected` continua: a ativa não se distingue só pela cor (o
         sublinhado do global também é cor), e é isso que o leitor de tela
         anuncia. O número é `aria-hidden` e volta no `aria-label` como
         "Passo 1: Lotes" — ouvir "um lotes" não ajuda ninguém. -->
    <div class="abas" role="tablist">
      <template v-for="ab in ABAS" :key="ab.chave">
        <span v-if="ab.separaAntes" class="au-abas-sep" aria-hidden="true">·</span>
        <button role="tab" type="button" :data-aba="ab.chave" :aria-label="ab.leitura"
                :aria-selected="String(aba === ab.chave)"
                :class="{ on: aba === ab.chave }" @click="aba = ab.chave">
          <span v-if="ab.n" class="au-aba-n" aria-hidden="true">{{ ab.n }}</span>{{ ab.rotulo }}
        </button>
      </template>
    </div>

    <!-- A AJUDA CURTA DA ABA, dentro dela. O guia inteiro ninguém reabre: quem
         cai na aba Alertas seis meses depois não vai procurar um guia para
         descobrir o que aquela lista significa. Os textos moram em
         `tutorial.js`, e há teste que reprova aba sem verbete. -->
    <p class="au-ajuda">{{ AJUDA_DA_ABA[aba] }}</p>

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

      <!-- ── A BUSCA E O ARQUIVAMENTO ────────────────────────────────────
           A aba abre nos EM ANDAMENTO. Com 50 lotes ela virava um muro, e o
           que a pessoa procura é sempre a fornada que está na bancada.
           NADA SOME DE VERDADE: o botão logo abaixo diz quantos estão
           encerrados e traz todos de volta, e a contagem do painel diz sempre
           "N de M". Não há coluna nova no banco: encerrado é o lote em que toda
           peça já foi gravada ou baixada, contado na hora. -->
      <PainelDeBusca v-else v-model:filtro="filtroDeLotes"
                     :atalhos="ATALHOS_DE_DATA" :estados="ESTADOS_DE_LOTE"
                     rotulo-da-data="Fabricado em" estado-padrao="andamento"
                     dica="Modelo, cor, referência ou o código de uma peça"
                     :contagem="contagemDeLotes" />

      <div v-if="lotes.length" class="au-acoes">
        <button v-if="filtroDeLotes.estado === 'andamento'" class="au-botao secundario" type="button"
                :disabled="!lotesEncerrados" @click="verEncerrados">
          Ver encerrados ({{ lotesEncerrados }})
        </button>
        <button v-else class="au-botao secundario" type="button" @click="verEmAndamento">
          Voltar aos em andamento
        </button>
      </div>

      <!-- A tela nunca mente: "nada encontrado" e "não há lote nenhum" são
           coisas diferentes, e a segunda já foi dita lá em cima. -->
      <p v-if="lotes.length && !lotesVisiveis.length" class="au-vazio">
        Nenhum lote com esse recorte. Há {{ lotes.length }} lote(s) no total — mude a busca,
        o período ou o estado, ou aperte “Limpar a busca”.
      </p>

      <div class="au-lista">
        <div v-for="l in lotesVisiveis" :key="l.id" class="au-card">
          <div class="au-card-topo">
            <span class="au-modelo">{{ l.modelo }}</span>
            <span class="au-progresso">{{ progressoDoLote(pecasDoLote(l.id)).texto }} gravadas</span>
          </div>
          <div class="au-card-linha">
            <!-- O ESTADO DO LOTE, ESCRITO. Sem ele, "encerrado" seria uma regra
                 invisível que só se percebe quando o lote some da lista. O selo
                 sai das classes prontas do PADRAO, nunca de cor à mão. -->
            <span class="selo" :class="marcaDoLote(l.id).selo">{{ marcaDoLote(l.id).rotulo }}</span>
            <span v-if="l.cor">{{ l.cor }}</span>
            <span v-if="l.sku" class="au-ref">ref. {{ l.sku }}</span>
            <span>{{ l.quantidade }} {{ l.quantidade === 1 ? 'peça' : 'peças' }}</span>
            <span>{{ dataCurta(l.fabricado_em) }}</span>
          </div>
          <button class="au-link" type="button" @click="irGravar(l.id)">Gravar as etiquetas deste lote →</button>

          <!-- AS AÇÕES DO LOTE FICAM TODAS NA MESMA LINHA. "Ver as peças" entra
               aqui e não numa linha própria: duas fileiras de link uma embaixo
               da outra empurram o cartão seguinte para fora da vista no
               celular. Editar e Excluir continuam atrás de `podeEditar`. -->
          <div class="au-lote-acoes">
            <button class="au-link" type="button" :aria-expanded="String(loteAberto === l.id)"
                    @click="alternarPecas(l.id)">
              {{ loteAberto === l.id ? 'Esconder as peças' : 'Ver as peças e os links' }}
            </button>
            <template v-if="podeEditar">
              <button class="au-link" type="button" @click="abrirEdicao(l)">Editar</button>
              <button class="au-link" type="button" @click="pedirExcluir(l.id)">Excluir</button>
            </template>
          </div>

          <!-- A PERGUNTA DE EXCLUIR MORA NA PRÓPRIA TELA: a caixinha nativa do
               navegador é proibida neste projeto e `uiConfirm` não existe aqui — e
               há um teste que reprova até a palavra escrita. Quem recusa de verdade
               é o banco; a tela só traduz a recusa para português.

               SÃO DUAS PERGUNTAS, E A SEGUNDA NÃO REPETE A PRIMEIRA. A primeira
               diz o que vai acontecer; a segunda diz o que se PERDE, com o
               número de peças, e pede a senha. Duas vezes a mesma frase vira um
               "sim, sim" automático, e o segundo clique não decide nada. -->
          <div v-if="excluindo === l.id" class="au-confirma">
            <template v-if="etapaDeExcluir === 1">
              <p class="au-confirma-texto">
                Excluir o lote <strong>{{ l.modelo }}</strong> e as {{ l.quantidade }} etiquetas dele?
              </p>
              <p class="au-aviso-menor">
                Só dá para excluir lote em que nenhuma etiqueta foi gravada. Se alguma já foi,
                a tela vai dizer quantas.
              </p>
              <div class="au-acoes">
                <button class="au-botao secundario" type="button" @click="fecharExcluir">Cancelar</button>
                <button class="au-botao" type="button" @click="etapaDeExcluir = 2">Continuar</button>
              </div>
            </template>

            <template v-else>
              <p class="au-confirma-texto">
                Tem certeza? Somem para sempre os <strong>{{ pecasDoLote(l.id).length }} código(s)</strong>
                deste lote, o endereço que cada um abre e a lista de produção dele. Não dá para
                desfazer: quem encostar o celular numa etiqueta apagada passa a ler
                “este código não consta”.
              </p>
              <!-- A SENHA É FRICÇÃO, NÃO COFRE — ver `fraseDaSenha`, em lotes.js.
                   Ela segura o clique sem pensar e quem senta no computador
                   destravado. Quem manda de verdade é o portão do banco. -->
              <label class="au-campo"><span class="au-rot">Sua senha</span>
                <input v-model="senhaDaExclusao" type="password" autocomplete="current-password"
                       :disabled="exclusaoDeLoteEmVoo" @keydown.enter.prevent="excluirLote(l.id)"></label>
              <p class="au-aviso-menor">É a mesma senha com que você entra no aplicativo.</p>
              <p v-if="erroDaSenha" class="au-recusa">{{ erroDaSenha }}</p>
              <div class="au-acoes">
                <button class="au-botao secundario" type="button" @click="fecharExcluir">Cancelar</button>
                <button class="au-botao" type="button" :disabled="exclusaoDeLoteEmVoo"
                        @click="excluirLote(l.id)">
                  {{ exclusaoDeLoteEmVoo ? 'Conferindo…' : 'Excluir para sempre' }}
                </button>
              </div>
            </template>
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

          <div v-if="loteAberto === l.id" class="au-pecas">
            <div class="au-pecas-topo">
              <span class="au-pecas-conta">
                Mostrando {{ pecasVisiveis.length }} de {{ pecasDoLoteAberto.length }} peça(s)
              </span>
              <button class="au-botao secundario" type="button" @click="baixarListaDoLote(l)">
                Baixar a lista inteira
              </button>
            </div>

            <p v-if="!pecasDoLoteAberto.length" class="au-aviso-menor">
              Este lote não tem peça nenhuma.
            </p>

            <ul v-else class="au-pecas-lista">
              <li v-for="pc in pecasVisiveis" :key="pc.codigo" class="au-peca">
                <div class="au-peca-topo">
                  <span class="au-peca-n">nº {{ pc.numero_na_serie }}</span>
                  <span class="au-ref au-peca-cod">{{ pc.codigo }}</span>
                  <span class="selo" :class="estadoDaPeca(pc).selo">{{ estadoDaPeca(pc).rotulo }}</span>
                </div>
                <!-- o estado por escrito, nunca só pela cor do selo: gravada
                     diz QUANDO, e baixada diz POR QUÊ -->
                <p class="au-peca-estado">
                  <template v-if="pc.baixada">Baixada — {{ rotuloDoMotivo(pc.baixa_motivo) }}</template>
                  <template v-else-if="pc.gravada_em">Gravada em {{ dataCurta(pc.gravada_em) }}</template>
                  <template v-else>Ainda não gravada</template>
                </p>
                <!-- o endereço é O QUE VAI DENTRO DA BOLSA: sai de
                     `enderecoDaTag`, nunca do domínio escrito à mão -->
                <div class="au-peca-end">{{ enderecoDaTag(pc.codigo) }}</div>
                <div class="au-peca-links">
                  <button class="au-link au-peca-botao" type="button"
                          @click="copiarEnderecoDaPeca(pc.codigo)">
                    {{ enderecoCopiado === pc.codigo ? 'Copiado!' : 'Copiar endereço' }}
                  </button>
                  <!-- abre o que a CLIENTE vê, para conferir na hora. Aba nova
                       com `rel="noopener"`: sem ele a página aberta ganha uma
                       alça para esta aqui. -->
                  <a class="au-link au-peca-botao" :href="enderecoDaTag(pc.codigo)"
                     target="_blank" rel="noopener">Abrir a página da cliente</a>
                </div>
              </li>
            </ul>

            <!-- 500 peças desenhadas de uma vez travam a tela do celular. O
                 botão diz quantas ainda faltam: lista que esconde sem avisar é
                 lista que mente. -->
            <button v-if="pecasQueFaltamMostrar" class="au-botao secundario" type="button"
                    @click="mostrarMaisPecas">
              Mostrar mais {{ Math.min(pecasQueFaltamMostrar, DE_CADA_VEZ) }} (faltam {{ pecasQueFaltamMostrar }})
            </button>
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
        <button class="au-link" type="button" @click="abrirGuia">
          Rever o guia de bancada — inclusive o “deu errado, e agora?”
        </button>
      </p>

      <p v-if="!lotes.length" class="au-vazio">
        Ainda não existe lote. Um lote é uma fornada de bolsas do mesmo modelo, e cada
        bolsa dele ganha um código diferente. Abra a aba <strong>Lotes</strong> para criar o primeiro.
      </p>

      <template v-else>
        <!-- ── A FILA DE TRABALHO, E SÓ ELA ────────────────────────────────
             O seletor oferecia os 50 lotes, inclusive os 40 que não têm mais
             nada a fazer. Aqui ele oferece só quem tem peça POR GRAVAR — mais o
             lote escolhido, que nunca sai: ao gravar a última peça o lote
             encerra na hora, e se ele sumisse do seletor a lista ficaria em
             branco levando junto o ✓ da etiqueta recém-encostada.
             O estado "Todos, inclusive encerrados" existe porque a lista das
             peças BAIXADAS mora nesta aba, e é o único caminho para desfazer
             uma baixa num lote já encerrado. -->
        <PainelDeBusca v-model:filtro="filtroDeGravar"
                       :atalhos="ATALHOS_DE_DATA" :estados="ESTADOS_DO_SELETOR"
                       rotulo-da-data="Fabricado em" estado-padrao="por_gravar"
                       dica="Modelo, cor, referência ou o código de uma peça"
                       :contagem="contagemDoSeletor" />

        <!-- Frase útil no lugar de lista vazia: dizer "nenhum lote" com 50
             lotes encerrados na mão seria mentira, e sem explicação a pessoa
             acharia que a ferramenta quebrou. -->
        <p v-if="!lotesComPecaPorGravar(lotes, pecasDoLote)" class="au-pronto">
          Não há nenhuma etiqueta por gravar: os {{ lotes.length }} lote(s) estão encerrados —
          cada peça já foi gravada ou baixada. Crie um lote novo na aba <strong>1 Lotes</strong>,
          ou troque o estado acima para “Todos” se veio desfazer uma baixa.
        </p>

        <label class="au-campo">
          <span class="au-rot">Lote</span>
          <!-- travado durante a gravação: trocar de lote no meio dos 8 segundos
               era o caminho que gravava uma peça e marcava outra -->
          <select v-model="loteEscolhido" :disabled="gravando">
            <option v-for="l in lotesDoSeletor" :key="l.id" :value="l.id">
              {{ l.modelo }}<span v-if="l.cor"> · {{ l.cor }}</span> — {{ progressoDoLote(pecasDoLote(l.id)).texto }}<span v-if="loteEstaEncerrado(l.id)"> · encerrado</span>
            </option>
          </select>
        </label>

        <!-- ── O FAROL DO LOTE ─────────────────────────────────────────────
             Ele fica FORA do bloco de gravação de propósito: quando a última
             peça é gravada aquele bloco inteiro some, e com ele sumiria o ✓ da
             etiqueta que a pessoa acabou de encostar.
             A BARRA NÃO SUBSTITUI O TEXTO, soma a ele: barra sozinha não diz
             quantas faltam, e não dá para ler em voz alta na bancada. -->
        <div class="au-farol">
          <div class="au-barra" role="progressbar" aria-valuemin="0"
               :aria-valuenow="progressoDoLoteAtual.gravadas"
               :aria-valuemax="progressoDoLoteAtual.total"
               :aria-label="`${progressoDoLoteAtual.texto} etiquetas gravadas neste lote`">
            <i class="au-barra-cheia" :style="{ width: larguraDoProgresso }"></i>
          </div>
          <p class="au-barra-texto">{{ progressoDoLoteAtual.texto }} gravadas neste lote</p>

          <!-- O SINAL DE VIDA. O desenho é para o canto do olho; QUEM DIZ O QUE
               ACONTECEU É O TEXTO, aqui e no recado grande logo abaixo. Com
               `prefers-reduced-motion` o movimento sai e este bloco continua
               inteiro — desligar animação não é desligar informação. -->
          <div v-if="gravando || sinalDaGravacao" class="au-sinal"
               :class="'au-sinal-' + estadoDoSinal" role="status">
            <span v-if="gravando" class="au-anel" aria-hidden="true"></span>
            <svg v-else-if="sinalDaGravacao === 'ok'" class="au-marca-ok" viewBox="0 0 24 24"
                 width="30" height="30" aria-hidden="true" fill="none" stroke="currentColor"
                 stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="4 13 9.5 18.5 20 6" />
            </svg>
            <svg v-else class="au-marca-erro" viewBox="0 0 24 24"
                 width="30" height="30" aria-hidden="true" fill="none" stroke="currentColor"
                 stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
              <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
            </svg>
            <span class="au-sinal-texto">{{ textoDoSinal }}</span>
          </div>
        </div>

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

            <!-- ── ETIQUETA JÁ GRAVADA: SOBRESCREVER? ──────────────────────
                 A pergunta diz QUAL BOLSA está prestes a perder a identidade —
                 modelo, cor e número na série, não só o código: "K7M4X9QP2R" não
                 é bolsa nenhuma. E pergunta o que fazer com a peça antiga, nos
                 dois caminhos que o dono pediu.
                 A gravação física só acontece DEPOIS de o banco confirmar. -->
            <div v-if="sobrescrita" class="au-confirma">
              <p class="au-confirma-texto">
                Esta etiqueta já está gravada com <strong>{{ sobrescrita.descricaoAntiga }}</strong>.
                Sobrescrever apaga a identidade dessa peça desta etiqueta e grava
                <strong>{{ sobrescrita.descricaoNova }}</strong> no lugar.
              </p>
              <p v-if="sobrescrita.temGarantia" class="au-aviso-menor">
                <strong>A peça antiga tem garantia registrada por uma cliente.</strong>
                A garantia continua valendo no código dela — por isso o motivo escrito é
                obrigatório aqui.
              </p>

              <label class="au-campo"><span class="au-rot">O que fazer com a peça antiga</span>
                <select v-model="destinoDaAntiga" :disabled="gravando">
                  <option value="fila">Volta para a fila — ela ganha outra etiqueta depois</option>
                  <option value="baixa">Dar baixa — ela não vira bolsa</option>
                </select>
              </label>

              <label v-if="destinoDaAntiga === 'baixa'" class="au-campo">
                <span class="au-rot">Motivo da baixa</span>
                <select v-model="motivoDaSobrescrita" :disabled="gravando">
                  <option value="">Escolha o motivo…</option>
                  <option v-for="m in MOTIVOS_DE_BAIXA" :key="m.chave" :value="m.chave">{{ m.rotulo }}</option>
                </select>
              </label>
              <!-- `v-else-if` GRUDA no `v-if` de cima, e é de propósito: no
                   destino 'fila' o motivo é texto livre, e só é cobrado quando
                   há garantia de cliente. -->
              <label v-else-if="sobrescrita.temGarantia" class="au-campo">
                <span class="au-rot">Motivo</span>
                <input v-model="motivoDaSobrescrita" type="text" maxlength="200" :disabled="gravando"
                       placeholder="Ex.: etiqueta ficou de lado antes de costurar"></label>

              <p v-if="erroDaSobrescrita" class="au-recusa">{{ erroDaSobrescrita }}</p>

              <div class="au-acoes">
                <button class="au-botao secundario" type="button" :disabled="gravando"
                        @click="desistirDaSobrescrita">Não sobrescrever</button>
                <button class="au-botao" type="button" :disabled="gravando"
                        @click="sobrescreverEtiqueta">
                  {{ gravando ? 'Encoste a etiqueta…' : 'Sobrescrever esta etiqueta' }}
                </button>
              </div>
            </div>

            <!-- os botões normais somem enquanto a pergunta está aberta: "Gravar
                 nesta etiqueta" ali do lado leria a MESMA etiqueta de novo e
                 devolveria a MESMA pergunta, e a pessoa acharia que travou -->
            <div v-if="!sobrescrita" class="au-acoes">
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

          <!-- ── A FILA AO REDOR ─────────────────────────────────────────
               A que acabou de sair e as próximas. A da vez NÃO se distingue só
               pela cor: ela ganha fundo, borda e o selo escrito "Agora" — cor
               sozinha some para quem não a enxerga.
               Com uma peça só na fila a lista não aparece: bloco que mostra
               apenas a peça que já está na tela logo acima vira paisagem. -->
          <div v-if="filaAoRedor.length > 1" class="au-fila">
            <p class="au-fila-titulo">A fila deste lote</p>
            <ul class="au-fila-lista">
              <li v-for="pf in filaAoRedor" :key="pf.codigo"
                  :class="['au-fila-item', { atual: pf.codigo === proxima.codigo }]">
                <span class="au-fila-n">nº {{ pf.numero_na_serie }}</span>
                <span class="au-ref au-fila-cod">{{ pf.codigo }}</span>
                <span class="selo"
                      :class="pf.codigo === proxima.codigo ? 'selo-info' : estadoDaPeca(pf).selo">
                  {{ pf.codigo === proxima.codigo ? 'Agora' : estadoDaPeca(pf).rotulo }}
                </span>
              </li>
            </ul>
          </div>

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

    <!-- ── ETIQUETAS ────────────────────────────────────────────────────
         A aba de consertar o que foi gravado errado.

         ⚠️ `v-else-if` GRUDA NO `v-if` ANTERIOR: este bloco entra ENTRE a aba
         Gravar e a aba Registros, e as duas continuam sendo os vizinhos diretos
         dele na corrente. Um `v-if` solto no meio partiria a corrente em duas, e
         o `v-else` do fim — a aba Alertas inteira — passaria a ser desenhado
         embaixo das outras abas. Já aconteceu nesta tela, em 30/08. -->
    <template v-else-if="aba === 'etiquetas'">
      <p class="au-instrucao">
        Aqui se conserta o que já foi gravado. Apagar a gravação devolve a peça para a fila
        e <strong>não apaga o código nem a garantia de ninguém</strong> — mas a etiqueta continua
        costurada dentro da bolsa, e alguém vai precisar achá-la.
      </p>

      <!-- O AVISO DA GARANTIA FICA NA TELA, e não só no recado que some: uma
           bolsa que já está com uma cliente voltar para a fila é coisa que
           alguém vai precisar explicar. Ele só aparece quando houve garantia —
           aviso que aparece sempre vira paisagem (PADRAO item 9). -->
      <div v-if="avisoDaGarantia" class="au-confirma au-aviso-garantia" role="status">
        <p class="au-confirma-texto">{{ avisoDaGarantia }}</p>
        <div class="au-acoes">
          <button class="au-botao secundario" type="button" @click="avisoDaGarantia = ''">Entendi</button>
        </div>
      </div>

      <label class="au-campo"><span class="au-rot">Lote</span>
        <select v-model="loteDaEtiqueta">
          <option value="">Todos os lotes</option>
          <option v-for="l in lotes" :key="l.id" :value="l.id">
            {{ l.modelo }}<span v-if="l.cor"> · {{ l.cor }}</span>
          </option>
        </select>
      </label>

      <!-- ── A BUSCA ─────────────────────────────────────────────────────
           A aba abre nos ÚLTIMOS 30 DIAS, e o resto fica atrás da busca: quem
           vem aqui acabou de gravar errado, e a peça dele é de hoje. O atalho
           "Qualquer data" (ou o "Limpar a busca") traz a história inteira de
           volta, e a contagem diz sempre quantas de quantas. -->
      <PainelDeBusca v-model:filtro="filtroDeEtiquetas"
                     :atalhos="ATALHOS_DE_DATA" :estados="ESTADOS_DE_ETIQUETA"
                     rotulo-da-data="Gravada em" estado-padrao="todas"
                     dica="Código da peça, modelo, referência ou o nº da série"
                     :contagem="contagemDeEtiquetas" />

      <p v-if="!etiquetasDaAba.length" class="au-vazio">
        Nenhuma etiqueta gravada {{ loteDaEtiqueta ? 'neste lote' : 'ainda' }}. Esta aba só mostra
        peça que está marcada como gravada — é o que dá para desfazer.
      </p>

      <!-- "Nada encontrado" e "não há nada" são coisas diferentes, e a tela não
           pode dizer uma pela outra. -->
      <p v-else-if="!etiquetasFiltradas.length" class="au-vazio">
        Nenhuma etiqueta com esse recorte. Há {{ etiquetasDaAba.length }} gravada(s)
        {{ loteDaEtiqueta ? 'neste lote' : 'no total' }} — mude a busca, o período ou o estado,
        ou aperte “Limpar a busca”.
      </p>

      <div v-else class="au-lista">
        <div v-for="pc in etiquetasVisiveis" :key="pc.codigo" class="au-card">
          <div class="au-card-topo">
            <span class="au-modelo">{{ descricaoDaPeca(pc, loteDaPeca(pc.lote_id)) }}</span>
            <span class="selo" :class="estadoDaPeca(pc).selo">{{ estadoDaPeca(pc).rotulo }}</span>
          </div>
          <div class="au-card-linha">
            <span>Gravada em {{ dataCurta(pc.gravada_em) }}</span>
            <span v-if="pc.baixada">Baixada — {{ rotuloDoMotivo(pc.baixa_motivo) }}</span>
            <!-- A PEÇA COM GARANTIA APARECE MARCADA. Sem isto, quem vai apagar a
                 gravação não tem como saber que do outro lado há uma cliente. -->
            <span v-if="temGarantia(pc.codigo)" class="selo selo-atencao">Garantia de cliente</span>
          </div>
          <div class="au-peca-end">{{ enderecoDaTag(pc.codigo) }}</div>

          <div v-if="podeEditar && apagando?.codigo !== pc.codigo" class="au-peca-acoes">
            <button class="au-link au-baixar" type="button"
                    @click="pedirApagarGravacao(pc)">Apagar a gravação</button>
          </div>

          <!-- DUAS PERGUNTAS E A SENHA, como no excluir lote: apagar a gravação
               de uma peça costurada dentro de uma bolsa é destrutivo, e a
               etiqueta continua existindo no mundo depois disso. -->
          <div v-if="apagando?.codigo === pc.codigo" class="au-confirma">
            <template v-if="etapaDeApagar === 1">
              <p class="au-confirma-texto">
                Apagar a gravação de <strong>{{ apagando.descricao }}</strong>?
              </p>
              <p class="au-aviso-menor">
                A peça volta para a fila de gravação. O código continua existindo e a página da
                cliente continua respondendo igual.
              </p>
              <div class="au-acoes">
                <button class="au-botao secundario" type="button" @click="fecharApagar">Cancelar</button>
                <button class="au-botao" type="button" @click="etapaDeApagar = 2">Continuar</button>
              </div>
            </template>

            <template v-else>
              <p class="au-confirma-texto">
                Tem certeza? A etiqueta desta peça <strong>continua costurada dentro de uma bolsa</strong>,
                gravada com este mesmo endereço — e o sistema vai passar a dizer que a peça está por
                gravar. Quem pegar a fila depois vai procurar uma etiqueta que já existe.
              </p>
              <p v-if="apagando.temGarantia" class="au-aviso-menor">
                <strong>Esta peça tem garantia registrada por uma cliente.</strong> A garantia continua
                valendo no código dela — por isso o motivo escrito é obrigatório aqui.
              </p>

              <label class="au-campo">
                <span class="au-rot">Motivo{{ motivoEhObrigatorio ? '' : ' (opcional)' }}</span>
                <input v-model="motivoDeApagar" type="text" maxlength="200"
                       :disabled="apagarEmVoo"
                       placeholder="Ex.: cliquei na peça errada no meio do lote"></label>

              <label class="au-campo"><span class="au-rot">Sua senha</span>
                <input v-model="senhaDeApagar" type="password" autocomplete="current-password"
                       :disabled="apagarEmVoo" @keydown.enter.prevent="apagarGravacao"></label>
              <p class="au-aviso-menor">É a mesma senha com que você entra no aplicativo.</p>
              <p v-if="erroDeApagar" class="au-recusa">{{ erroDeApagar }}</p>

              <div class="au-acoes">
                <button class="au-botao secundario" type="button" @click="fecharApagar">Cancelar</button>
                <button class="au-botao" type="button" :disabled="apagarEmVoo" @click="apagarGravacao">
                  {{ apagarEmVoo ? 'Conferindo…' : 'Apagar a gravação' }}
                </button>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- lista que esconde sem avisar é lista que mente: o botão diz quantas
           ainda faltam, como o da aba Lotes -->
      <div v-if="etiquetasQueFaltamMostrar" class="au-acoes">
        <button class="au-botao secundario" type="button" @click="mostrarMaisEtiquetas">
          Mostrar mais {{ Math.min(etiquetasQueFaltamMostrar, DE_CADA_VEZ) }}
          (faltam {{ etiquetasQueFaltamMostrar }})
        </button>
      </div>
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
    <!-- ── O GUIA DE BANCADA ───────────────────────────────────────────────
         Abre sozinho na primeira visita e some depois; o botão "Rever o guia de
         bancada" da aba Gravar o traz de volta. O "pular" fica sempre visível:
         guia que prende a pessoa vira estorvo, não ajuda.
         O "Voltar" nasceu com o guia longo: passar direto pela tela que
         interessava obrigava a recomeçar o guia inteiro.
         O MIOLO ROLA DENTRO DA CAIXA, e nunca a página atrás (PADRAO item 4):
         as telas do socorro têm quatro casos, e no celular elas passam da
         altura da tela. -->
    <div v-if="guiaAberto" class="au-guia-fundo" role="dialog" aria-modal="true"
         aria-label="Guia de bancada da gravação">
      <div class="au-guia">
        <p class="au-guia-conta">{{ telaDoGuia + 1 }} de {{ TELAS_DO_GUIA.length }}</p>
        <h3 class="au-guia-titulo">{{ TELAS_DO_GUIA[telaDoGuia].titulo }}</h3>
        <div class="au-guia-miolo">
          <p class="au-guia-texto">{{ TELAS_DO_GUIA[telaDoGuia].texto }}</p>
          <!-- Os itens são o que separa "guia de bancada" de "tela de texto":
               cada um tem um rótulo que se acha com o olho, de pé, com o
               celular na mão. -->
          <dl v-if="TELAS_DO_GUIA[telaDoGuia].itens" class="au-guia-itens">
            <template v-for="i in TELAS_DO_GUIA[telaDoGuia].itens" :key="i.rotulo">
              <dt>{{ i.rotulo }}</dt>
              <dd>{{ i.texto }}</dd>
            </template>
          </dl>
        </div>
        <div class="au-guia-acoes">
          <button class="au-botao secundario" type="button" @click="fecharGuia">Pular</button>
          <button class="au-botao secundario" type="button" :disabled="telaDoGuia === 0"
                  @click="voltarGuia">Voltar</button>
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
  MOTIVOS_DE_BAIXA, fraseDaRecusa, fraseDaSenha, naFila,
  rotuloDoMotivo, pecasEmOrdem, estadoDaPeca, linhasDaListaDoLote,
  codigosComGarantia, etiquetasGravadas, motivoObrigatorio, descricaoDaPeca,
} from './lotes.js'
import {
  conferirLeitura, codigoDoEndereco, listaParaGravadorDeMesa, codigosNoTextoDoGravador,
} from './nfc-fila.js'
import {
  PASSOS, TELAS_DO_GUIA, AJUDA_DA_ABA, passoAtual, guiaJaVisto, marcarGuiaVisto,
  proximaTelaDoGuia, telaAnteriorDoGuia,
} from './tutorial.js'
import {
  ATALHOS_DE_DATA, ESTADOS_DE_LOTE, ESTADOS_DE_ETIQUETA, intervaloDoAtalho,
  estadoDoLote, seloDoLote, filtrarLotes, lotesParaGravar, lotesComPecaPorGravar,
  filtrarEtiquetas, fraseDaContagem,
} from './busca-e-arquivamento.js'
import PainelDeBusca from './painel-de-busca.vue'
import { produtosParaEscolher, procurarProduto } from './produtos-do-bling.js'
import { paginasDoBling, avisoDoErro } from '../../compartilhado/chamada-do-bling.js'
import { temSuporte, traduzirFalha, criarGravador } from './gravador-nfc.js'

// A BARRA DE ABAS É UMA SEQUÊNCIA, e não um armário: os três primeiros são
// PASSOS numerados, na ordem em que se faz — cria o lote, grava as etiquetas,
// conserta o que saiu errado. Garantias e Alertas vêm depois do separador
// porque não são passos: são consulta, e numerá-los mentiria sobre o fluxo.
//
// `Registros` virou `Garantias` na tela: é o que aquela lista É — as garantias
// que as clientes registraram. A CHAVE continua `registros`, porque é o nome da
// tabela e de metade dos comentários deste arquivo.
//
// `leitura` é o que o leitor de tela anuncia: ouvir "um lotes" não ajuda
// ninguém, e o número sozinho não diz que é um passo.
const ABAS = [
  { chave: 'lotes', n: 1, rotulo: 'Lotes', leitura: 'Passo 1: Lotes' },
  { chave: 'gravar', n: 2, rotulo: 'Gravar', leitura: 'Passo 2: Gravar' },
  { chave: 'etiquetas', n: 3, rotulo: 'Etiquetas', leitura: 'Passo 3: Etiquetas' },
  { chave: 'registros', rotulo: 'Garantias', leitura: 'Garantias', separaAntes: true },
  { chave: 'alertas', rotulo: 'Alertas', leitura: 'Alertas' },
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
// VOLTAR UMA TELA. Com o guia de bancada são mais de dez telas, e sem isto quem
// passasse direto pela que interessava tinha de recomeçar o guia inteiro.
function voltarGuia() {
  const anterior = telaAnteriorDoGuia(telaDoGuia.value)
  if (anterior !== null) telaDoGuia.value = anterior
}
const gravando = ref(false)
const recadoNfc = ref('')

// ── O SINAL DE VIDA DA GRAVAÇÃO ───────────────────────────────────────────
// Quem grava está de pé na bancada, com a bolsa numa mão e o celular na outra,
// e precisa entender pelo canto do olho: pulsa enquanto espera a etiqueta, ✓
// quando confirma, tremor quando falha.
//
// MAS A ANIMAÇÃO NUNCA É A ÚNICA FORMA DE SABER. Cada um dos três estados
// também está ESCRITO — `textoDoSinal` aqui embaixo, e o recado grande logo
// abaixo dele. Quem desliga animação no sistema (`prefers-reduced-motion`) vê o
// mesmo ✓ e lê o mesmo texto: sai o movimento, fica o sinal.
//
// '' · 'ok' · 'falha' — o 'esperando' não mora aqui, é o próprio `gravando`,
// senão os dois sairiam de sincronia no dia em que um deles esquecesse de zerar.
const sinalDaGravacao = ref('')
let relogioDoSinal = null

function avisarNaTela(sinal) {
  sinalDaGravacao.value = sinal
  clearTimeout(relogioDoSinal)
  // O SINAL SOME SOZINHO. ✓ que fica na tela vira paisagem e, pior, passa a ser
  // lido como se fosse da PRÓXIMA etiqueta — e aí ele mente. O recado grande
  // continua na tela: quem some é o desenho, não a informação.
  relogioDoSinal = setTimeout(() => { sinalDaGravacao.value = '' }, 2600)
}

const estadoDoSinal = computed(() => (gravando.value ? 'esperando' : sinalDaGravacao.value))
const textoDoSinal = computed(() => {
  if (gravando.value) return 'Esperando a etiqueta encostar…'
  if (sinalDaGravacao.value === 'ok') return 'Peça marcada como gravada.'
  if (sinalDaGravacao.value === 'falha') return 'Não deu certo. A peça NÃO foi marcada.'
  return ''
})

// A BARRA DO LOTE, no lugar do "3 de 20" solto — e COM ele: o texto continua
// embaixo, porque barra sozinha não diz quantas faltam nem dá para ler em voz
// alta para quem está do outro lado da bancada.
const progressoDoLoteAtual = computed(() => progressoDoLote(pecasDoLote(loteEscolhido.value)))
const larguraDoProgresso = computed(() => {
  const { gravadas, total } = progressoDoLoteAtual.value
  return `${total ? Math.round((gravadas / total) * 100) : 0}%`
})
const textoDoGravador = ref('')
const confirmacaoDoGravador = ref(null)  // { reconhecidos, ignorados } enquanto a pergunta está na tela

const novo = reactive({ modelo: '', cor: '', sku: '', quantidade: 20, fabricado_em: '' })

// EDITAR E EXCLUIR ABREM DENTRO DO MESMO CARTÃO, e só um de cada vez: dois
// blocos empilhados no mesmo lote fazem a tela perguntar duas coisas ao mesmo
// tempo, e aí nenhuma das duas é a pergunta principal.
const editando = ref(null)    // o lote com o formulário de editar aberto, ou null
const excluindo = ref(null)   // o lote com a pergunta de excluir na tela, ou null
const edicao = reactive({ modelo: '', cor: '', sku: '', fabricado_em: '', quantidade: 1 })

// ── AS DUAS PERGUNTAS DE EXCLUIR, E A SENHA ───────────────────────────────
// 1 = "vai excluir o lote?"  ·  2 = o que se PERDE, com o número de peças, e a
// senha. A segunda NÃO repete a primeira de propósito: duas vezes a mesma frase
// vira um "sim, sim" automático e o segundo clique não decide nada.
const etapaDeExcluir = ref(1)
// ⚠️ A SENHA NUNCA SOBREVIVE À AÇÃO. Ela é apagada no `finally` de
// `excluirLote`, ao cancelar e ao trocar de lote — e NUNCA vai para
// `localStorage`, nem para o banco, nem para lugar nenhum além do corpo da
// chamada à edge que a confere.
const senhaDaExclusao = ref('')
const erroDaSenha = ref('')
const exclusaoDeLoteEmVoo = ref(false)

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

// ── A BUSCA E O ARQUIVAMENTO AUTOMÁTICO ───────────────────────────────────
//
// A tela acumulava tudo para sempre. As contas moram em
// `busca-e-arquivamento.js`, testadas sem navegador; aqui fica só o estado do
// que a pessoa pediu, e cada aba tem o SEU: o recorte da aba Etiquetas
// (últimos 30 dias) não é o mesmo da aba Lotes (em andamento), e um filtro só
// para as três faria uma aba mudar a outra pelas costas.
//
// NADA DISSO TOCA O BANCO. "Encerrado" é contado na hora — lote em que toda
// peça já foi gravada ou baixada. Desfazer uma baixa devolve o lote para "em
// andamento" sozinho, sem ninguém precisar destravar nada.
const FILTRO_LIMPO = { texto: '', de: '', ate: '', atalho: 'tudo', estado: '' }

const filtroDeLotes = ref({ ...FILTRO_LIMPO, estado: 'andamento' })
const filtroDeGravar = ref({ ...FILTRO_LIMPO, estado: 'por_gravar' })
// A ABA ETIQUETAS ABRE NOS ÚLTIMOS 30 DIAS. Quem vem aqui acabou de gravar
// errado, e a peça dele é de hoje — a história inteira continua a um toque, no
// atalho "Qualquer data" ou no "Limpar a busca".
const filtroDeEtiquetas = ref({
  ...FILTRO_LIMPO, estado: 'todas', atalho: '30d', ...intervaloDoAtalho('30d', new Date()),
})

// O "estado" da aba Gravar não é o mesmo das outras: ali a pergunta é se o lote
// tem trabalho a fazer, e não em que ponto ele está.
const ESTADOS_DO_SELETOR = [
  { chave: 'por_gravar', rotulo: 'Só com peça por gravar' },
  { chave: 'todos', rotulo: 'Todos, inclusive encerrados' },
]

const marcaDoLote = (id) => seloDoLote(estadoDoLote(pecasDoLote(id)))
const loteEstaEncerrado = (id) => estadoDoLote(pecasDoLote(id)).encerrado

const lotesVisiveis = computed(() => filtrarLotes(lotes.value, {
  pecasDoLote,
  texto: filtroDeLotes.value.texto,
  de: filtroDeLotes.value.de,
  ate: filtroDeLotes.value.ate,
  estado: filtroDeLotes.value.estado,
}))
const lotesEncerrados = computed(
  () => lotes.value.length - lotesComPecaPorGravar(lotes.value, pecasDoLote))
const contagemDeLotes = computed(() => fraseDaContagem(
  lotesVisiveis.value.length, lotes.value.length, { um: 'lote', muitos: 'lotes' }))

// Os dois botões são o mesmo controle do painel, por outra porta: quem procura
// um lote encerrado procura um botão escrito, não um seletor de estado.
function verEncerrados() { filtroDeLotes.value = { ...filtroDeLotes.value, estado: 'encerrado' } }
function verEmAndamento() { filtroDeLotes.value = { ...filtroDeLotes.value, estado: 'andamento' } }

const lotesDoSeletor = computed(() => lotesParaGravar(lotes.value, {
  pecasDoLote,
  texto: filtroDeGravar.value.texto,
  de: filtroDeGravar.value.de,
  ate: filtroDeGravar.value.ate,
  // o lote escolhido nunca sai da lista: ao gravar a última peça ele encerra na
  // hora, e o seletor ficaria em branco com o ✓ ainda na tela
  escolhido: loteEscolhido.value,
  incluirEncerrados: filtroDeGravar.value.estado === 'todos',
}))
const contagemDoSeletor = computed(() => fraseDaContagem(
  lotesDoSeletor.value.length, lotes.value.length, { um: 'lote', muitos: 'lotes' }))

// ── A FILA AO REDOR DA PEÇA DA VEZ ────────────────────────────────────────
// Quem grava 50 seguidas se perde: a tela mostrava SÓ a peça da vez, e o único
// jeito de saber onde parou era contar etiqueta na mão. Aqui aparecem a que
// acabou de sair e as próximas, com a da vez marcada.
//
// SÃO POUCAS LINHAS DE PROPÓSITO. A lista inteira do lote é da aba Lotes, e vai
// a 500: aqui, no meio da gravação, uma lista longa empurraria o botão de gravar
// para fora da tela do celular — e o botão é o que a pessoa está procurando.
const QUANTAS_ADIANTE = 4
const filaAoRedor = computed(() => {
  const atual = proxima.value
  if (!atual) return []
  // A BAIXADA SAI, pela mesma regra da fila de gravação (`naFila`, em lotes.js):
  // ela não vai virar bolsa, e mostrá-la aqui como "a próxima" mandaria alguém
  // gravar a etiqueta de uma peça dada como refugo.
  const lista = pecasEmOrdem(pecasDoLote(loteEscolhido.value)).filter(naFila)
  const i = lista.findIndex((p) => p.codigo === atual.codigo)
  if (i === -1) return []
  // uma para trás — a que acabou de sair — e as próximas
  return lista.slice(Math.max(0, i - 1), i + 1 + QUANTAS_ADIANTE)
})

// As baixadas saem da fila de gravação, então precisam de um lugar PRÓPRIO para
// aparecer: sem esta lista, dar baixa por engano não teria como ser desfeito.
const baixadasDoLote = computed(() => pecasDoLote(loteEscolhido.value)
  .filter((p) => p.baixada)
  .sort((a, b) => (a.numero_na_serie || 0) - (b.numero_na_serie || 0)))

// ── VER AS PEÇAS DE UM LOTE ───────────────────────────────────────────────
// O buraco que o dono apontou: "não consigo ver os links que já foram gravados
// em lotes". A tela inteira mostrava UM código — o da próxima peça da fila —, e
// depois de gravar e costurar ninguém respondia "qual link ficou na bolsa nº 7".
//
// UM LOTE ABERTO POR VEZ, pelo mesmo motivo de editar e excluir: duas listas
// longas abertas ao mesmo tempo empurram o resto da tela para fora da vista.
const loteAberto = ref(null)

// UM LOTE PODE TER 500 PEÇAS, e desenhar 500 linhas de uma vez trava a tela no
// celular. Ela abre com um punhado e cresce a pedido — a lista nunca mente
// sobre o tamanho, porque o botão diz quantas ainda faltam.
const DE_CADA_VEZ = 50
const quantasMostrar = ref(DE_CADA_VEZ)
// qual endereço acabou de ser copiado, para o botão dizer "Copiado!" só nele
const enderecoCopiado = ref('')

const pecasDoLoteAberto = computed(() => pecasEmOrdem(pecasDoLote(loteAberto.value)))
const pecasVisiveis = computed(() => pecasDoLoteAberto.value.slice(0, quantasMostrar.value))
const pecasQueFaltamMostrar = computed(
  () => Math.max(0, pecasDoLoteAberto.value.length - pecasVisiveis.value.length))

function alternarPecas(id) {
  loteAberto.value = loteAberto.value === id ? null : id
  // recomeça do topo: deixar o limite crescido de um lote de 500 faria o lote
  // seguinte desenhar 500 linhas de uma vez, que é o que este limite evita
  quantasMostrar.value = DE_CADA_VEZ
  enderecoCopiado.value = ''
}

function mostrarMaisPecas() { quantasMostrar.value += DE_CADA_VEZ }

// ── A ABA ETIQUETAS: consertar o que foi gravado errado ───────────────────
//
// Ela NÃO lê nada de novo do banco. As peças, os lotes e os registros de
// garantia já vêm de `carregar()` — o que muda aqui é o recorte:
// `etiquetasGravadas` fica só com as que TÊM gravação, que são as únicas que
// `vessel_desmarcar_gravada` aceita.
const loteDaEtiqueta = ref('')
const quantasEtiquetas = ref(DE_CADA_VEZ)

// A pergunta aberta, ou null. Guarda a peça CONTADA no momento do clique
// (código, descrição e se tinha garantia): com a lista recarregando por baixo,
// ler a peça de novo lá no fim faria a pergunta falar de uma e apagar outra.
const apagando = ref(null)
const etapaDeApagar = ref(1)
const motivoDeApagar = ref('')
// ⚠️ Mesma regra da senha da exclusão: nunca sobrevive à ação, nunca vai para
// `localStorage`. É fricção, não cofre.
const senhaDeApagar = ref('')
const erroDeApagar = ref('')
const apagarEmVoo = ref(false)
// o que a tela continua dizendo depois que a garantia apareceu na resposta do
// banco. Fica até a pessoa dispensar: recado que some não é aviso de garantia.
const avisoDaGarantia = ref('')

// OS CÓDIGOS COM GARANTIA saem de `vessel_registros`, que a aba Registros já lê.
const comGarantia = computed(() => codigosComGarantia(registros.value))
const temGarantia = (codigo) => comGarantia.value.has(String(codigo ?? '').trim().toUpperCase())

const loteDaPeca = (id) => lotes.value.find((l) => l.id === id) || null
const etiquetasDaAba = computed(() => etiquetasGravadas(pecas.value, loteDaEtiqueta.value || null))
// DOIS RECORTES EM SEQUÊNCIA, e não um só: `etiquetasDaAba` é o que EXISTE (o
// que a aba pode consertar), e `etiquetasFiltradas` é o que a pessoa PEDIU.
// Guardar só o segundo faria a tela dizer "nenhuma etiqueta gravada" para uma
// busca que não achou nada — e "não há" e "não achei" são coisas diferentes.
const etiquetasFiltradas = computed(() => filtrarEtiquetas(etiquetasDaAba.value, {
  loteDaPeca,
  comGarantia: comGarantia.value,
  texto: filtroDeEtiquetas.value.texto,
  de: filtroDeEtiquetas.value.de,
  ate: filtroDeEtiquetas.value.ate,
  estado: filtroDeEtiquetas.value.estado,
}))
const etiquetasVisiveis = computed(() => etiquetasFiltradas.value.slice(0, quantasEtiquetas.value))
const etiquetasQueFaltamMostrar = computed(
  () => Math.max(0, etiquetasFiltradas.value.length - etiquetasVisiveis.value.length))
const contagemDeEtiquetas = computed(() => fraseDaContagem(
  etiquetasFiltradas.value.length, etiquetasDaAba.value.length,
  { um: 'etiqueta gravada', muitos: 'etiquetas gravadas' }))
function mostrarMaisEtiquetas() { quantasEtiquetas.value += DE_CADA_VEZ }

// MUDAR A BUSCA RECOMEÇA A LISTA DO TOPO, pelo mesmo motivo do watch de
// `loteDaEtiqueta`: com o limite crescido de uma busca larga, a busca seguinte
// desenharia 500 linhas de uma vez. O watch NÃO precisa ser profundo porque o
// painel troca o objeto inteiro a cada mudança — é isso que o Vue enxerga.
watch(filtroDeEtiquetas, () => { quantasEtiquetas.value = DE_CADA_VEZ })

// A TELA AVISA ANTES, EM VEZ DE DEIXAR O BANCO DAR A BRONCA. O banco recusa com
// `motivo_obrigatorio` quando falta motivo numa peça com garantia — mas aí a
// pessoa já apertou o botão, digitou a senha e esperou a rede para descobrir que
// faltava um campo que estava na tela o tempo todo.
const motivoEhObrigatorio = computed(
  () => motivoObrigatorio({ temGarantia: apagando.value?.temGarantia }))

// TROCAR DE LOTE RECOMEÇA A LISTA E FECHA A PERGUNTA, pelo mesmo cuidado do
// watch de `loteEscolhido`: a pergunta diz o código de UMA peça, e peça errada
// na pergunta é pior que pergunta nenhuma. E o limite crescido de um lote de 500
// faria o lote seguinte desenhar 500 linhas de uma vez.
watch(loteDaEtiqueta, () => {
  quantasEtiquetas.value = DE_CADA_VEZ
  fecharApagar()
})

function pedirApagarGravacao(pc) {
  apagando.value = {
    codigo: pc.codigo,
    temGarantia: temGarantia(pc.codigo),
    descricao: descricaoDaPeca(pc, loteDaPeca(pc.lote_id)),
  }
  etapaDeApagar.value = 1
  motivoDeApagar.value = ''
  senhaDeApagar.value = ''
  erroDeApagar.value = ''
}

function fecharApagar() {
  apagando.value = null
  etapaDeApagar.value = 1
  motivoDeApagar.value = ''
  // a senha sai da memória junto com a pergunta
  senhaDeApagar.value = ''
  erroDeApagar.value = ''
}

// APAGAR A GRAVAÇÃO DE UMA PEÇA. Quem recusa continua sendo o banco; a tela só
// se adianta nas duas recusas que ela consegue ver daqui (motivo faltando e
// senha), para não fazer a pessoa esperar a rede por um campo em branco.
async function apagarGravacao() {
  const alvo = apagando.value
  if (!alvo || apagarEmVoo.value) return
  erroDeApagar.value = ''

  const motivo = motivoDeApagar.value.trim()
  if (motivoObrigatorio({ temGarantia: alvo.temGarantia }) && !motivo) {
    erroDeApagar.value = fraseDaRecusa('motivo_obrigatorio')
    return
  }
  const senha = senhaDeApagar.value
  if (!senha) { erroDeApagar.value = fraseDaSenha('sem_senha'); return }

  apagarEmVoo.value = true
  try {
    const conferida = await conferirASenha(senha)
    if (!conferida.ok) { erroDeApagar.value = fraseDaSenha(conferida.erro); return }

    const { data, error } = await sbClient.rpc('vessel_desmarcar_gravada',
      // motivo em branco vai NULO, e não string vazia: é o que o banco entende
      // por "não escreveram motivo" (`nullif(trim(...), '')`)
      { p_codigo: alvo.codigo, p_motivo: motivo || null })
    if (error) { adminToast('Não consegui apagar a gravação agora', false); return }
    // a recusa do banco fica DENTRO da pergunta, e não num recado que some: é
    // ali que a pessoa está olhando, e é ali que ela conserta
    if (!data?.ok) { erroDeApagar.value = fraseDaRecusa(data?.motivo, data); return }

    // `tinha_garantia` vem do BANCO, e não do conjunto montado aqui: entre o
    // clique e a resposta, uma cliente pode ter registrado a garantia. Quem
    // sabe a verdade no instante da escrita é quem escreveu.
    const codigo = alvo.codigo
    const eraDeCliente = data.tinha_garantia
    fecharApagar()
    await carregar()
    if (eraDeCliente) {
      avisoDaGarantia.value = `A peça ${codigo} tinha garantia registrada por uma cliente. `
        + 'A garantia CONTINUA VALENDO no código dela — nada foi apagado do lado da cliente. '
        + 'O que mudou é que a peça voltou para a fila de gravação, e a ação ficou na trilha.'
      adminToast('Gravação apagada. Havia garantia de cliente — leia o aviso na tela.')
      return
    }
    adminToast('Gravação apagada. A peça voltou para a fila de gravação.')
  } finally {
    apagarEmVoo.value = false
    // ⚠️ A senha não sobrevive à ação, em nenhum caminho.
    senhaDeApagar.value = ''
  }
}

// O MESMO "Copiado!" do modo do aplicativo, mas por peça: com uma frase só para
// a lista inteira, a pessoa não saberia QUAL endereço foi para a área de
// transferência — e ia costurar a etiqueta errada achando que conferiu.
async function copiarEnderecoDaPeca(codigo) {
  try {
    await navigator.clipboard.writeText(enderecoDaTag(codigo))
    enderecoCopiado.value = codigo
    setTimeout(() => {
      if (enderecoCopiado.value === codigo) enderecoCopiado.value = ''
    }, 1800)
  } catch (e) {
    adminToast('Não consegui copiar — selecione o endereço na mão', false)
  }
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
  // o ✓ (ou o ✗) do lote anterior sob um lote novo é sinal do lote errado, que
  // é pior que sinal nenhum — mesmo motivo do recado logo acima
  sinalDaGravacao.value = ''
  confirmacaoDoGravador.value = null
  // a pergunta de sobrescrever fala de DUAS peças pelo nome; sob um lote novo
  // ela é pergunta do lote errado, que é pior que pergunta nenhuma
  sobrescrita.value = null
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
  // a pergunta diz o nome da bolsa que vai ENTRAR na etiqueta: com a peça da vez
  // trocada por baixo, ela prometeria uma e gravaria outra
  sobrescrita.value = null
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
    // O LOTE QUE A ABA GRAVAR ABRE É O PRIMEIRO COM PEÇA POR GRAVAR, e não o
    // mais recente: com o lote de ontem já encerrado, a aba abria numa fila
    // vazia dizendo "nada a fazer aqui" com trinta etiquetas esperando no lote
    // de baixo. Sem nenhum pendente, cai no mais recente — que é o que o
    // seletor mostra para quem veio desfazer uma baixa.
    if (!loteEscolhido.value && lotes.value.length) {
      const pendente = lotes.value.find((l) => !estadoDoLote(pecasDoLote(l.id)).encerrado)
      loteEscolhido.value = (pendente || lotes.value[0]).id
    }
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
  // `fecharExcluir()` e não `excluindo.value = null`: abrir o editor com a
  // pergunta de excluir pela metade deixaria a senha digitada viva na memória
  // da tela, esperando o próximo clique.
  fecharExcluir()
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
  // toda pergunta recomeça da primeira etapa, com o campo de senha limpo: uma
  // pergunta que abre já na etapa 2, com a senha de antes escrita, é um clique
  // de distância de apagar o lote errado
  etapaDeExcluir.value = 1
  senhaDaExclusao.value = ''
  erroDaSenha.value = ''
}

function fecharExcluir() {
  excluindo.value = null
  etapaDeExcluir.value = 1
  // a senha sai da memória junto com a pergunta
  senhaDaExclusao.value = ''
  erroDaSenha.value = ''
}

// ── CONFERIR A SENHA DE QUEM ESTÁ LOGADO, NO SERVIDOR ─────────────────────
//
// PASSA PELA EDGE `conferir-senha`, e NÃO por `sbClient.auth.signInWithPassword`
// aqui na tela. O motivo está escrito no cabeçalho da própria edge e já custou
// caro na Frota: o único jeito de conferir senha pelo cliente é o
// `signInWithPassword`, e ele TROCA A SESSÃO — token novo, com a pergunta e o
// lote pela metade na tela. A edge descobre quem é a pessoa pelo TOKEN (nunca
// por e-mail vindo do cliente, senão isto vira um oráculo para testar senha dos
// outros), refaz o login num cliente isolado que morre com a função, e devolve
// só sim ou não. Ela também conta as tentativas e bloqueia por dez minutos.
//
// ⚠️ ISTO É FRICÇÃO, NÃO COFRE. Ver o comentário de `fraseDaSenha` em lotes.js:
// quem manda de verdade é `is_vessel_admin()` por dentro da função do banco.
async function conferirASenha(senha) {
  if (!senha) return { ok: false, erro: 'sem_senha' }
  try {
    const { data, error } = await sbClient.functions.invoke('conferir-senha', { body: { senha } })
    if (error) {
      // A edge responde 429 (bloqueado), 401 (sem sessão) e 400 (sem senha) FORA
      // do 2xx, e o supabase-js transforma isso em `error` com `data` NULO. Lendo
      // o motivo só do `data`, "bloqueado por dez minutos" apareceria como
      // "senha incorreta" e a pessoa tentaria de novo sem parar.
      const detalhe = await error.context?.json?.().catch(() => null)
      return { ok: false, erro: detalhe?.erro || 'falha_interna' }
    }
    if (!data?.ok) return { ok: false, erro: data?.erro || 'falha_interna' }
    return { ok: true }
  } catch (e) {
    // falha em conferir é senha RECUSADA, nunca senha concedida por acidente
    return { ok: false, erro: 'falha_interna' }
  }
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
//
// A SENHA VEM ANTES DA PRIMEIRA ESCRITA, e o erro dela é DIFERENTE do erro da
// exclusão: senha errada não apagou nada e se resolve ali mesmo, no campo, sem
// fechar a pergunta. Recusa do banco fecha a pergunta, porque apertar de novo
// traria a mesma resposta.
async function excluirLote(id) {
  if (exclusaoDeLoteEmVoo.value) return
  const senha = senhaDaExclusao.value
  erroDaSenha.value = ''
  if (!senha) { erroDaSenha.value = fraseDaSenha('sem_senha'); return }
  exclusaoDeLoteEmVoo.value = true
  try {
    const conferida = await conferirASenha(senha)
    if (!conferida.ok) { erroDaSenha.value = fraseDaSenha(conferida.erro); return }

    const { data, error } = await sbClient.rpc('vessel_excluir_lote', { p_lote: id })
    if (error) { adminToast('Não consegui excluir agora', false); return }
    if (!data?.ok) { fecharExcluir(); adminToast(fraseDaRecusa(data?.motivo, data), false); return }
    fecharExcluir()
    await carregar()
    adminToast(`Lote excluído, com ${data.excluidas} etiqueta(s).`)
  } finally {
    exclusaoDeLoteEmVoo.value = false
    // ⚠️ A SENHA NÃO SOBREVIVE À AÇÃO, em nenhum caminho — nem no que deu certo,
    // nem no que falhou. Ela nunca esteve em `localStorage` e não fica na
    // memória da tela esperando o próximo clique.
    senhaDaExclusao.value = ''
  }
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
    if (!data?.ok) { adminToast('Sem permissão para marcar', false); avisarNaTela('falha'); return false }
    // atualiza só a peça, sem recarregar tudo: a equipe está gravando em
    // sequência e uma recarga inteira a cada etiqueta trava o ritmo
    const alvo = pecas.value.find((p) => p.codigo === codigo)
    if (alvo) alvo.gravada_em = new Date().toISOString()
    textoCopiar.value = 'Copiar endereço'
    // O ✓ NASCE AQUI, e não no chamador: este é o único ponto que sabe se o
    // BANCO confirmou. Acendendo lá em cima, o "Gravei essa" do modo do
    // aplicativo ficaria sem sinal nenhum — e ele é o modo do iPhone.
    avisarNaTela('ok')
    return true
  } catch (e) {
    adminToast('Não consegui marcar agora', false)
    avisarNaTela('falha')
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
      // A ETIQUETA JÁ TEM OUTRA PEÇA. Antes isto era o fim da linha: "separe ela
      // e pegue uma etiqueta em branco". O dono pediu para OFERECER a
      // sobrescrita — o caso comum é a etiqueta que foi gravada e ficou de lado
      // antes de costurar.
      //
      // A DECISÃO NÃO CABE AQUI DENTRO. Ela vira uma pergunta na tela, com o
      // NOME DA BOLSA que vai perder a identidade, e a gravação física só
      // acontece em `sobrescreverEtiqueta`, depois de o banco confirmar.
      const codigoAntigo = codigoDoEndereco(antes)
      const antiga = pecas.value.find((pa) => pa.codigo === codigoAntigo) || null
      sobrescrita.value = {
        codigoAntigo,
        codigoNovo: peca.codigo,
        // a peça antiga pode não estar nesta tela (lote excluído, banco de
        // outro ambiente): `descricaoDaPeca` diz isso em vez de inventar modelo
        descricaoAntiga: descricaoDaPeca(antiga || { codigo: codigoAntigo },
          antiga ? loteDaPeca(antiga.lote_id) : null),
        descricaoNova: descricaoDaPeca(peca, loteAtual.value),
        temGarantia: temGarantia(codigoAntigo),
      }
      destinoDaAntiga.value = 'fila'
      motivoDaSobrescrita.value = ''
      erroDaSobrescrita.value = ''
      recadoNfc.value = 'PARE: esta etiqueta já tem OUTRA peça gravada. '
        + 'Escolha abaixo o que fazer com ela antes de gravar por cima.'
      // este caminho não passa por `marcarGravada`, então acende o sinal aqui
      avisarNaTela('falha')
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
      avisarNaTela('falha')
      return
    }

    if (travarDepois.value) await gravador.travar()
    recadoNfc.value = await marcarGravada(peca.codigo)
      ? `Peça ${peca.numero_na_serie} pronta. Pegue a próxima etiqueta.`
      : `Gravei a etiqueta da peça ${peca.numero_na_serie}, mas não consegui marcá-la `
        + 'como pronta. NÃO pegue outra etiqueta: encoste esta de novo.'
  } catch (erro) {
    recadoNfc.value = traduzirFalha(erro)
    avisarNaTela('falha')
  } finally {
    gravando.value = false
  }
}

// ── SOBRESCREVER UMA ETIQUETA QUE JÁ TEM OUTRA PEÇA ───────────────────────
//
// A pergunta aberta, ou null. Guarda o que foi CONTADO no momento da leitura:
// os dois códigos, a descrição de cada bolsa e se a antiga tem garantia.
const sobrescrita = ref(null)
// A decisão do dono sobre a peça ANTIGA. Ele pediu os dois caminhos: 'fila' é o
// caso normal (etiqueta gravada que ficou de lado antes de costurar) e 'baixa' é
// a peça que não vira bolsa. Nasce em 'fila' porque é o caso comum.
const destinoDaAntiga = ref('fila')
// No destino 'baixa' isto guarda uma CHAVE de MOTIVOS_DE_BAIXA; no 'fila', o
// texto livre que a garantia exige. Trocar de destino limpa o campo, senão a
// chave 'extraviada' viraria o "motivo escrito" de uma peça que voltou à fila.
const motivoDaSobrescrita = ref('')
const erroDaSobrescrita = ref('')

watch(destinoDaAntiga, () => { motivoDaSobrescrita.value = '' })

const motivoDaSobrescritaObrigatorio = computed(() => motivoObrigatorio({
  temGarantia: sobrescrita.value?.temGarantia, destino: destinoDaAntiga.value,
}))

function desistirDaSobrescrita() {
  sobrescrita.value = null
  motivoDaSobrescrita.value = ''
  erroDaSobrescrita.value = ''
  recadoNfc.value = 'Não sobrescrevi nada. Separe esta etiqueta e pegue uma em branco.'
}

// ⚠️ A ORDEM AQUI É A REGRA INTEIRA: O BANCO PRIMEIRO, A ETIQUETA DEPOIS.
//
// Gravando primeiro e registrando depois, uma falha na segunda metade — rede
// caindo, aba fechada, token expirando — deixaria a peça ANTIGA marcada como
// gravada com a etiqueta que acabou de ser reciclada, e a NOVA sem marca
// nenhuma: duas bolsas com a mesma identidade. Nesta ordem, o pior caso é a
// etiqueta ficar com o endereço velho e o banco já dizer a verdade nova — e isso
// a tela CONTA, com o caminho do conserto escrito.
//
// A troca inteira é UMA chamada só (`vessel_sobrescrever_etiqueta`), e não duas
// da tela, porque entre "desmarcar a antiga" e "marcar a nova" haveria uma
// janela. O corpo de uma função plpgsql é uma transação só.
async function sobrescreverEtiqueta() {
  const pedido = sobrescrita.value
  if (!pedido || gravando.value) return
  erroDaSobrescrita.value = ''

  const destino = destinoDaAntiga.value
  const motivo = motivoDaSobrescrita.value.trim()
  // A TELA COBRA ANTES DO BANCO, pelo mesmo motivo da aba Etiquetas: o banco
  // recusaria com `motivo_obrigatorio`/`motivo_invalido`, mas só depois de a
  // pessoa esperar a rede por um campo que estava na tela o tempo todo.
  if (motivoObrigatorio({ temGarantia: pedido.temGarantia, destino }) && !motivo) {
    erroDaSobrescrita.value = destino === 'baixa'
      ? 'Escolha o motivo da baixa da peça antiga: sem ele o banco não aceita a baixa.'
      : fraseDaRecusa('motivo_obrigatorio')
    return
  }

  const gravador = criarGravador()
  if (!gravador) { gravaPorNfc.value = false; return }

  gravando.value = true
  // A recarga no fim só acontece se o BANCO tiver mudado. Recarregando sempre,
  // uma recusa (que não mudou nada) dispararia uma leitura que pode falhar — e
  // `carregar()` pinta a tela inteira de erro, levando junto a frase da recusa
  // que a pessoa precisa ler.
  let oBancoMudou = false
  try {
    // 1. O BANCO. Nada foi tocado na etiqueta ainda.
    const { data, error } = await sbClient.rpc('vessel_sobrescrever_etiqueta', {
      p_codigo_antigo: pedido.codigoAntigo,
      p_codigo_novo: pedido.codigoNovo,
      p_destino: destino,
      // motivo em branco vai NULO, como o banco entende (`nullif(trim(...), '')`)
      p_motivo: motivo || null,
    })
    if (error) {
      erroDaSobrescrita.value = 'Não consegui registrar a troca agora. '
        + 'NADA foi gravado na etiqueta — ela continua com a peça antiga. Tente de novo.'
      avisarNaTela('falha')
      return
    }
    if (!data?.ok) {
      erroDaSobrescrita.value = fraseDaRecusa(data?.motivo, data)
      avisarNaTela('falha')
      return
    }

    // 2. SÓ AGORA A ETIQUETA. A pergunta sai da tela: o que ela perguntava já
    // foi decidido, e o banco já mudou.
    oBancoMudou = true
    const eraDeCliente = data.tinha_garantia
    sobrescrita.value = null
    recadoNfc.value = 'Registrado. Encoste a MESMA etiqueta de novo e segure parado…'
    await gravador.gravar(enderecoDaTag(pedido.codigoNovo))

    // 3. LER DEPOIS: a prova de que gravou é a etiqueta devolver
    const depois = await gravador.lerUmaVez()
    if (conferirLeitura(depois, pedido.codigoNovo) !== 'confere') {
      recadoNfc.value = avisoDeMeiaSobrescrita(pedido)
      avisarNaTela('falha')
      return
    }
    if (travarDepois.value) await gravador.travar()

    recadoNfc.value = `Etiqueta sobrescrita. Agora ela é ${pedido.descricaoNova}.`
      + (destino === 'baixa'
        ? ` A peça antiga saiu da fila, baixada como ${rotuloDoMotivo(motivo)}.`
        : ' A peça antiga voltou para a fila e espera outra etiqueta.')
    avisarNaTela('ok')
    if (eraDeCliente) {
      avisoDaGarantia.value = `A peça ${pedido.codigoAntigo} tinha garantia registrada por uma `
        + 'cliente. A garantia CONTINUA VALENDO no código dela — nada foi apagado do lado da '
        + 'cliente. O que mudou é que a etiqueta dela foi reciclada, e a ação ficou na trilha.'
      adminToast('Etiqueta sobrescrita. Havia garantia de cliente — leia o aviso na aba Etiquetas.')
    }
  } catch (erro) {
    // Falha do chip DEPOIS de o banco já ter registrado: a tela não pode dizer
    // "tente de novo" e ficar por isso, porque o banco já mudou.
    recadoNfc.value = `${traduzirFalha(erro)} ${avisoDeMeiaSobrescrita(pedido)}`
    avisarNaTela('falha')
  } finally {
    gravando.value = false
    // a lista tem de refletir o que o banco fez — inclusive quando a etiqueta
    // falhou DEPOIS de o registro entrar, que é o caso que a tela precisa contar
    if (oBancoMudou) await carregar()
  }
}

// O RECADO DA METADE QUE FALTOU. A troca ficou registrada e a etiqueta não. A
// tela nunca mente: ela diz exatamente o que sobrou e por onde se conserta.
function avisoDeMeiaSobrescrita(pedido) {
  return `A TROCA JÁ FOI REGISTRADA, mas a etiqueta NÃO recebeu o endereço novo: `
    + `ela ainda abre a peça ${pedido.codigoAntigo}. No sistema, ${pedido.descricaoNova} `
    + 'já consta como gravada. Para consertar: vá à aba Etiquetas, apague a gravação dessa '
    + 'peça — ela volta para a fila — e grave esta MESMA etiqueta de novo.'
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

// A LISTA INTEIRA DO LOTE, para arquivar junto da ordem de produção.
// Função NOVA, e não um remendo em `baixarListaDoGravador` logo acima: aquela
// baixa a FILA DO QUE FALTA e alimenta o gravador de mesa — misturar as
// gravadas nela mandaria a máquina regravar etiqueta que já está dentro de uma
// bolsa. São duas listas de propósito.
function baixarListaDoLote(l) {
  const doLote = pecasDoLote(l.id)
  if (!doLote.length) { adminToast('Este lote não tem peça nenhuma', false); return }
  const csv = linhasDaListaDoLote(doLote, { formatarData: dataCurta })
  // BOM na frente: sem ele o Excel abre "Mônaco" como "MÃ´naco"
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  // A DATA DE FABRICAÇÃO VAI NO NOME porque dois lotes do MESMO modelo baixavam
  // com o mesmo nome, e o segundo virava "(1)" na pasta de Downloads — ou pior,
  // substituía o primeiro. O arquivo é o registro de qual link foi para qual
  // bolsa: nome repetido aqui é registro de produção perdido.
  a.download = `lote-${l.modelo || 'sem-modelo'}-${l.fabricado_em || 'sem-data'}-completo.csv`
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
/* ── O MENU DE ABAS ────────────────────────────────────────────────────────
   AQUI NÃO HÁ REGRA DE `.abas` NENHUMA, E É DE PROPÓSITO.
   A barra é a `.abas` GLOBAL de `estilos-globais.css` — a mesma da Frota, do
   Patrimônio e dos Acessos: mesma altura, mesmo peso de fonte, mesmo
   sublinhado, e os 40px de alvo de toque que foram corrigidos para as quatro
   telas em 19/08.

   A entrega anterior escreveu uma barra própria aqui (`.abas-barra` com fundo e
   moldura, `flex-wrap:nowrap`, `overflow-x:auto`) e o dono viu na hora que esta
   tela tinha ficado diferente das irmãs. O `nowrap` era o que criava o problema
   que o resto dos overrides existia para consertar: a barra global QUEBRA em
   duas linhas no celular, e com isso não transborda, não rola e não esconde a
   primeira aba. Regra local aqui é o caminho de volta para aquele defeito.

   Os dois únicos acréscimos são coisas que a barra global não tem porque
   nenhuma tela irmã precisou: o número do passo e o separador. Nenhum dos dois
   mexe em altura, fonte ou sublinhado. */
/* O número do passo, colado no nome da aba. Herda cor, peso e tamanho do botão
   — pintá-lo de outra cor faria o "1" competir com "LOTES" pela leitura. */
.au-aba-n{margin-right:var(--sp-1);font-variant-numeric:tabular-nums;}
/* O SEPARADOR ENTRE OS PASSOS E AS CONSULTAS. Um `·` discreto, com a cor de
   texto secundário — e não uma barra desenhada, que viraria mais uma linha
   brigando com o sublinhado da aba ativa. Ele é enfeite de leitura, então sai
   da árvore de acessibilidade (`aria-hidden`) e não recebe toque. */
.au-abas-sep{align-self:center;padding:0 var(--sp-1);color:var(--muted);font-size:max(9px, calc(13px * var(--escala-texto, 1)));user-select:none;pointer-events:none;}

/* A AJUDA CURTA DA ABA, logo abaixo da barra. Ela fica sempre à vista: guia
   único ninguém reabre. Texto secundário, largura de leitura. */
.au-ajuda{font-family:var(--fonte-principal);font-size:max(9px, calc(12.5px * var(--escala-texto, 1)));color:var(--muted);line-height:1.6;padding:var(--sp-3) 24px 0;max-width:680px;overflow-wrap:anywhere;}

.au-vazio,.au-erro,.au-pronto{font-family:var(--fonte-principal);font-size:max(9px, calc(13px * var(--escala-texto, 1)));color:var(--muted);padding:28px 24px;line-height:1.7;max-width:620px;}
.au-erro{color:var(--red);}
.au-pronto{color:var(--accent);}
.au-instrucao{font-family:var(--fonte-principal);font-size:max(9px, calc(12.5px * var(--escala-texto, 1)));color:var(--muted);line-height:1.7;padding:16px 24px 0;max-width:620px;}
.au-secao{font-family:var(--fonte-principal);font-size:max(9px, calc(11px * var(--escala-texto, 1)));font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--text);padding:24px 24px 4px;}

.au-topo-acao{display:flex;gap:10px;align-items:center;padding:18px 24px 0;flex-wrap:wrap;}
/* Medido a 375px NESTA rodada: o campo de busca da aba Garantias saía com 37px
   de altura e 13px de fonte — abaixo dos 40px de alvo de dedo e dos 16px abaixo
   dos quais o iOS dá zoom ao focar. Ele é anterior a esta entrega e nunca tinha
   sido medido; o painel de busca das outras três abas já nasce nos 40/16. */
.au-busca{flex:1;min-width:180px;box-sizing:border-box;min-height:40px;font-family:var(--fonte-principal);font-size:max(16px, calc(16px * var(--escala-texto, 1)));padding:9px 12px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);}

/* 40px DE ALTURA NA REGRA-BASE, e não em cada bloco. Ela já estava repetida em
   quatro lugares (`.au-gravacao .au-botao`, `.au-card .au-botao`, o guia e as
   ações dele) porque o botão nascia com 35,5px — medido a 375px. Cada bloco novo
   desta tela precisava lembrar de repetir, e o de agora não lembrou: o "Entendi"
   do aviso de garantia e o "Mostrar mais" da aba Etiquetas nasceram com 37px.
   Dedo não acerta menos que 40 (PADRAO item 6). */
.au-botao{font-family:var(--fonte-principal);font-size:max(9px, calc(11px * var(--escala-texto, 1)));font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--sobre-cor);background:var(--accent);border:1px solid var(--accent);border-radius:6px;padding:10px 16px;min-height:40px;box-sizing:border-box;cursor:pointer;}
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
  /* `.abas` saiu desta lista: o recuo de celular da barra é o do GLOBAL, que
     usa 8px abaixo de 400px. Repetir 16px aqui era um dos overrides que faziam
     esta tela ficar diferente das irmãs. */
  .au-topo-acao,.au-lista,.au-campo,.au-gravacao,.au-acoes,.au-baixadas-lote{padding-left:16px;padding-right:16px;}
  .au-vazio,.au-erro,.au-instrucao,.au-secao,.au-ajuda{padding-left:16px;padding-right:16px;}
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
/* O GUIA VIROU DE BANCADA e passou de 5 telas de texto para 11, algumas com
   quatro casos dentro. Por isso a caixa ganhou teto de altura e o MIOLO rola
   dentro dela — nunca a página atrás (PADRAO item 4). `dvh` e nunca `vh`: no
   celular o `vh` é calculado com a barra de endereço escondida, e o fim do
   texto fica atrás dela. O `overscroll-behavior`/`touch-action` do par
   fundo+caixa é o que impede o dedo de arrastar a tela por dentro do modal. */
.au-guia{
  width:100%; max-width:420px; max-height:88dvh; padding:var(--sp-4);
  display:flex; flex-direction:column;
  border-radius:var(--radius-lg); border:1px solid var(--border);
  background:var(--surface); color:var(--text);
  overscroll-behavior:contain; touch-action:pan-y;
}
.au-guia-conta{margin:0 0 var(--sp-1); font-size:12px; color:var(--muted); letter-spacing:.06em}
.au-guia-titulo{margin:0 0 var(--sp-2); font-size:19px; line-height:1.25}
/* O cabeçalho e os botões não rolam junto: quem está no meio de uma tela longa
   precisa do "Continuar" na mão o tempo todo. */
.au-guia-miolo{flex:1 1 auto; min-height:0; overflow-y:auto; overscroll-behavior:contain; -webkit-overflow-scrolling:touch}
.au-guia-texto{margin:0 0 var(--sp-3); font-size:15px; line-height:1.55}
/* OS ITENS SÃO O QUE SEPARA GUIA DE BANCADA DE TELA DE TEXTO: o rótulo se acha
   com o olho, de pé, com o celular na mão. `<dl>` porque é isso que eles são —
   um termo e a explicação dele. */
.au-guia-itens{margin:0 0 var(--sp-3)}
.au-guia-itens dt{
  margin-top:var(--sp-3); font-family:var(--fonte-principal);
  font-size:max(9px, calc(13px * var(--escala-texto, 1)));
  font-weight:700; color:var(--text); overflow-wrap:anywhere;
}
.au-guia-itens dd{
  margin:var(--sp-1) 0 0; font-size:max(9px, calc(13.5px * var(--escala-texto, 1)));
  line-height:1.5; color:var(--muted); overflow-wrap:anywhere;
}
/* os botoes embaixo e lado a lado; a 375px eles empilham em vez de encolher,
   porque alvo de toque abaixo de 40px e defeito */
.au-guia-acoes{display:flex; gap:var(--sp-2); flex-wrap:wrap; padding-top:var(--sp-3)}
.au-guia-acoes .au-botao{flex:1 1 120px; min-height:40px}

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
/* O "Cancelar"/"Não sobrescrever" destas caixas mede 4,46 de contraste no tema
   escuro com o `--accent` puro — reprova por pouco, e "por pouco" continua
   sendo reprovado. `--accent-forte` é o par que o PADRAO manda usar para cor
   sobre o próprio tom aguado, e ele já vem medido. Medido aqui: 4,46 → 6,3 no
   escuro, 5,87 → 9,0 no claro. Vale para as CINCO perguntas desta tela, não só
   para as novas. */
.au-confirma .au-botao.secundario{color:var(--accent-forte)}
/* 16px no campo nao e estetica: abaixo disso o iOS da zoom ao focar e a tela
   salta na cara de quem esta digitando a senha. A regra-base do `.au-campo
   input` desta tela e de 14px — sem esta linha o campo de senha nascia com ela.
   40px de altura porque dedo nao acerta menos que isso. */
.au-confirma input{min-height:40px; box-sizing:border-box; font-size:max(16px, calc(16px * var(--escala-texto, 1)))}
/* A RECUSA DA SENHA. Segue o desenho de aviso do PADRAO-DA-CENTRAL: a cor e o
   SINAL, o texto fica em `--text` para ser lido. O `--red` como letra sobre o
   fundo desta caixa mede 4,50 no tema escuro — passa raspando, e "por pouco"
   continua sendo por pouco. */
.au-recusa{
  margin:var(--sp-2) 0 0; padding:var(--sp-2) var(--sp-3);
  border-radius:var(--radius-md);
  background:color-mix(in srgb, var(--red) 12%, var(--surface));
  border:1px solid color-mix(in srgb, var(--red) 38%, var(--surface));
  color:var(--text); font-family:var(--fonte-principal);
  font-size:max(9px, calc(13px * var(--escala-texto, 1)));
  line-height:1.45; overflow-wrap:anywhere;
}
/* A lista das baixadas vive FORA do `.au-gravacao`, entao carrega o proprio
   recuo. O `@media` la em cima passa este bloco para 16px junto com os outros. */
.au-baixadas-lote{padding:0 24px; max-width:620px}
/* O aviso da garantia é o único `.au-confirma` que vive solto na tela, e não
   dentro de um cartão: ele carrega o próprio recuo, como o bloco acima. O
   `@media` do fim do arquivo o passa para 16px junto com os outros. */
.au-aviso-garantia{margin:var(--sp-4) 24px 0; max-width:620px}
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
/* ── AS PEÇAS DE UM LOTE ──────────────────────────────────────────────────
   Cor só de token e espaço só da escala (PADRAO-DA-CENTRAL, itens 2 e 7). O
   bloco reaproveita `.selo` das classes prontas — estado com cor inventada é o
   que o padrão proíbe, e o selo já vem com contraste medido nos dois temas. */
.au-pecas{
  margin-top:var(--sp-3); padding:var(--sp-3);
  border:1px solid var(--border); border-radius:var(--radius-md);
  background:var(--surface2);
}
.au-pecas-topo{
  display:flex; align-items:center; justify-content:space-between;
  gap:var(--sp-3); flex-wrap:wrap;
}
.au-pecas-conta{
  font-family:var(--fonte-principal);
  font-size:max(9px, calc(12px * var(--escala-texto, 1)));
  color:var(--muted); overflow-wrap:anywhere;
}
/* A LISTA ROLA DENTRO DA PRÓPRIA CAIXA. Um lote pode ter 500 peças: sem esta
   altura, abrir um lote empurraria os outros lotes para 50 telas abaixo e o
   cartão viraria a página inteira. `dvh` e nunca `vh` — no celular o `vh` é
   calculado com a barra de endereço escondida, e o fim fica atrás dela. */
.au-pecas-lista{
  list-style:none; margin:var(--sp-3) 0 0; padding:0;
  max-height:60dvh; overflow-y:auto; overscroll-behavior:contain;
}
.au-peca{padding:var(--sp-2) 0; border-bottom:1px solid var(--border)}
.au-peca:last-child{border-bottom:0}
.au-peca-topo{display:flex; align-items:center; gap:var(--sp-2); flex-wrap:wrap}
.au-peca-n{
  font-family:var(--fonte-principal); font-weight:700;
  font-size:max(9px, calc(13px * var(--escala-texto, 1)));
  color:var(--text); white-space:nowrap;
}
.au-peca-cod{
  font-size:max(9px, calc(13px * var(--escala-texto, 1)));
  color:var(--text); overflow-wrap:anywhere;
}
.au-peca-estado{
  margin:var(--sp-1) 0 0; font-family:var(--fonte-principal);
  font-size:max(9px, calc(12px * var(--escala-texto, 1)));
  color:var(--muted); line-height:1.45; overflow-wrap:anywhere;
}
/* O endereço é o que se confere letra por letra na hora de costurar: fonte de
   dados e quebra garantida, como o `.au-endereco` da aba Gravar. */
.au-peca-end{
  margin-top:var(--sp-1); font-family:var(--fonte-dados);
  font-size:max(9px, calc(12px * var(--escala-texto, 1)));
  line-height:1.5; color:var(--text); word-break:break-all; user-select:all;
}
.au-peca-links{display:flex; gap:var(--sp-3); flex-wrap:wrap}
/* Alvo de dedo de 40px sem virar botão: cresce a área, o texto continua link
   (PADRAO item 6). O `text-decoration` existe porque um deles é `<a>`. */
.au-peca-botao{
  display:inline-flex; align-items:center; min-height:40px; margin-top:0;
  text-decoration:none;
}
.au-pecas > .au-botao{margin-top:var(--sp-3)}
/* Medido a 375px: o "Gravar as etiquetas deste lote →" saía com 13px de altura
   — alvo de dedo abaixo de 40px é defeito (PADRAO item 6), e este é o botão
   principal do cartão. Cresce a área, o texto continua link. É o único `.au-link`
   filho DIRETO do cartão; os de dentro dos blocos já têm a regra deles. */
.au-card > .au-link{display:inline-flex; align-items:center; min-height:40px}

/* ── A GRAVAÇÃO COM VIDA ──────────────────────────────────────────────────
   O botão só trocava de texto para "Encoste a etiqueta…". Quem grava está de pé
   na bancada, com a bolsa numa mão e o celular na outra: pulsa enquanto espera,
   ✓ que cresce quando confirma, tremor quando falha.
   Cor só de token e espaço só da escala (PADRAO-DA-CENTRAL, itens 2 e 7). */
.au-farol{padding:var(--sp-4) 24px 0; max-width:620px}
.au-barra{
  height:8px; border-radius:999px; box-sizing:border-box;
  background:var(--surface2); border:1px solid var(--border); overflow:hidden;
}
.au-barra-cheia{display:block; height:100%; background:var(--accent); transition:width .3s ease}
.au-barra-texto{
  margin:var(--sp-2) 0 0; font-family:var(--fonte-principal);
  font-size:max(9px, calc(12px * var(--escala-texto, 1)));
  color:var(--muted); overflow-wrap:anywhere;
}
/* O bloco do sinal é o desenho do PADRAO para aviso: a cor é o SINAL, e o texto
   fica em `--text` para ser lido. */
.au-sinal{
  display:flex; align-items:center; gap:var(--sp-3);
  margin-top:var(--sp-3); padding:var(--sp-3);
  border-radius:var(--radius-md); border:1px solid var(--border);
  background:var(--surface2); color:var(--text);
}
.au-sinal-texto{
  font-family:var(--fonte-principal);
  font-size:max(9px, calc(15px * var(--escala-texto, 1)));
  line-height:1.4; overflow-wrap:anywhere;
}
.au-sinal-esperando{border-color:color-mix(in srgb, var(--accent) 38%, var(--surface))}
.au-sinal-ok{border-color:color-mix(in srgb, var(--green) 38%, var(--surface))}
.au-sinal-falha{border-color:color-mix(in srgb, var(--red) 38%, var(--surface))}
/* O ANEL QUE PULSA enquanto a etiqueta não encosta. Ele é DESENHADO mesmo
   parado: sem animação continua um anel na cor da ação, ao lado do texto. */
.au-anel{
  flex:none; width:30px; height:30px; border-radius:50%; box-sizing:border-box;
  border:3px solid var(--accent);
  animation:au-pulsa 1.3s ease-in-out infinite;
}
.au-marca-ok{flex:none; color:var(--green); animation:au-cresce .35s cubic-bezier(.22,1,.36,1) both}
.au-marca-erro{flex:none; color:var(--red); animation:au-treme .42s ease-in-out}
@keyframes au-pulsa{0%,100%{transform:scale(.86); opacity:.55} 50%{transform:scale(1); opacity:1}}
@keyframes au-cresce{from{transform:scale(.3); opacity:0} to{transform:scale(1); opacity:1}}
@keyframes au-treme{
  0%,100%{transform:translateX(0)} 20%{transform:translateX(-5px)}
  40%{transform:translateX(5px)} 60%{transform:translateX(-3px)} 80%{transform:translateX(3px)}
}
/* QUEM DESLIGA ANIMAÇÃO NO SISTEMA COSTUMA TER MOTIVO — e nesses casos o estado
   aparece sem se mexer, mas APARECE: o anel continua desenhado e opaco, o ✓
   continua verde e inteiro, o ✗ continua vermelho, a barra continua na medida
   certa, e o texto continua dizendo o que aconteceu. Sai o movimento, fica o
   sinal. `animation:none` num `@keyframes` de entrada exige que o estado FINAL
   já seja o estado de repouso do elemento — por isso o `opacity:1` abaixo. */
@media (prefers-reduced-motion: reduce){
  .au-anel, .au-marca-ok, .au-marca-erro{animation:none; opacity:1; transform:none}
  .au-barra-cheia{transition:none}
}

/* ── A FILA AO REDOR DA PEÇA DA VEZ ───────────────────────────────────────
   Cor só de token e espaço só da escala (PADRAO-DA-CENTRAL, itens 2 e 7). */
.au-fila{margin-top:var(--sp-4)}
.au-fila-titulo{
  margin:0 0 var(--sp-2); font-family:var(--fonte-principal);
  font-size:max(9px, calc(10px * var(--escala-texto, 1)));
  font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:var(--muted);
}
.au-fila-lista{list-style:none; margin:0; padding:0}
.au-fila-item{
  display:flex; align-items:center; gap:var(--sp-2); flex-wrap:wrap;
  padding:var(--sp-2); border-radius:var(--radius-md);
  border:1px solid transparent;
  font-family:var(--fonte-principal); color:var(--muted);
  font-size:max(9px, calc(13px * var(--escala-texto, 1)));
  overflow-wrap:anywhere;
}
/* A DA VEZ NÃO SE DISTINGUE SÓ PELA COR: ela ganha fundo, borda E o selo escrito
   "Agora". Quem não enxerga a diferença de cor continua sabendo qual é. */
.au-fila-item.atual{
  background:var(--surface2); color:var(--text); font-weight:600;
  border-color:color-mix(in srgb, var(--accent) 38%, var(--surface));
}
.au-fila-n{white-space:nowrap}
.au-fila-cod{font-size:max(9px, calc(12px * var(--escala-texto, 1)))}

/* O `@media` do celular deste bloco fica AQUI, e não no de cima junto com os
   outros: as regras-base acima têm a mesma especificidade e vêm depois no
   arquivo, então lá em cima elas seriam simplesmente ignoradas a 375px.
   Medido no CSS do build antes de escrever esta linha. */
@media (max-width:520px){
  .au-escolha-produto > .au-aviso-menor{padding-left:16px;padding-right:16px;}
  .au-produtos{padding-left:8px;padding-right:8px;}
  /* Medido a 375px: com o `.au-botao{flex:1}` do celular, "Baixar a lista
     inteira" disputava a linha com a contagem e saía quebrado em TRÊS linhas.
     Em coluna cada um tem a sua, e o botão ocupa a largura toda. O `flex:none`
     é obrigatório: em coluna, o `flex:1` cresceria a ALTURA do botão. */
  .au-pecas-topo{flex-direction:column; align-items:stretch;}
  .au-pecas-topo .au-botao{flex:none;}
  /* mesmo recuo dos outros blocos da tela a 375px. Vai AQUI e não no `@media`
     de cima porque a regra-base do `.au-farol` vem depois dele. */
  .au-farol{padding-left:16px; padding-right:16px;}
  /* mesmo motivo: a regra-base do `.au-aviso-garantia` vem depois do `@media`
     de cima, e lá em cima este ajuste seria ignorado em silêncio. */
  .au-aviso-garantia{margin-left:16px; margin-right:16px;}
  /* O MODAL OCUPA A TELA NO CELULAR, com 12px de cada lado (PADRAO item 4) — os
     12px são o `padding` do fundo. `dvh` e nunca `vh`. A regra-base do
     `.au-guia` vem depois do `@media` de cima, então este ajuste também tem de
     morar aqui embaixo. */
  .au-guia{max-width:none; max-height:calc(100dvh - 24px);}
  /* Três botões a 375px não cabem lado a lado sem espremer o alvo do dedo: aqui
     cada um ocupa a linha inteira. */
  .au-guia-acoes .au-botao{flex:1 1 100%;}
}
</style>
