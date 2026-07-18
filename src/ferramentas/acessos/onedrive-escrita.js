// Lógica PURA da ESCRITA no OneDrive (dar acesso / liberar setor). Vive separada da
// tela (.vue) de propósito: assim dá pra TESTAR a preparação dos dados sem navegador
// e — importante — sem encostar na API real da Microsoft. NENHUMA função aqui dispara
// chamada de rede; elas só arrumam a lista de e-mails ANTES de a tela chamar o proxy.

// Normaliza uma lista de e-mails antes de compartilhar: tira espaços das pontas, deixa
// tudo minúsculo (a Microsoft não diferencia maiúsculas em e-mail), descarta o que não
// parece e-mail e — o mais importante — REMOVE DUPLICADOS. Assim ninguém recebe dois
// convites da mesma pasta e o contador "vou liberar para N pessoas" bate com a verdade.
export function normalizarEmailsParaCompartilhar(lista) {
  const vistos = new Set()
  const out = []
  for (const bruto of Array.isArray(lista) ? lista : []) {
    const e = String(bruto == null ? '' : bruto).trim().toLowerCase()
    // precisa ter um "@" no meio (não no começo nem no fim) pra ser um e-mail plausível
    const at = e.indexOf('@')
    if (at <= 0 || at === e.length - 1) continue
    if (vistos.has(e)) continue
    vistos.add(e)
    out.push(e)
  }
  return out
}

// Junta os e-mails marcados no seletor de colaboradores com um e-mail avulso digitado à
// mão e normaliza o conjunto. É o que os botões "Dar acesso" e "Liberar setor" usam pra
// montar a lista final de destinatários antes de chamar o proxy.
export function montarEmailsDeSelecao(emailsSelecionados, emailAvulso) {
  const juntos = Array.isArray(emailsSelecionados) ? emailsSelecionados.slice() : []
  if (emailAvulso != null && String(emailAvulso).trim()) juntos.push(String(emailAvulso))
  return normalizarEmailsParaCompartilhar(juntos)
}

// Monta os e-mails de TODOS os membros ativos de um setor (departamento) que têm conta
// Microsoft cadastrada — é o coração do "Liberar setor" (soltar a pasta pro departamento
// inteiro de uma vez). Quem está inativo, sem e-mail Outlook, ou é de outro setor fica de
// fora: não dá pra compartilhar OneDrive com quem não tem conta Microsoft.
export function emailsDoSetor(pessoas, setorId) {
  const doSetor = (Array.isArray(pessoas) ? pessoas : []).filter(
    (p) => p && p.status === 'ativo' && p.email_outlook && p.setor_id === setorId,
  )
  return normalizarEmailsParaCompartilhar(doSetor.map((p) => p.email_outlook))
}
