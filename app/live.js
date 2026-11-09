// Live-scherm: voelers, adviezen, kookplan, alarmen, grafiek, tijdlijn.
import { S, KLEUREN, voeler, isBbq, hoogGrens, laagGrens, fmt, fmtTempo, graad } from './staat.js';
import { $, esc, fmtTijd, fmtDuur, fmtKlok } from './hulp.js';
import { ic } from './iconen.js';
import { tempo, verwachting, isStall, dekselOpen, gemiddelde, voorspelLijn } from './analyse.js';
import { VLEES, OPSTELLINGEN, gebeurtenisInfo } from './kookboek.js';
import { gebeurtenis, wisGebeurtenis, bewaarSessie } from './sessie.js';
import { vindRecept } from './receptui.js';
import { startTimer } from './timers.js';
import { geefAlarm, wisAlarm } from './alarmen.js';

export const live = {
  bereikMin: 120, verborgen: new Set(), grafiek: null, weg: {},
  openVoeler: () => {}, // door main.js ingevuld
  openRecept: () => {},
};
const OMTREK = 2 * Math.PI * 50;
const kleur = (i) => KLEUREN[i % KLEUREN.length];

// ---------- Analyse per voeler ----------
export function toestand(nu = Date.now()) {
  const pitI = S.temps.findIndex((c, i) => c != null && isBbq(voeler(i)));
  const pit = pitI >= 0 ? gemiddelde(S.buffer, pitI, nu, 15 * 60e3) ?? S.temps[pitI] : null;
  return S.temps.map((c, i) => {
    const v = voeler(i);
    if (c == null) return { i, v, c: null };
    const r = { i, v, c, tempo: tempo(S.buffer, i, nu, 10 * 60e3) };
    if (isBbq(v)) {
      r.deksel = S.dekselTot > nu && S.dekselVoeler === i;
      r.status = v.max != null && c > v.max ? 'heet' : v.min != null && c < v.min ? 'koud' : (v.min != null || v.max != null) ? 'ok' : null;
    } else {
      r.stall = isStall(S.buffer, i, nu, c);
      r.klaar = v.doel != null && c >= v.doel;
      r.eta = v.doel != null ? verwachting(S.buffer, i, nu, c, v.doel, pit) : null;
    }
    return r;
  });
}

/** Na elke nieuwe meting: deksel, stall en alarmen. */
export function verwerk(st, nu) {
  S.boven ||= {}; S.stallGemeld ||= {}; S.klaarOm ||= {};
  for (const r of st) {
    const { i, v, c } = r;
    if (c == null) continue;
    // deksel open: plotselinge daling bij de BBQ-voeler
    if (isBbq(v) && c > 60 && !(S.dekselTot > nu) && dekselOpen(S.buffer, i, nu, c)) {
      S.dekselTot = nu + 5 * 60e3; S.dekselVoeler = i;
      const recent = (S.sessie?.gebeurtenissen || []).some((g) => /deksel/i.test(g.type) && nu - g.t < 5 * 60e3);
      if (!recent) gebeurtenis('dekselAuto');
      r.deksel = true;
    }
    if (r.stall && !S.stallGemeld[i]) { S.stallGemeld[i] = true; gebeurtenis('stall', `${v.naam} ${fmt(c, 0)}°`); }
    if (r.klaar && !S.klaarOm[i]) S.klaarOm[i] = nu;
    if (!r.klaar) delete S.klaarOm[i];
  }
  controleerAlarmen(st, nu);
  receptMomenten();
}

// ---------- Recept tijdens de cook ----------
/** Stappen met een temperatuur ("bij 70°: inpakken") laten afgaan. */
function receptMomenten() {
  const rs = S.sessie?.recept;
  if (!rs || rs.voeler == null) return;
  const r = vindRecept(rs.id), c = S.temps[rs.voeler];
  if (!r || c == null) return;
  (r.stappen || []).forEach((s, n) => {
    if (!s.bij || rs.klaar.includes(n) || rs.gemeld?.[n] || c < s.bij) return;
    (rs.gemeld ||= {})[n] = true;
    bewaarSessie();
    geefAlarm('recept' + n, `${r.naam}: ${s.k}`, s.t);
  });
}

let vorigeRecept = '';
export function toonRecept() {
  const kaart = $('#recept-kaart'), rs = S.sessie?.recept;
  const r = rs && vindRecept(rs.id);
  if (!r) { kaart.hidden = true; vorigeRecept = ''; return; }
  kaart.hidden = false;
  const stappen = r.stappen || [];
  const c = rs.voeler != null ? S.temps[rs.voeler] : null;
  const open = stappen.map((s, n) => ({ s, n })).filter((x) => !rs.klaar.includes(x.n));
  const pct = stappen.length ? Math.round((rs.klaar.length / stappen.length) * 100) : 0;
  const html = `
    <div class="rk-kop"><span class="rk-titel">${esc(r.naam)}</span><span class="rk-teller">${rs.klaar.length}/${stappen.length}</span>
      <button class="rk-open" type="button">Recept</button></div>
    <div class="rk-balk"><i style="width:${pct}%"></i></div>
    ${open.length ? `<ol class="rk-stappen">${open.slice(0, 3).map(({ s, n }, k) => `
      <li class="${k === 0 ? 'volgende' : ''}${rs.gemeld?.[n] ? ' nu' : ''}">
        <button class="vink" data-n="${n}" title="Gedaan">${ic('vink')}</button>
        <div><b>${esc(s.k)}</b>${k === 0 ? `<small>${esc(s.t)}</small>` : ''}
          <div class="stap-tags">
            ${s.timer ? `<button class="chip" data-timer="${n}">${ic('timer')}start ${s.timer >= 60 && s.timer % 60 === 0 ? s.timer / 60 + ' u' : s.timer + ' min'}${s.herhaal ? ' ↻' : ''}</button>` : ''}
            ${s.bij ? `<span class="chip">${rs.gemeld?.[n] ? `${ic('bel')}nu` : `${ic('thermo')}bij ${fmt(s.bij, 0)}°${c != null ? ` · nu ${fmt(c, 0)}°` : ''}`}</span>` : ''}
          </div></div>
      </li>`).join('')}</ol>` : '<p class="klein grijs">Alle stappen gedaan. Eet smakelijk.</p>'}`;
  if (html === vorigeRecept) return;
  vorigeRecept = html;
  kaart.innerHTML = html;
  kaart.querySelector('.rk-open').onclick = () => live.openRecept(r.id, rs.personen);
  kaart.querySelectorAll('[data-n]').forEach((b) => {
    b.onclick = () => {
      const n = +b.dataset.n;
      if (!rs.klaar.includes(n)) rs.klaar.push(n);
      wisAlarm('recept' + n);
      bewaarSessie();
      toonRecept();
    };
  });
  kaart.querySelectorAll('[data-timer]').forEach((b) => {
    b.onclick = () => { const s = stappen[+b.dataset.timer]; startTimer(s.k, s.timer, !!s.herhaal); };
  });
}

// ---------- Keukenmodus: grote cijfers, af te lezen van een afstand ----------
export function toonKeuken(st) {
  const el = $('#keuken');
  if (el.hidden) return;
  $('#k-naam').textContent = S.sessie?.naam || '';
  $('#k-klok').textContent = S.sessie ? fmtKlok((S.verbonden ? Date.now() : S.sessie.eind) - S.sessie.start) : new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  const aan = st.filter((r) => r.c != null);
  $('#k-voelers').dataset.n = aan.length;
  $('#k-voelers').innerHTML = aan.map((r) => {
    let sub = '';
    if (isBbq(r.v)) sub = r.status === 'ok' ? 'binnen bereik' : r.status === 'koud' ? 'te koud' : r.status === 'heet' ? 'te heet' : 'BBQ';
    else if (r.klaar) sub = 'klaar';
    else if (r.stall) sub = 'stall';
    else if (r.eta?.klaarOm) sub = `klaar ± ${fmtTijd(r.eta.klaarOm)}`;
    else if (r.v.doel != null) sub = `doel ${fmt(r.v.doel, 0)}°`;
    const alarm = S.alarmStaat[r.i] ? ' k-alarm' : '';
    return `<div class="k-voeler${alarm}" style="--k:${kleur(r.i)}"><div class="k-naam">${esc(r.v.naam)}</div>
      <div class="k-temp">${fmt(r.c, 0)}<small>°</small></div><div class="k-sub">${esc(sub)}</div></div>`;
  }).join('') || '<div class="k-voeler"><div class="k-naam">Geen metingen</div></div>';
}

function controleerAlarmen(st, nu) {
  for (const { i, v, c } of st) {
    const oud = S.alarmStaat[i] || null;
    const hoog = hoogGrens(v), laag = laagGrens(v);
    if (c != null && laag != null && c >= laag + 1) S.boven[i] = true;
    let nieuw = null;
    if (c != null) {
      const isHoog = hoog != null && (oud === 'hoog' ? c > hoog - 1 : c >= hoog);
      const deksel = S.dekselTot > nu && S.dekselVoeler === i;
      const isLaag = laag != null && S.boven[i] && !deksel && (oud === 'laag' ? c < laag + 1 : c < laag);
      nieuw = isHoog ? 'hoog' : isLaag ? 'laag' : null;
    }
    S.alarmStaat[i] = nieuw;
    if (nieuw && nieuw !== oud && !S.alarmGezien[i + nieuw]) {
      let titel, tekst;
      if (nieuw === 'hoog' && !isBbq(v)) {
        titel = `${v.naam} is klaar: ${fmt(c)}${graad()}`;
        tekst = `Doel ${fmt(hoog, 0)}° bereikt.${v.rust ? ` Laat ${v.rust} min rusten.` : ''}`;
        gebeurtenis('klaar', v.naam);
      } else if (nieuw === 'hoog') {
        titel = `${v.naam} te heet: ${fmt(c, 0)}${graad()}`;
        tekst = `Boven de ${fmt(hoog, 0)}°. Draai het onderste ventiel iets dichter.`;
      } else {
        titel = `${v.naam} te koud: ${fmt(c, 0)}${graad()}`;
        tekst = `Onder de ${fmt(laag, 0)}°. Onderste ventiel iets open of kolen bijvullen.`;
      }
      geefAlarm(`v${i}${nieuw}`, titel, tekst);
    }
    if (nieuw !== 'hoog') { delete S.alarmGezien[i + 'hoog']; wisAlarm(`v${i}hoog`); }
    if (nieuw !== 'laag') { delete S.alarmGezien[i + 'laag']; wisAlarm(`v${i}laag`); }
  }
}
/** Na "Stop": huidige alarmen niet opnieuw laten afgaan tot de situatie verandert. */
export function alarmenGezien() {
  Object.entries(S.alarmStaat).forEach(([i, staat]) => { if (staat) S.alarmGezien[i + staat] = true; });
}

// ---------- Voelerkaarten ----------
// Wijzerplaat van 270° (zoals de thermometer op het deksel), met maatstreepjes
const BOOG = 0.75 * OMTREK;
const STREPEN = Array.from({ length: 31 }, (_, k) => {
  const hoek = ((135 + k * 9) * Math.PI) / 180, groot = k % 5 === 0;
  const r1 = groot ? 54 : 55.5, r2 = 59;
  const p = (r) => `${(60 + r * Math.cos(hoek)).toFixed(1)} ${(60 + r * Math.sin(hoek)).toFixed(1)}`;
  return `<path class="ring-streep${groot ? ' groot' : ''}" d="M${p(r1)} L${p(r2)}"/>`;
}).join('');
function ringSvg() {
  return `<svg viewBox="0 0 120 120">${STREPEN}<g transform="rotate(135 60 60)"><circle class="ring-bg" cx="60" cy="60" r="50" style="stroke-dasharray:${BOOG} ${OMTREK}"/><circle class="ring-band" cx="60" cy="60" r="50"/><circle class="ring-vg" cx="60" cy="60" r="50"/></g></svg>`;
}
export function toonVoelers(st) {
  const vak = $('#voelers');
  const aan = st.filter((r) => r.c != null);
  const heroI = aan.find((r) => !isBbq(r.v) && r.v.doel != null)?.i ?? -1;
  const sleutel = aan.map((r) => `${r.i}${r.i === heroI ? 'h' : ''}`).join(',');
  if (vak.dataset.sleutel !== sleutel) {
    vak.dataset.sleutel = sleutel;
    const volgorde = [...aan].sort((a, b) => (b.i === heroI) - (a.i === heroI));
    vak.innerHTML = volgorde.map((r) => `
      <button class="voeler${r.i === heroI ? ' hero' : ''}" data-i="${r.i}">
        <span class="v-instel">${ic('schuif')}</span>
        <div class="v-kop"><i class="stip"></i><span class="v-naam"></span><span class="v-badge"></span></div>
        <div class="v-ring">${ringSvg()}<div class="v-temp"><b></b><span class="v-doel"></span></div></div>
        <div class="v-info"><div class="v-eta"></div><div class="v-tempo"></div></div>
      </button>`).join('');
    vak.querySelectorAll('.voeler').forEach((b) => { b.onclick = () => live.openVoeler(+b.dataset.i); });
  }
  for (const r of aan) {
    const el = vak.querySelector(`[data-i="${r.i}"]`);
    if (el) vulKaart(el, r);
  }
  const los = st.filter((r) => r.c == null);
  const losVak = $('#los-voelers');
  const losHtml = los.map((r) => `<button data-i="${r.i}">${esc(r.v.naam)} · niet aangesloten</button>`).join('');
  if (losVak.innerHTML !== losHtml) {
    losVak.innerHTML = losHtml;
    losVak.querySelectorAll('button').forEach((b) => { b.onclick = () => live.openVoeler(+b.dataset.i); });
  }
}

function vulKaart(el, r) {
  const { i, v, c } = r, k = kleur(i);
  el.style.setProperty('--kleur-gloed', k + '40');
  el.querySelector('.stip').style.background = k;
  el.querySelector('.v-naam').textContent = v.naam;
  el.querySelector('.v-temp b').innerHTML = `${fmt(c)}<small>${graad()}</small>`;
  el.classList.toggle('alarm-aan', !!S.alarmStaat[i] && !S.alarmGezien[i + S.alarmStaat[i]]);
  const vg = el.querySelector('.ring-vg'), band = el.querySelector('.ring-band');
  let p, ringKleur = k, badge = '', badgeKlasse = '', eta = '', doel = '';
  if (isBbq(v)) {
    const schaal = Math.max((v.max ?? v.min ?? 150) * 1.3, c * 1.1, 60);
    p = c / schaal;
    if (v.min != null || v.max != null) {
      const a = (v.min ?? 0) / schaal, b = (v.max ?? schaal) / schaal;
      band.style.stroke = 'rgba(147, 181, 111, .35)';
      band.style.strokeDasharray = `${(b - a) * BOOG} ${OMTREK}`;
      band.style.strokeDashoffset = `${-a * BOOG}`;
      doel = v.max != null && v.min != null ? `${fmt(v.min, 0)}–${fmt(v.max, 0)}°` : v.min != null ? `min ${fmt(v.min, 0)}°` : `max ${fmt(v.max, 0)}°`;
    } else { band.style.strokeDasharray = `0 ${OMTREK}`; doel = 'stel bereik in'; }
    ringKleur = r.status === 'ok' ? 'var(--goed)' : r.status === 'koud' ? 'var(--koud)' : r.status === 'heet' ? 'var(--gevaar)' : k;
    if (r.deksel) { badge = 'DEKSEL'; badgeKlasse = 'deksel'; eta = 'deksel open?'; }
    else if (r.status === 'heet') { badge = 'TE HEET'; badgeKlasse = 'heet'; eta = `${fmt(c - v.max, 0)}° te heet`; }
    else if (r.status === 'koud') { badge = 'TE KOUD'; badgeKlasse = 'koud'; eta = `${fmt(v.min - c, 0)}° te koud`; }
    else if (r.status === 'ok') { badge = 'OK'; badgeKlasse = 'ok'; eta = 'binnen bereik'; }
    else eta = 'BBQ-temperatuur';
  } else {
    band.style.strokeDasharray = `0 ${OMTREK}`;
    if (v.doel != null) {
      const start = Math.min(S.startTemp[i] ?? c, v.doel - 1);
      p = (c - start) / (v.doel - start);
      doel = `doel ${fmt(v.doel, 0)}°`;
    } else { p = c / 100; doel = 'tik voor doel'; }
    if (r.klaar) { badge = 'KLAAR'; badgeKlasse = 'klaar'; eta = v.rust ? `Klaar! ${v.rust} min rusten` : 'Klaar!'; ringKleur = 'var(--goed)'; }
    else if (r.stall) { badge = 'STALL'; badgeKlasse = 'stall'; eta = 'stall – geduld'; }
    else if (r.eta?.klaarOm) eta = `klaar ± ${fmtTijd(r.eta.klaarOm)} · ${fmtDuur(r.eta.minuten * 60e3)}`;
    else if (r.eta) eta = r.eta.tekst;
    else eta = VLEES.find((x) => x.id === v.preset)?.naam || '';
  }
  p = Math.max(0.02, Math.min(1, p || 0));
  vg.style.stroke = ringKleur;
  vg.style.strokeDasharray = `${BOOG * p} ${OMTREK}`;
  el.querySelector('.v-doel').textContent = doel;
  const b = el.querySelector('.v-badge');
  b.textContent = badge; b.className = 'v-badge ' + badgeKlasse; b.hidden = !badge;
  el.querySelector('.v-eta').textContent = eta;
  el.querySelector('.v-tempo').textContent = r.tempo != null ? fmtTempo(r.tempo) : '';
}

// ---------- Adviezen ----------
export function adviezen(st, nu) {
  S.onderSinds ||= {};
  const lijst = [];
  for (const r of st) {
    if (r.c == null) continue;
    const { v, i, c } = r;
    if (isBbq(v)) {
      if (r.status !== 'koud') delete S.onderSinds[i];
      if (r.deksel) {
        lijst.push({ id: 'deksel' + i, soort: 'koud', icoon: 'oog', titel: 'Deksel open?',
          tekst: 'De temperatuur zakte ineens. Houd de deksel zo veel mogelijk dicht: elke keer kijken kost al gauw 10–15 minuten extra.' });
      } else if (r.status === 'heet') {
        lijst.push({ id: 'heet' + i, soort: 'let-op', icoon: 'heet', titel: `${v.naam} te heet: ${fmt(c, 0)}°`,
          tekst: `Boven de ${fmt(v.max, 0)}°. Draai het onderste ventiel een stukje dichter en geef het 10–15 min. Het deksel-ventiel open laten voor schone rook.`,
          knoppen: [{ label: 'Ventiel versteld', fn: () => gebeurtenis('ventiel', 'dichter') }] });
      } else if (r.status === 'koud' && S.boven?.[i]) {
        S.onderSinds[i] ||= nu;
        const duur = nu - S.onderSinds[i];
        const t15 = tempo(S.buffer, i, nu, 15 * 60e3);
        if (duur > 15 * 60e3 && (t15 == null || t15 < 1)) {
          lijst.push({ id: 'kolen' + i, soort: 'let-op', icoon: 'kolen', titel: 'Kolen raken op?',
            tekst: `Al ${fmtDuur(duur)} onder de ${fmt(v.min, 0)}° en hij komt niet terug. Vul bij met een paar aangestoken briketten, of zet het onderste ventiel verder open.`,
            knoppen: [{ label: 'Kolen bijgevuld', fn: () => gebeurtenis('kolen') }] });
        } else {
          lijst.push({ id: 'koud' + i, soort: 'koud', icoon: 'koud', titel: `${v.naam} te koud: ${fmt(c, 0)}°`,
            tekst: `Onder de ${fmt(v.min, 0)}°. Zet het onderste ventiel iets verder open en geef het 10–15 min voor je weer bijstelt.`,
            knoppen: [{ label: 'Ventiel versteld', fn: () => gebeurtenis('ventiel', 'verder open') }] });
        }
      }
    } else {
      const p = VLEES.find((x) => x.id === v.preset);
      if (r.klaar) {
        const knoppen = [];
        if (v.rust) knoppen.push({ label: `Rusttimer ${v.rust} min`, fn: () => { startTimer(`Rusten: ${v.naam}`, v.rust); gebeurtenis('eraf', v.naam); } });
        else knoppen.push({ label: 'Van de BBQ', fn: () => gebeurtenis('eraf', v.naam) });
        lijst.push({ id: 'klaar' + i, soort: 'goed', icoon: 'vinkRond', titel: `${v.naam} is klaar!`,
          tekst: `Haal het van de BBQ${v.rust ? ` en laat het ${v.rust} minuten rusten` : ''}. Tijdens het rusten stijgt de kern nog 1–3°.`, knoppen });
      } else if (r.stall) {
        lijst.push({ id: 'stall' + i, soort: '', icoon: 'pauze', titel: `Stall bij ${v.naam} (${fmt(c, 0)}°)`,
          tekst: 'Het vlees blijft hangen doordat vocht aan het oppervlak verdampt. Heel normaal, kan uren duren. Sneller: inpakken in slagerspapier of folie (Texas crutch).',
          knoppen: [{ label: 'Ingepakt', fn: () => gebeurtenis('ingepakt', v.naam) }] });
      } else if (r.eta?.minuten != null && r.eta.minuten < 15) {
        lijst.push({ id: 'bijna' + i, soort: 'goed', icoon: 'zandloper', titel: `${v.naam} bijna klaar`,
          tekst: `Nog ± ${Math.max(1, Math.round(r.eta.minuten))} min.${p?.tip ? ' ' + p.tip : ''}` });
      }
    }
  }
  return lijst.filter((a) => !(live.weg[a.id] > nu));
}

let vorigeAdviezen = '';
export function toonAdviezen(lijst) {
  const html = lijst.map((a) => `
    <div class="advies ${a.soort}" data-id="${a.id}">
      <div class="a-icoon">${ic(a.icoon)}</div>
      <div class="a-tekst"><b>${esc(a.titel)}</b><span>${esc(a.tekst)}</span>
        ${a.knoppen?.length ? `<div class="a-knoppen">${a.knoppen.map((k, n) => `<button data-n="${n}">${esc(k.label)}</button>`).join('')}</div>` : ''}
      </div>
      <button class="a-weg" title="Verbergen">${ic('kruis')}</button>
    </div>`).join('');
  if (html === vorigeAdviezen) return;
  vorigeAdviezen = html;
  const vak = $('#adviezen');
  vak.innerHTML = html;
  lijst.forEach((a) => {
    const el = vak.querySelector(`[data-id="${a.id}"]`);
    el.querySelector('.a-weg').onclick = () => { live.weg[a.id] = Date.now() + 20 * 60e3; el.remove(); vorigeAdviezen = ''; };
    el.querySelectorAll('[data-n]').forEach((b) => {
      b.onclick = () => { a.knoppen[+b.dataset.n].fn(); live.weg[a.id] = Date.now() + 20 * 60e3; el.remove(); vorigeAdviezen = ''; };
    });
  });
}

// ---------- Kookplan (eettijd) ----------
export function toonPlan(st, nu) {
  const el = $('#plan'), eet = S.sessie?.eettijd;
  if (!eet) { el.hidden = true; return; }
  el.hidden = false;
  const vlees = st.filter((r) => r.c != null && !isBbq(r.v) && r.v.doel != null);
  let laatste = null, onbekend = false, stall = false;
  for (const r of vlees) {
    const rust = (r.v.rust || 0) * 60e3;
    let klaar;
    if (r.klaar) klaar = (S.klaarOm?.[r.i] || nu) + rust;
    else if (r.eta?.klaarOm) klaar = r.eta.klaarOm + rust;
    else { onbekend = true; if (r.stall) stall = true; continue; }
    laatste = Math.max(laatste ?? 0, klaar);
  }
  let soort = '', icoon = 'bord', titel, tekst;
  if (!vlees.length) { titel = `Eten om ${fmtTijd(eet)}`; tekst = 'Geef een vleesvoeler een doeltemperatuur, dan reken ik uit of je op schema ligt.'; }
  else if (laatste == null || (onbekend && laatste < eet)) {
    titel = `Eten om ${fmtTijd(eet)}`;
    tekst = stall ? 'Het vlees zit in de stall; de klaar-tijd volgt zodra het weer stijgt.' : 'De klaar-tijd volgt zodra het tempo bekend is (± 15 min meten).';
  } else {
    const verschil = eet - laatste;
    if (Math.abs(verschil) <= 15 * 60e3) { soort = 'goed'; icoon = 'vinkRond'; titel = `Op schema voor ${fmtTijd(eet)}`; tekst = `Klaar inclusief rusten rond ${fmtTijd(laatste)}.`; }
    else if (verschil < 0) {
      soort = 'laat'; icoon = 'let'; titel = `± ${fmtDuur(-verschil)} te laat voor ${fmtTijd(eet)}`;
      tekst = `Verwacht klaar inclusief rusten rond ${fmtTijd(laatste)}. Zet de BBQ 10–15° hoger${stall ? ', of pak het vlees in' : ''}.`;
    } else {
      soort = 'vroeg'; icoon = 'timer'; titel = `± ${fmtDuur(verschil)} ruim op tijd`;
      tekst = `Klaar inclusief rusten rond ${fmtTijd(laatste)}. Geen probleem: ingepakt in een koelbox met handdoeken blijft het uren warm.`;
    }
  }
  el.className = 'plan ' + soort;
  el.innerHTML = `<div class="plan-icoon">${ic(icoon)}</div><div><b>${esc(titel)}</b><span class="klein grijs">${esc(tekst)}</span></div>`;
}

// ---------- Sessiekop ----------
export function toonSessie() {
  const s = S.sessie;
  $('#sessie').hidden = !s;
  $('#acties').hidden = !s && !S.verbonden;
  $('#sessie-eind').hidden = !s && !S.verbonden;
  $('#afronden').hidden = !s;
  $('#grafiek-kaart').hidden = !s;
  $('#tijdlijn-kaart').hidden = !s || !(s.gebeurtenissen || []).length;
  if (!s) return;
  $('#sessie-naam').textContent = s.naam;
  const chips = [];
  const op = OPSTELLINGEN.find((o) => o.id === s.opstelling);
  if (op) chips.push(['vlam', op.naam.split(' – ')[0]]);
  if (s.eettijd) chips.push(['bord', `eten ${fmtTijd(s.eettijd)}`]);
  chips.push(['grafiek', `${S.buffer.length} metingen`]);
  if (!S.verbonden) chips.push(['btUit', 'niet verbonden · sessie loopt door']);
  const html = chips.map(([i, c]) => `<span class="chip">${ic(i)}${esc(c)}</span>`).join('');
  if ($('#sessie-chips').innerHTML !== html) $('#sessie-chips').innerHTML = html;
  toonKlok();
  toonTijdlijn();
}
export function toonKlok() {
  if (S.sessie) $('#sessie-klok').textContent = fmtKlok((S.verbonden ? Date.now() : S.sessie.eind) - S.sessie.start);
}

function toonTijdlijn() {
  const g = [...(S.sessie?.gebeurtenissen || [])].reverse().slice(0, 12);
  const html = g.map((x) => {
    const info = gebeurtenisInfo(x.type);
    const handmatig = !['verbindingWeg', 'verbindingTerug', 'klaar', 'stall', 'dekselAuto'].includes(x.type);
    return `<li><span class="tl-tijd">${fmtTijd(x.t)}</span><span class="tl-icoon">${ic(info.icoon)}</span>
      <span class="tl-tekst">${esc(info.label)}${x.tekst ? ` <small>${esc(x.tekst)}</small>` : ''}</span>
      ${handmatig ? `<button data-t="${x.t}" title="Verwijderen">${ic('kruis')}</button>` : ''}</li>`;
  }).join('');
  const ol = $('#tijdlijn');
  if (ol.innerHTML === html) return;
  ol.innerHTML = html;
  ol.querySelectorAll('[data-t]').forEach((b) => { b.onclick = () => wisGebeurtenis(+b.dataset.t); });
}

// ---------- Grafiek ----------
export function tekenLive() {
  if (!live.grafiek || $('#grafiek-kaart').hidden || document.hidden) return;
  const aantal = Math.max(S.temps.length, ...S.buffer.slice(-1).map((m) => m.v.length), 0);
  const voelers = Array.from({ length: aantal }, (_, i) => voeler(i));
  legenda($('#legenda'), voelers, S.buffer, live.verborgen, tekenLive);
  const nu = Date.now();
  const toekomst = S.verbonden ? toestand(nu).filter((r) => r.eta?.klaarOm && !r.stall)
    .map((r) => ({ i: r.i, punten: voorspelLijn(r.c, r.v.doel, r.eta, nu) })).filter((f) => f.punten) : [];
  live.grafiek.zet(S.buffer, {
    voelers, bereikMs: live.bereikMin * 60e3, gebeurtenissen: S.sessie?.gebeurtenissen || [], verborgen: live.verborgen, toekomst,
  });
}
export function legenda(vak, voelers, metingen, verborgen, opnieuw) {
  const met = voelers.map((v, i) => ({ v, i })).filter(({ i }) => metingen.some((m) => m.v[i] != null));
  const html = met.map(({ v, i }) => `<button data-i="${i}" class="${verborgen.has(i) ? 'uit' : ''}"><i style="background:${kleur(i)}"></i>${esc(v.naam)}</button>`).join('');
  if (vak.innerHTML === html) return;
  vak.innerHTML = html;
  vak.querySelectorAll('button').forEach((b) => {
    b.onclick = () => { const i = +b.dataset.i; if (verborgen.has(i)) verborgen.delete(i); else verborgen.add(i); opnieuw(); };
  });
}

// ---------- Tekst voor de vaste melding (achtergrond) ----------
export function meldingTekst(st) {
  const aan = st.filter((r) => r.c != null);
  if (!aan.length) return { titel: S.verbonden ? 'BBQ Thermometer · geen voelers' : 'BBQ Thermometer · opnieuw verbinden…', tekst: 'Sessie loopt door' };
  const titel = aan.map((r) => `${r.v.naam} ${fmt(r.c, 0)}°`).join(' · ');
  const regels = aan.map((r) => {
    if (isBbq(r.v)) return `${r.v.naam}: ${r.status === 'ok' ? 'binnen bereik' : r.status === 'koud' ? 'te koud' : r.status === 'heet' ? 'te heet' : fmt(r.c, 0) + '°'}`;
    if (r.klaar) return `${r.v.naam}: klaar!`;
    if (r.stall) return `${r.v.naam}: stall`;
    if (r.eta?.klaarOm) return `${r.v.naam}: klaar ± ${fmtTijd(r.eta.klaarOm)}`;
    return r.v.doel != null ? `${r.v.naam}: doel ${fmt(r.v.doel, 0)}°` : null;
  }).filter(Boolean);
  return { titel: (S.verbonden ? '' : 'Geen verbinding · ') + titel, tekst: regels.join(' · ') || 'Meten…' };
}
