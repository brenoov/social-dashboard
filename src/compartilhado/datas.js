// Régua única de datas do painel. O negócio é no Brasil: toda janela é BRT,
// independentemente do fuso da máquina de quem está olhando.
//
// NUNCA use new Date().toISOString().slice(0,10) para pegar "hoje": isso devolve
// UTC, e das 21h à meia-noite BRT já é o dia seguinte lá — foi o que fazia o
// painel dizer que ninguém vendeu, gastou ou postou no fim da noite.
const TZ = 'America/Sao_Paulo'

// Data local (BRT) de um Date, no formato YYYY-MM-DD. 'en-CA' produz esse formato.
function _fmt(d) {
  return d.toLocaleDateString('en-CA', { timeZone: TZ })
}

// Meio-dia BRT do dia informado. Âncora segura para aritmética de dias: longe das
// duas bordas, então somar/subtrair dias nunca escorrega por causa de horário de verão.
function _meioDia(diaISO) {
  return new Date(`${diaISO}T12:00:00-03:00`)
}

export function hojeLocal() {
  return _fmt(new Date())
}

export function diasAtras(n) {
  const d = _meioDia(hojeLocal())
  d.setDate(d.getDate() - n)
  return _fmt(d)
}

export function primeiroDiaDoMes(offsetMeses = 0) {
  const [ano, mes] = hojeLocal().split('-').map(Number)
  const d = _meioDia(`${ano}-${String(mes).padStart(2, '0')}-01`)
  d.setMonth(d.getMonth() + offsetMeses)
  return _fmt(d)
}

export function ultimoDiaDoMes(offsetMeses = 0) {
  const [ano, mes] = hojeLocal().split('-').map(Number)
  const d = _meioDia(`${ano}-${String(mes).padStart(2, '0')}-01`)
  // Dia 0 do mês seguinte = último dia deste mês. Cobre 28/29/30/31 sem tabela.
  d.setMonth(d.getMonth() + offsetMeses + 1)
  d.setDate(0)
  return _fmt(d)
}
