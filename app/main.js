// BBQ Thermometer – startpunt. Bouwen: npm run bouw (→ public/app.js)
import './native.js'; // eerst: geeft in de Android-app de echte Bluetooth
import { S, inst, bewaarInst, voeler, bewaarVoeler, isBbq, naarEenheid, vanEenheid, graad, fmt, log } from './staat.js';
import { $, $$, bewaar, esc, melding, fmtTijd, isNative } from './hulp.js';
import { VLEES, OPSTELLINGEN, GEBEURTENISSEN, TIMER_SNEL } from './kookboek.js';
import * as ble from './ble.js';
import {
  ontgrendelGeluid, vraagMeldingen, geefAlarm, wisAlarm, stopAlarmen, spreek, achtergrondStart, achtergrondUpdate,
  achtergrondStop, achtergrondStatus, accuVrijgeven, houdSchermAan, laatSchermLos,
} from './alarmen.js';
import { opSessie, herstel, rondAf, gebeurtenis, bewaarMeting, bewaarSessie, nieuweSessie } from './sessie.js';
import { live, toestand, verwerk, toonVoelers, adviezen, toonAdviezen, toonPlan, toonSessie, toonKlok, tekenLive, meldingTekst, alarmenGezien, toonRecept, toonKeuken } from './live.js';
import { rc, toonRecepten, openRecept, koppelRecepten } from './receptui.js';
import { behaald, BADGES } from './prestaties.js';
import { hist, toonLijst, koppelDetail, toonSterren } from './historie.js';
import { Grafiek } from './grafiek.js';
import { startTimer, tik as timerTik, toonTimers } from './timers.js';
import { statistiek } from './analyse.js';
import { maakBackup, zetBackupTerug, opslag } from './opslag.js';
import { bewaarBestand, verkleinFoto } from './bestand.js';
import { ic } from './iconen.js';

const VERSIE = '3.0';
let st = [];                 // laatste analyse per voeler
let laatsteMeldingTekst = 0;

// ---------- Nieuwe metingen ----------
async function nieuweTemps(temps) {
  const nu = Date.now();
  S.temps = temps;
  const opgeslagen = await bewaarMeting(temps, nu);
  st = toestand(nu);
  verwerk(st, nu);
  const lijst = adviezen(st, nu);
  if (!document.hidden) {
    toonVoelers(st);
    toonPlan(st, nu);
    toonAdviezen(lijst);
    toonRecept();
    toonKeuken(st);
    if (opgeslagen) { toonSessie(); tekenLive(); }
  }
  if (nu - laatsteMeldingTekst > 15e3) {
    laatsteMeldingTekst = nu;
    const m = meldingTekst(st);
    achtergrondUpdate(m.titel, m.tekst);
  }
}

// ---------- Status en verbinden ----------
function toonStatus(tekst) {
  const el = $('#status');
  let klasse = 'pil', t = 'Niet verbonden';
  if (tekst) { t = tekst; klasse = 'pil bezig'; }
  else if (S.verbonden) { t = S.demo ? 'Demo' : 'Verbonden'; klasse = 'pil aan'; }
  el.className = klasse;
  el.innerHTML = `<i class="stip"></i><span>${esc(t)}</span>`;
  const b = $('#batterij');
  b.hidden = S.batterij == null || !S.verbonden;
  b.innerHTML = `${ic('batterij')} ${S.batterij}%`;
  b.classList.toggle('laag', S.batterij != null && S.batterij < 20);
  toonVerbinden();
}
function toonVerbinden() {
  const actief = S.verbonden || !!S.demo || (!!S.apparaat && !S.handmatigLos);
  $('#verbind-kaart').hidden = actief;
  if (!actief && S.sessie) {
    $('#verbind-titel').textContent = 'Sessie loopt nog';
    $('#verbind-tekst').textContent = `"${S.sessie.naam}" staat open (laatst gemeten om ${fmtTijd(S.sessie.eind)}). Verbind om verder te gaan; de nieuwe metingen komen er gewoon bij.`;
    $('#verbind').textContent = 'Verbind en ga verder';
  } else {
    $('#verbind-titel').textContent = 'Klaar om te stoken?';
    $('#verbind-tekst').textContent = 'Zet de thermometer aan en verbind. Alles wordt automatisch bewaard, ook als de verbinding even wegvalt.';
    $('#verbind').textContent = 'Verbind thermometer';
  }
  $('#pauze').hidden = !(S.pauze && !S.sessie && actief);
  $('#acties').hidden = !S.sessie && !actief;
  $('#sessie-eind').hidden = !S.sessie && !actief;
  $('#verbreek').hidden = !actief;
}
function alles() {
  const nu = Date.now();
  st = toestand(nu);
  toonStatus();
  toonSessie();
  $('#voelers').classList.toggle('oud', !S.verbonden);
  toonVoelers(st);
  toonPlan(st, nu);
  toonAdviezen(adviezen(st, nu));
  toonRecept();
  toonKeuken(st);
  toonTimers();
  tekenLive();
}

async function verbind(allesTonen = false) {
  ontgrendelGeluid();
  vraagMeldingen();
  $('#diagnose').hidden = true;
  try {
    await ble.verbind(allesTonen);
  } catch (e) {
    const m = e.message || '';
    if (/adapter|not available|uit/i.test(m)) melding('Bluetooth staat uit, of de app mag het niet gebruiken.', 7000);
    else if (/ander protocol/.test(m)) melding('Verbonden, maar dit model praat anders. Zie de gegevens.', 7000);
    else melding('Verbinden mislukt: ' + m, 7000);
  }
}

let kwijtTimer = null;
ble.opvang.temps = nieuweTemps;
ble.opvang.status = (tekst) => { toonStatus(tekst); if (!tekst) toonSessie(); };
ble.opvang.diagnose = (tekst) => { $('#diagnose-tekst').textContent = tekst; $('#diagnose').hidden = false; };
ble.opvang.verbonden = () => {
  if (!S.sessie) S.pauze = false; // nieuwe verbinding zonder open sessie → gewoon opnemen
  clearTimeout(kwijtTimer);
  wisAlarm('verbinding');
  if (S.wasWeg) { S.wasWeg = false; gebeurtenis('verbindingTerug'); }
  houdSchermAan();
  const m = meldingTekst(toestand());
  achtergrondStart(m.tekst);
  alles();
};
ble.opvang.verbroken = () => {
  S.wasWeg = true;
  if (S.sessie) gebeurtenis('verbindingWeg');
  alles();
  achtergrondUpdate('Verbinding met thermometer weg', 'Opnieuw verbinden… De sessie loopt door.');
  clearTimeout(kwijtTimer);
  kwijtTimer = setTimeout(() => {
    if (!S.verbonden && !S.handmatigLos) {
      geefAlarm('verbinding', 'Verbinding met de thermometer kwijt',
        'Al 2 minuten geen metingen. Breng je telefoon dichterbij of zet Bluetooth aan; de app blijft het proberen en de sessie loopt door.');
    }
  }, 2 * 60e3);
};

async function verbreek() {
  await ble.verbreek();
  clearTimeout(kwijtTimer);
  wisAlarm('verbinding');
  laatSchermLos();
  await achtergrondStop();
  S.temps = [];
  alles();
}

// ---------- Tabs ----------
function kiesTab(naam) {
  $$('.onder .tab').forEach((t) => t.classList.toggle('actief', t.dataset.tab === naam));
  ['live', 'recepten', 'historie', 'instellingen'].forEach((t) => { $('#tab-' + t).hidden = t !== naam; });
  if (naam === 'historie') toonLijst();
  if (naam === 'recepten' && $('#rc-detail').hidden && $('#rc-planner').hidden && $('#rc-gidsen').hidden) toonRecepten();
  if (naam === 'live') alles();
  if (naam === 'instellingen') toonInstellingen();
  window.scrollTo(0, 0);
}
hist.naarLive = () => kiesTab('live');
rc.naarLive = () => kiesTab('live');
live.openRecept = (id, personen) => { kiesTab('recepten'); openRecept(id, personen); };

// ---------- Dialoog: voeler ----------
function openVoeler(i) {
  ontgrendelGeluid();
  vraagMeldingen();
  const d = $('#dlg-voeler'), v = voeler(i);
  let rol = v.rol;
  $('#dv-titel').textContent = `Voeler ${i + 1}`;
  $('#dv-naam').value = S.voelers[i]?.naam || '';
  $('#dv-naam').placeholder = `Voeler ${i + 1}`;
  const waarde = (x) => (x == null ? '' : Math.round(naarEenheid(x) * 10) / 10);
  $('#dv-doel').value = waarde(v.doel);
  $('#dv-rust').value = v.rust ?? '';
  $('#dv-min').value = waarde(v.min);
  $('#dv-max').value = waarde(v.max);
  d.querySelectorAll('.eh').forEach((e) => { e.textContent = `(${graad()})`; });
  const zetRol = (r) => {
    rol = r;
    $$('#dv-rol button').forEach((b) => b.classList.toggle('actief', b.dataset.rol === r));
    $('#dv-vlees').hidden = r !== 'vlees';
    $('#dv-bbq').hidden = r !== 'bbq';
    const lijst = r === 'bbq' ? OPSTELLINGEN : VLEES;
    $('#dv-preset').innerHTML = '<option value="">— kies —</option>' + lijst.map((p) => {
      const graden = r === 'bbq' ? `${p.min ?? ''}${p.max ? '–' + p.max : '+'}°` : `${p.doel}°`;
      return `<option value="${p.id}">${esc(p.naam)} (${graden})</option>`;
    }).join('');
    $('#dv-preset').value = v.rol === r && v.preset ? v.preset : '';
    toonTip();
  };
  const toonTip = () => {
    const lijst = rol === 'bbq' ? OPSTELLINGEN : VLEES;
    const p = lijst.find((x) => x.id === $('#dv-preset').value);
    $('#dv-tip').hidden = !p?.tip;
    $('#dv-tip').textContent = p?.tip || '';
  };
  $$('#dv-rol button').forEach((b) => { b.onclick = () => zetRol(b.dataset.rol); });
  $('#dv-preset').onchange = () => {
    const lijst = rol === 'bbq' ? OPSTELLINGEN : VLEES;
    const p = lijst.find((x) => x.id === $('#dv-preset').value);
    toonTip();
    if (!p) return;
    if (rol === 'bbq') {
      $('#dv-min').value = p.min == null ? '' : Math.round(naarEenheid(p.min));
      $('#dv-max').value = p.max == null ? '' : Math.round(naarEenheid(p.max));
      if (!$('#dv-naam').value) $('#dv-naam').value = 'BBQ';
    } else {
      $('#dv-doel').value = Math.round(naarEenheid(p.doel));
      $('#dv-rust').value = p.rust ?? '';
      $('#dv-naam').value = p.naam.replace(/\s*\(.*\)$/, '').replace(/ – .*/, '');
    }
  };
  zetRol(v.rol);
  d.onclose = () => {
    if (d.returnValue !== 'ok') return;
    const getal = (s) => { const x = parseFloat(String(s).replace(',', '.')); return Number.isFinite(x) ? vanEenheid(x) : null; };
    const nieuw = { naam: $('#dv-naam').value.trim() || undefined, rol, preset: $('#dv-preset').value || null };
    if (rol === 'bbq') { nieuw.min = getal($('#dv-min').value); nieuw.max = getal($('#dv-max').value); }
    else { nieuw.doel = getal($('#dv-doel').value); const r = parseInt($('#dv-rust').value, 10); nieuw.rust = Number.isFinite(r) ? r : null; }
    if (!nieuw.naam) delete nieuw.naam;
    bewaarVoeler(i, nieuw);
    delete S.alarmGezien[i + 'hoog']; delete S.alarmGezien[i + 'laag'];
    if (S.boven) delete S.boven[i];
    if (S.stallGemeld) delete S.stallGemeld[i];
    if (S.sessie) { S.sessie.voelers = S.temps.map((_, k) => voeler(k)); bewaarSessie(); }
    alles();
  };
  d.returnValue = '';
  d.showModal();
}
live.openVoeler = openVoeler;

// ---------- Dialoog: sessie ----------
function volgendeKeer(tijd) {
  const [u, m] = tijd.split(':').map(Number);
  const d = new Date(); d.setHours(u, m, 0, 0);
  if (d.getTime() < Date.now() - 2 * 3600e3) d.setDate(d.getDate() + 1);
  return d.getTime();
}
async function openSessieDlg() {
  const d = $('#dlg-sessie');
  if (!S.sessie) {
    if (!S.verbonden) { melding('Verbind eerst de thermometer.'); return; }
    await nieuweSessie();
  }
  const s = S.sessie;
  $('#ds-naam').value = s.naam;
  $('#ds-opstelling').innerHTML = '<option value="">— kies —</option>' + OPSTELLINGEN.map((o) => `<option value="${o.id}">${esc(o.naam)}</option>`).join('');
  $('#ds-opstelling').value = s.opstelling || '';
  const tip = () => { const o = OPSTELLINGEN.find((x) => x.id === $('#ds-opstelling').value); $('#ds-tip').hidden = !o; $('#ds-tip').textContent = o?.tip || ''; };
  $('#ds-opstelling').onchange = tip; tip();
  const aantal = Math.max(S.temps.length, 4);
  const huidigBbq = Array.from({ length: aantal }, (_, i) => i).find((i) => isBbq(voeler(i)));
  $('#ds-bbq').innerHTML = '<option value="">Geen</option>' + Array.from({ length: aantal }, (_, i) => {
    const c = S.temps[i];
    return `<option value="${i}">${esc(voeler(i).naam)}${c != null ? ` (nu ${fmt(c, 0)}°)` : ''}</option>`;
  }).join('');
  $('#ds-bbq').value = huidigBbq ?? '';
  $('#ds-eettijd').value = s.eettijd ? new Date(s.eettijd).toTimeString().slice(0, 5) : '';
  d.onclose = () => {
    if (d.returnValue !== 'ok') return;
    if ($('#ds-naam').value.trim() && $('#ds-naam').value.trim() !== s.naam) { s.naam = $('#ds-naam').value.trim(); s.autoNaam = false; }
    s.opstelling = $('#ds-opstelling').value || null;
    s.eettijd = $('#ds-eettijd').value ? volgendeKeer($('#ds-eettijd').value) : null;
    bewaar('laatsteOpzet', { opstelling: s.opstelling });
    const o = OPSTELLINGEN.find((x) => x.id === s.opstelling);
    const keuze = $('#ds-bbq').value;
    for (let i = 0; i < aantal; i++) {
      const v = { ...(S.voelers[i] || {}) };
      if (String(i) === keuze) {
        v.rol = 'bbq'; v.naam ||= 'BBQ';
        if (o) { v.min = o.min; v.max = o.max; v.preset = o.id; }
        bewaarVoeler(i, v);
      } else if (v.rol === 'bbq') { v.rol = 'vlees'; v.preset = null; v.min = null; v.max = null; bewaarVoeler(i, v); }
    }
    s.voelers = S.temps.map((_, k) => voeler(k));
    bewaarSessie(true);
    alles();
  };
  d.returnValue = '';
  d.showModal();
}

// ---------- Dialoog: gebeurtenis ----------
function openGebeurtenis() {
  if (!S.sessie) { melding('Er loopt nog geen sessie.'); return; }
  const d = $('#dlg-gebeurtenis');
  $('#dg-tekst').value = '';
  $('#dg-knoppen').innerHTML = GEBEURTENISSEN.map((g) => `<button type="button" data-type="${g.type}">${ic(g.icoon)}${esc(g.label)}</button>`).join('');
  $$('#dg-knoppen button').forEach((b) => {
    b.onclick = () => {
      const g = GEBEURTENISSEN.find((x) => x.type === b.dataset.type);
      gebeurtenis(g.type, $('#dg-tekst').value.trim());
      if (g.type === 'deksel') { S.dekselTot = Date.now() + 5 * 60e3; S.dekselVoeler = S.temps.findIndex((_, i) => isBbq(voeler(i))); }
      d.close();
      melding(`${g.label} vastgelegd`);
      tekenLive();
    };
  });
  d.showModal();
}

// ---------- Dialoog: timer ----------
function openTimer() {
  ontgrendelGeluid();
  vraagMeldingen();
  const d = $('#dlg-timer');
  $('#dt-snel').innerHTML = TIMER_SNEL.map((t, n) => `<button type="button" class="chip" data-n="${n}">${esc(t.label)} · ${t.min}m${t.herhaal ? ' ↻' : ''}</button>`).join('');
  $$('#dt-snel button').forEach((b) => {
    b.onclick = () => { const t = TIMER_SNEL[+b.dataset.n]; $('#dt-naam').value = t.label; $('#dt-min').value = t.min; $('#dt-herhaal').checked = !!t.herhaal; };
  });
  d.onclose = () => {
    if (d.returnValue !== 'ok') return;
    const min = parseFloat(String($('#dt-min').value).replace(',', '.'));
    if (!(min > 0)) return;
    startTimer($('#dt-naam').value.trim() || 'Timer', min, $('#dt-herhaal').checked);
    melding(`Timer van ${min} min gestart`);
  };
  d.returnValue = '';
  d.showModal();
}

// ---------- Dialoog: afronden ----------
async function openAfronden() {
  if (!S.sessie) return;
  const s = S.sessie, d = $('#dlg-afronden');
  let beoordeling = s.beoordeling || 0, foto = null;
  const duur = s.eind - s.start;
  let html = `<div class="stat">Duur <b>${Math.floor(duur / 3600e3)}u ${String(Math.round(duur / 60e3) % 60).padStart(2, '0')}m</b></div>`;
  (s.voelers || []).forEach((v, i) => {
    const r = statistiek(S.buffer, i, isBbq(v) ? v : null);
    if (!r) return;
    html += `<div class="stat">${esc(v.naam)}: ${isBbq(v) ? `gem <b>${fmt(r.gem, 0)}°</b>${r.binnen != null ? ` · ${Math.round(r.binnen * 100)}% in bereik` : ''}` : `eind <b>${fmt(r.eind)}°</b>`}</div>`;
  });
  $('#da-stats').innerHTML = html;
  $('#da-notitie').value = s.notitie || '';
  $('#da-foto-voorbeeld').hidden = true;
  toonSterren($('#da-sterren'), beoordeling, (n) => { beoordeling = n; });
  $('#da-foto').onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    foto = await verkleinFoto(f);
    $('#da-foto-voorbeeld').src = URL.createObjectURL(foto); $('#da-foto-voorbeeld').hidden = false;
  };
  d.onclose = async () => {
    if (d.returnValue !== 'ok') return;
    const id = s.id;
    if (foto) { await opslag.fotoBewaren(id, foto); s.heeftFoto = true; }
    const voor = behaald(await opslag.sessies());
    await rondAf({ beoordeling, notitie: $('#da-notitie').value });
    const nieuw = [...behaald(await opslag.sessies())].filter((b) => !voor.has(b));
    if (nieuw.length) {
      const namen = nieuw.map((id) => BADGES.find((x) => x.id === id).naam).join(', ');
      setTimeout(() => melding(`Nieuwe prestatie${nieuw.length > 1 ? 's' : ''}: ${namen}`, 7000), 1500);
    }
    if (S.verbonden) S.pauze = true; // niet meteen een nieuwe sessie beginnen
    else { await achtergrondStop(); laatSchermLos(); }
    melding('Sessie bewaard in de historie');
    alles();
  };
  d.returnValue = '';
  d.showModal();
}

// ---------- Instellingen ----------
async function toonInstellingen() {
  $$('#inst-eenheid button').forEach((b) => b.classList.toggle('actief', b.dataset.w === inst.eenheid));
  $('#inst-geluid').checked = inst.geluid;
  $('#inst-trillen').checked = inst.trillen;
  $('#inst-spraak').checked = inst.spraak;
  $('#versie').textContent = `BBQ Thermometer ${VERSIE}${isNative() ? ' · Android-app' : ' · webversie'}`;
  $('#zoektest').hidden = !navigator.bluetooth?.zoektest;
  $('#inst-achtergrond').hidden = !isNative();
  if (isNative()) {
    const s = await achtergrondStatus();
    $('#inst-accu').textContent = s ? (s.accuVrij ? 'uit (goed)' : 'aan – kan meten onderbreken') : 'onbekend';
    $('#inst-accu-knop').hidden = !!s?.accuVrij;
  }
}

async function zoektest() {
  log('Zoektest 10 s: alles wat de telefoon hoort…');
  const gezien = new Set();
  try {
    await navigator.bluetooth.zoektest(10000, (r) => {
      if (gezien.has(r.id)) return;
      gezien.add(r.id);
      log(`  "${r.name || '(geen naam)'}" ${r.id} sterkte ${r.rssi ?? '?'}${r.uuids?.length ? ' diensten ' + r.uuids.map(ble.kort).join(',') : ''}`);
    });
    log(`Zoektest klaar: ${gezien.size} apparaten gehoord`);
  } catch (e) { log(`Zoektest: FOUT ${e.name}: ${e.message}`); }
}

function koppelKnoppen() {
  $$('.onder .tab').forEach((t) => { t.onclick = () => kiesTab(t.dataset.tab); });
  $('#verbind').onclick = () => verbind(false);
  $('#verbind-alles').onclick = () => verbind(true);
  $('#demo').onclick = () => { ontgrendelGeluid(); ble.startDemo(); };
  $('#verbreek').onclick = verbreek;
  $('#alarm-stop').onclick = () => { stopAlarmen(); alarmenGezien(); alles(); };
  $('#sessie-naam').onclick = openSessieDlg;
  $('#knop-sessie').onclick = openSessieDlg;
  $('#knop-gebeurtenis').onclick = openGebeurtenis;
  $('#knop-timer').onclick = openTimer;
  $('#afronden').onclick = openAfronden;
  $('#nieuwe-sessie').onclick = async () => { S.pauze = false; await nieuweSessie(); alles(); openSessieDlg(); };
  $('#bereik').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    live.bereikMin = +b.dataset.min;
    $$('#bereik button').forEach((x) => x.classList.toggle('actief', x === b));
    tekenLive();
  };
  $('#diagnose-kopieer').onclick = () => kopieer($('#diagnose-tekst').textContent);
  $('#log-kopieer').onclick = () => kopieer(S.log.join('\n'));
  $('#zoektest').onclick = zoektest;
  // instellingen
  $$('#inst-eenheid button').forEach((b) => {
    b.onclick = () => { inst.eenheid = b.dataset.w; bewaarInst(); toonInstellingen(); alles(); };
  });
  $('#inst-geluid').onchange = (e) => { inst.geluid = e.target.checked; bewaarInst(); };
  $('#inst-trillen').onchange = (e) => { inst.trillen = e.target.checked; bewaarInst(); };
  $('#inst-spraak').onchange = (e) => { inst.spraak = e.target.checked; bewaarInst(); if (inst.spraak) spreek('Gesproken meldingen staan aan'); };
  // keukenmodus
  $('#keuken-knop').onclick = () => {
    $('#keuken').hidden = false;
    toonKeuken(toestand());
    document.documentElement.requestFullscreen?.().catch(() => {});
  };
  $('#keuken').onclick = (e) => { if (e.target.closest('#k-sluit') || e.target === $('#keuken')) sluitKeuken(); };
  koppelRecepten();
  $('#inst-accu-knop').onclick = async () => { try { await accuVrijgeven(); } catch (e) { melding(e.message); } setTimeout(toonInstellingen, 1500); };
  $('#inst-verbind').onclick = () => { kiesTab('live'); verbind(false); };
  $('#inst-verbreek').onclick = verbreek;
  $('#inst-demo').onclick = () => { kiesTab('live'); ontgrendelGeluid(); ble.startDemo(); };
  $('#inst-backup').onclick = async () => {
    try {
      const tekst = await maakBackup();
      await bewaarBestand(`BBQ Thermometer back-up ${new Date().toLocaleDateString('nl-NL')}.json`, tekst, 'application/json');
    } catch (e) { melding('Back-up mislukt: ' + e.message, 6000); }
  };
  $('#inst-terug').onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { const n = await zetBackupTerug(await f.text()); melding(`${n} sessie(s) teruggezet`); }
    catch (err) { melding('Terugzetten mislukt: ' + err.message, 6000); }
  };
  koppelDetail();
}
function sluitKeuken() {
  $('#keuken').hidden = true;
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
}
/** Decoratieve wijzerplaat op het startscherm. */
function wijzerplaat() {
  let s = '<circle cx="60" cy="60" r="54" fill="none" stroke="var(--lijn2)" stroke-width="1.5"/>';
  for (let k = 0; k <= 30; k++) {
    const h = ((135 + k * 9) * Math.PI) / 180, g = k % 5 === 0, r1 = g ? 38 : 42;
    s += `<line x1="${60 + r1 * Math.cos(h)}" y1="${60 + r1 * Math.sin(h)}" x2="${60 + 47 * Math.cos(h)}" y2="${60 + 47 * Math.sin(h)}" stroke="${g ? 'var(--zacht)' : 'var(--lijn2)'}" stroke-width="${g ? 1.8 : 1.2}"/>`;
  }
  const n = ((135 + 21 * 9) * Math.PI) / 180;
  s += `<path d="M${60 + 36 * Math.cos(n)} ${60 + 36 * Math.sin(n)} L${60 - 4 * Math.sin(n)} ${60 + 4 * Math.cos(n)} L${60 + 4 * Math.sin(n)} ${60 - 4 * Math.cos(n)}z" fill="var(--sintel)"/>`;
  s += '<circle cx="60" cy="60" r="6" fill="var(--vlak3)" stroke="var(--sintel)" stroke-width="2"/>';
  s += '<text x="60" y="92" text-anchor="middle" fill="var(--vaag)" font-family="Barlow Condensed" font-weight="600" font-size="9" letter-spacing="1.5">°C</text>';
  return s;
}
async function kopieer(tekst) {
  try { await navigator.clipboard.writeText(tekst); melding('Gekopieerd'); } catch { melding('Kopiëren lukte niet; maak een schermafbeelding.'); }
}

// ---------- Start ----------
async function start() {
  // icoontjes in de HTML invullen
  $$('[data-ic]').forEach((el) => { el.outerHTML = ic(el.dataset.ic); });
  $('#verbind-wijzer').innerHTML = wijzerplaat();
  live.grafiek = new Grafiek($('#grafiek'), $('#grafiek-tip'));
  hist.grafiek = new Grafiek($('#det-grafiek'), $('#det-tip'));
  koppelKnoppen();
  opSessie.veranderd = () => { toonSessie(); tekenLive(); toonVerbinden(); };
  log(isNative() ? 'Android-app gestart' : 'Webversie gestart');
  if (!navigator.bluetooth) $('#geen-bt').hidden = false;
  navigator.bluetooth?.getAvailability?.()
    .then((ok) => { $('#bt-uit').hidden = ok; log('Bluetooth ' + (ok ? 'staat aan' : 'staat UIT')); })
    .catch((e) => log(`Bluetooth opstarten: FOUT ${e.name}: ${e.message}`));
  // Bluetooth weer aan → meteen opnieuw verbinden
  navigator.bluetooth?.opAdapter?.((aan) => {
    log('Bluetooth ' + (aan ? 'aangezet' : 'uitgezet'));
    $('#bt-uit').hidden = aan;
    if (aan) ble.wekOp();
  });

  try { await herstel(); } catch (e) { log('Herstellen mislukt: ' + e.message); }
  alles();

  setInterval(() => {
    timerTik();
    if (!document.hidden) { toonKlok(); if (!$('#keuken').hidden) $('#k-klok').textContent = $('#sessie-klok').textContent; }
  }, 1000);
  setInterval(() => { if (!document.hidden) alles(); }, 30e3);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { if (S.verbonden) houdSchermAan(); alles(); }
  });

  if ('serviceWorker' in navigator && !isNative()) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (new URLSearchParams(location.search).has('demo')) { ble.startDemo(); return; }
  // Android-app met open sessie: vanzelf weer verbinden met de bekende thermometer
  if (isNative() && S.sessie && navigator.bluetooth?.bekende) {
    log('Open sessie gevonden → automatisch verbinden');
    ble.verbindBekende().catch(() => {});
  }
}
start();
