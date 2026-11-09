'use strict';
/*
 * BBQ Thermometer – webapp voor Inkbird BBQ-thermometers met het "iBBQ"-protocol
 * (IBT-2X, IBT-4XS, IBT-6XS en vergelijkbare). Werkt met Web Bluetooth in Chrome
 * (Android, Windows, Mac). Alle metingen blijven op het apparaat (IndexedDB).
 */

// ---------- iBBQ Bluetooth-protocol ----------
const SERVICE = 0xfff0;
const CH_RESULTAAT = 0xfff1;   // antwoorden (o.a. batterij)       – notify
const CH_LOGIN = 0xfff2;       // inloggen / koppelen               – write
const CH_LIVE = 0xfff4;        // live temperaturen                 – notify
const CH_INSTELLING = 0xfff5;  // opdrachten                        – write
const CMD = {
  login: [0x21, 0x07, 0x06, 0x05, 0x04, 0x03, 0x02, 0x01, 0xb8, 0x22, 0x00, 0x00, 0x00, 0x00, 0x00],
  live: [0x0b, 0x01, 0x00, 0x00, 0x00, 0x00],
  celsius: [0x02, 0x00, 0x00, 0x00, 0x00, 0x00],
  batterij: [0x08, 0x24, 0x00, 0x00, 0x00, 0x00],
};

// ---------- Instellingen ----------
const KLEUREN = ['#ff7a1a', '#3ec3ff', '#3ecf6e', '#c77dff', '#ffd23f', '#ff5c8a'];
const OPSLAG_ELKE_MS = 5000;           // één meting per 5 s bewaren
const NIEUWE_SESSIE_NA_MS = 3 * 3600e3; // >3 uur niets gemeten → nieuwe sessie
const ETA_VENSTER_MS = 10 * 60e3;       // tempo over de laatste 10 minuten
const PRESETS = [
  { naam: '— kies —' },
  { naam: 'Rund – rare (52°)', doel: 52 },
  { naam: 'Rund – medium rare (55°)', doel: 55 },
  { naam: 'Rund – medium (58°)', doel: 58 },
  { naam: 'Rund – well done (68°)', doel: 68 },
  { naam: 'Varkenshaas (62°)', doel: 62 },
  { naam: 'Pulled pork (93°)', doel: 93 },
  { naam: 'Brisket (93°)', doel: 93 },
  { naam: 'Spareribs (90°)', doel: 90 },
  { naam: 'Kip / kalkoen filet (74°)', doel: 74 },
  { naam: 'Kippendij / drumstick (80°)', doel: 80 },
  { naam: 'Lam – medium (58°)', doel: 58 },
  { naam: 'Zalm (52°)', doel: 52 },
  { naam: 'BBQ low & slow (107–125°)', doel: 125, min: 107 },
  { naam: 'BBQ hot & fast (150–180°)', doel: 180, min: 150 },
];

const $ = (s) => document.querySelector(s);
const S = {
  temps: [],            // huidige temperaturen in °C (null = geen voeler)
  batterij: null,
  apparaat: null,
  kanalen: null,
  verbonden: false,
  handmatigLos: false,
  demo: null,
  sessie: null,         // { id, naam, start, eind, ... }
  buffer: [],           // metingen van de huidige sessie: { t, v: [..] }
  laatsteOpslag: 0,
  bereikMin: 60,
  eenheid: lees('eenheid', 'C'),
  voelers: lees('voelers', []), // per voeler: { naam, doel, min }
  alarmStaat: {},       // per voeler: 'hoog' | 'laag' | null
  alarmGezien: {},
  geluid: null,
  log: [],
  koppelNr: 0,
  laatsteData: 0,
  wakeLock: null,
};

function lees(sleutel, standaard) {
  try { const v = localStorage.getItem(sleutel); return v ? JSON.parse(v) : standaard; } catch { return standaard; }
}
function bewaar(sleutel, waarde) {
  try { localStorage.setItem(sleutel, JSON.stringify(waarde)); } catch { /* geen opslag */ }
}
function voeler(i) {
  return Object.assign({ naam: `Voeler ${i + 1}`, doel: null, min: null }, S.voelers[i] || {});
}

// ---------- Eenheden en opmaak ----------
const naarEenheid = (c) => (c == null ? null : S.eenheid === 'F' ? c * 9 / 5 + 32 : c);
const vanEenheid = (x) => (S.eenheid === 'F' ? (x - 32) * 5 / 9 : x);
const graad = () => (S.eenheid === 'F' ? '°F' : '°C');
function fmt(c, dec = 1) {
  const x = naarEenheid(c);
  return x == null ? '—' : x.toLocaleString('nl-NL', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmtTijd(t) { return new Date(t).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }); }
function fmtDatum(t) {
  return new Date(t).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtDuur(ms) {
  const m = Math.max(0, Math.round(ms / 60e3));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} u ${String(m % 60).padStart(2, '0')} min`;
}
function melding(tekst, ms = 3500) {
  const el = $('#melding');
  el.textContent = tekst; el.hidden = false;
  clearTimeout(melding.t); melding.t = setTimeout(() => { el.hidden = true; }, ms);
}

// ---------- Opslag (IndexedDB) ----------
let dbBelofte;
function db() {
  dbBelofte ||= new Promise((ok, fout) => {
    const r = indexedDB.open('bbq-thermometer', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('sessies', { keyPath: 'id', autoIncrement: true });
      const m = d.createObjectStore('metingen', { autoIncrement: true });
      m.createIndex('sessie', 'sessie');
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fout(r.error);
  });
  return dbBelofte;
}
async function tx(stores, modus, fn) {
  const d = await db();
  return new Promise((ok, fout) => {
    const t = d.transaction(stores, modus);
    let res;
    Promise.resolve(fn(t)).then((r) => { res = r; });
    t.oncomplete = () => ok(res);
    t.onerror = () => fout(t.error);
    t.onabort = () => fout(t.error);
  });
}
const req = (r) => new Promise((ok, fout) => { r.onsuccess = () => ok(r.result); r.onerror = () => fout(r.error); });

const opslag = {
  sessieMaken: (s) => tx(['sessies'], 'readwrite', (t) => req(t.objectStore('sessies').add(s))),
  sessieBewaren: (s) => tx(['sessies'], 'readwrite', (t) => { t.objectStore('sessies').put(s); }),
  sessie: (id) => tx(['sessies'], 'readonly', (t) => req(t.objectStore('sessies').get(id))),
  sessies: () => tx(['sessies'], 'readonly', (t) => req(t.objectStore('sessies').getAll())),
  meting: (m) => tx(['metingen'], 'readwrite', (t) => { t.objectStore('metingen').add(m); }),
  metingen: (id) => tx(['metingen'], 'readonly', (t) =>
    req(t.objectStore('metingen').index('sessie').getAll(IDBKeyRange.only(id)))),
  wis: (id) => tx(['sessies', 'metingen'], 'readwrite', async (t) => {
    t.objectStore('sessies').delete(id);
    const keys = await req(t.objectStore('metingen').index('sessie').getAllKeys(IDBKeyRange.only(id)));
    const st = t.objectStore('metingen');
    keys.forEach((k) => st.delete(k));
  }),
};

// ---------- Sessies ----------
function sessieNaam(t, demo) {
  const d = new Date(t);
  const dag = d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
  return `${demo ? 'Demo – ' : ''}${dag[0].toUpperCase()}${dag.slice(1)}, ${fmtTijd(t)}`;
}
async function zorgVoorSessie(nu) {
  if (S.sessie && nu - (S.sessie.eind || S.sessie.start) > NIEUWE_SESSIE_NA_MS) await sluitSessie();
  if (S.sessie) return;
  const s = { naam: sessieNaam(nu, !!S.demo), start: nu, eind: nu, demo: !!S.demo, voelers: [], notitie: '' };
  s.id = await opslag.sessieMaken(s);
  S.sessie = s; S.buffer = []; S.laatsteOpslag = 0;
  bewaar('actieveSessie', s.id);
  toonSessie();
}
async function sluitSessie() {
  if (S.sessie && S.buffer.length === 0) await opslag.wis(S.sessie.id); // lege sessie niet bewaren
  S.sessie = null; S.buffer = []; S.laatsteOpslag = 0;
  bewaar('actieveSessie', null);
  toonSessie();
}
async function herstelSessie() {
  const id = lees('actieveSessie', null);
  if (!id) return;
  const s = await opslag.sessie(id);
  if (!s || Date.now() - s.eind > NIEUWE_SESSIE_NA_MS) { bewaar('actieveSessie', null); return; }
  S.sessie = s;
  S.buffer = (await opslag.metingen(id)).sort((a, b) => a.t - b.t);
  S.laatsteOpslag = S.buffer.length ? S.buffer[S.buffer.length - 1].t : 0;
  toonSessie();
  tekenLive();
}

// ---------- Nieuwe metingen ----------
let bezigMetOpslaan = false;
async function nieuweTemps(temps) {
  const nu = Date.now();
  S.temps = temps;
  controleerAlarmen();
  toonVoelers();
  if (bezigMetOpslaan || nu - S.laatsteOpslag < OPSLAG_ELKE_MS) return;
  if (!temps.some((t) => t != null)) return; // geen voeler aangesloten → niets bewaren
  bezigMetOpslaan = true;
  try {
    await zorgVoorSessie(nu);
    const m = { sessie: S.sessie.id, t: nu, v: temps.map((t) => (t == null ? null : Math.round(t * 10) / 10)) };
    await opslag.meting(m);
    S.buffer.push({ t: m.t, v: m.v });
    S.laatsteOpslag = nu;
    S.sessie.eind = nu;
    S.sessie.voelers = temps.map((_, i) => voeler(i));
    await opslag.sessieBewaren(S.sessie);
    toonSessie();
    tekenLive();
  } catch (e) {
    console.error(e);
  } finally {
    bezigMetOpslaan = false;
  }
}

// ---------- Bluetooth ----------
function schrijf(ch, bytes) {
  const data = new Uint8Array(bytes);
  if (ch.properties && ch.properties.write && ch.writeValueWithResponse) return ch.writeValueWithResponse(data);
  if (ch.writeValueWithoutResponse) return ch.writeValueWithoutResponse(data);
  return ch.writeValue(data);
}
function leesTemps(dv) {
  const temps = [];
  for (let i = 0; i + 1 < dv.byteLength; i += 2) {
    const v = dv.getUint16(i, true);
    temps.push(v >= 0xfff0 ? null : v / 10); // 0xFFF6 = geen voeler
  }
  return temps;
}
function leesBatterij(dv) {
  if (dv.byteLength < 5 || dv.getUint8(0) !== 0x24) return;
  const nu = dv.getUint16(1, true);
  let max = dv.getUint16(3, true);
  if (!max) max = 6580;
  const v = nu / (max / 6580);
  S.batterij = Math.max(0, Math.min(100, Math.round((v - 5580) / (6150 - 5580) * 100)));
  toonStatus();
}

// Diensten die we mogen bekijken (Web Bluetooth geeft alleen toegang tot wat hier staat).
// Naast het iBBQ-protocol een paar veelgebruikte, zodat de diagnose ook andere modellen laat zien.
const ANDERE_DIENSTEN = [0xffe0, 0xffb0, 0xffd0, 0xff00, 0xfee0, 0xfe00, 0xfff6, 0x180a, 0x180f,
  '0000fee7-0000-1000-8000-00805f9b34fb', '6e400001-b5a3-f393-e0a9-e50e24dcca9e'];

async function verbind(alles = false) {
  if (!navigator.bluetooth) { $('#geen-bt').hidden = false; return; }
  ontgrendelGeluid();
  vraagMeldingen();
  $('#diagnose').hidden = true;
  let dev;
  try {
    dev = await navigator.bluetooth.requestDevice(alles
      ? { acceptAllDevices: true, optionalServices: [SERVICE, ...ANDERE_DIENSTEN] }
      : {
        filters: [{ namePrefix: 'iBBQ' }, { namePrefix: 'IBT' }, { namePrefix: 'Inkbird' },
          { namePrefix: 'INKBIRD' }, { services: [SERVICE] }],
        optionalServices: [SERVICE, ...ANDERE_DIENSTEN],
      });
  } catch (e) {
    if (/cancel/i.test(e.message)) return; // gebruiker sloot de lijst
    if (/adapter|not available|unavailable/i.test(e.message)) {
      melding('Bluetooth staat uit, of Chrome mag het niet gebruiken. Zie "Lukt het niet?".', 7000);
    } else if (/permission|denied|NotAllowed/i.test(e.name + e.message)) {
      melding('Chrome kreeg geen toestemming. Zet "Apparaten in de buurt" en "Locatie" aan voor Chrome.', 7000);
    } else {
      melding('Zoeken mislukt: ' + e.message, 7000);
    }
    return;
  }
  stopDemo();
  S.apparaat = dev;
  S.handmatigLos = false;
  dev.addEventListener('gattserverdisconnected', bijVerbroken);
  try {
    await koppel(dev);
  } catch (e) {
    console.error(e);
    log('Mislukt: ' + e.message);
    melding(/ander protocol/.test(e.message)
      ? 'Verbonden, maar dit model praat anders. Zie de gegevens hieronder.'
      : 'Verbinden mislukt: ' + e.message + '. Probeer het nog eens.', 7000);
    S.handmatigLos = true;
    S.apparaat = null;
    try { dev.gatt.disconnect(); } catch { /* al los */ }
    toonStatus('Niet verbonden');
  }
}

async function koppel(dev) {
  toonStatus('Verbinden…');
  const nr = ++S.koppelNr;
  log(`Verbinden met "${dev.name || '(geen naam)'}"…`);
  const server = await dev.gatt.connect();
  log('Bluetooth-verbinding staat');
  let svc;
  try {
    svc = await server.getPrimaryService(SERVICE);
  } catch (e) {
    log('Dienst FFF0 niet gevonden: ' + e.message);
    await toonDiagnose(dev, server);
    throw new Error('dit model gebruikt een ander protocol');
  }
  const [res, login, live, inst] = await Promise.all(
    [CH_RESULTAAT, CH_LOGIN, CH_LIVE, CH_INSTELLING].map((u) => svc.getCharacteristic(u)));
  S.kanalen = { res, login, live, inst };
  log('Kanalen: ' + [res, login, live, inst].map((c) => `${kort(c.uuid)}[${eigenschappen(c)}]`).join(' '));
  // eigenschappen i.p.v. addEventListener: bij opnieuw verbinden geen dubbele luisteraars
  res.oncharacteristicvaluechanged = (e) => {
    log('Antwoord FFF1: ' + hex(e.target.value));
    leesBatterij(e.target.value);
  };
  S.laatsteData = 0;
  live.oncharacteristicvaluechanged = (e) => {
    if (!S.laatsteData) log('Eerste meting FFF4: ' + hex(e.target.value));
    S.laatsteData = Date.now();
    nieuweTemps(leesTemps(e.target.value));
  };
  // eerst meldingen aanzetten, dan pas inloggen: dan missen we geen antwoord
  await stap('meldingen FFF1 aan', () => res.startNotifications());
  if (!await stap('meldingen FFF4 aan', () => live.startNotifications())) throw new Error('metingen aanzetten lukte niet');
  await handdruk(login, inst, false);
  wachtOpMetingen(nr, login, inst);
  clearInterval(S.batterijTimer);
  S.batterijTimer = setInterval(() => {
    if (S.verbonden) schrijf(inst, CMD.batterij).catch(() => {});
  }, 60e3);
  S.verbonden = true;
  S.verbindingKwijtSinds = null;
  houdSchermAan();
  toonStatus();
  toonVerbinden();
}

// Inloggen + metingen aanzetten. "anders" = de andere schrijfwijze (met/zonder bevestiging);
// sommige uitvoeringen negeren de ene en reageren alleen op de andere.
async function handdruk(login, inst, anders) {
  const w = anders ? schrijfAnders : schrijf;
  await stap('inloggen', () => w(login, CMD.login));
  await wacht(300);
  await stap('°C instellen', () => w(inst, CMD.celsius));
  await stap('live metingen aan', () => w(inst, CMD.live));
  await stap('batterij opvragen', () => w(inst, CMD.batterij));
}
function schrijfAnders(ch, bytes) {
  const data = new Uint8Array(bytes);
  const metBevestiging = ch.properties && ch.properties.write && ch.writeValueWithResponse;
  if (metBevestiging && ch.writeValueWithoutResponse) return ch.writeValueWithoutResponse(data);
  if (ch.writeValueWithResponse) return ch.writeValueWithResponse(data);
  return ch.writeValue(data);
}
// Komen er na het verbinden geen metingen binnen, dan nog een paar keer proberen.
async function wachtOpMetingen(nr, login, inst) {
  const pogingen = [
    ['nog geen metingen na 4 s → opnieuw, andere schrijfwijze', () => handdruk(login, inst, true)],
    ['nog geen metingen na 8 s → opnieuw, gewone schrijfwijze', () => handdruk(login, inst, false)],
  ];
  for (const [tekst, fn] of pogingen) {
    await wacht(4000);
    if (nr !== S.koppelNr || !S.verbonden || S.laatsteData) return;
    log(tekst);
    await fn();
  }
  await wacht(4000);
  if (nr !== S.koppelNr || !S.verbonden || S.laatsteData) return;
  log('Geen metingen ontvangen. Kopieer dit log en stuur het door.');
  toonStatus('Geen metingen');
  $('#log-vak').open = true;
  melding('Verbonden, maar de thermometer stuurt geen metingen. Zie "Verbindingslog" onderaan.', 8000);
}
async function stap(naam, fn) {
  try { await fn(); log(naam + ': ok'); return true; } catch (e) { log(`${naam}: FOUT ${e.name}: ${e.message}`); return false; }
}
function log(tekst) {
  S.log.push(`${new Date().toLocaleTimeString('nl-NL')} ${tekst}`);
  if (S.log.length > 300) S.log.shift();
  $('#log-tekst').textContent = S.log.join('\n');
}
const hex = (dv) => [...new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength)].map((b) => b.toString(16).padStart(2, '0')).join(' ');
const kort = (uuid) => (/^0000(....)-0000-1000-8000-00805f9b34fb$/.exec(String(uuid))?.[1] || String(uuid)).toUpperCase();
const eigenschappen = (c) => ['read', 'write', 'writeWithoutResponse', 'notify', 'indicate'].filter((k) => c.properties[k]).join(',');

// Laat zien wat het apparaat aanbiedt, zodat de app op een ander model kan worden aangepast.
async function toonDiagnose(dev, server) {
  const r = [`Naam: ${dev.name || '(geen naam)'}`, `Browser: ${navigator.userAgent}`];
  const tekst = (dv) => new TextDecoder().decode(dv).replace(/\0+$/, '');
  let diensten = [];
  try { diensten = await server.getPrimaryServices(); } catch (e) { r.push('Diensten: ' + e.message); }
  if (!diensten.length) r.push('Geen bekende diensten gevonden.');
  for (const d of diensten) {
    r.push(`Dienst ${d.uuid}`);
    let kenmerken = [];
    try { kenmerken = await d.getCharacteristics(); } catch (e) { r.push('  ' + e.message); }
    for (const c of kenmerken) {
      const props = eigenschappen(c).split(',');
      let waarde = '';
      if (c.properties.read) {
        try {
          const dv = await c.readValue();
          const t = tekst(dv);
          waarde = /^[\x20-\x7e]+$/.test(t) ? ` = "${t}"` : ` = ${hex(dv)}`;
        } catch { /* niet leesbaar */ }
      }
      r.push(`  ${c.uuid} [${props.join(', ')}]${waarde}`);
    }
  }
  $('#diagnose-tekst').textContent = r.join('\n');
  $('#diagnose').hidden = false;
}

async function bijVerbroken() {
  log('Verbinding verbroken');
  S.verbonden = false;
  clearInterval(S.batterijTimer);
  toonStatus();
  if (S.handmatigLos || !S.apparaat) { toonVerbinden(); return; }
  S.verbindingKwijtSinds ||= Date.now();
  const wachttijden = [1, 2, 3, 5, 5, 10];
  for (let poging = 0; !S.handmatigLos && S.apparaat; poging++) {
    toonStatus('Opnieuw verbinden…');
    await wacht(1000 * wachttijden[Math.min(poging, wachttijden.length - 1)]);
    if (S.handmatigLos || !S.apparaat) break;
    try { await koppel(S.apparaat); return; } catch { /* volgende poging */ }
    if (Date.now() - S.verbindingKwijtSinds > 60e3 && !S.kwijtGemeld) {
      S.kwijtGemeld = true;
      geefAlarm('Verbinding met de thermometer kwijt', 'Breng je telefoon dichter bij de thermometer.');
    }
  }
  toonVerbinden();
}
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));

async function verbreek() {
  S.handmatigLos = true;
  stopDemo();
  if (S.apparaat?.gatt?.connected) S.apparaat.gatt.disconnect();
  S.apparaat = null; S.verbonden = false; S.temps = [];
  clearInterval(S.batterijTimer);
  S.batterij = null;
  laatSchermLos();
  toonStatus(); toonVoelers(); toonVerbinden();
}

// ---------- Demo ----------
function startDemo() {
  ontgrendelGeluid();
  S.handmatigLos = false;
  const begin = [118, 6, 9, null];
  let t = 0;
  S.demo = setInterval(() => {
    t++;
    const ruis = () => (Math.random() - 0.5) * 0.6;
    nieuweTemps([
      115 + 8 * Math.sin(t / 90) + ruis(),
      Math.min(95, begin[1] + 88 * (1 - Math.exp(-t / 900))) + ruis() / 3,
      Math.min(80, begin[2] + 70 * (1 - Math.exp(-t / 600))) + ruis() / 3,
      null,
    ]);
  }, 1000);
  S.verbonden = true;
  S.batterij = 87;
  houdSchermAan();
  toonStatus(); toonVerbinden();
}
function stopDemo() {
  if (!S.demo) return;
  clearInterval(S.demo); S.demo = null;
}

// ---------- Alarmen ----------
function controleerAlarmen() {
  S.temps.forEach((c, i) => {
    const v = voeler(i);
    const oud = S.alarmStaat[i] || null;
    // "te laag" pas nadat de voeler boven de ondergrens is geweest (anders alarm tijdens het opwarmen)
    S.boven ||= {};
    if (c != null && v.min != null && c >= v.min + 1) S.boven[i] = true;
    let nieuw = null;
    if (c != null) {
      // 1 graad marge zodat het alarm niet aan/uit blijft springen rond de grens
      const hoog = v.doel != null && (oud === 'hoog' ? c > v.doel - 1 : c >= v.doel);
      const laag = v.min != null && S.boven[i] && (oud === 'laag' ? c < v.min + 1 : c < v.min);
      nieuw = hoog ? 'hoog' : laag ? 'laag' : null;
    }
    S.alarmStaat[i] = nieuw;
    if (nieuw && nieuw !== oud && !S.alarmGezien[i + nieuw]) {
      const tekst = nieuw === 'hoog'
        ? `${v.naam} is op temperatuur: ${fmt(c)}${graad()}`
        : `${v.naam} is te ver gezakt: ${fmt(c)}${graad()}`;
      geefAlarm(tekst, nieuw === 'hoog' ? `Doel ${fmt(v.doel, 0)}${graad()} bereikt.` : `Ondergrens ${fmt(v.min, 0)}${graad()}.`);
    }
    if (!nieuw) { delete S.alarmGezien[i + 'hoog']; delete S.alarmGezien[i + 'laag']; }
  });
}
function geefAlarm(titel, tekst) {
  $('#alarm-tekst').textContent = titel;
  $('#alarm').hidden = false;
  speelAlarm();
  if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 400]);
  if ('Notification' in window && Notification.permission === 'granted') {
    const opties = { body: tekst, tag: 'bbq-alarm', renotify: true, icon: 'icoon-192.png', vibrate: [400, 200, 400] };
    if (window.__native) { new Notification(titel, opties); return; } // Android-app
    navigator.serviceWorker?.ready
      .then((r) => r.showNotification(titel, opties))
      .catch(() => { try { new Notification(titel, opties); } catch { /* niet mogelijk */ } });
  }
}
function stopAlarm() {
  $('#alarm').hidden = true;
  clearInterval(S.alarmGeluid); S.alarmGeluid = null;
  Object.entries(S.alarmStaat).forEach(([i, staat]) => { if (staat) S.alarmGezien[i + staat] = true; });
  S.kwijtGemeld = false;
  toonVoelers();
}
function ontgrendelGeluid() {
  try {
    S.geluid ||= new (window.AudioContext || window.webkitAudioContext)();
    S.geluid.resume();
  } catch { /* geen geluid */ }
}
function piep() {
  const ctx = S.geluid;
  if (!ctx) return;
  [0, 0.25, 0.5].forEach((d) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = 1760;
    g.gain.setValueAtTime(0.15, ctx.currentTime + d);
    g.gain.setValueAtTime(0, ctx.currentTime + d + 0.15);
    o.connect(g).connect(ctx.destination);
    o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.16);
  });
}
function speelAlarm() {
  if (S.alarmGeluid) return;
  piep();
  S.alarmGeluid = setInterval(piep, 1500);
}
function vraagMeldingen() {
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
}

// ---------- Scherm aan houden ----------
async function houdSchermAan() {
  try { if ('wakeLock' in navigator && !S.wakeLock) S.wakeLock = await navigator.wakeLock.request('screen'); } catch { /* mag niet */ }
  S.wakeLock?.addEventListener?.('release', () => { S.wakeLock = null; });
}
function laatSchermLos() { S.wakeLock?.release?.(); S.wakeLock = null; }
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && S.verbonden) houdSchermAan();
});

// ---------- Tempo en verwachte tijd ----------
function verwachtteTijd(i) {
  const v = voeler(i), c = S.temps[i];
  // bij een BBQ-voeler (met ondergrens) is "klaar om" zinloos
  if (c == null || v.doel == null || v.min != null || c >= v.doel) return null;
  const nu = Date.now();
  const p = S.buffer.filter((m) => m.t >= nu - ETA_VENSTER_MS && m.v[i] != null).map((m) => [m.t, m.v[i]]);
  p.push([nu, c]);
  if (p.length < 8 || p[p.length - 1][0] - p[0][0] < 2 * 60e3) return { tekst: 'tempo meten…' };
  // lineaire regressie: graden per minuut
  const n = p.length, mx = p.reduce((s, q) => s + q[0], 0) / n, my = p.reduce((s, q) => s + q[1], 0) / n;
  let teller = 0, noemer = 0;
  p.forEach(([x, y]) => { teller += (x - mx) * (y - my); noemer += (x - mx) ** 2; });
  const perMin = (teller / noemer) * 60e3;
  if (!(perMin > 0.02)) return { tekst: 'stijgt niet (stall?)' };
  const min = (v.doel - c) / perMin;
  if (min > 48 * 60) return { tekst: 'nog lang' };
  return { tekst: `klaar ± ${fmtTijd(nu + min * 60e3)} (nog ${fmtDuur(min * 60e3)})` };
}

// ---------- Weergave: status ----------
function toonStatus(tekst) {
  const el = $('#status');
  if (tekst) { el.textContent = tekst; el.className = 'pil bezig'; }
  else if (S.verbonden) { el.textContent = S.demo ? 'Demo' : 'Verbonden'; el.className = 'pil aan'; }
  else { el.textContent = 'Niet verbonden'; el.className = 'pil'; }
  const b = $('#batterij');
  b.hidden = S.batterij == null || !S.verbonden;
  b.textContent = `🔋 ${S.batterij}%`;
  b.className = 'pil' + (S.batterij != null && S.batterij < 20 ? ' bezig' : '');
  $('#eenheid').textContent = graad();
}
function toonVerbinden() {
  const actief = S.verbonden || !!S.apparaat || !!S.demo;
  $('#verbind-kaart').hidden = actief;
  $('#verbreek').hidden = !actief;
}
function toonSessie() {
  $('#sessie-kaart').hidden = !S.sessie;
  $('#grafiek-kaart').hidden = !S.sessie;
  if (!S.sessie) return;
  $('#sessie-naam').textContent = `${S.sessie.naam} · ${fmtDuur(S.sessie.eind - S.sessie.start)}`;
}

// ---------- Weergave: voelers ----------
function toonVoelers() {
  const vak = $('#voelers');
  const aantal = S.temps.length;
  if (vak.children.length !== aantal) {
    vak.innerHTML = '';
    for (let i = 0; i < aantal; i++) {
      const b = document.createElement('button');
      b.className = 'voeler';
      b.innerHTML = '<span class="tandwiel">⚙</span><div class="naam"><span class="stip"></span><span class="nm"></span></div>'
        + '<div class="temp"></div><div class="doel"></div><div class="balk"><i></i></div><div class="eta"></div>';
      b.addEventListener('click', () => openInstellingen(i));
      vak.appendChild(b);
    }
  }
  S.temps.forEach((c, i) => {
    const el = vak.children[i], v = voeler(i), kleur = KLEUREN[i % KLEUREN.length];
    el.classList.toggle('uit', c == null);
    el.classList.toggle('alarm-aan', !!S.alarmStaat[i] && !S.alarmGezien[i + S.alarmStaat[i]]);
    el.querySelector('.stip').style.background = kleur;
    el.querySelector('.nm').textContent = v.naam;
    el.querySelector('.temp').innerHTML = c == null ? '—' : `${fmt(c)}<small>${graad()}</small>`;
    const delen = [];
    if (v.doel != null) delen.push(`doel ${fmt(v.doel, 0)}°`);
    if (v.min != null) delen.push(`min ${fmt(v.min, 0)}°`);
    el.querySelector('.doel').textContent = c == null ? 'niet aangesloten' : delen.join(' · ') || 'tik om alarm in te stellen';
    const balk = el.querySelector('.balk');
    balk.hidden = c == null || v.doel == null;
    if (!balk.hidden) {
      balk.firstChild.style.width = Math.max(0, Math.min(100, (c / v.doel) * 100)) + '%';
      balk.firstChild.style.background = kleur;
    }
    const eta = c == null ? null : verwachtteTijd(i);
    el.querySelector('.eta').textContent = eta ? eta.tekst : '';
  });
}

// ---------- Instellingen per voeler ----------
function openInstellingen(i) {
  ontgrendelGeluid();
  vraagMeldingen();
  const v = voeler(i), dlg = $('#dlg');
  $('#dlg-titel').textContent = `Voeler ${i + 1}`;
  $('#dlg-naam').value = S.voelers[i]?.naam || '';
  $('#dlg-naam').placeholder = `Voeler ${i + 1}`;
  $('#dlg-doel').value = v.doel == null ? '' : Math.round(naarEenheid(v.doel) * 10) / 10;
  $('#dlg-min').value = v.min == null ? '' : Math.round(naarEenheid(v.min) * 10) / 10;
  $('#dlg-preset').value = '0';
  dlg.querySelectorAll('.eh').forEach((e) => { e.textContent = `(${graad()})`; });
  dlg.onclose = () => {
    if (dlg.returnValue !== 'ok') return;
    const getal = (s) => (s.trim() === '' ? null : vanEenheid(parseFloat(s.replace(',', '.'))));
    const doel = getal($('#dlg-doel').value), min = getal($('#dlg-min').value);
    S.voelers[i] = {
      naam: $('#dlg-naam').value.trim() || null,
      doel: Number.isFinite(doel) ? doel : null,
      min: Number.isFinite(min) ? min : null,
    };
    if (!S.voelers[i].naam) delete S.voelers[i].naam;
    for (let k = 0; k < S.voelers.length; k++) S.voelers[k] ||= {};
    bewaar('voelers', S.voelers);
    delete S.alarmGezien[i + 'hoog']; delete S.alarmGezien[i + 'laag'];
    if (S.boven) delete S.boven[i];
    toonVoelers(); tekenLive();
  };
  dlg.returnValue = '';
  dlg.showModal();
}
function vulPresets() {
  const sel = $('#dlg-preset');
  sel.innerHTML = PRESETS.map((p, i) => `<option value="${i}">${p.naam}</option>`).join('');
  sel.addEventListener('change', () => {
    const p = PRESETS[sel.value];
    if (p.doel == null) return;
    $('#dlg-doel').value = Math.round(naarEenheid(p.doel));
    $('#dlg-min').value = p.min == null ? '' : Math.round(naarEenheid(p.min));
    if (!$('#dlg-naam').value) $('#dlg-naam').value = p.naam.replace(/\s*\(.*\)$/, '').replace(/^BBQ.*/, 'BBQ');
  });
}

// ---------- Grafiek ----------
class Grafiek {
  constructor(canvas, tip) {
    this.cv = canvas; this.tip = tip; this.metingen = []; this.opties = {};
    const wijs = (e) => { this.cursor = e.offsetX; this.teken(); };
    canvas.addEventListener('pointerdown', wijs);
    canvas.addEventListener('pointermove', wijs);
    canvas.addEventListener('pointerleave', () => { this.cursor = null; this.teken(); });
    new ResizeObserver(() => this.teken()).observe(canvas);
  }
  zet(metingen, opties) { this.metingen = metingen; this.opties = opties; this.teken(); }
  teken() {
    const cv = this.cv, w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    const stijl = getComputedStyle(document.documentElement);
    const grijs = stijl.getPropertyValue('--grijs').trim(), rand = stijl.getPropertyValue('--rand').trim();
    c.font = '11px system-ui, sans-serif';

    const { voelers = [], bereikMs = 0 } = this.opties;
    const alle = this.metingen;
    this.tip.hidden = true;
    if (alle.length < 2) {
      c.fillStyle = grijs; c.textAlign = 'center';
      c.fillText('Grafiek verschijnt na een paar metingen…', w / 2, h / 2);
      return;
    }
    const tot = alle[alle.length - 1].t;
    const van = bereikMs ? Math.max(alle[0].t, tot - bereikMs) : alle[0].t;
    let pts = alle.filter((m) => m.t >= van);
    if (pts.length < 2) pts = alle.slice(-2);
    const t0 = pts[0].t, t1 = Math.max(pts[pts.length - 1].t, t0 + 60e3);

    // y-bereik (in weergave-eenheid)
    let lo = Infinity, hi = -Infinity;
    pts.forEach((m) => m.v.forEach((x) => { if (x != null) { const y = naarEenheid(x); lo = Math.min(lo, y); hi = Math.max(hi, y); } }));
    voelers.forEach((v, i) => {
      if (!pts.some((m) => m.v[i] != null)) return;
      [v.doel, v.min].forEach((x) => { if (x != null) { const y = naarEenheid(x); lo = Math.min(lo, y); hi = Math.max(hi, y); } });
    });
    if (!Number.isFinite(lo)) { lo = 0; hi = 100; }
    const stap = [5, 10, 20, 25, 50, 100].find((s) => (hi - lo) / s <= 6) || 100;
    lo = Math.floor((lo - 2) / stap) * stap; hi = Math.ceil((hi + 2) / stap) * stap;

    const L = 34, R = 8, T = 8, B = 20, pw = w - L - R, ph = h - T - B;
    const X = (t) => L + ((t - t0) / (t1 - t0)) * pw;
    const Y = (y) => T + (1 - (y - lo) / (hi - lo)) * ph;

    // raster
    c.strokeStyle = rand; c.fillStyle = grijs; c.lineWidth = 1; c.textAlign = 'right'; c.textBaseline = 'middle';
    for (let y = lo; y <= hi; y += stap) {
      c.beginPath(); c.moveTo(L, Y(y) + 0.5); c.lineTo(w - R, Y(y) + 0.5); c.stroke();
      c.fillText(String(y), L - 5, Y(y));
    }
    const minuten = [1, 2, 5, 10, 15, 30, 60, 120, 180, 240, 360, 720].find((m) => (t1 - t0) / (m * 60e3) <= Math.max(2, pw / 70)) || 1440;
    const xs = minuten * 60e3;
    const offset = new Date(t0).getTimezoneOffset() * 60e3;
    c.textAlign = 'center'; c.textBaseline = 'top';
    for (let t = Math.ceil((t0 - offset) / xs) * xs + offset; t <= t1; t += xs) {
      c.fillText(fmtTijd(t), X(t), h - B + 5);
    }

    // doellijnen
    c.setLineDash([4, 4]);
    voelers.forEach((v, i) => {
      if (!pts.some((m) => m.v[i] != null)) return;
      c.strokeStyle = KLEUREN[i % KLEUREN.length]; c.globalAlpha = 0.6;
      [v.doel, v.min].forEach((x) => {
        if (x == null) return;
        c.beginPath(); c.moveTo(L, Y(naarEenheid(x))); c.lineTo(w - R, Y(naarEenheid(x))); c.stroke();
      });
    });
    c.setLineDash([]); c.globalAlpha = 1;

    // lijnen (bij veel punten: één punt per ~pixel)
    const elke = Math.max(1, Math.floor(pts.length / pw));
    const aantal = Math.max(...pts.map((m) => m.v.length));
    c.lineWidth = 2; c.lineJoin = 'round';
    for (let i = 0; i < aantal; i++) {
      c.strokeStyle = KLEUREN[i % KLEUREN.length];
      c.beginPath();
      const gat = Math.max(90e3, elke * OPSLAG_ELKE_MS * 3); // langer niets gemeten = lijn onderbreken
      let vorigeT = null;
      for (let k = 0; k < pts.length; k += elke) {
        const m = pts[k], x = m.v[i];
        if (x == null) { vorigeT = null; continue; }
        const px = X(m.t), py = Y(naarEenheid(x));
        if (vorigeT == null || m.t - vorigeT > gat) c.moveTo(px, py); else c.lineTo(px, py);
        vorigeT = m.t;
      }
      c.stroke();
    }

    // aanwijzer
    if (this.cursor != null && this.cursor >= L) {
      const t = t0 + ((this.cursor - L) / pw) * (t1 - t0);
      let best = pts[0];
      for (const m of pts) if (Math.abs(m.t - t) < Math.abs(best.t - t)) best = m;
      const bx = X(best.t);
      c.strokeStyle = grijs; c.beginPath(); c.moveTo(bx + 0.5, T); c.lineTo(bx + 0.5, T + ph); c.stroke();
      best.v.forEach((x, i) => {
        if (x == null) return;
        c.fillStyle = KLEUREN[i % KLEUREN.length];
        c.beginPath(); c.arc(bx, Y(naarEenheid(x)), 4, 0, 7); c.fill();
      });
      this.tip.innerHTML = `<b>${new Date(best.t).toLocaleTimeString('nl-NL')}</b>` + best.v.map((x, i) => (x == null ? ''
        : `<span><i style="background:${KLEUREN[i % KLEUREN.length]}"></i>${esc((voelers[i] || voeler(i)).naam)}: ${fmt(x)}${graad()}</span>`)).join('');
      this.tip.hidden = false;
      const tw = this.tip.offsetWidth;
      this.tip.style.left = (bx + 10 + tw > w ? bx - 10 - tw : bx + 10) + 'px';
    }
  }
}
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

let liveGrafiek, detGrafiek;
function tekenLive() {
  if (!liveGrafiek || $('#grafiek-kaart').hidden) return;
  liveGrafiek.zet(S.buffer, { voelers: S.temps.map((_, i) => voeler(i)), bereikMs: S.bereikMin * 60e3 });
}

// ---------- Historie ----------
let detSessie = null;
async function toonHistorie() {
  $('#historie-detail').hidden = true;
  const lijst = $('#historie-lijst');
  lijst.hidden = false;
  const sessies = (await opslag.sessies()).sort((a, b) => b.start - a.start);
  if (!sessies.length) {
    lijst.innerHTML = '<div class="leeg">Nog geen sessies.<br>Zodra je de thermometer verbindt, wordt alles automatisch bewaard.</div>';
    return;
  }
  lijst.innerHTML = '';
  sessies.forEach((s) => {
    const b = document.createElement('button');
    b.className = 'sessie-item';
    const actief = S.sessie && S.sessie.id === s.id ? ' · <span style="color:var(--goed)">bezig</span>' : '';
    b.innerHTML = `<div class="titel">${esc(s.naam)}</div>`
      + `<div class="sub">${fmtDatum(s.start)} · ${fmtTijd(s.start)}–${fmtTijd(s.eind)} · ${fmtDuur(s.eind - s.start)}${actief}</div>`
      + (s.notitie ? `<div class="sub">${esc(s.notitie.split('\n')[0])}</div>` : '');
    b.addEventListener('click', () => openSessie(s.id));
    lijst.appendChild(b);
  });
}
async function openSessie(id) {
  const s = await opslag.sessie(id);
  if (!s) return toonHistorie();
  const metingen = (await opslag.metingen(id)).sort((a, b) => a.t - b.t);
  detSessie = { s, metingen };
  $('#historie-lijst').hidden = true;
  $('#historie-detail').hidden = false;
  $('#det-naam').value = s.naam;
  $('#det-notitie').value = s.notitie || '';
  $('#det-info').textContent = `${fmtDatum(s.start)} · ${fmtTijd(s.start)}–${fmtTijd(s.eind)} · ${fmtDuur(s.eind - s.start)} · ${metingen.length} metingen`;
  const voelers = s.voelers || [];
  const aantal = Math.max(0, ...metingen.map((m) => m.v.length));
  let stats = '';
  for (let i = 0; i < aantal; i++) {
    const waarden = metingen.map((m) => m.v[i]).filter((x) => x != null);
    if (!waarden.length) continue;
    const naam = (voelers[i] && voelers[i].naam) || `Voeler ${i + 1}`;
    const gem = waarden.reduce((a, b) => a + b, 0) / waarden.length;
    stats += `<div class="stat"><i style="background:${KLEUREN[i % KLEUREN.length]}"></i>${esc(naam)}: `
      + `max ${fmt(Math.max(...waarden))}° · gem ${fmt(gem)}° · eind ${fmt(waarden[waarden.length - 1])}°</div>`;
  }
  $('#det-stats').innerHTML = stats;
  detGrafiek.zet(metingen, { voelers: Array.from({ length: aantal }, (_, i) => Object.assign({ naam: `Voeler ${i + 1}` }, voelers[i])) });
  window.scrollTo(0, 0);
}
async function bewaarDetail() {
  if (!detSessie) return;
  const s = detSessie.s;
  s.naam = $('#det-naam').value.trim() || s.naam;
  s.notitie = $('#det-notitie').value;
  // de actieve sessie wordt elke 5 s bewaard; wijzig daarom ook de kopie in het geheugen
  if (S.sessie && S.sessie.id === s.id) { S.sessie.naam = s.naam; S.sessie.notitie = s.notitie; toonSessie(); }
  else await opslag.sessieBewaren(s);
}
function downloadCsv() {
  if (!detSessie) return;
  const { s, metingen } = detSessie;
  const aantal = Math.max(0, ...metingen.map((m) => m.v.length));
  const namen = Array.from({ length: aantal }, (_, i) => (s.voelers?.[i]?.naam) || `Voeler ${i + 1}`);
  const regels = [['Datum', 'Tijd', ...namen.map((n) => `${n} (${graad()})`)].join(';')];
  metingen.forEach((m) => {
    const d = new Date(m.t);
    regels.push([d.toLocaleDateString('nl-NL'), d.toLocaleTimeString('nl-NL'),
      ...namen.map((_, i) => (m.v[i] == null ? '' : fmt(m.v[i]).replace(/\./g, '')))].join(';'));
  });
  const blob = new Blob(['﻿' + regels.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${s.naam.replace(/:/g, '.').replace(/[\\/*?"<>|]/g, '')}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
async function wisSessie() {
  if (!detSessie || !confirm(`"${detSessie.s.naam}" verwijderen? Dit kan niet ongedaan worden.`)) return;
  const id = detSessie.s.id;
  if (S.sessie && S.sessie.id === id) { S.sessie = null; S.buffer = []; S.laatsteOpslag = 0; bewaar('actieveSessie', null); toonSessie(); }
  await opslag.wis(id);
  detSessie = null;
  toonHistorie();
}

// ---------- Tabs en knoppen ----------
function kiesTab(naam) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('actief', t.dataset.tab === naam));
  $('#tab-live').hidden = naam !== 'live';
  $('#tab-historie').hidden = naam !== 'historie';
  if (naam === 'historie') toonHistorie(); else tekenLive();
}

function start() {
  liveGrafiek = new Grafiek($('#grafiek'), $('#grafiek-tip'));
  detGrafiek = new Grafiek($('#det-grafiek'), $('#det-tip'));
  vulPresets();
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => kiesTab(t.dataset.tab)));
  $('#verbind').addEventListener('click', () => verbind(false));
  $('#verbind-alles').addEventListener('click', () => verbind(true));
  $('#log-kopieer').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(S.log.join('\n')); melding('Log gekopieerd'); }
    catch { melding('Kopiëren lukte niet; maak een schermafbeelding.'); }
  });
  $('#diagnose-kopieer').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('#diagnose-tekst').textContent); melding('Gekopieerd'); }
    catch { melding('Kopiëren lukte niet; maak een schermafbeelding.'); }
  });
  navigator.bluetooth?.getAvailability?.().then((ok) => { $('#bt-uit').hidden = ok; }).catch(() => {});
  $('#demo').addEventListener('click', startDemo);
  $('#verbreek').addEventListener('click', verbreek);
  $('#alarm-stop').addEventListener('click', stopAlarm);
  $('#nieuwe-sessie').addEventListener('click', async () => {
    if (!confirm('Huidige sessie afsluiten en een nieuwe beginnen?')) return;
    await sluitSessie();
    melding('Nieuwe sessie begint bij de volgende meting.');
  });
  $('#eenheid').addEventListener('click', () => {
    S.eenheid = S.eenheid === 'C' ? 'F' : 'C';
    bewaar('eenheid', S.eenheid);
    toonStatus(); toonVoelers(); tekenLive();
    if (detSessie && !$('#historie-detail').hidden) openSessie(detSessie.s.id);
  });
  $('#bereik').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    S.bereikMin = +b.dataset.min;
    $('#bereik').querySelectorAll('button').forEach((x) => x.classList.toggle('actief', x === b));
    tekenLive();
  });
  $('#terug').addEventListener('click', toonHistorie);
  $('#det-naam').addEventListener('change', bewaarDetail);
  $('#det-notitie').addEventListener('change', bewaarDetail);
  $('#det-csv').addEventListener('click', downloadCsv);
  $('#det-wis').addEventListener('click', wisSessie);
  if (!navigator.bluetooth) $('#geen-bt').hidden = false;

  // elke 30 s de "klaar om"-tijden en sessieduur verversen, ook als er even niets binnenkomt
  setInterval(() => { toonVoelers(); toonSessie(); }, 30e3);

  toonStatus(); toonVerbinden();
  herstelSessie().catch(console.error);
  if ('serviceWorker' in navigator && !window.__native) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (new URLSearchParams(location.search).has('demo')) startDemo();
}
start();
