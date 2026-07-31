// O aviso da hora H: a quem mandar e o que escrever.
//
// PURO: sem rede, sem banco. A Edge busca as peças, as inscrições, as
// preferências e os perfis, e passa tudo pra cá. É o que permite testar a parte
// que erra — o cruzamento de permissão e o texto — sem subir função nenhuma.

import { inscricoesDoTipo } from './notificacoes.js';

// Quanto tempo depois da hora marcada ainda faz sentido avisar.
//
// POR QUE EXISTE: o cron reivindica toda peça agendada com `publicar_em <=
// now()`. No primeiro deploy, ou depois de qualquer janela em que o cron ficou
// parado, isso inclui tudo que está no passado — e viraria uma enxurrada de
// pushes de posts de semanas atrás. Peça mais velha que isto é reivindicada
// (para não ficar presa) mas não gera aviso; fica registrada em conteudo_eventos.
export const HORAS_DE_TOLERANCIA = 12;

const FORMATOS = {
  feed: 'Post do feed',
  carrossel: 'Carrossel',
  reels: 'Reels',
  stories: 'Story',
};

export function atrasadaDemais(publicarEm, agora = new Date()) {
  if (!publicarEm) return true;
  const t = new Date(publicarEm).getTime();
  if (Number.isNaN(t)) return true;
  return (agora.getTime() - t) > HORAS_DE_TOLERANCIA * 3600 * 1000;
}

export function montarAvisoDePeca(peca, conta) {
  const titulo = (peca?.titulo || '').trim() || 'Peça sem título';
  const formato = FORMATOS[peca?.formato] || 'Publicação';
  const marca = (conta?.name || '').trim();

  return {
    title: `Hora de publicar: ${titulo}`,
    // O corpo responde o que a pessoa pergunta ao olhar a tela bloqueada:
    // onde posto, o quê, e já está pronto?
    body: [formato, marca, 'legenda pronta para copiar'].filter(Boolean).join(' · '),
    // Por peça, nunca fixa: o service worker usa renotify:true, então tag
    // repetida faz um aviso apagar o outro.
    tag: `conteudo-${peca?.id}`,
    url: `/conteudo/peca/${peca?.id}`,
  };
}

// Quem realmente recebe: quer o tipo E pode abrir a ferramenta.
//
// inscricoesDoTipo() sozinha só sabe de preferência. Sem cruzar com a permissão,
// alguém que perdeu o acesso continuaria recebendo o título das peças no
// celular — vazamento pequeno, mas é vazamento.
export function alvosDoAviso(inscricoes, preferencias, perfis) {
  const podem = new Set(
    (perfis || [])
      .filter(p => p && (p.role === 'admin' || p.is_superadmin || (p.features || []).includes('conteudo')))
      .map(p => String(p.id)),
  );
  return inscricoesDoTipo(inscricoes, preferencias, 'conteudo')
    .filter(s => podem.has(String(s.user_id)));
}
