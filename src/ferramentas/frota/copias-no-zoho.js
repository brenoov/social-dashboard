/* O QUE A ABA GESTÃO DIZ SOBRE AS CÓPIAS EM PDF DAS FICHAS ASSINADAS.
 *
 * Desenho: docs/superpowers/specs/2026-08-06-frota-checklist-assinatura-design.md (D23)
 *
 * POR QUE ISTO EXISTE. A tabela `frota_checklist_pdf` já guardava tudo — quem
 * subiu, quem falhou, e uma frase em português dizendo o que fazer — e nada
 * disso aparecia em lugar nenhum. Quem escreveu a migration deixou anotado o
 * motivo com todas as letras: *uma fila que ninguém enxerga é exatamente como
 * um papel sumir sem ninguém notar.* Este arquivo é a tradução daquelas linhas
 * pro que o gestor lê na tela.
 *
 * AS DUAS COISAS QUE ESTA TELA NÃO PODE FAZER, e é por elas que a lógica está
 * aqui, testada, em vez de num punhado de `?:` dentro do template:
 *
 * 1) NÃO PODE CHAMAR ESPERA DE PROBLEMA. O robô roda de 10 em 10 minutos. Uma
 *    ficha assinada há dois minutos está esperando a vez, e isso é o relógio,
 *    não defeito. Pintar isso de vermelho ensinaria o gestor a ignorar
 *    vermelho — e aí o vermelho de verdade também some.
 *
 * 2) NÃO PODE DAR A ENTENDER QUE A FICHA VALE MENOS. O PDF é CÓPIA. A prova é
 *    a ficha assinada, que já está gravada no banco desde o segundo em que foi
 *    assinada. Papel atrasado não invalida nada.
 *
 * SÃO TRÊS SITUAÇÕES, NÃO DUAS, e a do meio é a que quase se perdeu:
 *
 *   esperando   — está na fila e nunca deu erro. Neutro. Só o relógio.
 *   tropeçou    — já deu erro pelo menos uma vez, MAS o robô continua tentando
 *                 sozinho (`na_fila`/`enviando` com `ultimo_erro` escrito).
 *   desistiu    — `situacao = 'falhou'`: o robô tentou 8 vezes e parou. Daqui
 *                 pra frente só sai se alguém fizer alguma coisa.
 *
 * "Tropeçou" precisa aparecer porque o robô só desiste depois de 8 tentativas,
 * ou seja ~80 minutos. Se o Zoho estiver desconectado às 8h, a frase que manda
 * reconectar ficaria invisível a manhã inteira se só `falhou` fosse mostrado —
 * e o conserto é de trinta segundos. Mas ele NÃO é vermelho: o robô ainda está
 * cuidando disso sozinho.
 *
 * O `ultimo_erro` VAI PRA TELA COMO ESTÁ. Ele já foi escrito em português
 * dizendo o que fazer ("Abra Acessos → Zoho e clique em conectar"). Resumir
 * isso pra "erro ao enviar" jogaria fora exatamente a parte útil.
 */

/** 'YYYY-MM-DDTHH:MM:SSZ' vira '12/03/2026', no fuso de quem lê. */
function dataBR(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

/* Como esta linha se chama na tela. O nome do carro é o que o gestor reconhece,
 * então ele vem primeiro. Quando a ficha é mais velha que a janela de 120 dias
 * que a tela carrega, o carro é desconhecido — e aí a tela DIZ a data em vez de
 * inventar um nome. Nunca "—", que pareceria dado faltando. */
export function nomeDaLinha({ linha, fichas, veiculos }) {
  const ficha = (fichas || []).find((f) => f.id === linha.checklist_id) || null;
  const veiculo = ficha ? (veiculos || []).find((v) => v.id === ficha.veiculo_id) : null;
  if (veiculo && veiculo.nome) return veiculo.nome;
  const quando = dataBR(linha.criado_em);
  return quando ? `Ficha assinada em ${quando}` : 'Ficha antiga';
}

/* Uma frase por MOTIVO, não uma linha por ficha. Quando o Zoho cai, as nove
 * fichas do dia trazem exatamente o mesmo `ultimo_erro` — nove cópias do mesmo
 * parágrafo empurrariam o resto da Gestão pra fora da tela e ainda fariam um
 * problema só parecer nove. Agrupado: a frase uma vez, os carros embaixo. */
function agrupar(linhas, gravidade, fichas, veiculos) {
  const porMotivo = new Map();
  for (const l of linhas) {
    const mensagem = (l.ultimo_erro || '').trim()
      || 'O robô não escreveu o motivo desta vez. Se continuar assim, avise quem cuida da central.';
    if (!porMotivo.has(mensagem)) porMotivo.set(mensagem, []);
    porMotivo.get(mensagem).push(nomeDaLinha({ linha: l, fichas, veiculos }));
  }
  return [...porMotivo.entries()].map(([mensagem, nomes]) => ({
    gravidade,
    mensagem,
    veiculos: nomes,
    quantos: nomes.length,
    titulo: tituloDoGrupo(gravidade, nomes.length),
  }));
}

function tituloDoGrupo(gravidade, quantos) {
  if (gravidade === 'desistiu') {
    return quantos === 1
      ? 'Uma cópia que o robô tentou várias vezes e parou:'
      : `${quantos} cópias que o robô tentou várias vezes e parou:`;
  }
  return quantos === 1
    ? 'Uma cópia tropeçou; o robô continua tentando sozinho:'
    : `${quantos} cópias tropeçaram; o robô continua tentando sozinho:`;
}

/**
 * O resumo inteiro do quadro.
 *
 * @param linhas    as linhas de `frota_checklist_pdf` que ainda NÃO foram
 *                  entregues (a tela pede `situacao <> 'enviado'`, porque as
 *                  entregues crescem pra sempre e não têm nada a dizer).
 * @param entregues quantas já estão na pasta do Zoho (contagem, não as linhas).
 * @param fichas    `frota_checklist` carregadas, pra achar o carro de cada uma.
 * @param veiculos  `frota_veiculos`, pra achar o nome do carro.
 * @param falhaLeitura true quando a consulta em si falhou — que é diferente de
 *                  "não tem nada". Sem essa distinção, uma queda de rede viraria
 *                  "está tudo em dia", que é a mentira mais cara deste quadro.
 */
export function resumoDasCopias({
  linhas = [], entregues = 0, fichas = [], veiculos = [], falhaLeitura = false,
} = {}) {
  if (falhaLeitura) {
    return {
      falhaLeitura: true, esperando: 0, tropecos: 0, desistidas: 0,
      grupos: [], temProblema: false, frase: '',
    };
  }

  const vivas = (linhas || []).filter((l) => l && l.situacao !== 'enviado');
  const desistidas = vivas.filter((l) => l.situacao === 'falhou');
  // "Tropeçou" é ter erro escrito e ainda estar na fila. `enviando` entra junto
  // com `na_fila`: pra quem olha a tela, as duas são "ainda não chegou lá".
  const tropecos = vivas.filter((l) => l.situacao !== 'falhou' && !!(l.ultimo_erro || '').trim());
  const esperando = vivas.filter((l) => l.situacao !== 'falhou' && !(l.ultimo_erro || '').trim());

  const grupos = [
    // Primeiro o que precisa de gente, depois o que o robô ainda resolve.
    ...agrupar(desistidas, 'desistiu', fichas, veiculos),
    ...agrupar(tropecos, 'tentando', fichas, veiculos),
  ];

  return {
    falhaLeitura: false,
    esperando: esperando.length,
    tropecos: tropecos.length,
    desistidas: desistidas.length,
    grupos,
    temProblema: grupos.length > 0,
    frase: fraseDoQuadro({
      esperando: esperando.length,
      pendentesComErro: desistidas.length + tropecos.length,
      entregues: entregues || 0,
    }),
  };
}

/* A LINHA DISCRETA — a única coisa que aparece quando está tudo bem.
 *
 * O gestor abre a Gestão pra cobrar checklist, não pra administrar arquivo.
 * Quando não há nada errado, este quadro tem que caber numa frase; ele só
 * cresce quando há problema. E o estado de HOJE (nenhuma ficha assinada ainda)
 * é o primeiro que o dono vai ver — por isso ele explica o que vai acontecer,
 * em vez de parecer uma caixa vazia que deu defeito. */
export function fraseDoQuadro({ esperando = 0, pendentesComErro = 0, entregues = 0 } = {}) {
  if (pendentesComErro > 0) {
    // A CONTA DA MANCHETE É SÓ DAS QUE DERAM PROBLEMA. Somar as que estão só
    // esperando daria um número maior do que os cartões que aparecem embaixo —
    // e ainda contaria como falha uma ficha que está apenas na vez dela. As que
    // esperam entram numa segunda frase, sem alarme.
    const manchete = pendentesComErro === 1
      ? 'Uma cópia ainda não chegou na pasta do Zoho.'
      : `${pendentesComErro} cópias ainda não chegaram na pasta do Zoho.`;
    if (!esperando) return manchete;
    return `${manchete} ${esperando === 1
      ? 'Outra está só esperando a vez.'
      : `Outras ${esperando} estão só esperando a vez.`}`;
  }
  if (esperando > 0) {
    return esperando === 1
      ? 'Uma cópia esperando a vez. O robô sobe de 10 em 10 minutos.'
      : `${esperando} cópias esperando a vez. O robô sobe de 10 em 10 minutos.`;
  }
  if (entregues > 0) {
    return entregues === 1
      ? 'A cópia da ficha assinada já está na pasta do Zoho.'
      : `As ${entregues} cópias das fichas assinadas já estão na pasta do Zoho.`;
  }
  return 'Nenhuma ficha foi assinada ainda. Quando a primeira for, a cópia em PDF '
    + 'vai sozinha pra pasta do Zoho.';
}
