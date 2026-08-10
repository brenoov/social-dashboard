// O catálogo dos relatórios do Patrimônio. A casca (aba-de-relatorios.vue) não
// sabe nada sobre patrimônio: tudo o que ela precisa está declarado aqui.
//
// Cada relatório declara suas colunas UMA VEZ, e essa mesma lista desenha a
// tabela na tela, monta o Excel e monta a folha de impressão. É o que impede as
// três saídas de discordarem entre si — a mesma razão pela qual COLUNAS_PLANILHA
// já existe.

import { COLUNAS_PLANILHA } from './planilha-e-resumo.js'

// A linha achatada guarda o NOME da marca e do local ("Vessel", "Fábrica
// Conchal"), não o id. Recortar por nome quebraria justamente nos homônimos —
// existem duas "Fábrica Conchal". Por isso o id sai sempre do bem cru.
const idsDoBemAchatado = (linha) => ({
  empresaId: linha?._bem?.empresa_id || null,
  localId: linha?._bem?.local_id || null,
})

export const RELATORIOS_DO_PATRIMONIO = [
  {
    chave: 'bens',
    titulo: 'Bens',
    explicacao: 'Tudo que está cadastrado, item por item, com valor e onde está.',
    periodo: false,
    colunas: COLUNAS_PLANILHA,
    pegarIds: idsDoBemAchatado,
    // A tela já carregou e já achatou os bens. Buscar de novo seria pagar duas
    // vezes pela mesma consulta e abrir espaço para as duas divergirem.
    montar: async ({ linhasAchatadas }) => linhasAchatadas || [],
  },

  {
    chave: 'com-quem',
    titulo: 'Com quem está cada bem',
    explicacao: 'O que está na mão de cada pessoa hoje. É o relatório de "fulano saiu, o que precisa voltar".',
    periodo: false,
    colunas: [
      { chave: 'pessoa', titulo: 'Pessoa', tipo: 'texto' },
      { chave: 'numero', titulo: 'Nº', tipo: 'numero' },
      { chave: 'nome', titulo: 'Item', tipo: 'texto' },
      { chave: 'categoria', titulo: 'Categoria', tipo: 'texto' },
      { chave: 'empresa', titulo: 'Marca', tipo: 'texto' },
      { chave: 'local', titulo: 'Local', tipo: 'texto' },
      { chave: 'desde', titulo: 'Desde', tipo: 'texto' },
      { chave: 'motivo', titulo: 'Motivo', tipo: 'texto' },
      { chave: 'valor_centavos', titulo: 'Valor', tipo: 'dinheiro' },
    ],
    pegarIds: idsDoBemAchatado,
    montar: async ({ sbClient, linhasAchatadas }) => {
      // `ate is null` é o que define "ainda está com a pessoa" — a coluna nasceu
      // assim na migration, e conferir por data daria resposta diferente.
      const { data, error } = await sbClient
        .from('patrimonio_posse').select('*').is('ate', null).order('de', { ascending: false })
      // Estourar, e não devolver vazio: lista vazia por erro se lê como
      // "ninguém está com nada", que é o contrário do que aconteceu.
      if (error) throw new Error(error.message)
      const porId = new Map((linhasAchatadas || []).map((l) => [l.id, l]))
      return (data || []).flatMap((p) => {
        const bem = porId.get(p.bem_id)
        // Posse de bem apagado não vira linha meia-boca: sem o bem não há
        // número, item nem valor, e a linha só confundiria quem lê.
        if (!bem) return []
        return [{ ...bem, pessoa: p.pessoa_nome || 'Não informada', desde: p.de, motivo: p.motivo || '' }]
      })
    },
  },
]

export function acharRelatorio(chave) {
  return RELATORIOS_DO_PATRIMONIO.find((r) => r.chave === chave) || null
}
