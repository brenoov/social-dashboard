// ============================================================================
// REMENDO CONSCIENTE — NÃO É A SOLUÇÃO FINAL. NÃO COPIE ESTE PADRÃO.
//
// Hoje existem DOIS campos de permissão na tabela `profiles`, e eles precisam
// andar juntos porque metade do sistema lê um e metade lê o outro:
//
//   - `permissions` (jsonb) — o modelo NOVO, recurso→ações.
//     Ex.: { "meta.gestor": ["ver", "editar"] }. Quem lê: o FRONT, via
//     hasPermission() em controle-de-login-e-usuario.js.
//
//   - `features` (text[]) — o modelo ANTIGO, nível de módulo.
//     Ex.: ['social', 'meta', 'banco']. Quem lê: as EDGE FUNCTIONS
//     (meta-proxy, insights-ao-vivo, bling-proxy, acessos-proxy,
//     contar-collabs, serie-novos-dia).
//
// O painel de admin gravava só em `permissions{}` e nunca atualizava
// `features[]`. Resultado: quem era cadastrado depois da migração de
// permissões ficava com `features` no default ['banco'] — o front liberava a
// tela e a Edge Function negava. Sintomas reais: "sem permissão" na Análise de
// Campanhas e "nenhuma campanha encontrada" na Gestão de Tráfego.
//
// Esta função é a regra única de derivação `permissions{}` → `features[]`,
// para o painel de admin e para um futuro backfill usarem exatamente a mesma
// lógica (foi ela que corrigiu os 7 usuários já afetados no banco).
//
// A SOLUÇÃO FINAL (Onda 3, já especificada em
// docs/superpowers/specs/2026-07-16-seguranca-e-dados-design.md) elimina o
// `features[]` de vez e deixa uma função SQL `tem_permissao(recurso, acao)`
// como fonte única de verdade. Enquanto essa Onda não chega, a duplicação
// abaixo é obrigatória — ela NÃO é intencional nem desejada.
// ============================================================================

// Módulos-pai que NÃO devem ser derivados: não são módulos de verdade, só
// existem como prefixo de um filho. 'claude' só existe como 'claude.status'.
const PAIS_QUE_NAO_EXISTEM = ['claude']

/**
 * Deriva a lista `features[]` (modelo antigo, lido pelas Edge Functions) a
 * partir do objeto `permissions{}` (modelo novo, lido pelo front).
 *
 * A regra, exatamente:
 *   - para cada chave de `permissions` cujo array de ações contenha 'ver',
 *     inclui a própria chave em `features`;
 *   - inclui também o módulo-pai (o trecho antes do primeiro ponto), exceto
 *     quando esse pai está em PAIS_QUE_NAO_EXISTEM;
 *   - chave sem 'ver' não entra (nem ela, nem o pai dela).
 *
 * Exemplo:
 *   { "meta.gestor": ["ver","editar"], "social": ["ver"], "claude.status": ["ver"] }
 *   → ['claude.status', 'meta', 'meta.gestor', 'social']
 *
 * @param {Object<string, string[]>} permissions objeto recurso→ações.
 * @returns {string[]} lista de features, sem repetição e em ordem alfabética
 *                     (ordenada só para o resultado ser sempre o mesmo).
 */
export function derivarFeatures(permissions) {
  const features = new Set()

  for (const [chave, acoes] of Object.entries(permissions || {})) {
    // Só quem pode 'ver' entra. Sem 'ver', a chave é ignorada por inteiro.
    if (!Array.isArray(acoes) || !acoes.includes('ver')) continue

    features.add(chave)

    // O módulo-pai é o trecho antes do primeiro ponto. Para uma chave sem
    // ponto, o pai é a própria chave — o Set já cuida da repetição.
    const pai = chave.split('.')[0]
    if (!PAIS_QUE_NAO_EXISTEM.includes(pai)) features.add(pai)
  }

  return [...features].sort()
}
