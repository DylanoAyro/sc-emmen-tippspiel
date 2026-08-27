export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

export function showToast(msg){
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(()=>t.classList.remove('show'), 2200);
}

export function escapeHtml(s){
  return String(s ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

export function shorten(s){ return s.length > 16 ? s.slice(0,14)+'…' : s; }

export function fmtDate(iso){
  const d = new Date(iso);
  return d.toLocaleDateString('de-CH', {weekday:'short', day:'2-digit', month:'2-digit'}) + ', ' +
         d.toLocaleTimeString('de-CH', {hour:'2-digit', minute:'2-digit'});
}

export function toLocalInputValue(iso){
  const d = new Date(iso);
  const pad = n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
