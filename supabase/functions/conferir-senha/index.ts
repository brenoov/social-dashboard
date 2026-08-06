// Confere a senha de QUEM ESTÁ LOGADO e devolve só sim ou não.
//
// POR QUE ISTO EXISTE, e é a razão de ser uma Edge Function: o único jeito de
// conferir senha pelo cliente com Supabase é signInWithPassword — que é o que
// tela-de-login.vue:111 usa —, e ele TROCA A SESSÃO. Chamá-lo pra confirmar a
// senha no meio do checklist faria o app entrar de novo, com token novo e a
// ficha pela metade na tela.
//
// O USUÁRIO SAI DO TOKEN, NUNCA DO CORPO DO PEDIDO. Aceitar um e-mail vindo do
// cliente transformaria isto num oráculo pra testar senha de terceiros.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

// Cinco erros seguidos bloqueiam por dez minutos. Sem isto a função é um jeito
// confortável de testar senhas — e ela responde rápido, o que é pior.
const LIMITE = 5;
const BLOQUEIO_MS = 10 * 60 * 1000;
const tentativas = new Map<string, { erros: number; ate: number }>();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return json({ ok: false, erro: 'sem_sessao' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;

  // Quem é quem: cliente com o token de quem chamou, só pra descobrir o usuário.
  const comToken = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: { user }, error: erroUser } = await comToken.auth.getUser();
  if (erroUser || !user?.email) return json({ ok: false, erro: 'sem_sessao' }, 401);

  const marca = tentativas.get(user.id);
  if (marca && marca.ate > Date.now()) {
    return json({ ok: false, erro: 'bloqueado', bloqueado_ate: new Date(marca.ate).toISOString() }, 429);
  }

  let senha = '';
  try { senha = String((await req.json())?.senha || ''); } catch { /* corpo inválido -> senha vazia */ }
  if (!senha) return json({ ok: false, erro: 'sem_senha' }, 400);

  // Cliente NOVO e isolado só pra esta conferência: o signIn aqui dentro cria
  // uma sessão que morre com a função e nunca chega ao navegador de ninguém.
  const isolado = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await isolado.auth.signInWithPassword({ email: user.email, password: senha });

  if (error) {
    const erros = (marca?.erros || 0) + 1;
    tentativas.set(user.id, { erros, ate: erros >= LIMITE ? Date.now() + BLOQUEIO_MS : 0 });
    return json({ ok: false, erro: 'senha_incorreta', restam: Math.max(0, LIMITE - erros) });
  }

  tentativas.delete(user.id);
  // Encerra a sessão isolada explicitamente, pra não deixar token vivo à toa.
  await isolado.auth.signOut();
  return json({ ok: true });
});
