# Retomar daqui — 2026-07-31

Sessão longa encerrada por limite de contexto. Este arquivo é o suficiente para
continuar sem a conversa anterior.

---

## 1. O que está PRONTO e no ar (`main`)

Três projetos mesclados (PRs #74, #77, #78), com CI verde:

| | O que faz |
|---|---|
| **Duplicar** | Botão ⧉ nos três níveis (campanha/conjunto/anúncio). Cópia nasce PAUSADA, em cascata (foge do teto de 3 anúncios do `deep_copy`). |
| **Editar público** | Botão 👥 no conjunto. Cidade/raio/idade/gênero/interesses/públicos salvos/Advantage+. Preserva o que não gerencia. |
| **Sugestão de interesses** | Robô semanal + tabela + faixa na Fábrica. **Encanamento pronto; a QUALIDADE está em ajuste — ver §3.** |

Banco: `interesses_sugeridos` **aplicada**. `fabrica_marcas.segmento` **aplicada e
preenchida**. Segredos do GitHub: os quatro necessários já existiam.

### Ainda NÃO testado contra conta Meta real — decisão do dono
- **Duplicar** cria campanha de verdade.
- **Editar público** muda quem vê anúncios de campanha rodando.

O dono autorizou o que dá pra resolver sozinho, mas **escolher qual campanha
serve de cobaia é decisão de negócio, não técnica**. Peça uma campanha pausada
ou de gasto baixo antes de conduzir.

---

## 2. Trabalho EM ANDAMENTO

**Branch:** `fix/interesses-buscar` (publicada, sobre `main`)
**Último commit:** `fed5ce8`
**Havia mudança não commitada** quando a sessão acabou: um subagente estava
aplicando a leitura de `fabrica_marcas.segmento` no pedido da IA. **Confira
`git status` antes de qualquer coisa** — pode estar pela metade.

O arquivo `db/migrations/2026-07-31-marca-segmento.sql` existe sem versionar
(a migration já foi aplicada no banco; falta commitar o arquivo).

### O que essa mudança faz
Passar `fabrica_marcas.segmento` para `montarPedido`, logo após o nome da marca.
Sem segmento → cai no comportamento de hoje (só o nome), sem quebrar.

### Como medir (o ciclo que vinha funcionando)
```
git push origin fix/interesses-buscar
gh workflow run sugerir-interesses.yml --ref fix/interesses-buscar -f modo=seco
gh run list --workflow=sugerir-interesses.yml --limit 1 --json databaseId
gh run view <ID> --log | sed 's/^[^\t]*\t[^\t]*\t[^ ]*Z //' \
  | grep -E "La Vessel|^\s+[0-9]+\.|descartad|SECO"
```
Custo: **R$ 0,15 por rodada**, ~4 min. Modo seco NÃO grava, mas **as chamadas de
IA custam igual**.

---

## 3. A investigação da qualidade — leia antes de mexer

O robô funciona. O problema é **o que ele sugere**.

### Hipóteses JÁ MEDIDAS E MORTAS — não repetir

| Hipótese | Resultado real |
|---|---|
| `locale: 'pt_BR'` na busca conserta os nomes estrangeiros | **Zerou 48 buscas.** A Meta aceita sem erro e devolve vazio. Formato errado. NÃO tentar outro formato às cegas. |
| Pedir termos "específicos" à IA melhora | **Zerou tudo.** A IA inventa termos que não existem no catálogo da Meta. |
| O `path` (categoria) separa relevante de lixo | **Não existe.** 35 de 36 voltam como `Interesses > Outros interesses > <o próprio nome>` — placeholder repetindo o nome. |

### O que FUNCIONOU
- Buscar (`type=adinterest`) em vez de validar palpite (`adinterestvalid`):
  **15% → 49 interesses**.
- Teto de público (500 mi, provisório): cortou "Compras na internet" (1,58 bi).
- **Falhar alto**: duas rodadas zeradas ficaram VERMELHAS com exit 1. Antes
  registrariam "0 gravadas, ok" e a faixa ficaria vazia sem nada parecer erro.
- Imprimir termos + nomes + tamanhos no modo seco: é o que tornou tudo visível.

### A pista atual (não medida ainda)
A IA recebia só o nome **"La Vessel"** e deduzia "loja de moda feminina",
gerando `looks do dia`, `influencer moda`, `estilo pessoal`.

**O estoque real diz outra coisa** (`gc_estoque_item`):
Cinto 398 · Outros acessórios 200 · Transversal 180 · Bolsa de ombro 162 ·
Óculos 139 · Carteira 53 · Tote 52 · Bolsa de mão 49 · Clutch 45 · Mochila 16

**Cinto é a maior categoria.** Daí a coluna `segmento`, preenchida com:
> bolsas femininas (transversal, de ombro, tote, de mão, clutch de festa e
> mochila), cintos, carteiras, porta-cartões, óculos de sol e acessórios

**Próxima medição:** se os termos virarem "bolsa transversal", "cinto feminino",
"óculos de sol", a hipótese está certa.

### Lixo que sobrevive a todas as rodadas
`VK Moda Feminina Plus Size` (3 mil pessoas, rede social russa) em **6/6**
objetivos · `List of fashion magazines` (inglês) em **4/6** · `Boémia` (grafia
de Portugal).

**Não construir lista de bloqueio ainda** — com o segmento no pedido os termos
mudam e isso pode sumir sozinho. Se sobreviver, aí sim, com evidência.

---

## 4. Pendências registradas (não são bugs)

- **Node 20 nos workflows**: o GitHub avisa que vai parar de aceitar. Vale para
  **todos** os robôs do repo, não só os novos. Manutenção de uma vez só.
- **A faixa no Gestor de Tráfego** ainda não existe — o dado e a regra
  compartilhada (`baldeDoObjetivoDaFabrica` em `baldes.js`) já estão prontos.
- **`interesses_sugeridos` sem coluna de conta**, então fora da política por
  conta que a outra frente criou. Decisão registrada, não esquecimento.

---

## 5. Roadmap restante

| | O quê |
|---|---|
| **C2** | Editar posicionamentos (feed/story/reels). Ficou pequeno: herda o motor do editar-público. |
| **C3** | Criar campanha do zero no Gestor. **NUNCA foi feito** — o dono chegou a achar que sim. |
| **C4** | Copiar campanha para outra conta (a Meta não copia; exige recriar + re-subir imagens). |
| **C5** | Trocar criativo/público ao duplicar. |
| — | Sugestão nativa da Meta (`adinterestsuggestion`, "mostrar parecidos"). Pequena, sem IA. |
| ~~A~~ | ~~Vigia de saldo~~ — a outra frente fez. |

---

## 6. Como esta sessão trabalhou (vale manter)

- **Plano escrito → subagente implementa → revisor independente → conserto.**
  ~15 rodadas de conserto. **Quase todos os defeitos vieram dos PLANOS, não da
  execução.**
- Os dois piores tinham a mesma forma: **afirmar algo sobre um dado sem abrir o
  dado.** Inventei o formato de uma coluna em vez de ler a migration; afirmei que
  a Fábrica "não tem ambiguidade de objetivo" sem abrir a tabela que tem a
  ambiguidade na primeira linha.
- **O que pega defeito não é reler o plano — é executar o código contra a
  realidade.** A revisão final do editar-público achou 4 defeitos graves que 7
  revisões por tarefa não viram, todos executando.
- **Testes verdes não provam que a funcionalidade presta.** A sugestão de
  interesses tinha 900+ testes passando e sugeria um filme americano de 2009.

### Regras que valem para os próximos planos
1. Formato de dado de banco **se lê na migration que criou a coluna**.
2. Formato de API externa afirmado "segundo a documentação" e não verificado ao
   vivo é **suposição vestida de restrição** — a doc da Meta erra sobre
   `audience_size` e sobre `locale`.
3. Toda função que recebe lista precisa de teste com **um item bom ao lado do
   ruim**, provando que o bom sobrevive.
