// Autorização das funções chamadas pelo pg_cron.
//
// POR QUE ISTO EXISTE
//
// O toggle `verify_jwt` do gateway NÃO protege nada aqui: ele só confere que o JWT
// foi assinado pelo projeto — e a chave anon É um JWT desses, publicada no bundle
// público do site (o repositório é público). Quem abre o site copia a chave.
//
// Isso não era teoria: o cron do `coletar-dados` mandava exatamente a anon key, e o
// do `auditar-dados` não mandava cabeçalho de autorização nenhum, com
// verify_jwt=false — ou seja, era um endpoint aberto na internet que apagava a
// trilha de auditoria, gastava a cota da Graph API e disparava o webhook de alerta.
//
// A auth aqui é SELF-CONTAINED (não depende de toggle do gateway) e FAIL-CLOSED
// (qualquer erro nega). O segredo vive na tabela `segredos_de_cron`, que tem RLS
// ligada e zero policies: só o service role lê. O pg_cron monta o cabeçalho lendo
// dessa tabela na hora de disparar, então o segredo também não aparece no texto de
// `cron.job.command`.
//
// Mesmo espírito da `fabrica-purga`, que já usava segredo dedicado + comparação em
// tempo constante — só que sem depender de variável de ambiente.

import { createClient } from "jsr:@supabase/supabase-js@2";

// Comparação em tempo constante: evita que o atacante descubra o segredo medindo
// quanto tempo a comparação leva a cada caractere certo.
export function igualTempoConstante(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}

const naoAutorizado = () =>
  new Response(JSON.stringify({ error: "nao_autorizado" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });

/**
 * Devolve `null` se o chamador está autorizado, ou a Response 401 pronta se não.
 *
 * Uso:
 *   const negado = await exigirSegredoDeCron(req, "auditar-dados");
 *   if (negado) return negado;
 *
 * @param req  a requisição recebida
 * @param nome a chave em `segredos_de_cron` (ex.: "auditar-dados")
 */
export async function exigirSegredoDeCron(req: Request, nome: string): Promise<Response | null> {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return naoAutorizado();

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await sb
      .from("segredos_de_cron")
      .select("segredo")
      .eq("nome", nome)
      .single();

    // Fail-closed: sem segredo cadastrado, ninguém entra. Melhor a coleta parar
    // barulhentamente (401 visível em cron.job_run_details) do que o endpoint ficar
    // aberto por causa de um erro de configuração.
    if (error || !data?.segredo) return naoAutorizado();

    if (!igualTempoConstante(auth, `Bearer ${data.segredo}`)) return naoAutorizado();
    return null;
  } catch {
    return naoAutorizado();
  }
}
