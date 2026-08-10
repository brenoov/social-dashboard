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
]

export function acharRelatorio(chave) {
  return RELATORIOS_DO_PATRIMONIO.find((r) => r.chave === chave) || null
}
