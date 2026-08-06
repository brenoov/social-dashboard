// LIGAR UM LOGIN AO CADASTRO DE COLABORADOR — a decisão, sem a tela.
//
// POR QUE EXISTE: a primeira versão da tela cruzava login × cadastro SÓ por
// `profile_id`. A Raíssa tem cadastro ativo com o e-mail idêntico ao login e
// `profile_id` nulo — a tela dizia "sem cadastro de colaborador" quando o
// cadastro estava ali. Foi o dono quem percebeu.
//
// POR QUE É PURO E TESTADO: um casamento errado dá a lotação e o histórico de
// uma pessoa para outra. É barato de errar e caro de perceber.
//
// ESTE MÓDULO NÃO LIGA NADA. Ele devolve o que a tela deve oferecer, e quem
// confirma é sempre o dono.

const cru = (s) => String(s || '').trim().toLowerCase()

// O e-mail do colaborador pode estar em qualquer um dos dois campos.
const emailsDo = (c) => [cru(c && c.email_corporativo), cru(c && c.conta_apple)].filter(Boolean)

export function estadoDoVinculo(login, colaboradores) {
  const lista = Array.isArray(colaboradores) ? colaboradores.filter(Boolean) : []
  const id = login && login.id
  const email = cru(login && login.email)

  // 1. Já ligado vence tudo, inclusive ambiguidade de e-mail: o vínculo
  //    explícito é uma decisão que alguém já tomou.
  const ligado = id ? lista.find((c) => c.profile_id && String(c.profile_id) === String(id)) : null
  if (ligado) return { estado: 'ligado', colaborador: ligado }

  // Sem e-mail não há como casar. Dois vazios "batendo" fariam todo mundo
  // casar com todo mundo.
  if (!email) return { estado: 'sem-cadastro', colaborador: null }

  // 2. Candidatos: e-mail bate E o cadastro ainda não é de outra pessoa.
  //    Cadastro já ligado a OUTRO login está fora — sugeri-lo seria oferecer
  //    um clique que rouba o cadastro alheio.
  const candidatos = lista.filter((c) => !c.profile_id && emailsDo(c).includes(email))

  if (candidatos.length === 1) return { estado: 'sugestao', colaborador: candidatos[0] }

  // 3. Mais de um com o mesmo e-mail: caixa compartilhada. Escolher seria
  //    chutar qual pessoa recebe a lotação.
  if (candidatos.length > 1) return { estado: 'ambiguo', colaborador: null }

  return { estado: 'sem-cadastro', colaborador: null }
}
