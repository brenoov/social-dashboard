// QUANTO SALDO A CONTA TEM, e quanto tempo ele dura.
//
// ARMADILHA QUE ESTE ARQUIVO EXISTE PARA EVITAR: o campo `balance` da Meta NÃO é
// saldo. Ele é o valor da FATURA em aberto — quanto se deve. Medido nas contas
// reais (29/07):
//
//   Raíssa      cartão      balance R$ 1.486,79   →  é a fatura, não saldo
//   Breno Vale  pré-paga    balance R$    39,78   →  mas tem R$ 1.673,75 disponíveis
//   Vessel      pré-paga    balance R$   193,83   →  e está com R$ 0,00 disponíveis
//
// Avisar "Raíssa com R$ 1.486 de saldo, dura 1,9 dias" seria dizer o contrário
// do que acontece: ela paga no cartão, não tem saldo e não vai parar.
//
// O saldo de verdade só chega como TEXTO, dentro de
// `funding_source_details.display_string`: "Saldo disponível (R$ 1.673,75 BRL)".
// Não existe campo numérico. Ler texto formatado é frágil — muda com idioma,
// moeda e separador —, então o parse FALHA FECHADO: não reconheceu, devolve
// null, e quem consome não avisa nada. Silêncio é melhor que número errado sobre
// dinheiro, mesma regra do push de vendas.
//
// PURO: sem rede, sem tela, sem relógio (o gasto por dia entra por parâmetro).
//
// MORA EM _shared porque quem usa é a Edge Function (Deno), que não alcança
// `src/`. Mesmo lugar de vendas-do-dia.js, com o teste ao lado — `npm test` roda
// os dois. Se um dia a TELA precisar disso, ela importa daqui; ter uma cópia em
// src seria duas verdades sobre dinheiro esperando divergir.

// Tipo 20 = pré-pago (saldo). Tipo 1 = cartão. Só o pré-pago pode "acabar".
const TIPO_PRE_PAGO = 20;

// "Saldo disponível (R$ 1.673,75 BRL)" → 167375 (centavos).
// Aceita o formato pt-BR: milhar com ponto, decimal com vírgula. Qualquer outra
// forma devolve null — e null aqui significa "não sei", nunca "zero".
export function lerSaldoDoTexto(texto) {
  const t = String(texto || '');
  // Exige o R$ e o par milhar/decimal brasileiro. Sem o `\d{2}` no fim, "R$ 1.673"
  // seria lido como 1673 reais quando pode ser 1,673 em outro formato.
  const m = t.match(/R\$\s*([\d.]+),(\d{2})/);
  if (!m) return null;
  const inteiro = m[1].replace(/\./g, '');
  if (!/^\d+$/.test(inteiro)) return null;
  const centavos = Number(inteiro) * 100 + Number(m[2]);
  return Number.isFinite(centavos) ? centavos : null;
}

// A conta paga com saldo pré-pago (que acaba) ou no cartão (que não acaba)?
export function ehPrePaga(conta) {
  const c = conta || {};
  if (c.is_prepay_account === true) return true;
  return Number(c.funding_source_details && c.funding_source_details.type) === TIPO_PRE_PAGO;
}

// → { prePaga, centavos, reais, diasRestantes, nivel, porque }
//   nivel: 'acabou' | 'critico' | 'atencao' | 'ok' | 'nao-se-aplica' | 'nao-sei'
//
//   'nao-se-aplica'  conta de cartão — não tem saldo pra acabar
//   'nao-sei'        pré-paga, mas o texto do saldo não foi reconhecido
//
// `gastoPorDia` vem de fora (média recente). Sem ele dá pra dizer o saldo mas
// não quantos dias faltam — e é o "faltam 2 dias" que faz alguém agir.
export function lerSaldo(conta, gastoPorDia) {
  const c = conta || {};
  if (!ehPrePaga(c)) {
    return { prePaga: false, centavos: null, reais: null, diasRestantes: null,
      nivel: 'nao-se-aplica', porque: 'Esta conta paga no cartão — não tem saldo que acabe.' };
  }
  const centavos = lerSaldoDoTexto(c.funding_source_details && c.funding_source_details.display_string);
  if (centavos == null) {
    return { prePaga: true, centavos: null, reais: null, diasRestantes: null,
      nivel: 'nao-sei', porque: 'Não consegui ler o saldo desta conta.' };
  }
  const reais = centavos / 100;
  const porDia = Number(gastoPorDia);
  const dias = (Number.isFinite(porDia) && porDia > 0) ? reais / porDia : null;

  // Zerado é diferente de "pouco": as campanhas já pararam, não vão parar.
  if (centavos <= 0) {
    return { prePaga: true, centavos, reais, diasRestantes: 0, nivel: 'acabou',
      porque: 'O saldo acabou — as campanhas desta conta já podem ter parado.' };
  }
  // Sem saber o ritmo, não dá pra dizer se R$ 200 é muito ou pouco: numa conta
  // que gasta R$ 20/dia são dez dias, numa que gasta R$ 460 são horas.
  if (dias == null) {
    return { prePaga: true, centavos, reais, diasRestantes: null, nivel: 'ok',
      porque: 'Não sei o ritmo de gasto para estimar quanto tempo dura.' };
  }
  if (dias < 1) {
    return { prePaga: true, centavos, reais, diasRestantes: dias, nivel: 'critico',
      porque: 'No ritmo atual, o saldo não passa de hoje.' };
  }
  if (dias < 3) {
    return { prePaga: true, centavos, reais, diasRestantes: dias, nivel: 'atencao',
      porque: `No ritmo atual, o saldo dura cerca de ${Math.floor(dias)} dia${Math.floor(dias) === 1 ? '' : 's'}.` };
  }
  return { prePaga: true, centavos, reais, diasRestantes: dias, nivel: 'ok',
    porque: `No ritmo atual, o saldo dura cerca de ${Math.floor(dias)} dias.` };
}

// Quais contas MERECEM um aviso agora. Só 'acabou', 'critico' e 'atencao' —
// 'nao-sei' fica de fora de propósito: um alerta que não sabe o valor gera
// desconfiança e, repetido todo dia, vira ruído que se aprende a ignorar.
export function contasParaAvisar(leituras) {
  const urgencia = { acabou: 0, critico: 1, atencao: 2 };
  return (leituras || [])
    .filter((l) => l && urgencia[l.nivel] != null)
    .sort((a, b) => (urgencia[a.nivel] - urgencia[b.nivel]) || ((a.diasRestantes ?? 0) - (b.diasRestantes ?? 0)));
}

const brl = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// O texto do push. Uma conta = frase direta; várias = a mais urgente no título e
// as outras no corpo, porque notificação com lista longa não se lê na tela de
// bloqueio.
// → { titulo, corpo } ou null quando não há o que avisar.
export function montarAvisoDeSaldo(avisos) {
  const lista = contasParaAvisar(avisos);
  if (!lista.length) return null;
  const p = lista[0];
  const linha = (l) => l.nivel === 'acabou'
    ? `${l.conta}: sem saldo`
    : `${l.conta}: ${brl(l.reais)} (~${l.diasRestantes < 1 ? 'hoje' : Math.floor(l.diasRestantes) + ' dia' + (Math.floor(l.diasRestantes) === 1 ? '' : 's')})`;

  const titulo = p.nivel === 'acabou'
    ? `${p.conta} está sem saldo`
    : p.nivel === 'critico'
      ? `${p.conta}: saldo acaba hoje`
      : `${p.conta}: saldo para ${Math.floor(p.diasRestantes)} dia${Math.floor(p.diasRestantes) === 1 ? '' : 's'}`;

  const corpo = lista.length === 1
    ? `${brl(p.reais)} restantes. ${p.porque}`
    : `${lista.map(linha).join(' · ')}`;
  return { titulo, corpo };
}
