// A ÚNICA porta do navegador para o Bling — e o único lugar que decide o que
// fazer quando ele não responde.
//
// POR QUE ISTO EXISTE: em 12/08/2026 o Bling passou a recusar o token do iamundi
// (permissão de escopo) e as telas ficaram 17 HORAS mostrando R$ 0,00, sem
// avisar ninguém. O motivo estava numa linha: `blingCall` devolvia `r.json()`
// SEM olhar o status HTTP, e quem chamava lia "sem dado" como "sem venda". Erro
// de rede virava número de dinheiro. E a linha existia DUAS vezes, uma em cada
// tela — consertar uma e esquecer a outra era o resultado mais provável.
//
// Número zero e número ausente são coisas diferentes. Numa tela de dinheiro,
// confundir os dois é pior que quebrar: a tela mente com cara de certeza, e
// manda quem for consertar para o lugar errado. Foi o que aconteceu — a primeira
// suspeita caiu sobre a regra da data da venda, que era inocente.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './conectar-no-banco-de-dados.js'

export class ErroDoBling extends Error {
  constructor(causa, tecnica) {
    super(tecnica || causa)
    this.name = 'ErroDoBling'
    this.causa = causa
    this.tecnica = tecnica || ''
  }
}

// ── Quem barrou: o Bling ou o crachá de quem está olhando? ────────────────
// São dois "sem permissão" bem diferentes, e trocá-los manda a pessoa resolver
// a coisa errada:
//   - 500 "Token refresh failed" → o BLING recusou o iamundi (escopo/token).
//   - 403 insufficient_scope     → idem, dito pelo próprio Bling.
//   - 403 "sem permissao"        → é o nosso proxy dizendo que a PESSOA não tem
//                                  a chave `sales`/`gestor`.
//   - 401 "nao autenticado"      → sessão do navegador não vale.
// `status === null` significa que a chamada não voltou (internet, Supabase).
//
// A ordem importa: as pistas de token são conferidas ANTES do status, porque o
// Bling devolve o `insufficient_scope` dele com 403 — o mesmo código que o nosso
// proxy usa para dizer "esta pessoa não tem acesso a Vendas".
export function classificarFalhaDoBling(status, corpo) {
  if (status == null) return 'sem-resposta'
  const txt = (typeof corpo === 'string' ? corpo : JSON.stringify(corpo ?? '')).toLowerCase()
  if (txt.includes('token refresh failed')) return 'bling-recusou-token'
  if (txt.includes('insufficient_scope')) return 'bling-recusou-token'
  if (status === 401 || status === 403) return 'sem-acesso-a-vendas'
  return 'bling-fora'
}

// ── O que aparece na faixa ────────────────────────────────────────────────
// Admin lê a causa e o que fazer. Todos os outros — e a TV da loja — leem só
// que o número está velho: sem jargão na frente de cliente, e sem esconder do
// dono o que ele precisa para consertar.
const HORA = (h) => (h ? ` Números de ${h}.` : '')

export function textoDoAviso(causa, { ehAdmin = false, horaDoDado = null, tecnica = '' } = {}) {
  if (causa === 'sem-acesso-a-vendas') {
    // Aqui não se segura número nem se fala do Bling: o problema é o crachá.
    return ehAdmin
      ? { titulo: 'Este login não tem acesso a Vendas.', detalhe: 'Falta a chave `sales` ou `gestor` no perfil.' }
      : { titulo: 'Você não tem acesso a Vendas — fale com quem administra.', detalhe: '' }
  }
  if (!ehAdmin) {
    if (!horaDoDado) return { titulo: 'Não foi possível buscar as vendas agora.', detalhe: '' }
    const fim = causa === 'sem-resposta' ? 'sem conexão'
      : causa === 'erro-na-tela' ? 'a Central falhou ao montar'
      : 'aguardando o Bling'
    return { titulo: `Números de ${horaDoDado} — ${fim}.`, detalhe: '' }
  }
  const curto = String(tecnica || '').slice(0, 120)
  if (causa === 'bling-recusou-token') {
    return {
      titulo: 'O Bling recusou o acesso do iamundi.',
      detalhe: `Token vencido ou escopo sem permissão — precisa reautorizar no Bling.${HORA(horaDoDado)}${curto ? ' · ' + curto : ''}`,
    }
  }
  if (causa === 'sem-resposta') {
    return { titulo: 'Sem resposta.', detalhe: `Pode ser a internet ou o Supabase.${HORA(horaDoDado)}` }
  }
  if (causa === 'erro-na-tela') {
    // Defeito NOSSO, não do fornecedor. Dizer "o Bling não respondeu" aqui
    // mandaria quem for consertar mexer no Bling por causa de um bug da Central
    // — o desperdício exato da manhã de 13/08/2026.
    return { titulo: 'A tela falhou ao montar os números.', detalhe: `Não é o Bling: é um defeito da Central.${HORA(horaDoDado)}${curto ? ' · ' + curto : ''}` }
  }
  return { titulo: 'O Bling não respondeu.', detalhe: `Erro no servidor do Bling.${HORA(horaDoDado)}${curto ? ' · ' + curto : ''}` }
}

// ── A chamada ─────────────────────────────────────────────────────────────
// A diferença que importa em relação ao código antigo é UMA linha: conferir
// `r.ok` antes de interpretar o corpo. O resto é o mesmo.
export async function chamarBling(sbClient, endpoint, params) {
  const { data: { session } } = await sbClient.auth.getSession()
  if (!session) throw new ErroDoBling('sem-acesso-a-vendas', 'sem sessão no navegador')
  let r
  try {
    r = await fetch(SUPABASE_URL + '/functions/v1/bling-proxy', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + session.access_token,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ endpoint, params }),
    })
  } catch (e) {
    throw new ErroDoBling('sem-resposta', e?.message || 'fetch falhou')
  }
  let corpo = null
  try { corpo = await r.json() } catch { corpo = null }
  if (!r.ok) {
    const causa = classificarFalhaDoBling(r.status, corpo)
    const tecnica = typeof corpo?.error === 'string' ? corpo.error : JSON.stringify(corpo?.error ?? corpo ?? '')
    throw new ErroDoBling(causa, `${r.status} ${tecnica}`)
  }
  return corpo ?? {}
}

// ── A paginação ───────────────────────────────────────────────────────────
// Página vazia continua sendo "fim da lista" — isso é legítimo e é o caso do
// dia sem venda. O que mudou: a FALHA não passa mais por vazio, ela sobe.
// (O código antigo tentava 3 vezes por página e desistia devolvendo [], o que
// transformava um Bling fora do ar em "não vendeu nada".)
export async function paginasDoBling(sbClient, endpoint, params) {
  const todos = []
  for (let pagina = 1; pagina <= 10; pagina++) {
    const resp = await chamarBling(sbClient, endpoint, { ...params, pagina, limite: 100 })
    const itens = Array.isArray(resp?.data) ? resp.data : []
    if (!itens.length) break
    todos.push(...itens)
    if (itens.length < 100) break
  }
  return todos
}
