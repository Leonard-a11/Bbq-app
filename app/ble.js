// Bluetooth: iBBQ-protocol (Inkbird IBT-2X/4XS/6XS), verbinden, eindeloos opnieuw
// verbinden, diagnose en een demo zonder thermometer.
import { S, log } from './staat.js';
import { $, wacht } from './hulp.js';

const SERVICE = 0xfff0;
const CH_RESULTAAT = 0xfff1, CH_LOGIN = 0xfff2, CH_LIVE = 0xfff4, CH_INSTELLING = 0xfff5;
const CMD = {
  login: [0x21, 0x07, 0x06, 0x05, 0x04, 0x03, 0x02, 0x01, 0xb8, 0x22, 0x00, 0x00, 0x00, 0x00, 0x00],
  live: [0x0b, 0x01, 0x00, 0x00, 0x00, 0x00],
  celsius: [0x02, 0x00, 0x00, 0x00, 0x00, 0x00],
  batterij: [0x08, 0x24, 0x00, 0x00, 0x00, 0x00],
};
const ANDERE_DIENSTEN = [0xffe0, 0xffb0, 0xffd0, 0xff00, 0xfee0, 0xfe00, 0xfff6, 0x180a, 0x180f,
  '0000fee7-0000-1000-8000-00805f9b34fb', '6e400001-b5a3-f393-e0a9-e50e24dcca9e'];

/** Wordt door main.js ingevuld. */
export const opvang = {
  temps: () => {},       // nieuwe temperaturen
  status: () => {},      // verbindingsstatus veranderd (tekst optioneel)
  verbonden: () => {},   // (opnieuw) verbonden
  verbroken: () => {},   // verbinding weg (niet handmatig)
  diagnose: () => {},    // ander protocol: tekst met gegevens
};

export const hex = (dv) => [...new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength)].map((b) => b.toString(16).padStart(2, '0')).join(' ');
export const kort = (uuid) => (/^0000(....)-0000-1000-8000-00805f9b34fb$/.exec(String(uuid))?.[1] || String(uuid)).toUpperCase();
const eigenschappen = (c) => ['read', 'write', 'writeWithoutResponse', 'notify', 'indicate'].filter((k) => c.properties[k]).join(',');

function schrijf(ch, bytes) {
  const data = new Uint8Array(bytes);
  if (ch.properties && ch.properties.write && ch.writeValueWithResponse) return ch.writeValueWithResponse(data);
  if (ch.writeValueWithoutResponse) return ch.writeValueWithoutResponse(data);
  return ch.writeValue(data);
}
function schrijfAnders(ch, bytes) {
  const data = new Uint8Array(bytes);
  if (ch.properties && ch.properties.write && ch.writeValueWithResponse && ch.writeValueWithoutResponse) return ch.writeValueWithoutResponse(data);
  if (ch.writeValueWithResponse) return ch.writeValueWithResponse(data);
  return ch.writeValue(data);
}
export function leesTemps(dv) {
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
  const max = dv.getUint16(3, true) || 6580;
  const v = nu / (max / 6580);
  S.batterij = Math.max(0, Math.min(100, Math.round((v - 5580) / (6150 - 5580) * 100)));
  opvang.status();
}
async function stap(naam, fn) {
  try { await fn(); log(naam + ': ok'); return true; } catch (e) { log(`${naam}: FOUT ${e.name}: ${e.message}`); return false; }
}

// ---------- Verbinden ----------
export async function verbind(alles = false) {
  if (!navigator.bluetooth) { $('#geen-bt').hidden = false; return false; }
  log(alles ? 'Zoeken naar álle apparaten…' : 'Thermometer zoeken…');
  // Android-app: eerst rechtstreeks naar thermometers die de telefoon al kent
  if (!alles && navigator.bluetooth.bekende) {
    if (await verbindBekende()) return true;
  }
  let dev;
  try {
    dev = await navigator.bluetooth.requestDevice(alles
      ? { acceptAllDevices: true, optionalServices: [SERVICE, ...ANDERE_DIENSTEN] }
      : {
        filters: [{ namePrefix: 'iBBQ' }, { namePrefix: 'IBT' }, { namePrefix: 'Inkbird' }, { namePrefix: 'INKBIRD' }, { services: [SERVICE] }],
        optionalServices: [SERVICE, ...ANDERE_DIENSTEN],
      });
  } catch (e) {
    log(`Zoeken: ${e.name}: ${e.message}`);
    if (/cancel/i.test(e.message)) return false;
    throw e;
  }
  log(`Gekozen: "${dev.name || '(geen naam)'}"`);
  return probeer(dev, true);
}

/** Zonder zoeken verbinden met een bekende thermometer (alleen Android-app). */
export async function verbindBekende() {
  let kandidaten = [];
  try { kandidaten = await navigator.bluetooth.bekende(); } catch (e) { log('Bekende apparaten opvragen: FOUT ' + e.message); }
  log(kandidaten.length
    ? 'Bekende apparaten: ' + kandidaten.map((k) => `"${k.name || '?'}" ${k.id} (${k.bron})`).join(', ')
    : 'Geen bekende thermometer op deze telefoon');
  for (const k of kandidaten) {
    if (await probeer(navigator.bluetooth.apparaat(k.id, k.name), false)) return true;
  }
  return false;
}

async function probeer(dev, meldFout) {
  stopDemo();
  S.apparaat = dev;
  S.handmatigLos = false;
  if (!dev.__luistert) {
    dev.__luistert = true;
    dev.addEventListener('gattserverdisconnected', () => { if (S.apparaat === dev) bijVerbroken(); });
  }
  try {
    await koppel(dev);
    navigator.bluetooth.onthoud?.(dev);
    return true;
  } catch (e) {
    log('Mislukt: ' + e.message);
    S.handmatigLos = true;
    S.apparaat = null;
    try { dev.gatt.disconnect(); } catch { /* al los */ }
    opvang.status();
    if (meldFout) throw e;
    return false;
  }
}

async function koppel(dev) {
  opvang.status('Verbinden…');
  const nr = ++S.koppelNr;
  log(`Verbinden met "${dev.name || '(geen naam)'}"…`);
  const server = await dev.gatt.connect();
  log('Bluetooth-verbinding staat');
  let svc;
  try {
    svc = await server.getPrimaryService(SERVICE);
  } catch (e) {
    log('Dienst FFF0 niet gevonden: ' + e.message);
    opvang.diagnose(await diagnose(dev, server));
    throw new Error('dit model gebruikt een ander protocol');
  }
  const [res, login, live, inst] = await Promise.all(
    [CH_RESULTAAT, CH_LOGIN, CH_LIVE, CH_INSTELLING].map((u) => svc.getCharacteristic(u)));
  log('Kanalen: ' + [res, login, live, inst].map((c) => `${kort(c.uuid)}[${eigenschappen(c)}]`).join(' '));
  res.oncharacteristicvaluechanged = (e) => leesBatterij(e.target.value);
  S.laatsteData = 0;
  live.oncharacteristicvaluechanged = (e) => {
    if (!S.laatsteData) log('Eerste meting: ' + hex(e.target.value));
    S.laatsteData = Date.now();
    opvang.temps(leesTemps(e.target.value));
  };
  await stap('meldingen FFF1 aan', () => res.startNotifications());
  if (!await stap('meldingen FFF4 aan', () => live.startNotifications())) throw new Error('metingen aanzetten lukte niet');
  await handdruk(login, inst, false);
  clearInterval(S.batterijTimer);
  S.batterijTimer = setInterval(() => { if (S.verbonden) schrijf(inst, CMD.batterij).catch(() => {}); }, 60e3);
  S.verbonden = true;
  S.verbindingKwijtSinds = null;
  opvang.verbonden();
  wachtOpMetingen(nr, login, inst);
}

async function handdruk(login, inst, anders) {
  const w = anders ? schrijfAnders : schrijf;
  await stap('inloggen', () => w(login, CMD.login));
  await wacht(300);
  await stap('°C instellen', () => w(inst, CMD.celsius));
  await stap('live metingen aan', () => w(inst, CMD.live));
  await stap('batterij opvragen', () => w(inst, CMD.batterij));
}

async function wachtOpMetingen(nr, login, inst) {
  const pogingen = [() => handdruk(login, inst, true), () => handdruk(login, inst, false)];
  for (const p of pogingen) {
    await wacht(4000);
    if (nr !== S.koppelNr || !S.verbonden || S.laatsteData) return;
    log('Nog geen metingen → opnieuw inloggen');
    await p();
  }
  await wacht(4000);
  if (nr !== S.koppelNr || !S.verbonden || S.laatsteData) return;
  log('Geen metingen ontvangen.');
  opvang.status('Geen metingen');
}

// ---------- Opnieuw verbinden ----------
let wekker = null;
/** Wachten onderbreken (bijv. als Bluetooth weer aan gaat). */
export function wekOp() { if (wekker) wekker(); }

async function bijVerbroken() {
  if (!S.verbonden && S.verbindingKwijtSinds) return; // al bezig
  log('Verbinding verbroken');
  S.verbonden = false;
  clearInterval(S.batterijTimer);
  opvang.status();
  if (S.handmatigLos || !S.apparaat) return;
  S.verbindingKwijtSinds = Date.now();
  opvang.verbroken();
  const wachttijden = [1, 2, 3, 5, 5, 10, 10, 15, 20];
  for (let poging = 0; !S.handmatigLos && S.apparaat && !S.verbonden; poging++) {
    opvang.status('Opnieuw verbinden…');
    await Promise.race([wacht(1000 * wachttijden[Math.min(poging, wachttijden.length - 1)]), new Promise((r) => { wekker = r; })]);
    wekker = null;
    if (S.handmatigLos || !S.apparaat || S.verbonden) break;
    try { await koppel(S.apparaat); return; } catch (e) { if (poging % 5 === 0) log('Opnieuw verbinden: ' + e.message); }
  }
  opvang.status();
}

export async function verbreek() {
  S.handmatigLos = true;
  stopDemo();
  wekOp();
  if (S.apparaat?.gatt?.connected) S.apparaat.gatt.disconnect();
  S.apparaat = null; S.verbonden = false; S.temps = []; S.batterij = null; S.verbindingKwijtSinds = null;
  clearInterval(S.batterijTimer);
  log('Verbinding handmatig verbroken');
  opvang.status();
}

// ---------- Diagnose (ander model) ----------
async function diagnose(dev, server) {
  const r = [`Naam: ${dev.name || '(geen naam)'}`, `Browser: ${navigator.userAgent}`];
  let diensten = [];
  try { diensten = await server.getPrimaryServices(); } catch (e) { r.push('Diensten: ' + e.message); }
  for (const d of diensten) {
    r.push(`Dienst ${d.uuid}`);
    let ks = [];
    try { ks = await d.getCharacteristics(); } catch (e) { r.push('  ' + e.message); }
    for (const c of ks) {
      let waarde = '';
      if (c.properties.read) {
        try {
          const dv = await c.readValue();
          const t = new TextDecoder().decode(dv).replace(/\0+$/, '');
          waarde = /^[\x20-\x7e]+$/.test(t) ? ` = "${t}"` : ` = ${hex(dv)}`;
        } catch { /* niet leesbaar */ }
      }
      r.push(`  ${c.uuid} [${eigenschappen(c)}]${waarde}`);
    }
  }
  return r.join('\n');
}

// ---------- Demo: een lange low & slow met stall, deksel open en kolen bijvullen ----------
export function startDemo() {
  S.handmatigLos = false;
  let t = 0;
  S.demo = setInterval(() => {
    t++;
    const ruis = () => (Math.random() - 0.5) * 0.5;
    // BBQ ± 115°, elke 25 min deksel even open
    let pit = 116 + 6 * Math.sin(t / 300) + ruis();
    if (t % 1500 > 1440 && t % 1500 < 1470) pit -= 25;
    // brisket: stijgt, stall tussen 68 en 72, daarna door
    const b = t < 2400 ? 6 + 62 * (1 - Math.exp(-t / 900)) : t < 4200 ? 66.5 + (t - 2400) / 600 : 69.5 + 26 * (1 - Math.exp(-(t - 4200) / 1800));
    const ribs = 8 + 82 * (1 - Math.exp(-t / 1500));
    opvang.temps([pit, Math.min(b, 97) + ruis() / 4, Math.min(ribs, 92) + ruis() / 4, null]);
  }, 1000);
  S.verbonden = true;
  S.batterij = 87;
  opvang.verbonden();
}
export function stopDemo() {
  if (!S.demo) return;
  clearInterval(S.demo); S.demo = null;
}
