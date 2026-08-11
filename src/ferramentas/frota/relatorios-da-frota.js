// O catálogo dos relatórios da Frota. A casca (compartilhado/relatorios/
// aba-de-relatorios.vue) não sabe nada sobre frota: tudo o que ela precisa está
// declarado aqui, no mesmo formato do catálogo do Patrimônio.
//
// A PALAVRA DO PRIMEIRO NÍVEL AQUI É "EMPRESA", NÃO "MARCA"
// ---------------------------------------------------------
// Na Frota, `marca` já quer dizer VOLVO, BMW, FIAT — e está preenchida nos 10
// veículos, enquanto `empresa_id` está vazio nos 10. O dono abriu a ficha, viu
// marca preenchida e concluiu, com razão, que estava tudo certo. São dois
// campos com o mesmo nome na cabeça de quem usa. Quem passa a palavra para a
// casca é a tela, em `palavraDaMarca="empresa"`.

import { revisoesDoVeiculo, ultimaRevisao, SITUACOES_REVISAO } from './revisoes.js'
import { ultimoHodometro } from './estado-do-veiculo.js'

// As MESMAS palavras do formulário da ficha (tela-de-frota.vue). Um relatório
// que escrevesse 'em_manutencao' obrigaria a pessoa a traduzir de cabeça.
const SITUACAO_DO_VEICULO = {
  ativo: 'Ativo',
  em_manutencao: 'Em manutenção',
  inativo: 'Parado',
  alienado: 'Fora da frota',
}

const RESULTADO_DO_CHECKLIST = {
  liberado: 'Liberado',
  com_ressalvas: 'Com ressalvas',
  nao_liberado: 'Não liberado',
}

const nomeNaLista = (lista, id) =>
  (id ? (lista || []).find((x) => x.id === id)?.nome : '') || ''

/** O recorte sai sempre do VEÍCULO, mesmo nos relatórios de evento: é o carro
 * que tem empresa e local, não a ficha nem a viagem. */
const idsDoVeiculo = (linha) => ({
  empresaId: linha?._veiculo?.empresa_id || null,
  localId: linha?._veiculo?.local_id || null,
})

/** Data 'AAAA-MM-DD' (ou timestamp) em DD/MM/AAAA, sem sofrer com fuso. */
function dataBR(valor) {
  if (!valor) return ''
  const [ano, mes, dia] = String(valor).slice(0, 10).split('-')
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : ''
}

export const RELATORIOS_DA_FROTA = [
  {
    chave: 'veiculos',
    titulo: 'Ficha dos veículos',
    explicacao: 'A frota como está hoje: de quem é cada carro, onde fica, quem dirige, contrato e valor.',
    periodo: false,
    colunas: [
      { chave: 'placa', titulo: 'Placa', tipo: 'texto' },
      { chave: 'nome', titulo: 'Veículo', tipo: 'texto' },
      { chave: 'marca', titulo: 'Marca / modelo', tipo: 'texto' },
      { chave: 'ano', titulo: 'Ano', tipo: 'numero' },
      { chave: 'cor', titulo: 'Cor', tipo: 'texto' },
      { chave: 'empresa', titulo: 'Empresa', tipo: 'texto' },
      { chave: 'local', titulo: 'Local', tipo: 'texto' },
      { chave: 'ambiente', titulo: 'Ambiente', tipo: 'texto' },
      { chave: 'dono', titulo: 'Dono fixo', tipo: 'texto' },
      { chave: 'situacao', titulo: 'Situação', tipo: 'texto' },
      { chave: 'contrato', titulo: 'Contrato', tipo: 'texto' },
      { chave: 'codigo_patrimonial', titulo: 'Código', tipo: 'texto' },
      { chave: 'aluguel_centavos', titulo: 'Aluguel', tipo: 'dinheiro' },
      { chave: 'fipe_centavos', titulo: 'FIPE', tipo: 'dinheiro' },
      { chave: 'observacao', titulo: 'Observação', tipo: 'texto' },
    ],
    pegarIds: idsDoVeiculo,
    montar: async ({ veiculos, empresas, locais, comodos, pessoas }) =>
      (veiculos || []).map((v) => ({
        ...v,
        empresa: nomeNaLista(empresas, v.empresa_id),
        local: nomeNaLista(locais, v.local_id),
        ambiente: nomeNaLista(comodos, v.comodo_id),
        dono: nomeNaLista(pessoas, v.pessoa_id),
        situacao: SITUACAO_DO_VEICULO[v.situacao] || v.situacao || '',
        _veiculo: v,
      })),
  },

  {
    chave: 'checklists',
    titulo: 'Checklists assinados',
    explicacao: 'As fichas que os motoristas preencheram no período: quem conferiu e o que apontou.',
    periodo: true,
    colunas: [
      { chave: 'data', titulo: 'Data', tipo: 'texto' },
      { chave: 'placa', titulo: 'Placa', tipo: 'texto' },
      { chave: 'veiculo', titulo: 'Veículo', tipo: 'texto' },
      { chave: 'pessoa', titulo: 'Quem fez', tipo: 'texto' },
      { chave: 'hodometro', titulo: 'Hodômetro', tipo: 'numero' },
      { chave: 'resultado', titulo: 'Resultado', tipo: 'texto' },
      { chave: 'anomalias', titulo: 'Apontou', tipo: 'texto' },
    ],
    pegarIds: idsDoVeiculo,
    montar: async ({ sbClient, veiculos, de, ate }) => {
      const { data, error } = await sbClient
        .from('frota_checklist').select('*')
        .gte('feita_em', de).lte('feita_em', ate)
        .order('feita_em', { ascending: false })
      // "Nenhum checklist no período" é afirmação grave nesta frota. Não pode
      // ser o que a tela mostra quando na verdade a consulta falhou.
      if (error) throw new Error(error.message)
      const porId = new Map((veiculos || []).map((v) => [v.id, v]))
      return (data || []).flatMap((f) => {
        const v = porId.get(f.veiculo_id)
        if (!v) return []
        return [{
          data: dataBR(f.feita_em),
          placa: v.placa,
          veiculo: v.nome,
          pessoa: f.pessoa_nome || 'Não informado',
          hodometro: f.hodometro,
          resultado: RESULTADO_DO_CHECKLIST[f.resultado] || f.resultado || '',
          anomalias: f.anomalias || '',
          _veiculo: v,
        }]
      })
    },
  },

  {
    chave: 'revisoes',
    titulo: 'Revisões e manutenção',
    explicacao: 'O que está vencido ou perto de vencer em cada carro, com a última troca ao lado.',
    // NÃO pede período de propósito: filtrando por data, o item que nunca foi
    // trocado — o mais vencido de todos — não teria linha e sumiria justamente
    // do relatório de vencidos.
    periodo: false,
    colunas: [
      { chave: 'placa', titulo: 'Placa', tipo: 'texto' },
      { chave: 'veiculo', titulo: 'Veículo', tipo: 'texto' },
      { chave: 'item', titulo: 'Item', tipo: 'texto' },
      { chave: 'situacao', titulo: 'Situação', tipo: 'texto' },
      { chave: 'detalhe', titulo: 'Detalhe', tipo: 'texto' },
      { chave: 'alvo', titulo: 'Trocar aos (km)', tipo: 'numero' },
      { chave: 'ultima_troca', titulo: 'Última troca', tipo: 'texto' },
      { chave: 'ultima_km', titulo: 'Km da última', tipo: 'numero' },
      { chave: 'oficina', titulo: 'Oficina', tipo: 'texto' },
      { chave: 'custo_centavos', titulo: 'Custo', tipo: 'dinheiro' },
    ],
    pegarIds: idsDoVeiculo,
    // A conta de vencida/perto/em dia NÃO é refeita aqui: é a mesma
    // `revisoesDoVeiculo` que a aba Revisões já usa. Duas contas do mesmo
    // número divergiriam, e aí o relatório contradiria a tela.
    montar: async ({ veiculos, plano, revisoes, fichas }) =>
      (veiculos || []).flatMap((v) => {
        const kmAtual = ultimoHodometro(fichas || [], v.id)
        return revisoesDoVeiculo({ veiculo: v, kmAtual, plano, revisoes }).map((r) => {
          const u = ultimaRevisao(revisoes, v.id, r.item)
          return {
            placa: v.placa,
            veiculo: v.nome,
            item: r.item,
            situacao: SITUACOES_REVISAO[r.situacao]?.rotulo || r.situacao,
            detalhe: r.texto,
            alvo: r.alvo,
            ultima_troca: u ? dataBR(u.feita_em) : '',
            ultima_km: u ? u.km : null,
            oficina: u?.oficina || '',
            custo_centavos: u?.custo_centavos ?? null,
            _veiculo: v,
          }
        })
      }),
  },

  {
    chave: 'quem-dirigiu',
    titulo: 'Quem esteve com cada carro',
    explicacao: 'Saídas e devoluções no período. É o que responde "quem dirigia no dia da multa".',
    periodo: true,
    colunas: [
      { chave: 'saida', titulo: 'Saída', tipo: 'texto' },
      { chave: 'volta', titulo: 'Volta', tipo: 'texto' },
      { chave: 'placa', titulo: 'Placa', tipo: 'texto' },
      { chave: 'veiculo', titulo: 'Veículo', tipo: 'texto' },
      { chave: 'pessoa', titulo: 'Quem', tipo: 'texto' },
      { chave: 'km_saida', titulo: 'Km saída', tipo: 'numero' },
      { chave: 'km_volta', titulo: 'Km volta', tipo: 'numero' },
      { chave: 'km_rodados', titulo: 'Km rodados', tipo: 'numero' },
      { chave: 'destino', titulo: 'Destino', tipo: 'texto' },
      { chave: 'finalidade', titulo: 'Finalidade', tipo: 'texto' },
    ],
    pegarIds: idsDoVeiculo,
    montar: async ({ sbClient, veiculos, de, ate }) => {
      const { data, error } = await sbClient
        .from('frota_uso').select('*')
        .gte('saida_em', de).lte('saida_em', ate)
        .order('saida_em', { ascending: false })
      if (error) throw new Error(error.message)
      const porId = new Map((veiculos || []).map((v) => [v.id, v]))
      return (data || []).flatMap((u) => {
        const v = porId.get(u.veiculo_id)
        if (!v) return []
        const temOsDois = Number.isInteger(u.km_saida) && Number.isInteger(u.km_volta)
        return [{
          saida: dataBR(u.saida_em),
          // Vazio seria lido como "voltou e ninguém anotou". O carro está fora.
          volta: u.volta_em ? dataBR(u.volta_em) : 'na rua',
          placa: v.placa,
          veiculo: v.nome,
          pessoa: u.pessoa_nome || 'Não informado',
          km_saida: u.km_saida,
          km_volta: u.km_volta,
          // Sem os dois números não há km rodado. Zero mentiria: zero é
          // "andou e não saiu do lugar".
          km_rodados: temOsDois ? u.km_volta - u.km_saida : '',
          destino: u.destino || '',
          finalidade: u.finalidade || '',
          _veiculo: v,
        }]
      })
    },
  },
]

export function acharRelatorioDaFrota(chave) {
  return RELATORIOS_DA_FROTA.find((r) => r.chave === chave) || null
}
