# Central de Inteligência RBV

## ANTES DE ESCREVER QUALQUER LINHA

Leia **[PADRAO-DA-CENTRAL.md](PADRAO-DA-CENTRAL.md)**. Ele é obrigatório e vale
para toda tela, toda ferramenta nova e todo ajuste em tela existente.

Cada regra de lá está lá porque um defeito real chegou às mãos do dono. Não é
guia de estilo opinativo: é a lista do que já quebrou.

O resumo, se você só ler uma linha: **nada de jeitinho.** Cor sai de token, botão
tem três tipos e só, texto nunca corta, e toda entrega se mede a 375px num
navegador de verdade — não se deduz.

## Como rodar

```bash
npm test                            # suíte inteira
npm run build                       # build de produção
npm run dev -- --port 5199 --strictPort   # porta fixa: há mais de uma janela neste repositório
```

`coletor/.env` é gitignored e não vem em worktree novo — copie do checkout
principal, senão dois testes da fábrica falham por credencial ausente.

## Onde ficam as coisas

| | |
|---|---|
| Padrão obrigatório | `PADRAO-DA-CENTRAL.md` |
| Tokens (cor, espaço, fonte, botões) | `src/estilos/estilos-globais.css` |
| Telas | `src/ferramentas/<ferramenta>/` |
| Lógica pura + teste ao lado | `src/ferramentas/<ferramenta>/*.js` + `*.test.mjs` |
| Edge Functions | `supabase/functions/` |
| Robôs e scripts | `coletor/` |
| Desenhos e planos | `docs/superpowers/{specs,plans}/` |
