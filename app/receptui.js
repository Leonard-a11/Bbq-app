// Recepten-tab: receptenboek (met eigen recepten en favorieten), planner, rekenhulpen en gidsen.
import { RECEPTEN, CATEGORIEEN, hoeveel, leesIngredient, leesStap } from './recepten.js';
import { VLEES, OPSTELLINGEN } from './kookboek.js';
import { S, voeler, bewaarVoeler, isBbq } from './staat.js';
import { $, $$, esc, lees, bewaar, melding, vraag, fmtTijd, fmtDuur, isNative } from './hulp.js';
import { nieuweSessie, bewaarSessie } from './sessie.js';
import { startTimer } from './timers.js';
import { Share } from '@capacitor/share';
import { ic } from './iconen.js';

export const rc = { naarLive: () => {}, alles: () => {} };
let eigen = lees('eigenRecepten', []);
let favorieten = new Set(lees('favorieten', []));
let filter = { cat: null, zoek: '' };
let huidig = null; // { r, personen }

export const alleRecepten = () => [...eigen, ...RECEPTEN];
export const vindRecept = (id) => alleRecepten().find((r) => r.id === id);
const niveau = (n) => `<span class="niveau" title="Moeilijkheid ${n || 1} van 3">${[1, 2, 3].map((k) => `<i class="${k <= (n || 1) ? 'aan' : ''}"></i>`).join('')}</span>`;
const catNaam = (id) => CATEGORIEEN.find((c) => c.id === id)?.naam || '';

// ---------- Lijst ----------
export function toonRecepten() {
  kiesModus('recepten');
  $('#rc-cats').innerHTML = [{ id: null, naam: 'Alles' }, { id: 'fav', naam: 'Favorieten' }, ...CATEGORIEEN]
    .map((c) => `<button type="button" class="${filter.cat === c.id ? 'actief' : ''}" data-c="${c.id ?? ''}">${esc(c.naam)}</button>`).join('');
  $$('#rc-cats button').forEach((b) => { b.onclick = () => { filter.cat = b.dataset.c || null; toonRecepten(); }; });
  const z = filter.zoek.toLowerCase();
  const lijst = alleRecepten().filter((r) =>
    (!filter.cat || (filter.cat === 'fav' ? favorieten.has(r.id) : r.cat === filter.cat))
    && (!z || `${r.naam} ${r.intro || ''} ${(r.ingredienten || []).map((i) => i.n).join(' ')}`.toLowerCase().includes(z)));
  $('#rc-lijst').innerHTML = lijst.map((r, n) => `
    <li><button data-id="${r.id}">
      <span class="mk-nr">${String(n + 1).padStart(2, '0')}</span>
      <span class="mk-naam">${esc(r.naam)}${favorieten.has(r.id) ? ic('hart') : ''}</span>
      <span class="mk-tijd">${esc(r.tijd || '')}${r.niveau ? niveau(r.niveau) : ''}</span>
      <span class="mk-sub">${r.eigen ? 'Eigen recept · ' : ''}${esc(r.intro || catNaam(r.cat))}</span>
    </button></li>`).join('') || '<li class="leeg">Niets gevonden.</li>';
  $$('#rc-lijst button[data-id]').forEach((b) => { b.onclick = () => openRecept(b.dataset.id); });
}

function kiesModus(m) {
  $$('#rc-modus button').forEach((b) => b.classList.toggle('actief', b.dataset.m === m));
  $('#rc-recepten').hidden = m !== 'recepten';
  $('#rc-detail').hidden = true;
  $('#rc-planner').hidden = m !== 'planner';
  $('#rc-gidsen').hidden = m !== 'gidsen';
}

// ---------- Detail ----------
export function openRecept(id, personen) {
  const r = vindRecept(id);
  if (!r) return;
  huidig = { r, personen: personen || r.personen || 4 };
  $('#rc-recepten').hidden = true;
  $('#rc-detail').hidden = false;
  tekenRecept();
  window.scrollTo(0, 0);
}
function tekenRecept() {
  const { r, personen } = huidig;
  const f = personen / (r.personen || personen);
  const op = OPSTELLINGEN.find((o) => o.id === r.opstelling);
  const v = VLEES.find((x) => x.id === r.vlees);
  const kook = !!(r.opstelling || r.vlees);
  const houd = (t) => (t >= 60 && t % 60 === 0 ? `${t / 60} uur` : `${t} min`);
  const feiten = [
    ['Tijd', r.tijd], ['Kerntemperatuur', v ? `${v.doel}°C` : null],
    ['Opstelling', op ? op.naam.split(' – ')[0] : null], ['Rookhout', r.hout],
    ['Personen', r.personen ? `${r.personen} (basis)` : null], ['Moeilijkheid', r.niveau ? ['Makkelijk', 'Gemiddeld', 'Uitdagend'][r.niveau - 1] : null],
  ].filter(([, w]) => w);
  $('#rc-detail').innerHTML = `
    <button class="terug" id="rc-terug">${ic('links')}Recepten</button>
    <div class="recept-kop">
      <div class="label">${esc(catNaam(r.cat))}${r.eigen ? ' · eigen recept' : ''}</div>
      <h2>${esc(r.naam)}</h2>
      ${r.intro ? `<p>${esc(r.intro)}</p>` : ''}
    </div>
    ${feiten.length ? `<div class="feiten">${feiten.map(([k, w]) => `<div><span>${k}</span><b>${esc(w)}</b></div>`).join('')}</div>` : ''}
    <div class="rij-knoppen links">
      ${kook ? `<button class="knop" id="rc-start">${ic('vlam')}Start deze cook</button>` : ''}
      ${v ? `<button class="knop knop-licht" id="rc-plan">${ic('reken')}Plan</button>` : ''}
      <button class="knop knop-licht" id="rc-fav">${ic('hart')}${favorieten.has(r.id) ? 'Favoriet' : 'Bewaar'}</button>
      ${r.eigen ? `<button class="knop knop-licht" id="rc-bewerk">${ic('pen')}Bewerken</button>` : ''}
    </div>
    <div class="kaart">
      <div class="personen"><h3>Ingrediënten</h3>
        <div class="stapper"><button id="rc-min" aria-label="Minder">${ic('min')}</button><span>${personen} pers.</span><button id="rc-plus" aria-label="Meer">${ic('plus')}</button></div>
      </div>
      <ul class="ingredienten">${(r.ingredienten || []).map((i, n) => `
        <li data-n="${n}"><b>${hoeveel(i.h, f, i.e)} ${esc(i.e || '')}</b><span>${esc(i.n)}</span></li>`).join('')}</ul>
      <button class="knop knop-licht" id="rc-boodschappen">${ic('kar')}Boodschappenlijst delen</button>
    </div>
    <div class="kaart">
      <h3>Bereiding</h3>
      <ol class="stappen">${(r.stappen || []).map((st) => `
        <li><b>${esc(st.k)}</b><span>${esc(st.t)}</span>
          ${st.timer || st.bij ? `<div class="stap-tags">${st.timer ? `<span class="chip">${ic('timer')}${houd(st.timer)}${st.herhaal ? ', herhalend' : ''}</span>` : ''}${st.bij ? `<span class="chip">${ic('thermo')}melding bij ${st.bij}°</span>` : ''}</div>` : ''}
        </li>`).join('')}</ol>
    </div>
    ${(r.tips || []).length ? `<div class="kaart"><h3>Tips van de pitmaster</h3><ul class="tips">${r.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
    ${r.eigen ? '<div class="midden"><button class="link" id="rc-wis">Recept verwijderen</button></div>' : ''}`;
  $('#rc-terug').onclick = toonRecepten;
  $('#rc-min').onclick = () => { huidig.personen = Math.max(1, personen - 1); tekenRecept(); };
  $('#rc-plus').onclick = () => { huidig.personen = personen + 1; tekenRecept(); };
  $$('.ingredienten li').forEach((li) => { li.onclick = () => li.classList.toggle('af'); });
  $('#rc-fav').onclick = () => {
    if (favorieten.has(r.id)) favorieten.delete(r.id); else favorieten.add(r.id);
    bewaar('favorieten', [...favorieten]); tekenRecept();
  };
  $('#rc-boodschappen').onclick = () => deelBoodschappen(r, f, personen);
  if ($('#rc-start')) $('#rc-start').onclick = () => startCook(r, personen);
  if ($('#rc-plan')) $('#rc-plan').onclick = () => toonPlanner(r);
  if ($('#rc-bewerk')) $('#rc-bewerk').onclick = () => bewerkRecept(r);
  if ($('#rc-wis')) $('#rc-wis').onclick = async () => {
    if (!await vraag(`"${r.naam}" verwijderen?`, 'Verwijder', 'Annuleer', true)) return;
    eigen = eigen.filter((x) => x.id !== r.id); bewaar('eigenRecepten', eigen); toonRecepten();
  };
}

async function deelBoodschappen(r, f, personen) {
  const tekst = `Boodschappen: ${r.naam} (${personen} pers.)\n` + (r.ingredienten || [])
    .map((i) => `☐ ${[hoeveel(i.h, f, i.e), i.e].filter(Boolean).join(' ')} ${i.n}`.replace(/☐\s+/, '☐ ')).join('\n');
  try {
    if (isNative()) await Share.share({ title: `Boodschappen ${r.naam}`, text: tekst });
    else if (navigator.share) await navigator.share({ title: `Boodschappen ${r.naam}`, text: tekst });
    else { await navigator.clipboard.writeText(tekst); melding('Boodschappenlijst gekopieerd'); }
  } catch { /* geannuleerd */ }
}

/** Recept als cook starten: sessie, voelers en stappen klaarzetten. */
async function startCook(r, personen) {
  if (S.sessie && S.buffer.length) {
    if (!await vraag(`Recept "${r.naam}" toevoegen aan de lopende sessie "${S.sessie.naam}"?`, 'Toevoegen')) return;
  }
  S.pauze = false;
  if (!S.sessie) await nieuweSessie();
  const s = S.sessie;
  if (!S.buffer.length || s.autoNaam) { s.naam = r.naam; s.autoNaam = false; }
  if (r.opstelling) s.opstelling = r.opstelling;
  bewaar('laatsteOpzet', { opstelling: s.opstelling });
  const aantal = Math.max(S.temps.length, 4);
  let bbqI = Array.from({ length: aantal }, (_, i) => i).find((i) => isBbq(voeler(i)));
  const op = OPSTELLINGEN.find((o) => o.id === r.opstelling);
  if (op) {
    if (bbqI == null) bbqI = 0;
    bewaarVoeler(bbqI, { ...(S.voelers[bbqI] || {}), rol: 'bbq', naam: S.voelers[bbqI]?.naam || 'BBQ', preset: op.id, min: op.min, max: op.max });
  }
  let vleesI = null;
  const v = VLEES.find((x) => x.id === r.vlees);
  if (v) {
    // eerste vleesvoeler die aangesloten is, anders de eerste die geen BBQ is
    vleesI = Array.from({ length: aantal }, (_, i) => i).find((i) => i !== bbqI && S.temps[i] != null)
      ?? Array.from({ length: aantal }, (_, i) => i).find((i) => i !== bbqI);
    bewaarVoeler(vleesI, { naam: v.naam.split(' (')[0].split(' – ')[0].split(' / ')[0], rol: 'vlees', preset: v.id, doel: v.doel, rust: v.rust });
  }
  s.recept = { id: r.id, personen, klaar: [], gemeld: {}, voeler: vleesI };
  s.voelers = S.temps.map((_, k) => voeler(k));
  await bewaarSessie(true);
  rc.naarLive();
  const delen = [];
  if (bbqI != null && op) delen.push(`voeler ${bbqI + 1} = BBQ`);
  if (vleesI != null) delen.push(`voeler ${vleesI + 1} = ${voeler(vleesI).naam}`);
  melding(`${r.naam} gestart${delen.length ? ': ' + delen.join(', ') : ''}. Tik op een voeler om te wisselen.`, 7000);
}

// ---------- Eigen recept ----------
function stapTekst(s) {
  const tag = s.bij ? `[${s.bij}°] ` : s.timer ? `[${s.timer}m${s.herhaal ? '↻' : ''}] ` : '';
  return `${tag}${s.k}${s.t ? ' – ' + s.t : ''}`;
}

export function bewerkRecept(r = null) {
  const d = $('#dlg-recept');
  $('#dr-titel').textContent = r ? 'Recept bewerken' : 'Eigen recept';
  $('#dr-naam').value = r?.naam || '';
  $('#dr-cat').innerHTML = CATEGORIEEN.map((c) => `<option value="${c.id}">${c.icoon} ${esc(c.naam)}</option>`).join('');
  $('#dr-cat').value = r?.cat || 'varken';
  $('#dr-tijd').value = r?.tijd || '';
  $('#dr-personen').value = r?.personen || 4;
  $('#dr-vlees').innerHTML = '<option value="">—</option>' + VLEES.map((v) => `<option value="${v.id}">${esc(v.naam)} (${v.doel}°)</option>`).join('');
  $('#dr-vlees').value = r?.vlees || '';
  $('#dr-opstelling').innerHTML = '<option value="">—</option>' + OPSTELLINGEN.map((o) => `<option value="${o.id}">${esc(o.naam)}</option>`).join('');
  $('#dr-opstelling').value = r?.opstelling || '';
  $('#dr-intro').value = r?.intro || '';
  $('#dr-ingredienten').value = (r?.ingredienten || []).map((i) => [i.h ?? '', i.e, i.n].filter((x) => x !== '').join(' ')).join('\n');
  $('#dr-stappen').value = (r?.stappen || []).map(stapTekst).join('\n');
  $('#dr-tips').value = (r?.tips || []).join('\n');
  d.onclose = () => {
    if (d.returnValue !== 'ok') return;
    const naam = $('#dr-naam').value.trim();
    if (!naam) { melding('Geef het recept een naam'); return; }
    const regels = (id) => $(id).value.split('\n').map((x) => x.trim()).filter(Boolean);
    const nieuw = {
      id: r?.id || `eigen-${Date.now()}`, eigen: true, naam,
      cat: $('#dr-cat').value, tijd: $('#dr-tijd').value.trim(), niveau: r?.niveau || 1,
      personen: Math.max(1, parseInt($('#dr-personen').value, 10) || 4),
      vlees: $('#dr-vlees').value || null, opstelling: $('#dr-opstelling').value || null,
      intro: $('#dr-intro').value.trim(),
      ingredienten: regels('#dr-ingredienten').map(leesIngredient),
      stappen: regels('#dr-stappen').map(leesStap),
      tips: regels('#dr-tips'),
    };
    eigen = [nieuw, ...eigen.filter((x) => x.id !== nieuw.id)];
    bewaar('eigenRecepten', eigen);
    melding('Recept bewaard');
    openRecept(nieuw.id);
  };
  d.returnValue = '';
  d.showModal();
}

// ---------- Planner: terugrekenen vanaf de eettijd ----------
export function toonPlanner(recept = null) {
  kiesModus('planner');
  const p = lees('planner', { vlees: 'brisket', kg: 5, eten: '18:00' });
  if (recept?.vlees) { p.vlees = recept.vlees; p.kg = recept.gewicht || p.kg; }
  $('#rc-planner').innerHTML = `
    <div class="kaart">
      <h3>Wanneer moet ik beginnen?</h3>
      <label class="veld">Wat gaat erop?<select id="pl-vlees">${VLEES.map((v) => `<option value="${v.id}">${esc(v.naam)}</option>`).join('')}</select></label>
      <div class="twee">
        <label class="veld" id="pl-kg-veld">Gewicht (kg)<input id="pl-kg" type="number" inputmode="decimal" step="0.1" min="0.1"></label>
        <label class="veld">Eten om<input id="pl-eten" type="time"></label>
      </div>
      <div id="pl-uitkomst"></div>
    </div>`;
  $('#pl-vlees').value = p.vlees; $('#pl-kg').value = p.kg; $('#pl-eten').value = p.eten;
  const reken = () => {
    const v = VLEES.find((x) => x.id === $('#pl-vlees').value);
    const kg = parseFloat(String($('#pl-kg').value).replace(',', '.')) || 1;
    $('#pl-kg-veld').hidden = !v.uurPerKg;
    bewaar('planner', { vlees: v.id, kg, eten: $('#pl-eten').value });
    if (!$('#pl-eten').value) { $('#pl-uitkomst').innerHTML = ''; return; }
    const [lo, hi] = v.uren || v.uurPerKg.map((x) => x * kg);
    const gem = (lo + hi) / 2;
    const [u, m] = $('#pl-eten').value.split(':').map(Number);
    const eten = new Date(); eten.setHours(u, m, 0, 0);
    if (eten.getTime() < Date.now()) eten.setDate(eten.getDate() + 1);
    const rust = (v.rust || 0) * 60e3;
    const klaar = eten.getTime() - rust;
    const erop = klaar - gem * 3600e3;
    const lowSlow = gem >= 3;
    const aansteken = erop - (lowSlow ? 45 : 30) * 60e3;
    const nu = Date.now();
    const dag = (t) => { const d = new Date(t); const vandaag = new Date(); return d.toDateString() === vandaag.toDateString() ? '' : ` (${d.toLocaleDateString('nl-NL', { weekday: 'short' })})`; };
    const rijen = [
      [aansteken, 'Kolen aansteken', lowSlow ? 'snake of minion opbouwen, BBQ op temperatuur laten komen' : 'starter vol briketten'],
      [erop, 'Vlees op de BBQ', `${fmtDuur(lo * 3600e3)} – ${fmtDuur(hi * 3600e3)} garen`],
      [klaar, 'Klaar', `tussen ${fmtTijd(erop + lo * 3600e3)} en ${fmtTijd(erop + hi * 3600e3)}`],
      ...(rust ? [[klaar, `${v.rust} min rusten`, 'ingepakt in een koelbox blijft het uren warm']] : []),
      [eten.getTime(), 'Aan tafel', ''],
    ];
    const telaat = aansteken < nu;
    $('#pl-uitkomst').innerHTML = `
      ${telaat ? `<p class="waarschuwing klein">Dat haal je niet helemaal: begin nu, dan is het rond ${fmtTijd(nu + ((lowSlow ? 45 : 30) * 60e3) + gem * 3600e3 + rust)} klaar om te eten.</p>` : ''}
      <ol class="planlijn">${rijen.map(([t, k, uitleg]) => `<li><span class="pl-tijd">${fmtTijd(t)}${dag(t) ? `<small>${dag(t).replace(/[()]/g, '').trim()}</small>` : ''}</span><span><b>${k}</b>${uitleg ? `<small>${esc(uitleg)}</small>` : ''}</span></li>`).join('')}</ol>
      <p class="klein grijs">Richtlijn. Elk stuk vlees is anders: plan liever wat ruim, rusten kan altijd langer.</p>
      ${telaat ? '' : `<button class="knop" id="pl-herinner">${ic('bel')}Herinneringen zetten</button>`}`;
    if (!telaat) {
      $('#pl-herinner').onclick = () => {
        startTimer('Kolen aansteken', (aansteken - Date.now()) / 60e3);
        startTimer(`${v.naam.split(' (')[0]} op de BBQ`, (erop - Date.now()) / 60e3);
        melding('Herinneringen gezet, zie Live onder timers');
      };
    }
  };
  ['#pl-vlees', '#pl-kg', '#pl-eten'].forEach((s) => { $(s).oninput = reken; $(s).onchange = reken; });
  reken();
}

// ---------- Rekenhulpen en gidsen ----------
export function toonGidsen() {
  kiesModus('gidsen');
  $('#rc-gidsen').innerHTML = `
    <div class="kaart">
      <h3>Kolen-calculator · Weber 57 cm</h3>
      <div class="twee">
        <label class="veld">Opstelling<select id="kc-soort">
          <option value="snake">Snake (lang & laag)</option><option value="minion">Minion</option>
          <option value="indirect">Indirect 2-zone</option><option value="hotfast">Hot & fast</option>
          <option value="direct">Direct grillen</option></select></label>
        <label class="veld">Hoe lang (uur)<input id="kc-uren" type="number" inputmode="decimal" min="1" max="18" value="10"></label>
      </div>
      <div id="kc-uitkomst" class="uitkomst"></div>
    </div>
    <div class="kaart">
      <h3>Pekel-calculator</h3>
      <div class="segment breed" id="pk-soort"><button type="button" data-s="nat" class="actief">Natte pekel</button><button type="button" data-s="droog">Droog pekelen</button></div>
      <div class="twee">
        <label class="veld" id="pk-l1">Water (liter)<input id="pk-x" type="number" inputmode="decimal" step="0.5" value="2"></label>
        <label class="veld" id="pk-l2">Zout (%)<input id="pk-pct" type="number" inputmode="decimal" step="0.5" value="5"></label>
      </div>
      <div id="pk-uitkomst" class="uitkomst"></div>
    </div>
    ${gids('hout', 'Rookhout', `<table class="tabel"><tr><th>Hout</th><th>Smaak</th><th>Past bij</th></tr>
      <tr><td>Appel</td><td>mild, zoet</td><td>varken, kip, vis</td></tr>
      <tr><td>Kers</td><td>mild, fruitig, mooie kleur</td><td>alles</td></tr>
      <tr><td>Beuk</td><td>mild, neutraal</td><td>vis, kaas, kip</td></tr>
      <tr><td>Pecan</td><td>middel, nootachtig</td><td>varken, gevogelte</td></tr>
      <tr><td>Eik</td><td>middel, klassiek</td><td>rund, brisket</td></tr>
      <tr><td>Hickory</td><td>sterk, spekachtig</td><td>varken, ribs</td></tr>
      <tr><td>Mesquite</td><td>heel sterk</td><td>rund, kort grillen</td></tr></table>
      <p class="klein grijs">3–4 brokken aan het begin is genoeg; vlees neemt vooral in de eerste uren rook op. Zoek dunne, blauwige rook, geen dikke witte.</p>`)}
    ${gids('ventiel', 'Ventielen van de ketel', `<ul class="tips">
      <li><b>Deksel-ventiel</b> (boven) bijna altijd helemaal open, boven het vlees: trekt de rook langs het vlees.</li>
      <li><b>Onderste ventiel</b> regelt de temperatuur. Indicatie: ¼ open ≈ 110–125°, ½ open ≈ 150–180°, helemaal open = heet.</li>
      <li>Kleine stapjes en 10–15 minuten wachten: een kolen-BBQ reageert traag.</li>
      <li>Te heet is lastiger te herstellen dan te koud: sluit liever op tijd.</li></ul>`)}
    ${gids('pauze', 'De stall', `<p>Bij grote stukken (brisket, schouder) blijft de kern rond 65–75° soms uren hangen. Vocht verdampt aan het oppervlak en koelt het vlees, net als zweten. Het is normaal en geen fout.</p>
      <ul class="tips"><li><b>Wachten</b>: beste bark, kost tijd.</li><li><b>Inpakken</b> in slagerspapier (bark blijft redelijk) of folie (snelst, zachtere bark).</li><li>Niet de BBQ veel heter zetten: dan droogt de buitenkant uit.</li></ul>`)}
    ${gids('timer', 'Rusten & warm houden', `<p>Rusten laat het vocht terugtrekken en de kern nog 1–3° stijgen. Grote stukken kunnen ingepakt in een droge handdoek in een koelbox 2–4 uur warm blijven ("faux cambro"). Zo heb je ruimte als het vlees eerder klaar is.</p>`)}
    ${gids('thermo', 'Kerntemperaturen', `<table class="tabel"><tr><th>Vlees</th><th>Klaar</th><th>Rust</th></tr>${VLEES.map((v) => `<tr><td>${esc(v.naam)}</td><td>${v.doel}°</td><td>${v.rust ?? '—'} min</td></tr>`).join('')}</table>`)}
    ${gids('let', 'Veilig werken', `<ul class="tips"><li>Gevogelte en gehakt altijd minimaal 74° (gehakt 71°).</li><li>Gebruik aparte planken voor rauw en gaar.</li><li>Laat gegaard vlees niet langer dan 2 uur tussen 5 en 60° staan; koel restjes snel af.</li><li>Altijd buiten stoken: kolen geven koolmonoxide.</li></ul>`)}`;

  const kolen = () => {
    const soort = $('#kc-soort').value, uren = Math.max(1, parseFloat($('#kc-uren').value) || 1);
    $('#kc-uren').closest('label').hidden = !['snake', 'minion'].includes(soort);
    let t;
    if (soort === 'snake') {
      const n = Math.round(uren * 10);
      t = `<b>± ${n + 10} briketten</b><span>Slang van 2×1 (2 naast elkaar, 1 erop) van ± ${n} briketten langs de rand, plus 8–10 aangestoken briketten aan het begin. Houdt ± ${uren} uur 110–120° vast.</span>`;
    } else if (soort === 'minion') {
      const n = Math.round(uren * 9);
      t = `<b>± ${n} briketten</b><span>Volle kolenmand of een berg aan één kant; 10–12 aangestoken briketten bovenop.</span>`;
    } else if (soort === 'indirect') t = '<b>± 40–50 briketten</b><span>Halve starter, in de twee manden of aan één kant. ± 1–1,5 uur rond 160–180°; daarna 10–12 bijvullen per uur.</span>';
    else if (soort === 'hotfast') t = '<b>± 60–70 briketten</b><span>Driekwart starter aan één kant, ventielen half tot ver open.</span>';
    else t = '<b>± 80–90 briketten</b><span>Een volle starter, gelijkmatig verdeeld. Ideaal voor steaks, burgers en afschroeien.</span>';
    $('#kc-uitkomst').innerHTML = t + '<small class="grijs">Richtlijn voor gewone briketten (± 25 g); wind en kou kosten meer kolen.</small>';
  };
  let pekel = 'nat';
  const reken = () => {
    const x = parseFloat(String($('#pk-x').value).replace(',', '.')) || 0;
    const pct = parseFloat(String($('#pk-pct').value).replace(',', '.')) || 0;
    if (pekel === 'nat') {
      const zout = x * 1000 * pct / 100;
      $('#pk-uitkomst').innerHTML = `<b>${Math.round(zout)} g zout</b><span>op ${x} l water${pct ? `, plus eventueel ${Math.round(zout / 2)} g suiker` : ''}. Volledig oplossen, koud gebruiken. Kip 4–12 uur, varkenshaas/karbonade 4–8 uur, schouder 12–24 uur.</span>`;
    } else {
      $('#pk-uitkomst').innerHTML = `<b>${Math.round(x * 1000 * pct / 100)} g zout</b><span>voor ${x} kg vlees (${pct}%). Gelijkmatig erover, onafgedekt in de koelkast: minimaal 1 uur, liefst een nacht (kip: krokanter vel).</span>`;
    }
  };
  $$('#pk-soort button').forEach((b) => {
    b.onclick = () => {
      pekel = b.dataset.s;
      $$('#pk-soort button').forEach((x) => x.classList.toggle('actief', x === b));
      $('#pk-l1').firstChild.textContent = pekel === 'nat' ? 'Water (liter)' : 'Vlees (kg)';
      $('#pk-x').value = pekel === 'nat' ? 2 : 1.5; $('#pk-pct').value = pekel === 'nat' ? 5 : 1;
      reken();
    };
  });
  ['#kc-soort', '#kc-uren'].forEach((s) => { $(s).oninput = kolen; $(s).onchange = kolen; });
  ['#pk-x', '#pk-pct'].forEach((s) => { $(s).oninput = reken; });
  kolen(); reken();
}
function gids(icoon, titel, inhoud) {
  return `<details class="kaart gids"><summary>${ic(icoon)}${titel}</summary><div class="gids-inhoud">${inhoud}</div></details>`;
}

export function koppelRecepten() {
  $$('#rc-modus button').forEach((b) => {
    b.onclick = () => (b.dataset.m === 'planner' ? toonPlanner() : b.dataset.m === 'gidsen' ? toonGidsen() : toonRecepten());
  });
  $('#rc-zoek').oninput = (e) => { filter.zoek = e.target.value; toonRecepten(); };
  $('#rc-nieuw').onclick = () => bewerkRecept();
}

