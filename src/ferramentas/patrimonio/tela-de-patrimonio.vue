<template>
  <div class="tela-patrimonio">
    <div class="pat-topbar">
      <!-- O "voltar" sobe UM nível da árvore; só na raiz é que ele sai do módulo.
           Assim o mesmo botão serve pra subir e pra sair, sem o usuário decorar dois. -->
      <button class="pat-back" @click="voltar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>{{ rotuloDoVoltar }}
      </button>
      <span class="pat-title">{{ rotuloDoCaminho(caminho, listas) }}</span>
      <button class="pat-btn-listas" @click="listasAbertas = true" v-if="podeEditar" title="Listas">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
      </button>
      <button class="pat-btn-novo" @click="abrirNovo" v-if="podeCriar" title="Cadastrar bem">+</button>
    </div>

    <div class="pat-resumo">
      <span class="pat-resumo-qtd">{{ resumo.quantidade }}</span>
      <span class="pat-resumo-lab">{{ resumo.quantidade === 1 ? 'item' : 'itens' }}</span>
      <span class="pat-resumo-sep">·</span>
      <span class="pat-resumo-total">{{ formatarValor(resumo.totalCentavos) }}</span>
    </div>

    <div class="pat-busca-wrap">
      <input
        class="pat-busca"
        v-model="filtro.busca"
        type="search"
        inputmode="search"
        placeholder="Buscar por nome, número da etiqueta ou pessoa…"
        aria-label="Buscar bem">
    </div>

    <!-- Trilha do caminho: mostra a descida inteira e permite pular de volta pra
         qualquer nível com um toque, sem subir de um em um. -->
    <div class="pat-trilha rolagem-x" v-if="temCaminho">
      <button class="pat-trilha-item" @click="irParaNivel(0)">Tudo</button>
      <span class="pat-trilha-sep" v-if="caminho.empresaId">›</span>
      <button class="pat-trilha-item" v-if="caminho.empresaId" @click="irParaNivel(1)">{{ nomeDoNivel('empresaId') }}</button>
      <span class="pat-trilha-sep" v-if="caminho.localId">›</span>
      <button class="pat-trilha-item" v-if="caminho.localId" @click="irParaNivel(2)">{{ nomeDoNivel('localId') }}</button>
      <span class="pat-trilha-sep" v-if="caminho.comodoId">›</span>
      <button class="pat-trilha-item atual" v-if="caminho.comodoId">{{ nomeDoNivel('comodoId') }}</button>
    </div>

    <!-- Faixa de filtros: ROLA na horizontal, nunca quebra em linhas.
         Empresa e Local saíram daqui: agora eles SÃO a navegação, e repetir o
         mesmo recorte em dois lugares faria os dois brigarem entre si. -->
    <div class="pat-filtros rolagem-x">
      <select class="pat-select" v-model="filtro.categoriaId" aria-label="Categoria">
        <option value="">Todas as categorias</option>
        <option v-for="c in categorias" :key="c.id" :value="c.id">{{ c.nome }}</option>
      </select>
      <select class="pat-select" v-model="filtro.situacao" aria-label="Situação">
        <option value="">Todas as situações</option>
        <option v-for="s in SITUACOES" :key="s.valor" :value="s.valor">{{ s.rotulo }}</option>
      </select>
      <button class="pat-chip" :class="{ ativo: filtro.semDono }" @click="filtro.semDono = !filtro.semDono">Sem dono</button>
      <button class="pat-chip" v-if="temFiltro" @click="limparFiltros">Limpar</button>
    </div>

    <!-- O zoom vale para o CONTEÚDO (pastas, cartões, tabela), não para a barra
         de cima nem para os filtros: eles precisam continuar do mesmo tamanho e
         no mesmo lugar enquanto a pessoa aumenta a leitura da lista. -->
    <div class="pat-body" :style="{ zoom }">
      <div class="pat-aviso" v-if="carregando">Carregando os bens…</div>

      <div class="pat-aviso pat-aviso-erro" v-else-if="erro">
        Não consegui carregar o patrimônio: {{ erro }}
      </div>

      <!-- Tela vazia que ENSINA: diz o que fazer e por quê, não só "vazio". -->
      <div class="pat-vazio" v-else-if="!bens.length">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
        <h3>Nenhum bem cadastrado ainda</h3>
        <p>
          Aqui fica tudo que a empresa tem: computador, celular, mesa, máquina, carro.
          Cada bem guarda onde está, quanto custou e com quem está — e quando alguém
          é desligado, você sabe na hora o que precisa voltar.
        </p>
        <button class="pat-btn primario" @click="abrirNovo" v-if="podeCriar">Cadastrar o primeiro bem</button>
      </div>

      <div class="pat-vazio" v-else-if="!bensFiltrados.length">
        <h3>Nenhum bem para esses filtros</h3>
        <p>Tente limpar a busca ou escolher outra empresa, local ou situação.</p>
        <button class="pat-btn" @click="limparFiltros">Limpar filtros</button>
      </div>

      <template v-else>
        <!-- Os grupos do nível atual (empresas, depois locais, depois cômodos).
             Só aparecem quando NÃO há busca em texto: buscar é um pedido de
             "ache em tudo", e nesse momento a árvore só atrapalharia. -->
        <div class="pat-grupos" v-if="mostrarGrupos">
          <button class="pat-grupo" v-for="g in grupos" :key="g.id" @click="entrarNoGrupo(g)">
            <span class="pat-grupo-ico" :class="{ orfao: g.id === SEM_VALOR }">
              <svg v-if="g.id !== SEM_VALOR" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              <svg v-else width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </span>
            <span class="pat-grupo-nome">{{ g.nome }}</span>
            <span class="pat-grupo-num">
              {{ g.quantidade }} {{ g.quantidade === 1 ? 'item' : 'itens' }}
              <em v-if="g.totalCentavos">· {{ formatarValor(g.totalCentavos) }}</em>
            </span>
            <span class="pat-grupo-seta">›</span>
          </button>
        </div>

        <!-- Escape em qualquer nível: ver os bens de tudo que está aqui embaixo,
             sem ter que descer até o último cômodo um por um. -->
        <button class="pat-ver-todos" v-if="mostrarGrupos && bensFiltrados.length" @click="verTudoAqui = true">
          Ver os {{ bensFiltrados.length }} itens daqui, sem separar
        </button>

        <div class="pat-secao-bens" v-if="mostrarBens && mostrarGrupos && bensSoltos.length">
          {{ bensSoltos.length }} {{ bensSoltos.length === 1 ? 'item' : 'itens' }} direto aqui
        </div>

        <!-- CELULAR e TABLET: cartões. É a única forma que funciona com uma mão. -->
        <div class="pat-cards" v-if="mostrarBens">
          <button class="pat-card" v-for="bem in bensNaTela" :key="bem.id" @click="abrirBem(bem)">
            <div class="pat-card-topo">
              <span class="pat-card-nome">{{ bem.nome }}</span>
              <span class="pat-pill" :class="classeDaSituacao(bem.situacao)">{{ rotuloDaSituacao(bem.situacao) }}</span>
            </div>
            <div class="pat-card-meta">
              <span v-if="bem.numero">Nº {{ bem.numero }}</span>
              <span v-if="bem.numero" class="pat-card-sep">·</span>
              <span>{{ formatarValor(bem.valor_centavos) }}</span>
            </div>
            <div class="pat-card-linha">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              {{ nomeDoLocal(bem) }}
            </div>
            <div class="pat-card-linha">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              {{ textoDoDono(bem, pessoasById) }}
            </div>
          </button>
        </div>

        <!-- DESKTOP (≥1025px): a tabela larga, que só faz sentido com mouse e tela grande. -->
        <div class="pat-tabela-wrap rolagem-x" v-if="mostrarBens">
          <table class="pat-tabela">
            <thead>
              <tr>
                <th>Nº</th><th>Item</th><th>Categoria</th><th>Empresa</th>
                <th>Local</th><th>Com quem</th><th>Situação</th><th class="pat-dir">Valor</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="bem in bensNaTela" :key="bem.id" @click="abrirBem(bem)">
                <td>{{ bem.numero ?? '—' }}</td>
                <td>{{ bem.nome }}</td>
                <td>{{ nomeDe(categorias, bem.categoria_id) }}</td>
                <td>{{ nomeDe(empresas, bem.empresa_id) }}</td>
                <td>{{ nomeDoLocal(bem) }}</td>
                <td>{{ textoDoDono(bem, pessoasById) }}</td>
                <td><span class="pat-pill" :class="classeDaSituacao(bem.situacao)">{{ rotuloDaSituacao(bem.situacao) }}</span></td>
                <td class="pat-dir">{{ formatarValor(bem.valor_centavos) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>

    <!-- Confirmação da tela. Fica por cima de tudo (inclusive do painel de
         Listas) porque é ela que segura uma ação destrutiva em cascata. -->
    <div class="pat-confirm-fundo" v-if="confirmacao">
      <div class="pat-confirm">
        <p>{{ confirmacao.texto }}</p>
        <p class="pat-confirm-pergunta">Quer apagar mesmo assim?</p>
        <div class="pat-confirm-pe">
          <button class="pat-btn" @click="responderConfirmacao(false)">Cancelar</button>
          <button class="pat-btn perigo" @click="responderConfirmacao(true)">Apagar</button>
        </div>
      </div>
    </div>

    <!-- Zoom: mesma peça flutuante (.zoomctl) que Notícias, Gestão de Tráfego e
         Gestão Comercial já usam — o estilo é global, aqui só o comportamento.
         Some quando um painel está aberto, senão fica boiando sobre o modal. -->
    <div class="zoomctl" v-if="!bemAberto && !listasAbertas">
      <button type="button" @click="mudarZoom(-0.1)" title="Diminuir" aria-label="Diminuir">−</button>
      <span class="zoomctl-val" @click="zoom = 1" title="Restaurar 100%">{{ Math.round(zoom * 100) }}%</span>
      <button type="button" @click="mudarZoom(0.1)" title="Aumentar" aria-label="Aumentar">+</button>
    </div>

    <!-- Ficha do bem. É um painel DENTRO do componente (v-if), não um elemento
         anexado em document.body: assim o CSS escopado alcança sempre. -->
    <div class="pat-ficha-fundo" v-if="bemAberto" @click.self="fecharFicha">
      <div class="pat-ficha">
        <div class="pat-ficha-topo">
          <button class="pat-ficha-fechar" @click="fecharFicha" aria-label="Fechar">✕</button>
          <span class="pat-ficha-titulo">{{ bemAberto.novo ? 'Novo bem' : 'Editar bem' }}</span>
        </div>

        <div class="pat-ficha-corpo">
          <label class="pat-campo">
            <span>Nome do bem</span>
            <input v-model="form.nome" type="text" placeholder="Ex.: Macbook Air M4">
          </label>

          <div class="pat-campo-par">
            <label class="pat-campo">
              <span>Nº da etiqueta</span>
              <input v-model="form.numero" type="text" inputmode="numeric" placeholder="Ex.: 47">
            </label>
            <label class="pat-campo">
              <span>Valor de compra</span>
              <input v-model="form.valor" type="text" inputmode="decimal" placeholder="R$ 0,00">
            </label>
          </div>

          <label class="pat-campo">
            <span>Data da compra <em>(opcional)</em></span>
            <input v-model="form.data_compra" type="date">
          </label>

          <div class="pat-campo-par">
            <label class="pat-campo">
              <span>Empresa</span>
              <select v-model="form.empresa_id">
                <option value="">—</option>
                <option v-for="e in empresas" :key="e.id" :value="e.id">{{ e.nome }}</option>
              </select>
            </label>
            <label class="pat-campo">
              <span>Categoria</span>
              <select v-model="form.categoria_id">
                <option value="">—</option>
                <option v-for="c in categorias" :key="c.id" :value="c.id">{{ c.nome }}</option>
              </select>
            </label>
          </div>

          <!-- Local só mostra os da marca escolhida; cômodo só os do local
               escolhido. Sem isso a pessoa conseguiria pôr um bem da Vessel numa
               sala da Moto Easy — e a árvore da tela principal viraria mentira. -->
          <div class="pat-campo-par">
            <label class="pat-campo">
              <span>Local</span>
              <select v-model="form.local_id" :disabled="!form.empresa_id">
                <option value="">{{ form.empresa_id ? '—' : 'escolha a marca antes' }}</option>
                <option v-for="l in locaisDoForm" :key="l.id" :value="l.id">{{ l.nome }}</option>
              </select>
            </label>
            <label class="pat-campo">
              <span>Cômodo</span>
              <select v-model="form.comodo_id" :disabled="!form.local_id">
                <option value="">{{ form.local_id ? '—' : 'escolha o local antes' }}</option>
                <option v-for="c in comodosDoForm" :key="c.id" :value="c.id">{{ c.nome }}</option>
              </select>
            </label>
          </div>

          <div class="pat-nota" v-if="form.empresa_id && !locaisDoForm.length">
            Esta marca ainda não tem nenhum local cadastrado. Abra <strong>Listas</strong>
            (o botão ≡ lá em cima) e crie um local dentro dela.
          </div>

          <!-- Classificação de 3 níveis que o dono já usava na planilha:
               Categoria (Computadores) → Tipo (Notebook) → Marca/modelo (Macbook).
               Tipo só lista os da categoria escolhida, mesma regra de local/cômodo. -->
          <div class="pat-campo-par">
            <label class="pat-campo">
              <span>Tipo</span>
              <select v-model="form.tipo_id" :disabled="!form.categoria_id">
                <option value="">{{ form.categoria_id ? '—' : 'escolha a categoria antes' }}</option>
                <option v-for="t in tiposDoForm" :key="t.id" :value="t.id">{{ t.nome }}</option>
              </select>
            </label>
            <label class="pat-campo">
              <span>Marca / modelo</span>
              <input v-model="form.marca" type="text" placeholder="Ex.: Macbook">
            </label>
          </div>

          <label class="pat-campo">
            <span>Situação</span>
            <select v-model="form.situacao">
              <option v-for="s in SITUACOES" :key="s.valor" :value="s.valor">{{ s.rotulo }}</option>
            </select>
          </label>

          <label class="pat-campo">
            <span>Com quem está <em>(opcional)</em></span>
            <select v-model="form.pessoa_id">
              <option value="">Ninguém</option>
              <option v-for="p in pessoasAtivas" :key="p.id" :value="p.id">{{ p.nome }}</option>
            </select>
          </label>

          <div class="pat-nota" v-if="avisoDono">{{ avisoDono }}</div>

          <div class="pat-nota" v-if="!bemAberto.novo && bemAberto.dono_texto && !bemAberto.pessoa_id">
            Na planilha este bem estava com <strong>{{ bemAberto.dono_texto }}</strong>, que não
            é um colaborador cadastrado. Escolha a pessoa acima para ligar de vez.
          </div>

          <label class="pat-campo">
            <span>Observação</span>
            <textarea v-model="form.observacao" rows="2" placeholder="Qualquer detalhe que ajude a identificar o bem"></textarea>
          </label>

          <label class="pat-check">
            <input type="checkbox" v-model="form.etiquetado">
            <span>Já está etiquetado</span>
          </label>

          <!-- Histórico de posse: só faz sentido em bem que já existe. -->
          <div class="pat-hist" v-if="!bemAberto.novo">
            <h4>Histórico de posse</h4>
            <div class="pat-hist-vazio" v-if="!historico.length">
              Ninguém pegou este bem ainda. Quando você colocar uma pessoa em "com quem está",
              a troca fica registrada aqui com a data.
            </div>
            <div class="pat-hist-linha" v-for="h in historico" :key="h.id">{{ textoLinhaHistorico(h) }}</div>
          </div>
        </div>

        <div class="pat-ficha-pe">
          <button class="pat-btn" @click="fecharFicha">Cancelar</button>
          <button class="pat-btn perigo" v-if="!bemAberto.novo && podeExcluir" @click="excluirBem">Excluir</button>
          <button class="pat-btn primario" :disabled="salvando" @click="salvarBem">
            {{ salvando ? 'Salvando…' : 'Salvar' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Listas editáveis: o dono cria/renomeia/apaga as opções que aparecem nos
         campos do bem. Sem isto ele ficaria preso nos valores semeados. -->
    <div class="pat-ficha-fundo" v-if="listasAbertas" @click.self="listasAbertas = false">
      <div class="pat-ficha">
        <div class="pat-ficha-topo">
          <button class="pat-ficha-fechar" @click="listasAbertas = false" aria-label="Fechar">✕</button>
          <span class="pat-ficha-titulo">Listas</span>
        </div>
        <div class="pat-ficha-corpo">
          <p class="pat-listas-ajuda">
            Aqui você monta a estrutura: cada <strong>marca</strong> tem seus
            <strong>locais</strong>, e cada local tem seus <strong>cômodos</strong>.
            É a mesma ordem em que você navega os bens.
          </p>

          <!-- Árvore de cadastro, aberta um galho por vez. Fechado por padrão
               pra não despejar 47 caixas de texto na cara de quem só quer
               renomear uma coisa — que era a reclamação. -->
          <div class="pat-arv" v-for="marca in empresas" :key="marca.id">
            <div class="pat-arv-linha nivel1">
              <button class="pat-arv-abrir" @click="alternarGalho('m' + marca.id)" :aria-expanded="galhoAberto('m' + marca.id)">
                {{ galhoAberto('m' + marca.id) ? '▾' : '▸' }}
              </button>
              <input class="pat-lista-nome" :value="marca.nome"
                     @change="renomearItem(DEF_MARCAS, marca, $event.target.value)">
              <button class="pat-lista-del" @click="apagarItem(DEF_MARCAS, marca)" aria-label="Apagar marca">✕</button>
            </div>

            <div class="pat-arv-filhos" v-if="galhoAberto('m' + marca.id)">
              <div class="pat-arv-vazio" v-if="!locaisDaMarca(marca.id).length">
                Nenhum local nesta marca ainda.
              </div>

              <div v-for="local in locaisDaMarca(marca.id)" :key="local.id">
                <div class="pat-arv-linha nivel2">
                  <button class="pat-arv-abrir" @click="alternarGalho('l' + local.id)" :aria-expanded="galhoAberto('l' + local.id)">
                    {{ galhoAberto('l' + local.id) ? '▾' : '▸' }}
                  </button>
                  <input class="pat-lista-nome" :value="local.nome"
                         @change="renomearItem(DEF_LOCAIS, local, $event.target.value)">
                  <button class="pat-lista-del" @click="apagarItem(DEF_LOCAIS, local)" aria-label="Apagar local">✕</button>
                </div>

                <div class="pat-arv-filhos" v-if="galhoAberto('l' + local.id)">
                  <div class="pat-arv-vazio" v-if="!comodosDoLocal(local.id).length">
                    Nenhum cômodo neste local ainda.
                  </div>
                  <div class="pat-arv-linha nivel3" v-for="comodo in comodosDoLocal(local.id)" :key="comodo.id">
                    <span class="pat-arv-vaga"></span>
                    <input class="pat-lista-nome" :value="comodo.nome"
                           @change="renomearItem(DEF_COMODOS, comodo, $event.target.value)">
                    <button class="pat-lista-del" @click="apagarItem(DEF_COMODOS, comodo)" aria-label="Apagar cômodo">✕</button>
                  </div>
                  <div class="pat-arv-linha nivel3">
                    <span class="pat-arv-vaga"></span>
                    <input class="pat-lista-nome" v-model="novoComodo[local.id]"
                           placeholder="novo cômodo aqui…"
                           @keyup.enter="criarFilho(DEF_COMODOS, { local_id: local.id }, novoComodo, local.id)">
                    <button class="pat-btn" @click="criarFilho(DEF_COMODOS, { local_id: local.id }, novoComodo, local.id)">+</button>
                  </div>
                </div>
              </div>

              <div class="pat-arv-linha nivel2">
                <span class="pat-arv-vaga"></span>
                <input class="pat-lista-nome" v-model="novoLocal[marca.id]"
                       placeholder="novo local nesta marca…"
                       @keyup.enter="criarFilho(DEF_LOCAIS, { empresa_id: marca.id }, novoLocal, marca.id)">
                <button class="pat-btn" @click="criarFilho(DEF_LOCAIS, { empresa_id: marca.id }, novoLocal, marca.id)">+</button>
              </div>
            </div>
          </div>

          <div class="pat-arv-linha nivel1">
            <span class="pat-arv-vaga"></span>
            <input class="pat-lista-nome" v-model="novos.patrimonio_empresas"
                   placeholder="nova marca…" @keyup.enter="criarItem(DEF_MARCAS)">
            <button class="pat-btn" @click="criarItem(DEF_MARCAS)">Adicionar marca</button>
          </div>

          <!-- Categoria é lista SOLTA de propósito: ela classifica o que o bem É
               (notebook, mesa, carro), não onde ele está. Aninhar dentro de local
               obrigaria a recadastrar "Computadores" em cada sala. -->
          <div class="pat-lista-bloco">
            <h4>Categorias</h4>
            <p class="pat-listas-ajuda">O que o bem é. Não depende de onde ele está.</p>
            <div class="pat-lista-item" v-for="item in categorias" :key="item.id">
              <input class="pat-lista-nome" :value="item.nome"
                     @change="renomearItem(DEF_CATEGORIAS, item, $event.target.value)">
              <button class="pat-lista-del" @click="apagarItem(DEF_CATEGORIAS, item)" aria-label="Apagar">✕</button>
            </div>
            <div class="pat-lista-novo">
              <input class="pat-lista-nome" v-model="novos.patrimonio_categorias"
                     placeholder="nova categoria…" @keyup.enter="criarItem(DEF_CATEGORIAS)">
              <button class="pat-btn" @click="criarItem(DEF_CATEGORIAS)">Adicionar</button>
            </div>
          </div>
        </div>
        <div class="pat-ficha-pe">
          <button class="pat-btn primario" @click="listasAbertas = false">Pronto</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { sbClient } from '../../compartilhado/conectar-no-banco-de-dados.js'
import { adminToast } from '../../compartilhado/avisos.js'
import { hasPermission } from '../../compartilhado/controle-de-login-e-usuario.js'
import { hojeLocal } from '../../compartilhado/datas.js'
import { formatarValor, parsearValor, fecharEAbrirHistorico } from './patrimonio.js'
import { textoLinhaHistorico } from './patrimonio-lista.js'
import { SITUACOES, rotuloDaSituacao, classeDaSituacao, textoDoDono, avisoDeDonoVazio } from './rotulos-do-bem.js'
import { FILTRO_VAZIO, filtrarBens, resumoDaLista } from './filtro-de-bens.js'
import { SEM_VALOR, agruparBens, bensDoCaminho, rotuloDoCaminho } from './arvore-de-bens.js'

const router = useRouter()

const carregando = ref(true)
const erro = ref('')
const bens = ref([])
const empresas = ref([])
const locais = ref([])
const comodos = ref([])
const categorias = ref([])
const tipos = ref([])
const pessoas = ref([])

const filtro = reactive({ ...FILTRO_VAZIO })

const podeCriar = computed(() => hasPermission('patrimonio', 'criar'))

const pessoasById = computed(() => {
  const mapa = {}
  pessoas.value.forEach((p) => { mapa[p.id] = p })
  return mapa
})

// ------------------------------------------------- navegação Empresa→Local→Cômodo
// Onde a pessoa está agora na árvore. Vazio = raiz (lista de empresas).
const caminho = reactive({ empresaId: '', localId: '', comodoId: '' })
// "Ver os N itens daqui, sem separar": escape pra ver os bens sem descer mais.
const verTudoAqui = ref(false)

const listas = computed(() => ({
  empresas: empresas.value, locais: locais.value, comodos: comodos.value,
}))

const temCaminho = computed(() => !!(caminho.empresaId || caminho.localId || caminho.comodoId))

// Os filtros (categoria/situação/sem dono/busca) valem SEMPRE, em qualquer nível:
// eles recortam o conteúdo, a árvore recorta o lugar. São perguntas diferentes.
const bensFiltrados = computed(() => filtrarBens(bensDoCaminho(bens.value, caminho), filtro))
const resumo = computed(() => resumoDaLista(bensFiltrados.value))

// Os cadastros agora são uma ÁRVORE: local pertence a uma marca, cômodo a um
// local. Estes dois filtros são a base de tudo — a navegação, os seletores da
// ficha e a tela de Listas usam os mesmos.
const locaisDaMarca = (empresaId) =>
  empresaId && empresaId !== SEM_VALOR ? locais.value.filter((l) => l.empresa_id === empresaId) : []
const comodosDoLocal = (localId) =>
  localId && localId !== SEM_VALOR ? comodos.value.filter((c) => c.local_id === localId) : []

// Qual campo agrupa no nível atual: sem marca escolhida agrupa por marca, com
// marca agrupa pelos locais DELA, com local agrupa pelos cômodos DELE. No cômodo
// acaba. Passar só os filhos do pai atual é o que impede "Sala de Reunião" de
// outro local aparecer aqui dentro.
const nivelAtual = computed(() => {
  if (!caminho.empresaId) return { campo: 'empresa_id', cadastro: empresas.value }
  if (!caminho.localId) return { campo: 'local_id', cadastro: locaisDaMarca(caminho.empresaId) }
  if (!caminho.comodoId) return { campo: 'comodo_id', cadastro: comodosDoLocal(caminho.localId) }
  return null
})

const grupos = computed(() =>
  nivelAtual.value ? agruparBens(bensFiltrados.value, nivelAtual.value.campo, nivelAtual.value.cadastro) : [])

// Buscar é um pedido de "ache em TUDO": nesse momento a árvore sai da frente e a
// resposta vem em lista, senão a pessoa digita o nome do bem e ainda tem que
// adivinhar em que pasta ele mora.
const buscando = computed(() => !!(filtro.busca || '').trim())

// Grupos aparecem quando há mais de um lugar pra escolher e a pessoa não pediu
// pra ver tudo nem está buscando. Um grupo só não é escolha — é um toque à toa.
const mostrarGrupos = computed(() =>
  !buscando.value && !verTudoAqui.value && grupos.value.length > 1)

const mostrarBens = computed(() => !mostrarGrupos.value || bensSoltos.value.length > 0)

// Bem que está NESTE nível e não cai em nenhum grupo abaixo (ex.: item da Vessel
// sem local). Sem isto ele ficaria escondido atrás do grupo "Sem local"; mostrar
// aqui é mais direto e ele continua alcançável pelos dois caminhos.
const bensSoltos = computed(() => {
  const campo = nivelAtual.value?.campo
  if (!campo) return []
  return bensFiltrados.value.filter((b) => !b[campo])
})

const bensNaTela = computed(() => (mostrarGrupos.value ? bensSoltos.value : bensFiltrados.value))

function entrarNoGrupo(g) {
  if (!caminho.empresaId) caminho.empresaId = g.id
  else if (!caminho.localId) caminho.localId = g.id
  else caminho.comodoId = g.id
  verTudoAqui.value = false
}

// Volta pro nível N da trilha: 0 = tudo, 1 = dentro da empresa, 2 = dentro do local.
function irParaNivel(n) {
  if (n < 3) caminho.comodoId = ''
  if (n < 2) caminho.localId = ''
  if (n < 1) caminho.empresaId = ''
  verTudoAqui.value = false
}

function nomeDoNivel(nivel) {
  const cortes = { empresaId: 1, localId: 2, comodoId: 3 }
  const parcial = { empresaId: '', localId: '', comodoId: '' }
  const ate = cortes[nivel]
  if (ate >= 1) parcial.empresaId = caminho.empresaId
  if (ate >= 2) parcial.localId = caminho.localId
  if (ate >= 3) parcial.comodoId = caminho.comodoId
  return rotuloDoCaminho(parcial, listas.value)
}

// O "voltar" sobe um degrau; na raiz é que sai do módulo. Um botão só.
const rotuloDoVoltar = computed(() => (temCaminho.value ? 'Voltar' : 'Gestão Interna'))

// ------------------------------------------------------------------------ zoom
// Aumentar/diminuir o tamanho de tudo na lista. Serve tanto pra quem enxerga
// pouco quanto pra caber mais item na tela — o dono pediu explicitamente.
// Limites 60%–200%: abaixo de 60% o texto some, acima de 200% cabe um item por
// tela e a lista deixa de ser lista. Fica guardado por navegador.
const CHAVE_ZOOM = 'pat-zoom'
const zoom = ref(Number(localStorage.getItem(CHAVE_ZOOM)) || 1)

function mudarZoom(passo) {
  zoom.value = Math.min(2, Math.max(0.6, Math.round((zoom.value + passo) * 10) / 10))
}

watch(zoom, (z) => {
  try { localStorage.setItem(CHAVE_ZOOM, String(z)) } catch (e) { /* modo privado: só não guarda */ }
})

const temFiltro = computed(() =>
  !!filtro.busca || !!filtro.empresaId || !!filtro.localId ||
  !!filtro.categoriaId || !!filtro.situacao || !!filtro.pessoaId || filtro.semDono)

function limparFiltros() {
  Object.assign(filtro, FILTRO_VAZIO)
}

function nomeDe(lista, id) {
  if (!id) return '—'
  const achou = lista.find((x) => x.id === id)
  return achou ? achou.nome : '—'
}

// Local e cômodo juntos numa linha só: no cartão do celular não cabe uma linha
// pra cada, e "Sede Limeira · RH" é como a pessoa fala.
function nomeDoLocal(bem) {
  const local = nomeDe(locais.value, bem.local_id)
  const comodo = nomeDe(comodos.value, bem.comodo_id)
  if (local === '—' && comodo === '—') return 'Local não informado'
  if (comodo === '—') return local
  if (local === '—') return comodo
  return `${local} · ${comodo}`
}

// Sobe um degrau da árvore; só sai do módulo quando já está na raiz. Se a pessoa
// estava vendo "tudo daqui, sem separar", o primeiro voltar desfaz isso — senão
// ela apertaria voltar e pularia um nível sem entender por quê.
function voltar() {
  if (verTudoAqui.value) { verTudoAqui.value = false; return }
  if (caminho.comodoId) { caminho.comodoId = ''; return }
  if (caminho.localId) { caminho.localId = ''; return }
  if (caminho.empresaId) { caminho.empresaId = ''; return }
  router.push({ name: 'gestao-interna' })
}

// Qual bem está aberto na ficha (null = ficha fechada). Declarado ANTES das
// funções que mexem nele — `const` não sobe (hoisting), e usá-lo antes daria
// ReferenceError em runtime, não erro de build.
const bemAberto = ref(null)

function abrirBem(bem) {
  bemAberto.value = bem
}
function abrirNovo() {
  bemAberto.value = { novo: true }
}

// ---------------------------------------------------------------- ficha do bem
const salvando = ref(false)
const historico = ref([])
const podeExcluir = computed(() => hasPermission('patrimonio', 'excluir'))
const pessoasAtivas = computed(() => pessoas.value.filter((p) => p.status === 'ativo'))

const FORM_VAZIO = {
  nome: '', numero: '', valor: '', data_compra: '',
  empresa_id: '', local_id: '', comodo_id: '', categoria_id: '',
  tipo_id: '', marca: '',
  pessoa_id: '', situacao: 'em_estoque', observacao: '', etiquetado: false,
}
const form = reactive({ ...FORM_VAZIO })

// O aviso de "aparelho pessoal em uso sem ninguém". É aviso, não trava: móvel e
// máquina ficam em uso sem dono o tempo todo, e são a maioria do patrimônio.
const avisoDono = computed(() => avisoDeDonoVazio({
  situacao: form.situacao,
  categoria: categorias.value.find((c) => c.id === form.categoria_id)?.nome || null,
  temDono: !!form.pessoa_id,
}))

// Os seletores em cascata da ficha.
const tiposDaCategoria = (categoriaId) =>
  categoriaId ? tipos.value.filter((t) => t.categoria_id === categoriaId) : []
const tiposDoForm = computed(() => tiposDaCategoria(form.categoria_id))
watch(() => form.categoria_id, () => {
  if (!tiposDoForm.value.some((t) => t.id === form.tipo_id)) form.tipo_id = ''
})

const locaisDoForm = computed(() => locaisDaMarca(form.empresa_id))
const comodosDoForm = computed(() => comodosDoLocal(form.local_id))

// Trocou a marca: o local escolhido pode não existir mais nela — e o cômodo
// junto. Limpar é obrigatório, senão o bem fica com um local de outra marca.
watch(() => form.empresa_id, () => {
  if (!locaisDoForm.value.some((l) => l.id === form.local_id)) {
    form.local_id = ''
    form.comodo_id = ''
  }
})
watch(() => form.local_id, () => {
  if (!comodosDoForm.value.some((c) => c.id === form.comodo_id)) form.comodo_id = ''
})

function fecharFicha() {
  bemAberto.value = null
  historico.value = []
}

async function carregarHistorico(bemId) {
  const { data } = await sbClient
    .from('patrimonio_posse').select('*').eq('bem_id', bemId).order('de', { ascending: false })
  historico.value = data || []
}

// Preenche o formulário quando a ficha abre (bem existente ou novo).
watch(bemAberto, async (bem) => {
  if (!bem) return
  if (bem.novo) {
    Object.assign(form, FORM_VAZIO)
    historico.value = []
    return
  }
  Object.assign(form, {
    nome: bem.nome || '',
    numero: bem.numero === null || bem.numero === undefined ? '' : String(bem.numero),
    valor: bem.valor_centavos === null || bem.valor_centavos === undefined ? '' : formatarValor(bem.valor_centavos),
    data_compra: bem.data_compra ? String(bem.data_compra).slice(0, 10) : '',
    empresa_id: bem.empresa_id || '',
    local_id: bem.local_id || '',
    comodo_id: bem.comodo_id || '',
    categoria_id: bem.categoria_id || '',
    tipo_id: bem.tipo_id || '',
    marca: bem.marca || '',
    pessoa_id: bem.pessoa_id || '',
    situacao: bem.situacao || 'em_estoque',
    observacao: bem.observacao || '',
    etiquetado: !!bem.etiquetado,
  })
  await carregarHistorico(bem.id)
})

async function registrarLog(acao, alvo, detalhe) {
  await sbClient.from('patrimonio_log').insert({ acao, alvo, resultado: 'ok', detalhe: detalhe || null })
}

// Toda troca de dono passa por aqui: fecha o registro do dono anterior e abre o
// do novo. A decisão do que gravar é da função pura fecharEAbrirHistorico, que
// já tem teste — aqui só se executa o plano que ela devolve.
async function sincronizarPosse(bemId, novoDonoId) {
  const { data: atual } = await sbClient.from('patrimonio_posse').select('*').eq('bem_id', bemId)
  const pessoa = pessoas.value.find((p) => p.id === novoDonoId)
  const plano = fecharEAbrirHistorico({
    historicoAtual: atual || [],
    novoDonoId: novoDonoId || null,
    novoDonoNome: pessoa ? pessoa.nome : null,
    hoje: hojeLocal(),
  })
  if (plano.aFechar) {
    await sbClient.from('patrimonio_posse').update({ ate: plano.aFechar.ate }).eq('id', plano.aFechar.id)
  }
  // Sem dono novo: só fecha o anterior, não abre registro de "ninguém".
  if (plano.aAbrir && novoDonoId) {
    await sbClient.from('patrimonio_posse').insert({
      bem_id: bemId,
      pessoa_id: plano.aAbrir.pessoa_id,
      pessoa_nome: plano.aAbrir.pessoa_nome,
      de: plano.aAbrir.de,
      ate: null,
    })
  }
}

async function salvarBem() {
  const nome = (form.nome || '').trim()
  if (!nome) { adminToast('Dê um nome ao bem', false); return }
  const numeroTexto = (form.numero || '').trim()
  if (numeroTexto && !/^\d+$/.test(numeroTexto)) {
    adminToast('O nº da etiqueta é só número', false); return
  }
  const valorTexto = (form.valor || '').trim()
  const valorCentavos = valorTexto ? parsearValor(valorTexto) : null
  if (valorTexto && valorCentavos === null) {
    adminToast('Não entendi o valor. Use algo como 1.234,56', false); return
  }

  salvando.value = true
  const linha = {
    nome,
    numero: numeroTexto ? parseInt(numeroTexto, 10) : null,
    valor_centavos: valorCentavos,
    data_compra: form.data_compra || null,
    empresa_id: form.empresa_id || null,
    local_id: form.local_id || null,
    comodo_id: form.comodo_id || null,
    categoria_id: form.categoria_id || null,
    tipo_id: form.tipo_id || null,
    marca: (form.marca || '').trim() || null,
    pessoa_id: form.pessoa_id || null,
    // Ligou numa pessoa de verdade: o nome solto da planilha perde a razão de existir.
    dono_texto: form.pessoa_id ? null : (bemAberto.value.dono_texto || null),
    situacao: form.situacao,
    observacao: (form.observacao || '').trim() || null,
    etiquetado: !!form.etiquetado,
    atualizado_em: new Date().toISOString(),
  }

  let bemId = bemAberto.value.novo ? null : bemAberto.value.id
  if (bemId) {
    const { error } = await sbClient.from('patrimonio_bens').update(linha).eq('id', bemId)
    if (error) { adminToast('Erro ao salvar: ' + error.message, false); salvando.value = false; return }
    await registrarLog('bem.editar', 'bem:' + bemId, nome)
  } else {
    const { data, error } = await sbClient.from('patrimonio_bens').insert(linha).select('id').single()
    if (error) { adminToast('Erro ao criar: ' + error.message, false); salvando.value = false; return }
    bemId = data.id
    await registrarLog('bem.criar', 'bem:' + bemId, nome)
  }

  await sincronizarPosse(bemId, form.pessoa_id || null)
  salvando.value = false
  fecharFicha()
  adminToast('Bem salvo')
  await carregar()
}

// ------------------------------------------------------------ listas editáveis
const listasAbertas = ref(false)
const podeEditar = computed(() => hasPermission('patrimonio', 'editar'))
const novos = reactive({ patrimonio_empresas: '', patrimonio_categorias: '' })
// Um campo de "novo" por PAI: cada marca tem sua caixa de novo local, cada local
// a sua de novo cômodo. Um campo só, compartilhado, escreveria no galho errado.
const novoLocal = reactive({})
const novoComodo = reactive({})

const DEF_MARCAS = { tabela: 'patrimonio_empresas', titulo: 'Marcas', ref: empresas }
const DEF_LOCAIS = { tabela: 'patrimonio_locais', titulo: 'Locais', ref: locais }
const DEF_COMODOS = { tabela: 'patrimonio_comodos', titulo: 'Cômodos', ref: comodos }
const DEF_CATEGORIAS = { tabela: 'patrimonio_categorias', titulo: 'Categorias', ref: categorias }

// Quais galhos da árvore estão abertos. Tudo fechado por padrão: abrir os 12
// locais e 47 cômodos de uma vez é exatamente a bagunça que esta tela resolve.
const galhosAbertos = ref(new Set())
const galhoAberto = (chave) => galhosAbertos.value.has(chave)
function alternarGalho(chave) {
  const s = new Set(galhosAbertos.value)
  if (s.has(chave)) s.delete(chave); else s.add(chave)
  galhosAbertos.value = s
}

// Cria um filho já amarrado no pai (local dentro da marca, cômodo dentro do local).
async function criarFilho(def, vinculo, mapaDeNovos, chaveDoPai) {
  const nome = (mapaDeNovos[chaveDoPai] || '').trim()
  if (!nome) return
  const irmaos = def.ref.value.filter((x) => {
    const [campo, valor] = Object.entries(vinculo)[0]
    return x[campo] === valor
  })
  const { error } = await sbClient.from(def.tabela).insert({ nome, ordem: irmaos.length + 1, ...vinculo })
  if (error) {
    const jaExiste = /duplicate key|unique/i.test(error.message)
    adminToast(jaExiste ? `"${nome}" já existe aqui` : 'Erro: ' + error.message, false)
    return
  }
  mapaDeNovos[chaveDoPai] = ''
  await carregar()
}

async function criarItem(def) {
  const nome = (novos[def.tabela] || '').trim()
  if (!nome) return
  const { error } = await sbClient.from(def.tabela).insert({ nome, ordem: def.ref.value.length + 1 })
  if (error) {
    // unique(nome) violado = a opção já existe. Dizer isso, não vomitar o erro do banco.
    const jaExiste = /duplicate key|unique/i.test(error.message)
    adminToast(jaExiste ? `"${nome}" já está na lista` : 'Erro: ' + error.message, false)
    return
  }
  novos[def.tabela] = ''
  await carregar()
}

async function renomearItem(def, item, novoNome) {
  const nome = (novoNome || '').trim()
  if (!nome || nome === item.nome) return
  const { error } = await sbClient.from(def.tabela).update({ nome }).eq('id', item.id)
  if (error) { adminToast('Erro ao renomear: ' + error.message, false); await carregar(); return }
  await carregar()
}

// Apagar NÃO apaga bem nenhum: as FKs do bem são "on delete set null", então ele
// fica sem aquele campo e continua lá. Mas apagar um galho da ÁRVORE leva os
// filhos junto (cascade) — apagar uma marca apaga os locais dela e os cômodos
// deles. Isso precisa ser dito ANTES, não descoberto depois.
async function apagarItem(def, item) {
  let aviso = null
  if (def.tabela === 'patrimonio_empresas') {
    const filhos = locaisDaMarca(item.id)
    const netos = filhos.reduce((n, l) => n + comodosDoLocal(l.id).length, 0)
    if (filhos.length) aviso = `Apagar "${item.nome}" apaga junto ${filhos.length} local(is) e ${netos} cômodo(s).`
  } else if (def.tabela === 'patrimonio_locais') {
    const filhos = comodosDoLocal(item.id)
    if (filhos.length) aviso = `Apagar "${item.nome}" apaga junto ${filhos.length} cômodo(s).`
  }
  const usados = bens.value.filter((b) =>
    b.empresa_id === item.id || b.local_id === item.id ||
    b.comodo_id === item.id || b.categoria_id === item.id).length
  if (usados > 0) {
    aviso = (aviso ? aviso + ' ' : '') + `${usados} bem(ns) ficam sem esse campo (nenhum é apagado).`
  }
  if (aviso && !(await _confirmar(aviso))) return

  const { error } = await sbClient.from(def.tabela).delete().eq('id', item.id)
  if (error) { adminToast('Erro ao apagar: ' + error.message, false); return }
  await carregar()
}

// Confirmação própria da tela (nada de confirm() nativo). Promessa que resolve
// no clique — o painel fica DENTRO do componente, como o resto.
const confirmacao = ref(null)
function _confirmar(texto) {
  return new Promise((resolve) => {
    confirmacao.value = { texto, resolve }
  })
}
function responderConfirmacao(ok) {
  const c = confirmacao.value
  confirmacao.value = null
  if (c) c.resolve(ok)
}

async function excluirBem() {
  const id = bemAberto.value.id
  const nome = form.nome
  const { error } = await sbClient.from('patrimonio_bens').delete().eq('id', id)
  if (error) { adminToast('Erro ao excluir: ' + error.message, false); return }
  await registrarLog('bem.excluir', 'bem:' + id, nome)
  fecharFicha()
  adminToast('Bem excluído')
  await carregar()
}

async function carregar() {
  carregando.value = true
  erro.value = ''
  const [rBens, rEmp, rLoc, rCom, rCat, rTip, rPes] = await Promise.all([
    sbClient.from('patrimonio_bens').select('*').order('numero', { ascending: true, nullsFirst: false }),
    sbClient.from('patrimonio_empresas').select('id,nome').order('ordem').order('nome'),
    sbClient.from('patrimonio_locais').select('id,nome,empresa_id').order('ordem').order('nome'),
    sbClient.from('patrimonio_comodos').select('id,nome,local_id').order('ordem').order('nome'),
    sbClient.from('patrimonio_categorias').select('id,nome,vida_util_anos').order('ordem').order('nome'),
    sbClient.from('patrimonio_tipos').select('id,nome,categoria_id').order('ordem').order('nome'),
    sbClient.from('acessos_pessoas').select('id,nome,status').order('nome'),
  ])
  if (rBens.error) {
    erro.value = rBens.error.message
    carregando.value = false
    return
  }
  bens.value = rBens.data || []
  empresas.value = rEmp.data || []
  locais.value = rLoc.data || []
  comodos.value = rCom.data || []
  categorias.value = rCat.data || []
  tipos.value = rTip.data || []
  // Colaboradores vêm do módulo vizinho: é o ÚNICO ponto em que Patrimônio
  // depende de Colaboradores e Acessos. Se a pessoa não tiver acesso àquele
  // módulo, a RLS devolve lista vazia — e a tela segue funcionando, mostrando
  // o nome solto (dono_texto) quando houver.
  pessoas.value = rPes.data || []
  carregando.value = false
}

onMounted(() => {
  if (!hasPermission('patrimonio', 'ver')) {
    adminToast('Sem acesso', false)
    router.push({ name: 'inicio' })
    return
  }
  carregar()
})
</script>

<style scoped>
/* Celular-primeiro: o que está fora de media query É o celular.
   A tabela larga só aparece a partir de 1025px. */
.tela-patrimonio{min-height:100vh;display:flex;flex-direction:column;background:var(--bg);width:100%;}

.tela-patrimonio .pat-topbar{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border);background:var(--surface);position:sticky;top:0;z-index:10;}
.tela-patrimonio .pat-back{font-family:var(--fonte-principal);font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--accent);cursor:pointer;background:none;border:1px solid var(--accent-mid);border-radius:5px;padding:6px 10px;display:flex;align-items:center;gap:5px;white-space:nowrap;touch-action:manipulation;}
.tela-patrimonio .pat-title{font-family:var(--fonte-principal);font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:var(--text);flex:1;min-width:0;}
.tela-patrimonio .pat-btn-novo{width:38px;height:38px;flex-shrink:0;border-radius:10px;border:none;background:var(--accent);color:#fff;font-size:22px;line-height:1;cursor:pointer;touch-action:manipulation;}

.tela-patrimonio .pat-resumo{display:flex;align-items:baseline;gap:6px;padding:12px 14px 4px;font-family:var(--fonte-principal);}
.tela-patrimonio .pat-resumo-qtd{font-size:22px;font-weight:700;color:var(--text);}
.tela-patrimonio .pat-resumo-lab,.tela-patrimonio .pat-resumo-sep{font-size:12px;color:var(--muted);}
.tela-patrimonio .pat-resumo-total{font-size:15px;font-weight:600;color:var(--accent);}

.tela-patrimonio .pat-busca-wrap{padding:8px 14px;}
/* 16px obrigatório: abaixo disso o iOS dá zoom sozinho ao focar o campo. */
.tela-patrimonio .pat-busca{width:100%;font-size:16px;font-family:var(--fonte-principal);padding:11px 13px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text);}

.tela-patrimonio .pat-filtros{display:flex;gap:8px;padding:4px 14px 12px;white-space:nowrap;}
.tela-patrimonio .pat-select{font-size:16px;font-family:var(--fonte-principal);padding:9px 11px;border:1px solid var(--border);border-radius:9px;background:var(--surface);color:var(--text);flex-shrink:0;max-width:190px;}
.tela-patrimonio .pat-chip{font-size:12px;font-family:var(--fonte-principal);font-weight:600;padding:9px 14px;border:1px solid var(--border);border-radius:9px;background:var(--surface);color:var(--text);cursor:pointer;flex-shrink:0;touch-action:manipulation;}
.tela-patrimonio .pat-chip.ativo{background:var(--accent);border-color:var(--accent);color:#fff;}

.tela-patrimonio .pat-body{flex:1;padding:0 14px 40px;}
.tela-patrimonio .pat-aviso{padding:26px 4px;color:var(--muted);font-family:var(--fonte-principal);font-size:13px;}
.tela-patrimonio .pat-aviso-erro{color:#dc2626;}

.tela-patrimonio .pat-vazio{display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px;padding:48px 18px;color:var(--muted);}
.tela-patrimonio .pat-vazio h3{font-family:var(--fonte-principal);font-size:16px;font-weight:600;color:var(--text);}
.tela-patrimonio .pat-vazio p{font-family:var(--fonte-principal);font-size:13px;line-height:1.7;max-width:420px;}

.tela-patrimonio .pat-btn{font-family:var(--fonte-principal);font-size:13px;font-weight:600;padding:11px 18px;border:1px solid var(--border);border-radius:9px;background:var(--surface);color:var(--text);cursor:pointer;touch-action:manipulation;}
.tela-patrimonio .pat-btn.primario{background:var(--accent);border-color:var(--accent);color:#fff;}

/* ---- árvore: trilha e pastas de nível ---- */
.tela-patrimonio .pat-trilha{display:flex;align-items:center;gap:5px;padding:0 14px 8px;white-space:nowrap;}
.tela-patrimonio .pat-trilha-item{font-family:var(--fonte-principal);font-size:12px;font-weight:600;color:var(--accent);background:none;border:none;padding:4px 2px;cursor:pointer;flex-shrink:0;touch-action:manipulation;}
.tela-patrimonio .pat-trilha-item.atual{color:var(--muted);cursor:default;}
.tela-patrimonio .pat-trilha-sep{color:var(--muted);font-size:12px;flex-shrink:0;}

.tela-patrimonio .pat-grupos{display:flex;flex-direction:column;gap:8px;}
.tela-patrimonio .pat-grupo{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px;cursor:pointer;font-family:var(--fonte-principal);color:var(--text);touch-action:manipulation;}
.tela-patrimonio .pat-grupo:active{border-color:var(--accent);}
.tela-patrimonio .pat-grupo-ico{width:34px;height:34px;flex-shrink:0;border-radius:9px;background:var(--surface2);color:var(--accent);display:flex;align-items:center;justify-content:center;}
.tela-patrimonio .pat-grupo-ico.orfao{color:#b45309;}
.tela-patrimonio .pat-grupo-nome{flex:1;min-width:0;font-size:15px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.tela-patrimonio .pat-grupo-num{font-size:11px;color:var(--muted);text-align:right;flex-shrink:0;}
.tela-patrimonio .pat-grupo-num em{font-style:normal;display:block;}
.tela-patrimonio .pat-grupo-seta{color:var(--muted);font-size:17px;flex-shrink:0;}

.tela-patrimonio .pat-ver-todos{width:100%;margin-top:10px;font-family:var(--fonte-principal);font-size:12px;font-weight:600;color:var(--accent);background:none;border:1px dashed var(--border);border-radius:10px;padding:11px;cursor:pointer;touch-action:manipulation;}
.tela-patrimonio .pat-secao-bens{font-family:var(--fonte-principal);font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--muted);margin:18px 0 8px;}

.tela-patrimonio .pat-cards{display:flex;flex-direction:column;gap:10px;}
.tela-patrimonio .pat-card{display:flex;flex-direction:column;gap:6px;width:100%;text-align:left;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px;cursor:pointer;font-family:var(--fonte-principal);color:var(--text);touch-action:manipulation;}
.tela-patrimonio .pat-card:active{border-color:var(--accent);}
.tela-patrimonio .pat-card-topo{display:flex;align-items:center;gap:8px;}
.tela-patrimonio .pat-card-nome{font-size:15px;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.tela-patrimonio .pat-card-meta{font-size:12px;color:var(--muted);display:flex;gap:5px;}
.tela-patrimonio .pat-card-linha{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);}

.tela-patrimonio .pat-pill{font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;padding:4px 9px;border-radius:999px;flex-shrink:0;}
.tela-patrimonio .pat-pill-uso{background:#dcfce7;color:#166534;}
.tela-patrimonio .pat-pill-estoque{background:#e0e7ff;color:#3730a3;}
.tela-patrimonio .pat-pill-manutencao{background:#fef3c7;color:#92400e;}
.tela-patrimonio .pat-pill-baixado{background:#f1f5f9;color:#475569;}
.tela-patrimonio .pat-pill-neutro{background:#f1f5f9;color:#475569;}

/* A tabela NAO existe no celular. */
.tela-patrimonio .pat-tabela-wrap{display:none;}

/* ---- ficha do bem: painel de baixo pra cima no celular, caixa no desktop ---- */
.tela-patrimonio .pat-ficha-fundo{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:50;display:flex;align-items:flex-end;justify-content:center;}
.tela-patrimonio .pat-ficha{background:var(--surface);width:100%;max-height:92vh;display:flex;flex-direction:column;border-radius:16px 16px 0 0;}
.tela-patrimonio .pat-ficha-topo{display:flex;align-items:center;gap:10px;padding:14px;border-bottom:1px solid var(--border);}
.tela-patrimonio .pat-ficha-fechar{width:34px;height:34px;border:1px solid var(--border);border-radius:9px;background:var(--surface);color:var(--text);font-size:15px;cursor:pointer;touch-action:manipulation;}
.tela-patrimonio .pat-ficha-titulo{font-family:var(--fonte-principal);font-size:13px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:var(--text);}
.tela-patrimonio .pat-ficha-corpo{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:12px;}
.tela-patrimonio .pat-ficha-pe{display:flex;gap:8px;justify-content:flex-end;padding:12px 14px;border-top:1px solid var(--border);background:var(--surface);}

.tela-patrimonio .pat-campo{display:flex;flex-direction:column;gap:5px;font-family:var(--fonte-principal);}
.tela-patrimonio .pat-campo > span{font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--muted);}
.tela-patrimonio .pat-campo em{font-style:normal;text-transform:none;letter-spacing:0;font-weight:400;}
.tela-patrimonio .pat-campo input,.tela-patrimonio .pat-campo select,.tela-patrimonio .pat-campo textarea{font-size:16px;font-family:var(--fonte-principal);padding:11px 12px;border:1px solid var(--border);border-radius:9px;background:var(--surface);color:var(--text);width:100%;}
.tela-patrimonio .pat-campo select:disabled{opacity:.5;}
.tela-patrimonio .pat-campo-par{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.tela-patrimonio .pat-check{display:flex;align-items:center;gap:9px;font-family:var(--fonte-principal);font-size:13px;color:var(--text);}
.tela-patrimonio .pat-check input{width:19px;height:19px;}
.tela-patrimonio .pat-nota{font-family:var(--fonte-principal);font-size:12px;line-height:1.6;color:#92400e;background:#fef3c7;border-radius:8px;padding:10px 12px;}
.tela-patrimonio .pat-btn.perigo{border-color:#dc2626;color:#dc2626;}

.tela-patrimonio .pat-hist{border-top:1px solid var(--border);padding-top:12px;display:flex;flex-direction:column;gap:7px;}
.tela-patrimonio .pat-hist h4{font-family:var(--fonte-principal);font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--muted);}
.tela-patrimonio .pat-hist-vazio{font-family:var(--fonte-principal);font-size:12px;line-height:1.6;color:var(--muted);}
.tela-patrimonio .pat-hist-linha{font-family:var(--fonte-principal);font-size:12px;color:var(--text);padding:7px 10px;background:var(--surface2);border-radius:7px;}

/* ---- listas editáveis ---- */
.tela-patrimonio .pat-btn-listas{width:38px;height:38px;flex-shrink:0;border-radius:10px;border:1px solid var(--border);background:var(--surface);color:var(--text);display:flex;align-items:center;justify-content:center;cursor:pointer;touch-action:manipulation;}
.tela-patrimonio .pat-listas-ajuda{font-family:var(--fonte-principal);font-size:12px;line-height:1.6;color:var(--muted);}
.tela-patrimonio .pat-lista-bloco{display:flex;flex-direction:column;gap:7px;border-top:1px solid var(--border);padding-top:12px;}
.tela-patrimonio .pat-lista-bloco h4{font-family:var(--fonte-principal);font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--muted);}
.tela-patrimonio .pat-lista-item,.tela-patrimonio .pat-lista-novo{display:flex;gap:7px;align-items:center;}
.tela-patrimonio .pat-lista-nome{flex:1;min-width:0;font-size:16px;font-family:var(--fonte-principal);padding:9px 11px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);}
.tela-patrimonio .pat-lista-del{width:36px;height:36px;flex-shrink:0;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:#dc2626;cursor:pointer;touch-action:manipulation;}

/* ---- árvore de cadastro (Listas) ---- */
.tela-patrimonio .pat-arv{display:flex;flex-direction:column;}
.tela-patrimonio .pat-arv-linha{display:flex;gap:6px;align-items:center;padding:3px 0;}
/* O recuo é o que faz a hierarquia ser LIDA sem precisar explicar. */
.tela-patrimonio .pat-arv-linha.nivel2{padding-left:10px;}
.tela-patrimonio .pat-arv-linha.nivel3{padding-left:20px;}
/* Linha sem botao de abrir reserva a MESMA largura dele. Sem isso o nivel 3
   (que nao abre nada) volta pra esquerda e empata com o nivel 2 — a
   hierarquia deixa de ser legivel pelo recuo, que e todo o proposito. */
.tela-patrimonio .pat-arv-vaga{width:26px;flex-shrink:0;}
.tela-patrimonio .pat-arv-linha.nivel1 .pat-lista-nome{font-weight:600;}
.tela-patrimonio .pat-arv-abrir{width:26px;height:34px;flex-shrink:0;border:none;background:none;color:var(--muted);font-size:12px;cursor:pointer;touch-action:manipulation;}
.tela-patrimonio .pat-arv-filhos{border-left:2px solid var(--border);margin-left:12px;padding-left:2px;}
.tela-patrimonio .pat-arv-vazio{font-family:var(--fonte-principal);font-size:11px;color:var(--muted);padding:5px 0 5px 16px;}

/* ---- confirmação ---- */
.tela-patrimonio .pat-confirm-fundo{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:60;display:flex;align-items:center;justify-content:center;padding:18px;}
.tela-patrimonio .pat-confirm{background:var(--surface);border-radius:14px;padding:18px;max-width:400px;width:100%;font-family:var(--fonte-principal);display:flex;flex-direction:column;gap:10px;}
.tela-patrimonio .pat-confirm p{font-size:13px;line-height:1.6;color:var(--text);}
.tela-patrimonio .pat-confirm-pergunta{font-weight:600;}
.tela-patrimonio .pat-confirm-pe{display:flex;gap:8px;justify-content:flex-end;margin-top:4px;}

@media(min-width:1025px){
  .tela-patrimonio .pat-topbar{padding:13px 24px;}
  .tela-patrimonio .pat-resumo,.tela-patrimonio .pat-busca-wrap,.tela-patrimonio .pat-filtros{padding-left:24px;padding-right:24px;}
  .tela-patrimonio .pat-body{padding:0 24px 48px;}
  .tela-patrimonio .pat-cards{display:none;}
  .tela-patrimonio .pat-tabela-wrap{display:block;}
  .tela-patrimonio .pat-tabela{width:100%;border-collapse:collapse;font-family:var(--fonte-principal);font-size:13px;}
  .tela-patrimonio .pat-tabela th{text-align:left;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--muted);padding:10px 12px;border-bottom:1px solid var(--border);white-space:nowrap;}
  .tela-patrimonio .pat-tabela td{padding:11px 12px;border-bottom:1px solid var(--border);color:var(--text);}
  .tela-patrimonio .pat-tabela tbody tr{cursor:pointer;}
  .tela-patrimonio .pat-tabela tbody tr:hover{background:var(--surface2);}
  .tela-patrimonio .pat-dir{text-align:right;}
  .tela-patrimonio .pat-ficha-fundo{align-items:center;}
  .tela-patrimonio .pat-ficha{max-width:560px;border-radius:14px;}
}
</style>
