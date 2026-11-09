// Kooktimers (spritzen, kolen checken, rusten…), ook met herhaling.
// In de Android-app wordt de melding vooraf ingepland, zodat hij ook afgaat als de app slaapt.
import { lees, bewaar, $, esc, fmtAftel, isNative } from './hulp.js';
import { geefAlarm, wisAlarm, toestelMelding, annuleerMelding } from './alarmen.js';

let timers = lees('timers', []);
const opslaan = () => bewaar('timers', timers);
let volgendId = Math.max(1000, ...timers.map((t) => t.id + 1));

function plan(t) {
  if (isNative()) toestelMelding(`⏱ ${t.label}`, t.herhaal ? `Elke ${Math.round(t.duur / 60e3)} min` : 'Timer afgelopen', { id: t.id, at: t.eind });
}

export function startTimer(label, minuten, herhaal = false) {
  const duur = Math.max(1, minuten) * 60e3;
  const t = { id: volgendId++, label: label || 'Timer', duur, eind: Date.now() + duur, herhaal };
  timers.push(t);
  opslaan();
  plan(t);
  toonTimers();
  return t;
}
export function stopTimer(id) {
  timers = timers.filter((t) => t.id !== id);
  opslaan();
  annuleerMelding(id);
  wisAlarm('timer' + id);
  toonTimers();
}
function verleng(id, min) {
  const t = timers.find((x) => x.id === id);
  if (!t) return;
  t.eind = Math.max(Date.now(), t.eind) + min * 60e3;
  t.af = false;
  opslaan();
  annuleerMelding(id);
  plan(t);
  wisAlarm('timer' + id);
  toonTimers();
}

/** Elke seconde: afgelopen timers laten afgaan. */
export function tik() {
  const nu = Date.now();
  let veranderd = false;
  for (const t of timers) {
    if (t.af || nu < t.eind) continue;
    // in de app al ingepland als toestelmelding → hier geen tweede melding
    geefAlarm('timer' + t.id, `⏱ ${t.label}`, t.herhaal ? 'Volgende ronde is gestart' : 'Timer afgelopen', { melden: !isNative() });
    if (t.herhaal) {
      while (t.eind <= nu) t.eind += t.duur;
      plan(t);
    } else {
      t.af = true;
    }
    veranderd = true;
  }
  if (veranderd) opslaan();
  if (!document.hidden) toonTimers();
}

export function toonTimers() {
  const vak = $('#timers');
  if (!timers.length) { vak.innerHTML = ''; return; }
  const nu = Date.now();
  const sleutel = timers.map((t) => `${t.id}${t.af ? 'a' : ''}`).join(',');
  if (vak.dataset.sleutel !== sleutel) {
    vak.dataset.sleutel = sleutel;
    vak.innerHTML = timers.map((t) => `
      <div class="timer${t.af ? ' af' : ''}" data-id="${t.id}">
        <div class="t-naam">${esc(t.label)}<small>${t.herhaal ? `elke ${Math.round(t.duur / 60e3)} min` : `${Math.round(t.duur / 60e3)} min`}</small></div>
        <div class="t-tijd"></div>
        <button data-plus="${t.id}">+5</button>
        <button data-weg="${t.id}">✕</button>
        <div class="t-balk"></div>
      </div>`).join('');
    vak.querySelectorAll('[data-plus]').forEach((b) => { b.onclick = () => verleng(+b.dataset.plus, 5); });
    vak.querySelectorAll('[data-weg]').forEach((b) => { b.onclick = () => stopTimer(+b.dataset.weg); });
  }
  for (const t of timers) {
    const el = vak.querySelector(`[data-id="${t.id}"]`);
    if (!el) continue;
    const rest = t.eind - nu;
    el.querySelector('.t-tijd').textContent = t.af ? 'klaar' : fmtAftel(rest);
    el.querySelector('.t-balk').style.width = `${t.af ? 100 : Math.min(100, Math.max(0, (1 - rest / t.duur) * 100))}%`;
  }
}
