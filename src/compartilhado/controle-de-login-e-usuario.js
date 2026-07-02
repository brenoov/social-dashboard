import { reactive } from 'vue'

export const estado = reactive({
  currentSession: null,
  user: null,
  permissoes: null,
})

export function setSession(session) {
  estado.currentSession = session
  estado.user = session?.user ?? null
}
