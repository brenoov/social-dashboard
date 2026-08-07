// ONDE O CARRO FICA — as duas contas que a ficha do veículo faz na hora de
// gravar o local, e o que o "+" da árvore manda pro banco. Lógica pura: não
// toca banco nem tela.
//
// POR QUE ESTE ARQUIVO EXISTE
// ---------------------------
// O campo "Local" da ficha do carro era uma caixa de digitar. Bronca do dono:
// "fui editar a ficha de carro BMW, aí tem lá campo local, eu digito ao invés
// de já mostrar tudo o que já temos em banco". Agora ele aponta pra árvore
// Marca › Local › Ambiente do Patrimônio (patrimonio_empresas /
// patrimonio_locais / patrimonio_comodos), a mesma que o Patrimônio usa.
//
// A REGRA QUE NÃO PODE SER "MELHORADA" DEPOIS
// -------------------------------------------
// `local_texto` NÃO é apagado quando o local passa a ser apontado. Cinco dos
// nove carros têm texto escrito à mão hoje — "Casa RB" (3 carros), "Conchal" e
// "Barracão". Esse texto é a ÚNICA pista de onde cada carro estava antes de
// alguém apontar o local certo. Apagá-lo ao gravar parece limpeza, mas é perda
// definitiva: se a pessoa apontar o local errado, não sobra nada pra conferir.
// A coluna é barata; a pista, não.
//
// E DE QUEM É O CARRO É OUTRA PERGUNTA
// ------------------------------------
// `empresa_id` (de quem é) e `local_id` (onde fica) são campos separados de
// propósito, por decisão do dono: um carro da RBV Company pode passar a semana
// guardado na Fábrica Conchal da Vessel sem virar patrimônio da Vessel. Nada
// aqui deduz um do outro — quem responde as duas perguntas é a pessoa.

/** Campo vazio vira `null` no banco, nunca string vazia: coluna uuid não aceita
 * '' e, em texto, '' e null virariam dois jeitos de dizer "não informado". */
function ouNulo(valor) {
  const v = typeof valor === 'string' ? valor.trim() : valor
  return v === '' || v === undefined ? null : v
}

/**
 * A parte do "onde fica" do que vai ser gravado no veículo.
 *
 * Três coisas que ela garante, e que é o motivo de existir em vez de ficar
 * espalhada no meio de salvarVeiculo():
 *
 *  1. `local_texto` volta do jeito que estava. SEMPRE. Ver o cabeçalho.
 *  2. ambiente sem local não é gravado: um `comodo_id` sem `local_id` é dado
 *     quebrado — aponta pra uma sala sem dizer de qual prédio.
 *  3. `empresa_id` passa direto, sem olhar pro local escolhido: são perguntas
 *     diferentes.
 */
export function dadosDoLocal({ empresaId, localId, comodoId, textoAntigo } = {}) {
  const local = ouNulo(localId)
  return {
    empresa_id: ouNulo(empresaId),
    local_id: local,
    // Sem local, o ambiente cai fora — mesmo que tenha sobrado escolhido de uma
    // troca anterior.
    comodo_id: local ? ouNulo(comodoId) : null,
    // Passa por ouNulo só pra "" virar null; o conteúdo NUNCA é mexido.
    local_texto: ouNulo(textoAntigo),
  }
}

// Em qual tabela cada nível da árvore mora, e a quem a linha nova se pendura.
// São as tabelas do Patrimônio: a Frota não tem lista própria de locais, e não
// vai ter — duas listas de local divergem em uma semana.
const NIVEIS = {
  marca: { tabela: 'patrimonio_empresas', pai: null },
  local: { tabela: 'patrimonio_locais', pai: 'empresa_id' },
  ambiente: { tabela: 'patrimonio_comodos', pai: 'local_id' },
}

/**
 * O que o "+" da árvore manda pro banco: em qual tabela inserir e com quais
 * campos. Devolve `null` quando não dá pra inserir — nome em branco, nível
 * desconhecido, ou filho sem pai (local sem marca, ambiente sem local ficariam
 * órfãos e sumiriam da árvore de todo mundo).
 */
export function insertDaArvore({ nivel, nome, empresaId, localId } = {}) {
  const def = NIVEIS[nivel]
  if (!def) return null

  const nomeLimpo = String(nome ?? '').trim()
  if (!nomeLimpo) return null

  const dados = { nome: nomeLimpo }
  if (def.pai) {
    const paiId = ouNulo(def.pai === 'empresa_id' ? empresaId : localId)
    if (!paiId) return null
    dados[def.pai] = paiId
  }
  return { tabela: def.tabela, dados }
}
