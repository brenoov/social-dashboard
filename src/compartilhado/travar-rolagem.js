// TRAVAR A ROLAGEM DA PÁGINA ENQUANTO UM MODAL ESTÁ ABERTO.
//
// O PROBLEMA: com o modal aberto, a página atrás continuava rolável. No celular,
// arrastar em cima do modal movia o conteúdo de trás — parecia que a tela
// escorregava para os lados. Foi o dono quem viu, no aparelho.
//
// POR QUE É COMPARTILHADO: a Central tem vários modais (ficha da pessoa, editor
// de permissões, e os que vierem). Consertar em um só deixaria os outros com o
// mesmo defeito, e ninguém lembraria de repetir. Ver PADRAO-DA-CENTRAL.md.
//
// POR QUE UM CONTADOR, E NÃO UM BOOLEANO: dois modais podem se sobrepor (abrir o
// editor de permissões de dentro da ficha). Com booleano, fechar o de cima
// destravaria a página com o de baixo ainda aberto. O contador só destrava
// quando o último fecha.
//
// PURO O BASTANTE PARA TESTAR: recebe o documento por parâmetro.

let abertos = 0;
let rolagemGuardada = 0;

export function travarRolagem(doc) {
  const d = doc || (typeof document !== 'undefined' ? document : null);
  if (!d) return abertos;
  abertos++;
  if (abertos === 1) {
    // Guardar ONDE a pessoa estava: travar com `position:fixed` joga a página
    // para o topo, e ao fechar ela voltaria para um lugar que não era o dela.
    rolagemGuardada = (typeof window !== 'undefined' && window.scrollY) || 0;
    d.body.style.overflow = 'hidden';
    d.body.style.touchAction = 'none';
  }
  return abertos;
}

export function destravarRolagem(doc) {
  const d = doc || (typeof document !== 'undefined' ? document : null);
  if (!d) return abertos;
  // Nunca deixar negativo: um `destravar` a mais (fechar duas vezes) não pode
  // fazer o próximo `travar` não travar.
  abertos = Math.max(0, abertos - 1);
  if (abertos === 0) {
    d.body.style.overflow = '';
    d.body.style.touchAction = '';
    if (typeof window !== 'undefined' && window.scrollTo) window.scrollTo(0, rolagemGuardada);
  }
  return abertos;
}

// Só para teste: zera o contador entre um caso e outro.
export function _zerarTrava() { abertos = 0; rolagemGuardada = 0; }
