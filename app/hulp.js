// Kleine hulpfuncties die overal gebruikt worden.

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

export function lees(sleutel, standaard) {
  try { const v = localStorage.getItem(sleutel); return v ? JSON.parse(v) : standaard; } catch { return standaard; }
}
export function bewaar(sleutel, waarde) {
  try { localStorage.setItem(sleutel, JSON.stringify(waarde)); } catch { /* geen opslag */ }
}

export const wacht = (ms) => new Promise((r) => setTimeout(r, ms));
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
export const isNative = () => !!window.__native;

export function fmtTijd(t) { return new Date(t).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }); }
export function fmtDatum(t) {
  return new Date(t).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
export function fmtDuur(ms) {
  const m = Math.max(0, Math.round(ms / 60e3));
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}u ${String(m % 60).padStart(2, '0')}m`;
}
/** 3:42:10 */
export function fmtKlok(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const u = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${u}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
/** 12:05 (aftellen) */
export function fmtAftel(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const u = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return u ? `${u}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

/** Korte melding onderin, eventueel met een knop. */
export function melding(tekst, ms = 3500, actie) {
  const el = $('#melding');
  el.innerHTML = `<span>${esc(tekst)}</span>`;
  if (actie) {
    const b = document.createElement('button');
    b.textContent = actie.label;
    b.onclick = () => { el.hidden = true; actie.fn(); };
    el.appendChild(b);
  }
  el.hidden = false;
  clearTimeout(melding.t);
  melding.t = setTimeout(() => { el.hidden = true; }, actie ? Math.max(ms, 8000) : ms);
}

/** Simpele bevestiging in eigen stijl (confirm() oogt slecht in de app). */
export function vraag(tekst, ja = 'OK', nee = 'Annuleer', gevaar = false) {
  return new Promise((ok) => {
    const d = $('#dlg-vraag');
    $('#vraag-tekst').textContent = tekst;
    $('#vraag-ja').textContent = ja;
    $('#vraag-ja').className = 'knop' + (gevaar ? ' knop-gevaar' : '');
    $('#vraag-nee').textContent = nee;
    d.onclose = () => ok(d.returnValue === 'ja');
    d.returnValue = '';
    d.showModal();
  });
}
