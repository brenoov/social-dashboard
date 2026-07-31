// As datas que mexem com varejo, num lugar só.
//
// POR QUE AQUI, NUMA PASTA DO FRONT, SE QUEM MAIS USA É O ROBÔ: porque as duas
// pontas precisam da MESMA tabela. O robô manda isto no briefing e a tela mostra
// à pessoa o que foi mandado. Se cada lado tivesse a sua cópia, um dia a tela
// diria "Dia das Mães" enquanto o prompt dizia outra coisa — e ninguém
// descobriria, porque nada quebra.
//
// `coletor/conteudo-contexto.mjs` importa este arquivo por caminho relativo.
// Mantenha-o PURO: sem Vue, sem import de banco, sem window.

export const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

// Não é calendário completo de propósito: é o que faz diferença para quem vende.
export const DATAS_DO_MES = {
  1: 'volta às aulas, liquidação de verão',
  2: 'Carnaval',
  3: 'Dia do Consumidor (15), início do outono',
  4: 'Páscoa',
  5: 'Dia das Mães (2º domingo) — a data mais forte do varejo depois do Natal',
  6: 'Dia dos Namorados (12), festas juninas',
  7: 'férias escolares, liquidação de inverno',
  8: 'Dia dos Pais (2º domingo)',
  9: 'Dia do Cliente (15), início da primavera',
  10: 'Dia das Crianças (12)',
  11: 'Black Friday (última sexta)',
  12: 'Natal, retrospectiva do ano',
};

export const SEM_DATA = 'nada marcante no calendário comercial';

export function nomeDoMes(mes) {
  return MESES[Number(mes) - 1] || '';
}

export function datasDoMes(mes) {
  return DATAS_DO_MES[Number(mes)] || SEM_DATA;
}

// A frase que a tela mostra. Aceita Date ou o número do mês para não obrigar
// quem chama a saber que o mês do JavaScript começa em zero — origem clássica
// de erro de um mês.
export function descricaoDoMes(quando) {
  const mes = quando instanceof Date ? quando.getMonth() + 1 : Number(quando);
  const nome = nomeDoMes(mes);
  if (!nome) return SEM_DATA;
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)}: ${datasDoMes(mes)}`;
}
