import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baldeDoObjetivo, ehDeWhatsapp, baldeEfetivo } from './baldes.js';

test('cada objetivo cai no seu balde', () => {
  assert.equal(baldeDoObjetivo('OUTCOME_TRAFFIC'), 'trafego');
  assert.equal(baldeDoObjetivo('OUTCOME_SALES'), 'vendas');
  assert.equal(baldeDoObjetivo('OUTCOME_ENGAGEMENT'), 'engajamento');
  assert.equal(baldeDoObjetivo('MESSAGES'), 'mensagens');
  assert.equal(baldeDoObjetivo('OUTCOME_LEADS'), 'leads');
  assert.equal(baldeDoObjetivo('outcome_traffic'), 'trafego', 'minusculo tambem');
});

test('objetivo desconhecido cai em padrao, que NAO tem meta', () => {
  // Sem meta, o calculo devolve 'sem-dados' — melhor que julgar pela regua errada.
  assert.equal(baldeDoObjetivo('COISA_NOVA_DA_META'), 'padrao');
  assert.equal(baldeDoObjetivo(null), 'padrao');
  assert.equal(baldeDoObjetivo(''), 'padrao');
});

test('WhatsApp vem do CONJUNTO, que e o que a Meta AFIRMA', () => {
  assert.equal(ehDeWhatsapp([{ destination_type: 'WHATSAPP' }]), true);
  assert.equal(ehDeWhatsapp([{ optimization_goal: 'CONVERSATIONS' }]), true);
  assert.equal(ehDeWhatsapp([{ destination_type: 'PROFILE_VISIT' }]), false);
  assert.equal(ehDeWhatsapp([]), false);
  assert.equal(ehDeWhatsapp(null), false);
});

test('engajamento com destino WhatsApp e medido como mensagem', () => {
  assert.equal(baldeEfetivo('OUTCOME_ENGAGEMENT', [{ destination_type: 'WHATSAPP' }]), 'mensagens');
});

test('campanha da Raissa com conversa de tabela NAO vira mensagem', () => {
  // O caso real: "[TRÁFEGO] VIAGENS | PERFIL", 4.601 curtidas e 18 conversas
  // espontaneas, era medida a R$ 317 por conversa contra meta de R$ 15.
  assert.equal(baldeEfetivo('OUTCOME_ENGAGEMENT', [{ destination_type: 'PROFILE_VISIT' }]), 'engajamento');
  assert.equal(baldeEfetivo('OUTCOME_ENGAGEMENT', [{ optimization_goal: 'POST_ENGAGEMENT' }]), 'engajamento');
});

test('destino WhatsApp vale para QUALQUER objetivo, nao so engajamento', () => {
  // Os dados mandaram (2026-07-29): a "[Leads] Para WhatsApp" da Motoeasy gastou
  // R$ 9.738 com 2 leads e 1.020 conversas. Medida por lead dava R$ 4.869 — um
  // numero sem significado. Sao 8 campanhas e R$ 33.314 em 90 dias assim.
  assert.equal(baldeEfetivo('OUTCOME_LEADS', [{ destination_type: 'WHATSAPP' }]), 'mensagens');
  assert.equal(baldeEfetivo('OUTCOME_TRAFFIC', [{ optimization_goal: 'CONVERSATIONS' }]), 'mensagens');
  assert.equal(baldeEfetivo('OUTCOME_SALES', [{ destination_type: 'WHATSAPP' }]), 'mensagens');
});

test('SEM destino WhatsApp cada objetivo continua no seu balde', () => {
  // A trava contra o bug de 2026-07-28: o sinal e o que a Meta AFIRMA no
  // conjunto, nunca o resultado. Campanha de lead comum segue lead.
  assert.equal(baldeEfetivo('OUTCOME_LEADS', [{ destination_type: 'ON_AD' }]), 'leads');
  assert.equal(baldeEfetivo('OUTCOME_TRAFFIC', [{ optimization_goal: 'LINK_CLICKS' }]), 'trafego');
  assert.equal(baldeEfetivo('OUTCOME_SALES', []), 'vendas');
});
