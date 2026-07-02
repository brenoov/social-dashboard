# Migração do iamundi para Vue (modularização por ferramenta)

**Data:** 2026-07-02
**Status:** Aprovado (design) — aguardando revisão do spec antes do plano
**Autor:** brenoov (+ Claude)

---

## 1. Problema

Hoje o iamundi é **um único arquivo** `index.html` com ~12.000 linhas (866 KB) contendo
tudo: HTML, CSS (um único bloco `<style>`) e JavaScript (6 blocos `<script>`).

Vão passar a trabalhar **3 pessoas em paralelo** no projeto. Como tudo vive no mesmo
arquivo, duas pessoas editando ao mesmo tempo — mesmo em telas diferentes — geram
**conflito de merge no Git** na hora de juntar o trabalho.

**Objetivo:** dividir cada ferramenta/tela em um arquivo próprio, de forma que cada
pessoa edite arquivos distintos e os conflitos desapareçam — sem quebrar o site que
está no ar.

**Decisão de tecnologia:** migrar para **Vue** (com build via **Vite**), conforme
recomendação do TI, por ser padrão de mercado para componentização e adequado a um
time de 3 pessoas.

## 2. Estado atual (mapa do que existe)

- **App de tela única (SPA "caseiro"):** existem 14 telas, cada uma um bloco
  `id="...-screen"`. A navegação mostra/esconde telas alternando a classe `active`
  (`classList.add/remove('active')`).
- **As 14 telas:** `auth` (login), `home`, `meta-ads-hub`, `meta-ads-campanha`,
  `gestao-comercial`, `gestao-trafego`, `gestao-vista`, `noticias`, `acessos`,
  `admin`, `banco`, `sales-menu`, `sales-analysis`, `sales-brand`.
- **Miolo compartilhado** (usado por todas as telas):
  - Cliente Supabase (`sbClient`) + config (`SUPABASE_URL`, `SUPABASE_ANON_KEY`),
    hoje inline por volta da linha 3208.
  - Helpers de acesso a dados ("SUPABASE FETCH", ~linha 3276) e sessão
    (`currentSession`).
  - Bibliotecas externas via CDN: `@supabase/supabase-js`, `xlsx`, `chart.js`,
    `chartjs-plugin-datalabels`.
- **CSS:** um único bloco `<style>` para o app inteiro.
- **Deploy:** Vercel serve o arquivo estático diretamente (sem build). `vercel.json`
  só define rewrites de `/midia` e headers de segurança.

## 3. Estado desejado (estrutura nova)

Projeto Vite + Vue. Cada tela vira um componente `.vue` em sua própria pasta:

```
iamundi/
├─ index.html            # pequeno: só monta o app (#app) e carrega libs
├─ package.json          # dependências do projeto
├─ vite.config.js        # config do build
├─ vercel.json           # ajustado para servir o build (dist/)
└─ src/
   ├─ main.js            # cria o app Vue + router
   ├─ App.vue            # moldura: topbar, fundo, <router-view>
   ├─ router.js          # mapa de rotas (substitui o active/hidden)
   ├─ lib/               # 🔒 MIOLO COMPARTILHADO — muda pouco, passa pelo TI
   │   ├─ supabase.js    # cliente + config
   │   ├─ api.js         # helpers de fetch ao Supabase
   │   └─ estado.js      # sessão, usuário, permissões (store reativa)
   ├─ estilos/
   │   └─ global.css     # tokens, reset, topbar (o que é realmente global)
   └─ ferramentas/       # 👥 UMA PASTA POR FERRAMENTA — dono único, sem conflito
       ├─ noticias/      # PRIMEIRA a migrar (piloto)
       │   ├─ Noticias.vue
       │   └─ LEIA-ME.txt
       ├─ home/
       ├─ meta-ads/      # Hub.vue, Campanha.vue
       ├─ gestao-comercial/
       ├─ gestao-trafego/
       ├─ gestao-vista/
       ├─ acessos/
       ├─ admin/         # tela grande; pode subdividir em sub-seções
       ├─ banco/
       ├─ sales/         # Menu.vue, Analise.vue, Marca.vue
       └─ auth/
```

**Fronteiras (o ponto central que mata o conflito):**

- **Compartilhado** (`src/lib`, `src/estilos/global.css`, `App.vue`, `router.js`):
  poucos arquivos, estáveis, editados raramente e **com combinação prévia** (regra:
  mudanças aqui passam pelo TI).
- **Por-ferramenta** (`src/ferramentas/<nome>/`): dono único. O CSS de cada tela fica
  **`scoped`** (trancado no componente), então estilos não vazam nem colidem. Duas
  pessoas em ferramentas diferentes nunca tocam o mesmo arquivo.

Cada pasta de ferramenta recebe um **`LEIA-ME.txt`** em PT, linguagem de iniciante,
explicando o que a ferramenta faz e onde mexer.

## 4. Estratégia de migração (incremental, sem quebrar produção)

Regra de ouro: **nunca reescrever tudo de uma vez**. O site no ar continua funcionando
o tempo todo; o Vue é validado num **link de teste (preview da Vercel)** até ter
paridade, e só então vira produção.

- **Fase 0 — Esqueleto Vue.** Criar projeto Vite+Vue, mover libs/CDN, `supabase.js`,
  `api.js` e `estado.js` para `src/lib`. Montar `App.vue` (moldura) + `router.js` com
  rotas vazias/placeholder. Publicar em **preview**. Produção **não muda**.
- **Fase 1 — Miolo.** Migrar `auth` (login) + `home` + estado compartilhado + CSS
  global. Login → home funcionando no Vue, no preview.
- **Fase 2 — Notícias (piloto).** Primeira ferramenta real. Mover a tela `noticias`
  para `src/ferramentas/noticias/Noticias.vue` (template = HTML da tela, lógica =
  funções `loadNoticias`/`openNoticias`/`renderNoticias...`, CSS scoped). Validar no
  preview. Serve de **modelo** para as demais.
- **Fases 3..N — Uma ferramenta por sessão.** Migrar as telas restantes, uma por
  sessão de trabalho, cada uma testada no preview antes de seguir.
- **Fase final — Virada (cutover).** Quando o preview estiver **igual** à produção,
  apontar a Vercel para o build do Vue. Guardar o `index.html` antigo (ex.:
  `legacy/index.html`) como **rollback**.

## 5. Deploy

- Passa a existir **build** (Vite gera `dist/`). `vercel.json` e/ou as configurações
  do projeto na Vercel serão ajustados para servir o build; os rewrites de `/midia` e
  os headers de segurança atuais são preservados.
- **Atenção crítica (memória do projeto):** `git user.email` vazio **trava o build na
  Vercel**. Como agora há build de verdade, manter `user.name`/`user.email` sempre
  preenchidos é obrigatório.

## 6. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Quebrar telas que já funcionam | Migração incremental + preview; produção só muda na virada final; `index.html` antigo guardado para rollback. |
| Conflito ainda possível no miolo compartilhado | Regra: ferramentas só mexem na própria pasta; mudanças em `lib/`/`global.css` passam pelo TI. CSS scoped por componente. |
| Código legado manipula o DOM direto (briga com o Vue reativo) | Migrar tela a tela reescrevendo a manipulação de DOM para o modelo do Vue dentro de cada componente; não misturar os dois na mesma tela. |
| Build novo introduz ponto de falha no deploy | Validar todo o processo em preview antes da virada; documentar o passo de build no LEIA-ME. |
| Segredos expostos | O front já é público por natureza (anon key já no cliente). Não introduzir segredos novos no bundle; manter o proxy/Edge conforme já planejado em segurança. |

## 7. Critérios de sucesso

1. Cada uma das 14 telas vive em seu próprio arquivo/pasta sob `src/ferramentas/`.
2. Três pessoas conseguem editar três ferramentas diferentes sem conflito de merge.
3. O site em produção mantém **exatamente** as funcionalidades atuais após a virada.
4. Notícias (piloto) funciona no preview idêntica à versão atual, servindo de modelo.
5. Cada pasta de ferramenta tem `LEIA-ME.txt` em PT.
6. Deploy com build do Vite funcionando; rollback disponível via `legacy/index.html`.

## 8. Fora de escopo (por enquanto)

- Redesenhar/melhorar qualquer tela (isto é só reorganização técnica; visual e
  comportamento permanecem iguais).
- Adicionar novas ferramentas ou funcionalidades.
- Trocar o Supabase, o Vercel ou o modelo de permissões.
- Testes automatizados (podem ser considerados numa fase futura).

## 9. Primeiro passo combinado

Começar por **Notícias** como ferramenta piloto (após o esqueleto e o miolo das Fases
0 e 1), por ser uma tela relativamente autocontida e de baixo risco.
