// Onde colocar o balão do passeio guiado. Conta pura: não toca DOM.
//
// A regra que não pode ser quebrada: o balão NUNCA cobre o que ele está
// explicando. A primeira versão ancorava sempre abaixo do alvo e, quando não
// cabia, "grudava" no rodapé — em cima do próprio alvo. O usuário via a
// explicação de um botão escondido pelo balão.

const FOLGA = 14

// alvo, tela e balao: { top, left, width, height } / { largura, altura }
// Devolve { top, left, lado } — `lado` é só pra quem quiser desenhar a setinha.
export function posicaoDoBalao({ alvo, tela, balao }) {
  const t = tela || { largura: 0, altura: 0 }
  const b = balao || { largura: 0, altura: 0 }

  // Sem alvo (passo que aponta pra algo que não está na tela): centraliza.
  if (!alvo) {
    return {
      top: Math.max(FOLGA, Math.round((t.altura - b.altura) / 2)),
      left: Math.max(FOLGA, Math.round((t.largura - b.largura) / 2)),
      lado: 'centro',
    }
  }

  const espacoAbaixo = t.altura - (alvo.top + alvo.height)
  const espacoAcima = alvo.top
  const precisa = b.altura + FOLGA

  let top
  let lado
  if (espacoAbaixo >= precisa) {
    top = alvo.top + alvo.height + FOLGA
    lado = 'abaixo'
  } else if (espacoAcima >= precisa) {
    top = alvo.top - b.altura - FOLGA
    lado = 'acima'
  } else {
    // Não cabe nem em cima nem embaixo: vai para o lado com mais espaço e
    // encosta na borda. Cobrir parte da tela é aceitável; cobrir o alvo, não.
    lado = espacoAbaixo >= espacoAcima ? 'abaixo' : 'acima'
    top = lado === 'abaixo' ? t.altura - b.altura - FOLGA : FOLGA
  }

  // Alinha pela esquerda do alvo, mas sem vazar a tela dos dois lados.
  let left = alvo.left
  const maximo = t.largura - b.largura - FOLGA
  if (left > maximo) left = maximo
  if (left < FOLGA) left = FOLGA

  // Última garantia: se ainda assim sobrepõe o alvo (tela minúscula), empurra
  // para o extremo oposto.
  if (sobrepoe({ top, left, largura: b.largura, altura: b.altura }, alvo)) {
    top = lado === 'abaixo'
      ? Math.max(FOLGA, alvo.top + alvo.height + FOLGA)
      : Math.max(FOLGA, alvo.top - b.altura - FOLGA)
  }

  return { top: Math.round(top), left: Math.round(left), lado }
}

// Duas caixas se cruzam?
export function sobrepoe(caixa, alvo) {
  if (!caixa || !alvo) return false
  const aDir = caixa.left + caixa.largura
  const aBaixo = caixa.top + caixa.altura
  const bDir = alvo.left + alvo.width
  const bBaixo = alvo.top + alvo.height
  return caixa.left < bDir && aDir > alvo.left && caixa.top < bBaixo && aBaixo > alvo.top
}
