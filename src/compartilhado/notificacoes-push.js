import { sbClient } from './conectar-no-banco-de-dados.js';

// VAPID pública (pode ficar no front; a privada vive só nos secrets do Supabase).
// TROCAR pelo valor real gerado na Task 6 antes do deploy.
export const VAPID_PUBLIC_KEY = 'BEsOWWqBquun-DMnYz5T-QktDlHhlxfzroM08dIFq1-bpz2JBcyPFk-ITSfLjwgTedXLQqhB-R0ihTCOxcLew1c';

export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSuportado() {
  if (typeof window === 'undefined') return false;
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return false;
  // iOS só entrega push com o app na Tela de Início (standalone). Em aba do Safari
  // o PushManager existe mas o subscribe falha — não oferecemos o opt-in ali.
  const ehIOS = /iP(hone|ad|od)/.test(navigator.userAgent || '');
  const standalone = window.navigator.standalone === true ||
    (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches);
  return !(ehIOS && !standalone);
}

export function permissaoAtual() {
  if (!pushSuportado()) return 'nao-suportado';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

export async function registrarSW() {
  return navigator.serviceWorker.register('/sw-push.js');
}

// ── Perguntar ou não perguntar ────────────────────────────────────────────
// Regra pedida pelo dono em 13/08/2026: "sempre está pedindo para ativar
// notificações; se o usuário ou o dispositivo já aceitou não precisa mostrar
// novamente". A regra antiga (`!inscrito && permissao !== 'denied'`) só calava
// com o navegador NEGANDO — quem fechava o convite era perguntado em toda
// abertura, para sempre.
//
// Duas peças puras, para poderem ser testadas sem navegador. A moldura decide
// o que fazer; aqui mora só o critério.
//
// `permissao === 'granted'` NUNCA pergunta: se o aparelho já autorizou, mostrar
// o convite é pedir uma coisa que já foi dada. Se por acaso não houver inscrição
// neste aparelho, o caminho é `deveInscreverEmSilencio` — com permissão dada, o
// navegador não abre prompt nenhum.
//
// `dispensou` é lembrado por aparelho (localStorage). Quem dispensou não perde
// nada: o botão de ativar continua no menu do avatar.
export function devePedirPush({ suportado = false, permissao = 'default', inscrito = false, dispensou = false } = {}) {
  if (!suportado) return false;
  if (permissao === 'granted' || permissao === 'denied') return false;
  if (inscrito) return false;
  if (dispensou) return false;
  return true;
}

export function deveInscreverEmSilencio({ suportado = false, permissao = 'default', inscrito = false } = {}) {
  return !!suportado && permissao === 'granted' && !inscrito;
}

export async function jaInscrito() {
  if (!pushSuportado()) return false;
  const reg = await navigator.serviceWorker.getRegistration('/sw-push.js');
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  return !!sub;
}

export async function inscrever(userId) {
  if (!pushSuportado()) return false;
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return false;
    const reg = await registrarSW();
    await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    const j = sub.toJSON();
    const { error } = await sbClient.from('push_subs').upsert({
      endpoint: j.endpoint,
      p256dh: j.keys.p256dh,
      auth: j.keys.auth,
      user_id: userId,
    }, { onConflict: 'endpoint' });
    return !error;
  } catch (_e) {
    // permissão negada no prompt, subscribe rejeitado (iOS aba), rede caída, etc.
    return false;
  }
}

export async function desinscrever() {
  const reg = await navigator.serviceWorker.getRegistration('/sw-push.js');
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const j = sub.toJSON();
  await sbClient.from('push_subs').delete().eq('endpoint', j.endpoint);
  await sub.unsubscribe();
}
