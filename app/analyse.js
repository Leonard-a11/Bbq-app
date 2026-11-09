// Rekenwerk op de metingen: tempo, verwachte klaar-tijd, stall en deksel-open.
// Alles in °C en milliseconden. metingen = [{ t, v: [..] }] oplopend in tijd.

/** Punten [t, waarde] van voeler i binnen het venster (de laatste ms). */
export function punten(metingen, i, nu, venster) {
  const vanaf = nu - venster;
  const p = [];
  for (let k = metingen.length - 1; k >= 0; k--) {
    const m = metingen[k];
    if (m.t < vanaf) break;
    if (m.v[i] != null) p.push([m.t, m.v[i]]);
  }
  return p.reverse();
}

/** Lineaire regressie: helling per ms. */
export function helling(p) {
  const n = p.length;
  if (n < 2) return null;
  let mx = 0, my = 0;
  for (const [x, y] of p) { mx += x; my += y; }
  mx /= n; my /= n;
  let teller = 0, noemer = 0;
  for (const [x, y] of p) { teller += (x - mx) * (y - my); noemer += (x - mx) ** 2; }
  return noemer ? teller / noemer : null;
}

/** Tempo in °C per uur over het venster; null als er te weinig gegevens zijn. */
export function tempo(metingen, i, nu, venster = 10 * 60e3) {
  const p = punten(metingen, i, nu, venster);
  if (p.length < 6 || p[p.length - 1][0] - p[0][0] < venster * 0.4) return null;
  const h = helling(p);
  return h == null ? null : h * 3600e3;
}

/** Stall: vlees blijft hangen tussen 60 en 82° (vocht verdampt van het oppervlak). */
export function isStall(metingen, i, nu, huidig) {
  if (huidig == null || huidig < 60 || huidig > 82) return false;
  const t = tempo(metingen, i, nu, 25 * 60e3);
  return t != null && t < 2.5 && t > -4;
}

/**
 * Verwachte klaar-tijd voor vlees. Gebruikt het tempo van de laatste 15 min
 * (met 40 min als controle). Geeft { minuten, klaarOm, zeker } of { tekst }.
 */
export function verwachting(metingen, i, nu, huidig, doel, pit = null) {
  if (huidig == null || doel == null) return null;
  if (huidig >= doel) return { klaar: true, tekst: 'klaar' };
  const kort = tempo(metingen, i, nu, 15 * 60e3);
  if (kort == null) return { tekst: 'tempo meten…' };
  if (isStall(metingen, i, nu, huidig)) return { stall: true, tekst: 'stall – even geduld' };
  if (kort < 0.6) return { tekst: kort < 0 ? 'daalt' : 'stijgt nauwelijks' };
  const lang = tempo(metingen, i, nu, 40 * 60e3);
  let minuten;
  if (pit != null && pit <= doel + 2) return { tekst: 'BBQ te koud voor dit doel' };
  if (pit != null && pit > huidig + 3) {
    // Opwarmen remt af naarmate het vlees de BBQ-temperatuur nadert (wet van Newton):
    // tempo = k × (BBQ − vlees)  →  tijd = −ln((BBQ − doel) / (BBQ − vlees)) / k
    const k = kort / (pit - huidig);
    minuten = (-Math.log((pit - doel) / (pit - huidig)) / k) * 60;
  } else {
    // zonder BBQ-voeler: voorzichtig lineair
    const snelheid = lang != null && lang > 0.6 ? Math.min(kort, (kort + lang) / 2) : kort;
    minuten = ((doel - huidig) / snelheid) * 60;
  }
  if (!Number.isFinite(minuten) || minuten < 0) return { tekst: 'tempo meten…' };
  if (minuten > 36 * 60) return { tekst: 'nog lang' };
  return { minuten, klaarOm: nu + minuten * 60e3, zeker: lang != null };
}

/** Gemiddelde over het venster (bijv. BBQ-temperatuur van het afgelopen kwartier). */
export function gemiddelde(metingen, i, nu, venster) {
  const p = punten(metingen, i, nu, venster);
  return p.length ? p.reduce((s, x) => s + x[1], 0) / p.length : null;
}

/** Plotselinge daling (≥ 10° binnen ± 90 s) bij de BBQ-voeler = deksel open. */
export function dekselOpen(metingen, i, nu, huidig) {
  if (huidig == null) return false;
  const p = punten(metingen, i, nu, 100e3);
  if (!p.length) return false;
  const hoogste = Math.max(...p.map((x) => x[1]));
  return hoogste - huidig >= 10;
}

/** Statistiek per voeler voor de historie. */
export function statistiek(metingen, i, band) {
  const w = metingen.map((m) => m.v[i]).filter((x) => x != null);
  if (!w.length) return null;
  const r = {
    max: Math.max(...w), min: Math.min(...w),
    gem: w.reduce((a, b) => a + b, 0) / w.length,
    eind: w[w.length - 1], aantal: w.length,
  };
  if (band && (band.min != null || band.max != null)) {
    const binnen = w.filter((x) => (band.min == null || x >= band.min) && (band.max == null || x <= band.max)).length;
    r.binnen = binnen / w.length;
  }
  return r;
}

/** Duur van de stall in ms (bemonsterd per 5 minuten). */
export function stallDuur(metingen, i) {
  if (metingen.length < 2) return 0;
  const stap = 5 * 60e3;
  let duur = 0, k = 0;
  for (let t = metingen[0].t + 25 * 60e3; t <= metingen[metingen.length - 1].t; t += stap) {
    while (k + 1 < metingen.length && metingen[k + 1].t <= t) k++;
    if (isStall(metingen.slice(0, k + 1), i, t, metingen[k].v[i])) duur += stap;
  }
  return duur;
}
