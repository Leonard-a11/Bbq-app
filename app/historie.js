// Historie: overzicht van alle sessies en een detailpagina per sessie.
import { opslag } from './opslag.js';
import { S, KLEUREN, fmt, graad, isBbq } from './staat.js';
import { $, esc, fmtDatum, fmtTijd, fmtDuur, vraag, melding } from './hulp.js';
import { Grafiek, sparkline } from './grafiek.js';
import { statistiek, stallDuur } from './analyse.js';
import { gebeurtenisInfo, OPSTELLINGEN } from './kookboek.js';
import { heropen, bewaarSessie, opSessie } from './sessie.js';
import { legenda } from './live.js';
import { bewaarBestand, verkleinFoto } from './bestand.js';
import { BADGES, behaald, samenvatting } from './prestaties.js';
import { maakDeelkaart, deelAfbeelding } from './deelkaart.js';
import { ic } from './iconen.js';

export const hist = { grafiek: null, det: null, verborgen: new Set(), naarLive: () => {} };
const fotoUrls = [];
const kleur = (i) => KLEUREN[i % KLEUREN.length];
const naamVan = (s, i) => s.voelers?.[i]?.naam || `Voeler ${i + 1}`;

function sterren(n) { return '★'.repeat(n) + '<span style="color:var(--lijn2)">' + '★'.repeat(5 - n) + '</span>'; }

export async function toonLijst() {
  $('#historie-detail').hidden = true;
  const lijst = $('#historie-lijst');
  lijst.hidden = false;
  fotoUrls.splice(0).forEach((u) => URL.revokeObjectURL(u));
  const sessies = (await opslag.sessies()).sort((a, b) => b.start - a.start);
  if (!sessies.length) {
    lijst.innerHTML = '<div class="leeg">' + ic('vlam') + '<br>Nog geen sessies.<br>Zodra je de thermometer verbindt, wordt alles automatisch bewaard.</div>';
    return;
  }
  // samenvatting (voor prestaties) aanvullen bij oudere sessies
  for (const s of sessies) {
    if (s.open || s.samenvatting) continue;
    try { s.samenvatting = samenvatting(s, await opslag.metingen(s.id)); await opslag.sessieBewaren(s); } catch { /* volgende keer */ }
  }
  const gehaald = behaald(sessies);
  const echt = sessies.filter((s) => !s.demo);
  const uren = echt.reduce((a, s) => a + (s.eind - s.start), 0) / 3600e3;
  const langste = echt.reduce((a, s) => Math.max(a, s.eind - s.start), 0);
  lijst.innerHTML = `
    <div class="overzicht">
      <div><b>${echt.length}</b><span>sessies</span></div>
      <div><b>${uren.toLocaleString('nl-NL', { maximumFractionDigits: uren < 10 ? 1 : 0 })}</b><span>uur gestookt</span></div>
      <div><b>${fmtDuur(langste).replace(' ', '')}</b><span>langste cook</span></div>
    </div>
    <div class="sectie-kop"><h3>Prestaties</h3><span class="klein grijs">${gehaald.size}/${BADGES.length}</span></div>
    <div class="prestaties">${BADGES.map((b) => `<button class="badge${gehaald.has(b.id) ? ' aan' : ''}" data-b="${b.id}"><span>${ic(b.icoon)}</span>${esc(b.naam)}</button>`).join('')}</div>
    <div class="sectie-kop"><h3>Sessies</h3></div>`;
  lijst.querySelectorAll('[data-b]').forEach((el) => {
    const b = BADGES.find((x) => x.id === el.dataset.b);
    el.onclick = () => melding(`${b.naam}: ${b.uitleg}${gehaald.has(b.id) ? ' (behaald)' : ''}`);
  });
  for (const s of sessies) {
    const b = document.createElement('button');
    b.className = 'sessie-item';
    const actief = S.sessie && S.sessie.id === s.id;
    b.innerHTML = `
      <div class="si-foto">${ic(s.demo ? 'info' : 'vlam')}</div>
      <div class="si-midden">
        <div class="si-titel">${esc(s.naam)}</div>
        <div class="si-sub">${fmtDatum(s.start)} · ${fmtDuur(s.eind - s.start)}${actief ? ' · <span class="bezig-label">bezig</span>' : ''}</div>
        ${s.beoordeling ? `<div class="si-sterren">${sterren(s.beoordeling)}</div>` : ''}
      </div>
      <canvas></canvas>`;
    b.onclick = () => openSessie(s.id);
    lijst.appendChild(b);
    // foto en grafiekje los laden
    opslag.foto(s.id).then((blob) => {
      if (!blob) return;
      const u = URL.createObjectURL(blob); fotoUrls.push(u);
      b.querySelector('.si-foto').outerHTML = `<img class="si-foto" src="${u}" alt="">`;
    }).catch(() => {});
    opslag.metingen(s.id).then((m) => sparkline(b.querySelector('canvas'), m, s.voelers)).catch(() => {});
  }
}

export async function openSessie(id) {
  const s = await opslag.sessie(id);
  if (!s) return toonLijst();
  const metingen = S.sessie?.id === id ? S.buffer : await opslag.metingen(id);
  hist.det = { s: S.sessie?.id === id ? S.sessie : s, metingen };
  const d = hist.det.s;
  $('#historie-lijst').hidden = true;
  $('#historie-detail').hidden = false;
  $('#det-naam').value = d.naam;
  $('#det-notitie').value = d.notitie || '';
  const op = OPSTELLINGEN.find((o) => o.id === d.opstelling);
  $('#det-info').textContent = `${fmtDatum(d.start)} · ${fmtTijd(d.start)}–${fmtTijd(d.eind)} · ${fmtDuur(d.eind - d.start)}${op ? ' · ' + op.naam.split(' – ')[0] : ''}`;
  toonSterren($('#det-sterren'), d.beoordeling || 0, (n) => { d.beoordeling = n; bewaar(); });
  const blob = await opslag.foto(id);
  const img = $('#det-foto');
  if (blob) { img.src = URL.createObjectURL(blob); img.hidden = false; } else img.hidden = true;

  const aantal = Math.max(0, ...metingen.map((m) => m.v.length));
  const voelers = Array.from({ length: aantal }, (_, i) => Object.assign({ naam: `Voeler ${i + 1}` }, d.voelers?.[i]));
  let html = `<div class="stat">Duur <b>${fmtDuur(d.eind - d.start)}</b> · <b>${metingen.length}</b> metingen</div>`;
  const gaten = metingen.filter((m, k) => k && m.t - metingen[k - 1].t > 90e3).length;
  if (gaten) html += `<div class="stat">${gaten}× verbinding weg geweest</div>`;
  voelers.forEach((v, i) => {
    const st = statistiek(metingen, i, isBbq(v) ? v : null);
    if (!st) return;
    let t = `<i style="background:${kleur(i)}"></i>${esc(v.naam)}: `;
    if (isBbq(v)) {
      t += `gem <b>${fmt(st.gem, 0)}°</b> · ${fmt(st.min, 0)}–${fmt(st.max, 0)}°`;
      if (st.binnen != null) t += ` · <b>${Math.round(st.binnen * 100)}%</b> binnen bereik`;
    } else {
      t += `eind <b>${fmt(st.eind)}°</b> · max ${fmt(st.max)}°`;
      const stall = stallDuur(metingen, i);
      if (stall >= 20 * 60e3) t += ` · stall ${fmtDuur(stall)}`;
    }
    html += `<div class="stat">${t}</div>`;
  });
  $('#det-stats').innerHTML = html;
  const teken = () => hist.grafiek.zet(metingen, { voelers, gebeurtenissen: d.gebeurtenissen || [], verborgen: hist.verborgen, historie: true });
  legenda($('#det-legenda'), voelers, metingen, hist.verborgen, () => { teken(); legenda($('#det-legenda'), voelers, metingen, hist.verborgen, teken); });
  teken();
  $('#det-tijdlijn').innerHTML = (d.gebeurtenissen || []).map((g) => {
    const info = gebeurtenisInfo(g.type);
    return `<li><span class="tl-tijd">${fmtTijd(g.t)}</span><span class="tl-icoon">${ic(info.icoon)}</span><span class="tl-tekst">${esc(info.label)}${g.tekst ? ` <small>${esc(g.tekst)}</small>` : ''}</span></li>`;
  }).join('');
  $('#det-verder').hidden = S.sessie?.id === id;
  window.scrollTo(0, 0);
}

export function toonSterren(vak, n, kies) {
  vak.innerHTML = [1, 2, 3, 4, 5].map((k) => `<button type="button" data-k="${k}" class="${k <= n ? 'aan' : ''}">${ic('ster')}</button>`).join('');
  vak.querySelectorAll('button').forEach((b) => {
    b.onclick = () => { const k = +b.dataset.k; kies(k); toonSterren(vak, k, kies); };
  });
}

async function bewaar() {
  if (!hist.det) return;
  const d = hist.det.s;
  if (S.sessie && S.sessie.id === d.id) { bewaarSessie(); } else await opslag.sessieBewaren(d);
}

export function koppelDetail() {
  $('#terug').onclick = toonLijst;
  $('#det-naam').onchange = () => { hist.det.s.naam = $('#det-naam').value.trim() || hist.det.s.naam; bewaar(); };
  $('#det-notitie').onchange = () => { hist.det.s.notitie = $('#det-notitie').value; bewaar(); };
  $('#det-foto-kies').onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f || !hist.det) return;
    const blob = await verkleinFoto(f);
    await opslag.fotoBewaren(hist.det.s.id, blob);
    hist.det.s.heeftFoto = true; bewaar();
    $('#det-foto').src = URL.createObjectURL(blob); $('#det-foto').hidden = false;
    melding('Foto bewaard');
  };
  $('#det-verder').onclick = async () => {
    if (!hist.det) return;
    if (S.sessie && !await vraag(`"${S.sessie.naam}" afronden en verder met "${hist.det.s.naam}"?`, 'Verder')) return;
    await heropen(hist.det.s.id);
    melding(`Verder met "${hist.det.s.naam}". Nieuwe metingen komen erbij.`);
    hist.naarLive();
  };
  $('#det-deel').onclick = async () => {
    if (!hist.det) return;
    melding('Afbeelding maken…', 2000);
    try {
      const { s, metingen } = hist.det;
      const blob = await maakDeelkaart(s, metingen, await opslag.foto(s.id));
      await deelAfbeelding(blob, s.naam);
    } catch (e) { if (!/cancel|abort/i.test(e.message)) melding('Delen mislukt: ' + e.message, 6000); }
  };
  $('#det-csv').onclick = () => {
    if (!hist.det) return;
    const { s, metingen } = hist.det;
    const aantal = Math.max(0, ...metingen.map((m) => m.v.length));
    const regels = [['Datum', 'Tijd', ...Array.from({ length: aantal }, (_, i) => `${naamVan(s, i)} (${graad()})`), 'Gebeurtenis'].join(';')];
    const gb = [...(s.gebeurtenissen || [])];
    metingen.forEach((m) => {
      const d = new Date(m.t);
      const hier = gb.filter((g) => g.t <= m.t).map((g) => `${gebeurtenisInfo(g.type).label}${g.tekst ? ' (' + g.tekst + ')' : ''}`);
      gb.splice(0, hier.length);
      regels.push([d.toLocaleDateString('nl-NL'), d.toLocaleTimeString('nl-NL'),
        ...Array.from({ length: aantal }, (_, i) => (m.v[i] == null ? '' : fmt(m.v[i]).replace(/\./g, ''))), hier.join(', ')].join(';'));
    });
    bewaarBestand(`${s.naam.replace(/:/g, '.')}.csv`, '﻿' + regels.join('\r\n'), 'text/csv').catch((e) => melding('Opslaan mislukt: ' + e.message));
  };
  $('#det-wis').onclick = async () => {
    if (!hist.det || !await vraag(`"${hist.det.s.naam}" verwijderen? Dit kan niet ongedaan worden.`, 'Verwijder', 'Annuleer', true)) return;
    const id = hist.det.s.id;
    if (S.sessie && S.sessie.id === id) {
      S.sessie = null; S.buffer = []; S.laatsteOpslag = 0;
      localStorage.setItem('actieveSessie', 'null');
      opSessie.veranderd();
    }
    await opslag.wis(id);
    hist.det = null;
    toonLijst();
  };
}
