// RASCUNHO E HISTÓRICO DO ASSISTENTE DE CRIAR CAMPANHA.
//
// PEDIDO DO DONO (2026-08-03): "quero que tenha um salvamento das edições, às
// vezes a pessoa fecha a aba sem querer, precisa ter um histórico do que está em
// rascunho e enviado".
//
// AQUI MORAM AS REGRAS: o que vale a pena salvar, quando mudou de verdade, e
// como cada linha é dita em português na lista. Quem fala com o banco é a tela.
// PURO: sem rede, sem tela, sem relógio próprio (a data entra por parâmetro).

// SÓ SALVA DEPOIS QUE HÁ ALGO A PERDER.
//
// Um rascunho por clique no botão encheria o histórico de linhas vazias — a
// pessoa abre, olha e fecha, e isso não é uma tentativa de campanha. O primeiro
// sinal de intenção real é ter escolhido o tipo OU escrito um nome.
export function valeSalvar(estado) {
  const e = estado || {};
  return !!(texto(e.objetivo) || texto(e.nome));
}

const texto = (v) => (typeof v === 'string' ? v.trim() : '');

// O QUE MUDOU DE VERDADE, para não gravar a cada tecla.
//
// Comparar o estado inteiro por JSON é barato e suficiente aqui: o estado tem
// dezenas de campos, não milhares. O que isto impede é uma escrita no banco a
// cada letra digitada no nome da campanha.
export function mudou(anterior, atual) {
  return JSON.stringify(anterior || null) !== JSON.stringify(atual || null);
}

// O QUE VAI PARA O BANCO. `_targetingBase` e o público inteiro vão junto: sem
// eles, retomar um rascunho perderia o público salvo que foi aplicado — que é
// justamente o trabalho mais chato de refazer.
export function linhaParaSalvar({ estado, passo, contaId, tipoRotulo }) {
  const e = estado || {};
  return {
    account_id: String(contaId || ''),
    estado: e,
    passo: Number(passo) || 0,
    nome: texto(e.nome).slice(0, 200),
    tipo: texto(tipoRotulo).slice(0, 120),
    status: 'rascunho',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// A LISTA, dita em português.

const DOIS = (n) => String(n).padStart(2, '0');

// "hoje às 15:04", "ontem às 09:12", "22/07 às 18:30".
//
// Data absoluta pura ("03/08/2026 15:04") é correta e ruim de ler: a pergunta
// que a pessoa faz é "isto é de agora ou de semana passada?".
export function quando(iso, agora) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const ref = agora instanceof Date ? agora : new Date(agora);
  const hora = `${DOIS(d.getHours())}:${DOIS(d.getMinutes())}`;
  const dia = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((dia(ref) - dia(d)) / 86400000);
  if (diff === 0) return `hoje às ${hora}`;
  if (diff === 1) return `ontem às ${hora}`;
  return `${DOIS(d.getDate())}/${DOIS(d.getMonth() + 1)} às ${hora}`;
}

const ROTULO_STATUS = {
  rascunho: 'Rascunho',
  criada: 'Criada',
  falhou: 'A Meta recusou',
};

// UMA LINHA DO HISTÓRICO. Devolve dados, não HTML: quem desenha é a tela, e
// assim isto continua testável sem navegador.
export function linhaDoHistorico(row, agora) {
  const r = row || {};
  const estado = r.estado || {};
  return {
    id: String(r.id || ''),
    nome: texto(r.nome) || texto(estado.nome) || '(sem nome)',
    tipo: texto(r.tipo),
    status: r.status || 'rascunho',
    rotuloStatus: ROTULO_STATUS[r.status] || 'Rascunho',
    quando: quando(r.updated_at || r.created_at, agora),
    // "no passo 3 de 5" só faz sentido em rascunho: o resto já acabou.
    ondeParou: r.status === 'rascunho' ? `parou no passo ${(Number(r.passo) || 0) + 1}` : '',
    // O motivo da recusa é a informação mais valiosa desta lista, e é a que
    // some se ninguém guardar: meses depois ninguém lembra por que não foi.
    motivo: r.status === 'falhou' ? texto(r.resultado && r.resultado.erro) : '',
    podeContinuar: r.status === 'rascunho',
  };
}

// O HISTÓRICO INTEIRO, do mais recente para o mais antigo. Rascunho primeiro
// dentro do mesmo instante: é o que ainda dá para fazer alguma coisa a respeito.
export function montarHistorico(linhas, agora) {
  return (Array.isArray(linhas) ? linhas : [])
    .filter(Boolean)
    .map((r) => linhaDoHistorico(r, agora))
    .sort((a, b) => (a.podeContinuar === b.podeContinuar ? 0 : a.podeContinuar ? -1 : 1));
}

// O RASCUNHO QUE VALE OFERECER quando o assistente abre.
//
// O mais recente, e SÓ se for recente de verdade. Oferecer "continuar de onde
// parou" um mês depois é oferecer um trabalho que a pessoa já esqueceu — e o
// preço de recusar é ter que clicar mais uma vez toda vez.
export const DIAS_PARA_OFERECER = 7;

export function rascunhoParaRetomar(linhas, agora) {
  const ref = agora instanceof Date ? agora : new Date(agora);
  const candidatos = (Array.isArray(linhas) ? linhas : [])
    .filter((r) => r && r.status === 'rascunho' && r.estado && valeSalvar(r.estado));
  let melhor = null;
  for (const r of candidatos) {
    const d = new Date(r.updated_at || r.created_at);
    if (Number.isNaN(d.getTime())) continue;
    if ((ref - d) / 86400000 > DIAS_PARA_OFERECER) continue;
    if (!melhor || d > new Date(melhor.updated_at || melhor.created_at)) melhor = r;
  }
  return melhor;
}
