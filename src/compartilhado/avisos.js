// Aviso rápido (toast) no canto da tela — porte de adminToast (legacy/index.html L4377).
// DOM imperativo: cria um #admin-toast fixo, verde se ok / vermelho se não, some em 2,8s.
// (Troca o helper mkEl do legado por document.createElement — comportamento idêntico.)
export function adminToast(msg, ok = true) {
  let t = document.getElementById('admin-toast')
  if (!t) {
    t = document.createElement('div')
    t.id = 'admin-toast'
    t.style.cssText = 'position:fixed;bottom:24px;right:24px;padding:12px 20px;border-radius:8px;font-family:"IBM Plex Sans",sans-serif;font-size:13px;font-weight:500;z-index:9999;transition:opacity .3s;box-shadow:0 4px 16px rgba(0,0,0,.15)'
    document.body.appendChild(t)
  }
  t.textContent = msg
  t.style.background = ok ? '#166534' : '#991b1b'
  t.style.color = '#fff'
  t.style.opacity = '1'
  clearTimeout(t._to)
  t._to = setTimeout(() => { t.style.opacity = '0' }, 2800)
}
