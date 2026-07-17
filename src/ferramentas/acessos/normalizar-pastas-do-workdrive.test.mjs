// Testes da tradução "resposta do Zoho WorkDrive" -> "linhas de acessos_recursos".
//
// O módulo testado mora junto da Edge Function (supabase/functions/acessos-proxy/)
// porque é lá que ele roda. O teste vive aqui porque o `npm test` só varre
// src/** e coletor/**. Um arquivo só, sem cópia — cópia vira drift.
//
// Os exemplos abaixo NÃO são inventados: são recortes da resposta real da API,
// coletados em 2026-07-17 da conta RBV & Company.
import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizarPastasDoWorkdrive,
  montarLinhasDeRecursos,
  separarNovasDasExistentes,
} from "../../../supabase/functions/acessos-proxy/normalizar-pastas-do-workdrive.js";

// Recorte fiel de GET /teamfolders/<id>/folders
const RESPOSTA_REAL = {
  data: [
    {
      id: "b71f53e58f4d3383f4aebb9b3439c64851002",
      type: "files",
      attributes: {
        name: "01. Gestão de Serviços",
        is_folder: true,
        type: "folder",
        parent_id: "wbp6sefe483fe7da14c6ebe53225105f1f389",
        status: 1,
        permalink: "https://workdrive.zoho.com/folder/b71f53e58f4d3383f4aebb9b3439c64851002",
      },
    },
    {
      id: "b71f5dac92fa7fb544d8f8d5d81f9308d7f4d",
      type: "files",
      attributes: {
        name: "02. Herculano",
        is_folder: true,
        type: "folder",
        parent_id: "wbp6sefe483fe7da14c6ebe53225105f1f389",
        status: 1,
        permalink: "https://workdrive.zoho.com/folder/b71f5dac92fa7fb544d8f8d5d81f9308d7f4d",
      },
    },
  ],
};

test("le a resposta real do Zoho e extrai as pastas", () => {
  const pastas = normalizarPastasDoWorkdrive(RESPOSTA_REAL);
  assert.equal(pastas.length, 2);
  assert.equal(pastas[0].nome, "01. Gestão de Serviços");
  assert.equal(pastas[0].externalId, "b71f53e58f4d3383f4aebb9b3439c64851002");
  assert.equal(pastas[0].paiId, "wbp6sefe483fe7da14c6ebe53225105f1f389");
  assert.equal(pastas[1].nome, "02. Herculano");
});

test("arquivo solto na pasta nao vira recurso", () => {
  // A listagem de "files" devolve pasta e arquivo misturados.
  const comArquivo = {
    data: [
      ...RESPOSTA_REAL.data,
      {
        id: "arq1",
        type: "files",
        attributes: { name: "contrato.pdf", is_folder: false, type: "pdf", status: 1 },
      },
    ],
  };
  const pastas = normalizarPastasDoWorkdrive(comArquivo);
  assert.equal(pastas.length, 2);
  assert.ok(!pastas.some((p) => p.nome === "contrato.pdf"));
});

test("pasta na lixeira nao vira recurso", () => {
  const comLixeira = {
    data: [
      {
        id: "lix1",
        type: "files",
        attributes: { name: "Pasta apagada", is_folder: true, type: "folder", status: 2 },
      },
    ],
  };
  assert.equal(normalizarPastasDoWorkdrive(comLixeira).length, 0);
});

test("a pasta de equipe (teamfolders) tambem conta como pasta", () => {
  const teamFolder = {
    data: [
      {
        id: "wbp6sefe483fe7da14c6ebe53225105f1f389",
        type: "teamfolders",
        attributes: { name: "01. RBV and Company", is_built_in: false, status: 1 },
      },
    ],
  };
  const pastas = normalizarPastasDoWorkdrive(teamFolder);
  assert.equal(pastas.length, 1);
  assert.equal(pastas[0].nome, "01. RBV and Company");
});

test("item sem id e ignorado (sem id nao da pra deduplicar depois)", () => {
  const semId = { data: [{ type: "files", attributes: { name: "X", is_folder: true, status: 1 } }] };
  assert.equal(normalizarPastasDoWorkdrive(semId).length, 0);
});

test("pasta sem nome nao quebra: vira (sem nome)", () => {
  const semNome = { data: [{ id: "a1", type: "files", attributes: { is_folder: true, status: 1 } }] };
  assert.equal(normalizarPastasDoWorkdrive(semNome)[0].nome, "(sem nome)");
});

test("resposta vazia ou estranha nao explode", () => {
  assert.deepEqual(normalizarPastasDoWorkdrive({ data: [] }), []);
  assert.deepEqual(normalizarPastasDoWorkdrive({}), []);
  assert.deepEqual(normalizarPastasDoWorkdrive(null), []);
  assert.deepEqual(normalizarPastasDoWorkdrive({ data: "nao e lista" }), []);
});

test("monta a linha do jeito que a tabela espera", () => {
  const pastas = normalizarPastasDoWorkdrive(RESPOSTA_REAL);
  const linhas = montarLinhasDeRecursos(pastas, {
    driveId: "wbp6sefe483fe7da14c6ebe53225105f1f389",
    prefixoDoCaminho: "01. RBV and Company",
  });
  assert.equal(linhas[0].tipo, "workdrive");
  assert.equal(linhas[0].provedor, "zoho");
  assert.equal(linhas[0].nome, "01. Gestão de Serviços");
  assert.equal(linhas[0].drive_id, "wbp6sefe483fe7da14c6ebe53225105f1f389");
  assert.equal(linhas[0].caminho, "01. RBV and Company/01. Gestão de Serviços");
});

test("sem prefixo o caminho e so o nome da pasta", () => {
  const linhas = montarLinhasDeRecursos([{ externalId: "a", nome: "Sozinha" }], {});
  assert.equal(linhas[0].caminho, "Sozinha");
  assert.equal(linhas[0].drive_id, null);
});

test("nunca grava tipo/provedor de outro provedor", () => {
  const linhas = montarLinhasDeRecursos(normalizarPastasDoWorkdrive(RESPOSTA_REAL), {});
  assert.ok(linhas.every((l) => l.tipo === "workdrive" && l.provedor === "zoho"));
});

test("importar de novo nao duplica: o que ja existe fica de fora", () => {
  const linhas = montarLinhasDeRecursos(normalizarPastasDoWorkdrive(RESPOSTA_REAL), {});
  const { novas, existentes } = separarNovasDasExistentes(linhas, [
    "b71f53e58f4d3383f4aebb9b3439c64851002",
  ]);
  assert.equal(novas.length, 1);
  assert.equal(existentes.length, 1);
  assert.equal(novas[0].external_id, "b71f5dac92fa7fb544d8f8d5d81f9308d7f4d");
});

test("banco vazio: tudo e novo", () => {
  const linhas = montarLinhasDeRecursos(normalizarPastasDoWorkdrive(RESPOSTA_REAL), {});
  const { novas } = separarNovasDasExistentes(linhas, []);
  assert.equal(novas.length, 2);
});

test("segunda rodada seguida nao insere nada", () => {
  const linhas = montarLinhasDeRecursos(normalizarPastasDoWorkdrive(RESPOSTA_REAL), {});
  const jaGravados = linhas.map((l) => l.external_id);
  const { novas } = separarNovasDasExistentes(linhas, jaGravados);
  assert.equal(novas.length, 0);
});

test("se o Zoho repetir a mesma pasta na resposta, grava uma vez so", () => {
  const linhas = montarLinhasDeRecursos(
    [
      { externalId: "rep1", nome: "Repetida" },
      { externalId: "rep1", nome: "Repetida" },
    ],
    {},
  );
  const { novas } = separarNovasDasExistentes(linhas, []);
  assert.equal(novas.length, 1);
});
