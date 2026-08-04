// Combinação entre a moldura do app e as telas, para o avatar do perfil.
//
// A moldura desenha o avatar flutuante e o menu (e-mail, trocar senha, sair).
// Uma tela que quer o avatar DENTRO da própria barra de cima monta o componente
// <AvatarDoPerfil/>, que liga `avatarNaBarra` — e aí a moldura esconde o
// flutuante, para não existirem dois avatares na mesma tela.
//
// `menuDoPerfilAberto` é o que faz o avatar da barra abrir o mesmo menu de
// sempre: quem desenha o menu continua sendo a moldura, num lugar só. Duplicar
// "trocar senha" e "sair" em cada tela seria pedir para os dois divergirem.
import { ref } from 'vue'

export const avatarNaBarra = ref(false)
export const menuDoPerfilAberto = ref(false)
