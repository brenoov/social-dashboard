// Traduz a resposta crua do Zoho WorkDrive para linhas da tabela acessos_recursos.
//
// Este arquivo é PURO de propósito: não importa nada, não fala com banco, não faz
// rede. É o pedaço que dá pra testar com `node --test` sem subir nada. Se importasse
// a cadeia do Supabase, o teste no Node quebraria com "window is not defined".
//
// O formato que o Zoho devolve é JSON:API — os campos ficam dentro de "attributes",
// não na raiz do objeto:
//
//   { "data": [ { "id": "b71f5...", "type": "files",
//                 "attributes": { "name": "01. Gestão de Serviços",
//                                 "is_folder": true, "type": "folder",
//                                 "parent_id": "wbp6s...", "status": 1,
//                                 "permalink": "https://workdrive.zoho.com/folder/..." } } ] }
//
// Confirmado contra a API real em 2026-07-17 (ver o cabeçalho do index.ts).

// Uma pasta só entra se o Zoho disser que é pasta.
//
// Por que checar os dois campos: a listagem de "files" devolve pasta E arquivo
// misturados, e o que separa um do outro é is_folder / type='folder'. Sem esta
// checagem, um PDF solto na raiz viraria um "recurso" na tela de Acessos.
function ehPasta(item) {
  const attrs = (item && item.attributes) || {};
  if (attrs.is_folder === true) return true;
  if (typeof attrs.type === "string" && attrs.type.toLowerCase() === "folder") return true;
  // 'teamfolders' é a pasta de equipe (o container de tudo). Também é pasta.
  if (typeof item?.type === "string" && item.type.toLowerCase() === "teamfolders") return true;
  return false;
}

// status=1 é pasta ativa. Pasta na lixeira vem com outro status e não deve
// virar recurso — senão a tela mostra pasta que não existe mais.
function estaAtiva(item) {
  const attrs = (item && item.attributes) || {};
  if (attrs.status === undefined || attrs.status === null) return true; // sem informação: não descarta
  return Number(attrs.status) === 1;
}

function nomeDaPasta(item) {
  const attrs = (item && item.attributes) || {};
  const nome = attrs.name ?? attrs.display_name ?? attrs.folder_name;
  const limpo = typeof nome === "string" ? nome.trim() : "";
  return limpo || "(sem nome)";
}

/**
 * Pega a resposta crua de uma listagem do WorkDrive e devolve só as pastas,
 * já normalizadas. Ignora arquivo, item na lixeira e item sem id.
 *
 * @param {any} resposta corpo JSON:API do Zoho ({ data: [...] })
 * @returns {Array<{externalId:string, nome:string, paiId:string|null, link:string|null}>}
 */
export function normalizarPastasDoWorkdrive(resposta) {
  const dados = Array.isArray(resposta?.data) ? resposta.data : [];
  const pastas = [];
  for (const item of dados) {
    if (!ehPasta(item)) continue;
    if (!estaAtiva(item)) continue;
    const externalId = item?.id != null ? String(item.id) : "";
    if (!externalId) continue; // sem id não dá pra deduplicar nem compartilhar depois
    const attrs = item.attributes || {};
    pastas.push({
      externalId,
      nome: nomeDaPasta(item),
      paiId: attrs.parent_id != null ? String(attrs.parent_id) : null,
      link: typeof attrs.permalink === "string" ? attrs.permalink : null,
    });
  }
  return pastas;
}

/**
 * Monta as linhas prontas pra gravar em acessos_recursos.
 *
 * driveId = id da pasta de equipe (team folder) que contém a pasta. É por ele que
 * o compartilhamento vai saber em que espaço a pasta vive — por isso é guardado
 * agora, mesmo sem compartilhar ainda.
 *
 * @param {Array} pastas saída de normalizarPastasDoWorkdrive
 * @param {{driveId?: string|null, prefixoDoCaminho?: string|null}} opcoes
 */
export function montarLinhasDeRecursos(pastas, opcoes = {}) {
  const driveId = opcoes.driveId != null ? String(opcoes.driveId) : null;
  const prefixo = (opcoes.prefixoDoCaminho || "").trim();
  return (pastas || []).map((p) => ({
    tipo: "workdrive",
    provedor: "zoho",
    nome: p.nome,
    external_id: p.externalId,
    drive_id: driveId,
    caminho: prefixo ? `${prefixo}/${p.nome}` : p.nome,
  }));
}

/**
 * Decide o que inserir: só o que ainda não está no banco.
 *
 * Idempotência: a chave é o external_id. Rodar a importação duas vezes não pode
 * criar pasta repetida — a segunda rodada tem que ver "já existe" e não fazer nada.
 *
 * @param {Array} linhas linhas candidatas (saída de montarLinhasDeRecursos)
 * @param {Array<string>} externalIdsExistentes ids já gravados no banco
 */
export function separarNovasDasExistentes(linhas, externalIdsExistentes) {
  const jaTem = new Set((externalIdsExistentes || []).map((id) => String(id)));
  const novas = [];
  const existentes = [];
  const vistas = new Set(); // a própria resposta do Zoho pode repetir; não duplica dentro da rodada
  for (const linha of linhas || []) {
    const id = String(linha.external_id);
    if (jaTem.has(id) || vistas.has(id)) {
      existentes.push(linha);
      continue;
    }
    vistas.add(id);
    novas.push(linha);
  }
  return { novas, existentes };
}
