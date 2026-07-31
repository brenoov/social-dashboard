// Quando medir cada peça, e como ler o que a Meta responde.
//
// POR QUE NÃO MEDIR TUDO TODO DIA: a cota da Graph API é finita e compartilhada
// com o coletor, a Fábrica e a Gestão de Tráfego. Um post de três semanas atrás
// não muda mais de número — gastar chamada com ele tira chamada de quem precisa.
//
// A curva do Instagram é conhecida: quase todo o alcance acontece nas primeiras
// 48h, o resto escorre por uns dias e depois congela. Daí a cadência: todo dia
// na primeira semana, uma vez por semana até o mês, e nunca mais.
//
// PURO: sem rede.

export const DIAS_DE_ACOMPANHAMENTO = 30;
const DIAS_DE_MEDIDA_DIARIA = 7;

const DIA_MS = 86400000;

function _dia(d) {
  return new Date(d).toISOString().slice(0, 10);
}

// `ultimaMedida` é a data (YYYY-MM-DD) da última leitura, ou null se nunca mediu.
export function precisaMedir(peca, ultimaMedida, agora = new Date()) {
  const publicado = peca?.publicado_em;
  if (!publicado) return false;

  const t = new Date(publicado).getTime();
  if (Number.isNaN(t)) return false;

  const idadeEmDias = (agora.getTime() - t) / DIA_MS;
  if (idadeEmDias > DIAS_DE_ACOMPANHAMENTO) return false;

  // Nunca mediu: mede agora, seja qual for a idade (dentro da janela).
  if (!ultimaMedida) return true;

  // Já mediu hoje: a chave da tabela é (peça, dia), então medir de novo só
  // reescreveria a mesma linha gastando cota.
  const hoje = _dia(agora);
  if (ultimaMedida >= hoje) return false;

  const diasDesdeAMedida = (agora.getTime() - new Date(`${ultimaMedida}T12:00:00Z`).getTime()) / DIA_MS;
  return idadeEmDias <= DIAS_DE_MEDIDA_DIARIA ? true : diasDesdeAMedida >= 7;
}

// Os insights vêm como [{ name, values: [{ value }] }]. Devolve undefined
// quando a métrica não veio — o chamador transforma em null.
function _insight(insights, ...nomes) {
  const lista = insights?.data;
  if (!Array.isArray(lista)) return undefined;
  for (const nome of nomes) {
    const achou = lista.find((i) => i?.name === nome);
    const v = achou?.values?.[0]?.value;
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

// null e 0 são coisas DIFERENTES e a distinção é o ponto:
//   0    = a Meta disse que ninguém salvou
//   null = a Meta não respondeu essa métrica
// Trocar null por 0 (com `|| 0`, o reflexo natural) faz o painel afirmar um
// desempenho ruim que ele não mediu. Nesta ferramenta, número inventado é pior
// que espaço em branco.
const _ou = (v) => (v === undefined || v === null ? null : Number(v));

export function lerMetricas(midia, insights) {
  return {
    curtidas: _ou(midia?.like_count),
    comentarios: _ou(midia?.comments_count),
    alcance: _ou(_insight(insights, 'reach')),
    salvamentos: _ou(_insight(insights, 'saved')),
    compartilhamentos: _ou(_insight(insights, 'shares')),
    // 'views' é o nome novo; 'impressions' é o antigo, que ainda volta em
    // algumas contas. Aceitar os dois evita coluna vazia sem motivo aparente.
    visualizacoes: _ou(_insight(insights, 'views', 'impressions')),
    // O bruto permite recalcular o passado quando a Meta trocar um nome de novo
    // — sem ele, seria preciso coletar tudo outra vez (e post velho não volta).
    bruto: { midia: midia || null, insights: insights || null },
  };
}
