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
