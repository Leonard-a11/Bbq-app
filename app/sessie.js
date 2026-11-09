// Sessies: blijven open tot je ze afrondt. Verbinding weg (Bluetooth uit, weggelopen)?
// Dan gaat dezelfde sessie verder zodra er weer metingen zijn.
import { S, voeler, log } from './staat.js';
import { opslag } from './opslag.js';
import { lees, bewaar, melding, fmtTijd } from './hulp.js';

const OPSLAG_ELKE = 5000;              // één meting per 5 s bewaren
export const NIEUW_NA = 12 * 3600e3;   // > 12 uur niets gemeten → nieuwe sessie (bijv. de volgende dag)

/** Wordt door main.js ingevuld: scherm bijwerken. */
export const opSessie = { veranderd: () => {} };

function standaardNaam(t, demo) {
  const d = new Date(t);
  const dag = d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
  return `${demo ? 'Demo – ' : ''}${dag[0].toUpperCase()}${dag.slice(1)}, ${fmtTijd(t)}`;
}

function zetStartTemps() {
  S.startTemp = {};
  for (const m of S.buffer) m.v.forEach((x, i) => { if (x != null && S.startTemp[i] == null) S.startTemp[i] = x; });
}

async function laad(s) {
  S.sessie = s;
  S.buffer = await opslag.metingen(s.id);
  S.laatsteOpslag = S.buffer.length ? S.buffer[S.buffer.length - 1].t : 0;
  zetStartTemps();
  bewaar('actieveSessie', s.id);
  opSessie.veranderd();
}

export async function nieuweSessie(nu = Date.now()) {
  const vorige = lees('laatsteOpzet', {});
  const s = {
    naam: standaardNaam(nu, !!S.demo), start: nu, eind: nu, open: true, demo: !!S.demo,
    voelers: [], gebeurtenissen: [], notitie: '', beoordeling: 0,
    opstelling: vorige.opstelling || null, eettijd: null,
  };
  s.id = await opslag.sessieMaken(s);
  S.sessie = s; S.buffer = []; S.laatsteOpslag = 0; S.startTemp = {};
  bewaar('actieveSessie', s.id);
  log(`Nieuwe sessie: ${s.naam}`);
  opSessie.veranderd();
  return s;
}

let bewaarTimer = null;
export function bewaarSessie(direct = false) {
  if (!S.sessie) return Promise.resolve();
  clearTimeout(bewaarTimer);
  const s = S.sessie;
  if (direct) return opslag.sessieBewaren(s);
  bewaarTimer = setTimeout(() => opslag.sessieBewaren(s).catch(console.error), 1500);
  return Promise.resolve();
}

/** Sessie afronden (extra = beoordeling, notitie). Lege sessies worden niet bewaard. */
export async function rondAf(extra = {}) {
  if (!S.sessie) return;
  const s = S.sessie;
  Object.assign(s, extra, { open: false });
  clearTimeout(bewaarTimer);
  if (!S.buffer.length && !(s.gebeurtenissen || []).length) await opslag.wis(s.id);
  else await opslag.sessieBewaren(s);
  log(`Sessie afgerond: ${s.naam}`);
  S.sessie = null; S.buffer = []; S.laatsteOpslag = 0; S.startTemp = {};
  bewaar('actieveSessie', null);
  opSessie.veranderd();
}

/** Bij het opstarten: open sessie terughalen (ook als de app was afgesloten). */
export async function herstel() {
  const id = lees('actieveSessie', null);
  if (!id) return;
  const s = await opslag.sessie(id);
  if (!s || s.open === false) { bewaar('actieveSessie', null); return; }
  s.open = true;
  await laad(s);
  log(`Open sessie hersteld: ${s.naam} (${S.buffer.length} metingen)`);
}

/** Een afgeronde sessie weer openen en daarin verder meten. */
export async function heropen(id) {
  if (S.sessie && S.sessie.id === id) return;
  if (S.sessie) await rondAf();
  const s = await opslag.sessie(id);
  if (!s) return;
  s.open = true;
  await opslag.sessieBewaren(s);
  await laad(s);
  log(`Verder met sessie: ${s.naam}`);
}

/** De huidige (nieuwe) sessie samenvoegen met een eerdere. */
export async function voegSamen(oudId) {
  const nieuw = S.sessie;
  if (!nieuw || nieuw.id === oudId) return heropen(oudId);
  clearTimeout(bewaarTimer);
  await opslag.verhuis(nieuw.id, oudId);
  const oud = await opslag.sessie(oudId);
  oud.gebeurtenissen = [...(oud.gebeurtenissen || []), ...(nieuw.gebeurtenissen || [])].sort((a, b) => a.t - b.t);
  oud.eind = Math.max(oud.eind, nieuw.eind);
  oud.open = true;
  await opslag.sessieBewaren(oud);
  await opslag.wis(nieuw.id);
  await laad(oud);
  melding(`Verder met "${oud.naam}"`);
}

export function gebeurtenis(type, tekst = '', t = Date.now()) {
  if (!S.sessie) return false;
  (S.sessie.gebeurtenissen ||= []).push({ t, type, tekst });
  bewaarSessie();
  opSessie.veranderd();
  return true;
}
export function wisGebeurtenis(t) {
  if (!S.sessie) return;
  S.sessie.gebeurtenissen = (S.sessie.gebeurtenissen || []).filter((g) => g.t !== t);
  bewaarSessie();
  opSessie.veranderd();
}

let bezig = false;
/** Meting bewaren (max één per 5 s). Geeft true als er iets is opgeslagen. */
export async function bewaarMeting(temps, nu) {
  if (bezig || nu - S.laatsteOpslag < OPSLAG_ELKE) return false;
  if (!temps.some((x) => x != null)) return false;
  if (!S.sessie && S.pauze) return false; // na "afronden": pas opnemen na "Nieuwe sessie"
  bezig = true;
  try {
    if (S.sessie && nu - (S.sessie.eind || S.sessie.start) > NIEUW_NA) {
      const oud = S.sessie;
      await rondAf();
      await nieuweSessie(nu);
      melding('Nieuwe sessie gestart (de vorige is lang geleden).', 10000,
        { label: 'Toch verder met vorige', fn: () => voegSamen(oud.id) });
    }
    if (!S.sessie) await nieuweSessie(nu);
    const v = temps.map((x) => (x == null ? null : Math.round(x * 10) / 10));
    await opslag.meting({ sessie: S.sessie.id, t: nu, v });
    S.buffer.push({ t: nu, v });
    S.laatsteOpslag = nu;
    S.sessie.eind = nu;
    S.sessie.voelers = temps.map((_, i) => voeler(i));
    v.forEach((x, i) => { if (x != null && S.startTemp[i] == null) S.startTemp[i] = x; });
    if (nu - (S.laatsteSessieOpslag || 0) > 30e3) { S.laatsteSessieOpslag = nu; await opslag.sessieBewaren(S.sessie); }
    return true;
  } catch (e) {
    log('Opslaan mislukt: ' + e.message);
    return false;
  } finally {
    bezig = false;
  }
}
