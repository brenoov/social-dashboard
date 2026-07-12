import { ref } from 'vue'
import { sbClient } from '../../compartilhado/conectar-no-banco-de-dados.js'
export function useCandidatos() {
  const candidatos = ref([]); const carregando = ref(false); const erro = ref(null)
  async function buscar({ lojas, fonte, filtros }) {
    carregando.value = true; erro.value = null
    const { data, error } = await sbClient.functions.invoke('fabrica-candidatos', { body: { lojas, fonte, filtros } })
    carregando.value = false
    if (error) { erro.value = error.message; candidatos.value = []; return }
    candidatos.value = data?.candidatos || []
  }
  return { candidatos, carregando, erro, buscar }
}
