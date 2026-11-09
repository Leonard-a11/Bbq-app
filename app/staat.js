// Gedeelde toestand van de app en instellingen per voeler.
import { lees, bewaar } from './hulp.js';

export const KLEUREN = ['#e8642e', '#6fa8c7', '#93b56f', '#b994c9', '#dcae4a', '#d8798b'];

export const inst = Object.assign({ eenheid: lees('eenheid', 'C'), geluid: true, trillen: true, spraak: true }, lees('instellingen', {}));
export function bewaarInst() { bewaar('instellingen', inst); }

export const S = {
  temps: [],            // huidige temperaturen in °C (null = geen voeler)
  batterij: null,
  apparaat: null,
  verbonden: false,
  handmatigLos: false,
  demo: null,
  sessie: null,         // de open sessie
  buffer: [],           // metingen van de open sessie { t, v }
  laatsteOpslag: 0,
  laatsteData: 0,
  log: [],
  koppelNr: 0,
  voelers: lees('voelers', []), // per voeler { naam, rol: 'vlees'|'bbq', preset, doel, min, max, rust }
  alarmStaat: {},
  alarmGezien: {},
  startTemp: {},        // eerste temperatuur per voeler (voor de voortgangsring)
  dekselTot: 0,         // tot wanneer "deksel open" geldt (geen te-koud-alarm)
};

export function voeler(i) {
  return Object.assign({ naam: `Voeler ${i + 1}`, rol: 'vlees', preset: null, doel: null, min: null, max: null, rust: null },
    S.voelers[i] || {});
}
export function bewaarVoeler(i, v) {
  for (let k = 0; k <= i; k++) S.voelers[k] ||= {};
  S.voelers[i] = v;
  bewaar('voelers', S.voelers);
}
export const isBbq = (v) => v.rol === 'bbq';
/** Bovengrens voor het alarm: doel (vlees) of max (BBQ). */
export const hoogGrens = (v) => (isBbq(v) ? v.max : v.doel);
export const laagGrens = (v) => (isBbq(v) ? v.min : null);

// ---------- Eenheden ----------
export const naarEenheid = (c) => (c == null ? null : inst.eenheid === 'F' ? c * 9 / 5 + 32 : c);
export const vanEenheid = (x) => (inst.eenheid === 'F' ? (x - 32) * 5 / 9 : x);
export const graad = () => (inst.eenheid === 'F' ? '°F' : '°C');
export function fmt(c, dec = 1) {
  const x = naarEenheid(c);
  return x == null ? '—' : x.toLocaleString('nl-NL', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
/** Tempo (°C per uur) in de gekozen eenheid. */
export function fmtTempo(perUur) {
  if (perUur == null) return '';
  const x = inst.eenheid === 'F' ? perUur * 9 / 5 : perUur;
  return `${x >= 0 ? '+' : '−'}${Math.abs(x).toLocaleString('nl-NL', { maximumFractionDigits: 1 })}°/u`;
}

// ---------- Log ----------
export function log(tekst) {
  S.log.push(`${new Date().toLocaleTimeString('nl-NL')} ${tekst}`);
  if (S.log.length > 400) S.log.shift();
  const el = document.getElementById('log-tekst');
  if (el) el.textContent = S.log.join('\n');
}
