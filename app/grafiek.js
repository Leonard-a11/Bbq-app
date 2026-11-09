// Grafiek op een canvas: lijnen per voeler, BBQ-band, doellijnen, gebeurtenissen,
// verbindingsgaten en een aanwijzer met waarden.
import { KLEUREN, naarEenheid, graad, fmt, isBbq } from './staat.js';
import { esc, fmtTijd } from './hulp.js';
import { gebeurtenisInfo } from './kookboek.js';
import { ic, tekenIcoon } from './iconen.js';

const GAT = 90e3; // langer dan dit niets gemeten = gat in de lijn

export class Grafiek {
  constructor(canvas, tip) {
    this.cv = canvas; this.tip = tip; this.metingen = []; this.o = {};
    const wijs = (e) => { this.cursor = e.offsetX; this.teken(); };
    canvas.addEventListener('pointerdown', wijs);
    canvas.addEventListener('pointermove', wijs);
    canvas.addEventListener('pointerleave', () => { this.cursor = null; this.teken(); });
    new ResizeObserver(() => this.teken()).observe(canvas);
  }
  zet(metingen, opties) { this.metingen = metingen; this.o = opties || {}; this.teken(); }

  teken() {
    const cv = this.cv, w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    const dpr = this.o.schaal || window.devicePixelRatio || 1;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    const css = getComputedStyle(document.documentElement);
    const grijs = css.getPropertyValue('--grijs').trim(), lijn = css.getPropertyValue('--lijn').trim();
    c.font = "600 12px 'Barlow Condensed', sans-serif";
    this.tip.hidden = true;

    const { voelers = [], bereikMs = 0, gebeurtenissen = [], verborgen = new Set(), toekomst = [] } = this.o;
    const alle = this.metingen;
    if (alle.length < 2) {
      c.fillStyle = grijs; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('De grafiek verschijnt na een paar metingen…', w / 2, h / 2);
      return;
    }
    const tot = alle[alle.length - 1].t;
    const van = bereikMs ? Math.max(alle[0].t, tot - bereikMs) : alle[0].t;
    let pts = alle.filter((m) => m.t >= van);
    if (pts.length < 2) pts = alle.slice(-2);
    const t0 = pts[0].t;
    let t1 = Math.max(pts[pts.length - 1].t, t0 + 60e3);
    const nuT = t1;
    // voorspelling: grafiek iets verder naar rechts laten lopen
    const tk = toekomst.filter((f) => !verborgen.has(f.i) && f.punten?.length > 1);
    if (tk.length) {
      const verst = Math.max(...tk.map((f) => f.punten[f.punten.length - 1][0]));
      t1 = Math.min(Math.max(t1, verst + 5 * 60e3), t1 + Math.max(30 * 60e3, (t1 - t0) * 0.6));
    }
    const aantal = Math.max(...pts.map((m) => m.v.length));
    const zichtbaar = [];
    for (let i = 0; i < aantal; i++) if (!verborgen.has(i) && pts.some((m) => m.v[i] != null)) zichtbaar.push(i);

    // y-bereik in weergave-eenheid
    let lo = Infinity, hi = -Infinity;
    const neem = (x) => { if (x != null) { const y = naarEenheid(x); lo = Math.min(lo, y); hi = Math.max(hi, y); } };
    for (const m of pts) for (const i of zichtbaar) neem(m.v[i]);
    for (const i of zichtbaar) { const v = voelers[i] || {}; if (isBbq(v)) { neem(v.min); neem(v.max); } else neem(v.doel); }
    if (!Number.isFinite(lo)) { lo = 0; hi = 100; }
    const stap = [5, 10, 20, 25, 50, 100].find((s) => (hi - lo + 4) / s <= 6) || 100;
    lo = Math.floor((lo - 2) / stap) * stap; hi = Math.ceil((hi + 2) / stap) * stap;

    const L = 34, R = 10, T = 22, B = 20, pw = w - L - R, ph = h - T - B;
    const X = (t) => L + ((t - t0) / (t1 - t0)) * pw;
    const Y = (y) => T + (1 - (y - lo) / (hi - lo)) * ph;
    this.geo = { X, t0, t1, L, pw };

    // raster
    c.strokeStyle = lijn; c.fillStyle = grijs; c.lineWidth = 1; c.textAlign = 'right'; c.textBaseline = 'middle';
    for (let y = lo; y <= hi; y += stap) {
      c.beginPath(); c.moveTo(L, Math.round(Y(y)) + 0.5); c.lineTo(w - R, Math.round(Y(y)) + 0.5); c.stroke();
      c.fillText(String(y), L - 6, Y(y));
    }
    const minuten = [1, 2, 5, 10, 15, 30, 60, 120, 180, 240, 360, 720].find((m) => (t1 - t0) / (m * 60e3) <= Math.max(2, pw / 70)) || 1440;
    const xs = minuten * 60e3, offset = new Date(t0).getTimezoneOffset() * 60e3;
    c.textAlign = 'center'; c.textBaseline = 'top';
    for (let t = Math.ceil((t0 - offset) / xs) * xs + offset; t <= t1; t += xs) c.fillText(fmtTijd(t), X(t), h - B + 6);

    // gaten in de verbinding
    c.fillStyle = 'rgba(150,150,160,0.10)';
    for (let k = 1; k < pts.length; k++) {
      if (pts[k].t - pts[k - 1].t > GAT) {
        const a = X(pts[k - 1].t), b = X(pts[k].t);
        c.fillRect(a, T, b - a, ph);
        if (b - a > 70) {
          c.save(); c.fillStyle = grijs; c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText('geen verbinding', (a + b) / 2, T + ph / 2); c.restore();
        }
      }
    }

    // BBQ-band en doellijnen
    for (const i of zichtbaar) {
      const v = voelers[i] || {}, kleur = KLEUREN[i % KLEUREN.length];
      if (isBbq(v) && (v.min != null || v.max != null)) {
        const top = v.max != null ? Y(naarEenheid(v.max)) : T, onder = v.min != null ? Y(naarEenheid(v.min)) : T + ph;
        c.fillStyle = kleur + '14'; c.fillRect(L, top, pw, onder - top);
        c.strokeStyle = kleur + '66'; c.setLineDash([3, 4]);
        if (v.max != null) { c.beginPath(); c.moveTo(L, top); c.lineTo(w - R, top); c.stroke(); }
        if (v.min != null) { c.beginPath(); c.moveTo(L, onder); c.lineTo(w - R, onder); c.stroke(); }
        c.setLineDash([]);
      } else if (v.doel != null) {
        const y = Y(naarEenheid(v.doel));
        c.strokeStyle = kleur + 'aa'; c.setLineDash([5, 4]);
        c.beginPath(); c.moveTo(L, y); c.lineTo(w - R, y); c.stroke(); c.setLineDash([]);
        c.fillStyle = kleur; c.textAlign = 'right'; c.textBaseline = 'bottom';
        c.fillText(`${fmt(v.doel, 0)}°`, w - R - 2, y - 2);
      }
    }

    // lijnen (bij veel punten één per ~pixel) met zachte vulling eronder
    const elke = Math.max(1, Math.floor(pts.length / pw));
    const gat = Math.max(GAT, elke * 15e3);
    c.lineJoin = 'round'; c.lineCap = 'round';
    for (const i of zichtbaar) {
      const kleur = KLEUREN[i % KLEUREN.length];
      const stukken = [];
      let huidig = null, vorigeT = null;
      for (let k = 0; k < pts.length; k += elke) {
        const m = pts[k], x = m.v[i];
        if (x == null || (vorigeT != null && m.t - vorigeT > gat)) { huidig = null; vorigeT = x == null ? null : vorigeT; }
        if (x == null) continue;
        if (!huidig) { huidig = []; stukken.push(huidig); }
        huidig.push([X(m.t), Y(naarEenheid(x))]);
        vorigeT = m.t;
      }
      const g = c.createLinearGradient(0, T, 0, T + ph);
      g.addColorStop(0, kleur + '1c'); g.addColorStop(1, kleur + '00');
      for (const s of stukken) {
        if (s.length < 2) continue;
        c.beginPath(); c.moveTo(s[0][0], T + ph);
        s.forEach(([x, y]) => c.lineTo(x, y));
        c.lineTo(s[s.length - 1][0], T + ph); c.closePath();
        c.fillStyle = g; c.fill();
        c.beginPath(); s.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y)));
        c.strokeStyle = kleur; c.lineWidth = 2.2; c.stroke();
      }
      // laatste punt
      const laatste = stukken.length && stukken[stukken.length - 1];
      if (laatste && laatste.length && !this.o.historie) {
        const [x, y] = laatste[laatste.length - 1];
        c.fillStyle = kleur; c.beginPath(); c.arc(x, y, 3.5, 0, 7); c.fill();
      }
    }

    // voorspelling (stippellijn naar het doel)
    if (tk.length) {
      c.save();
      c.beginPath(); c.rect(L, 0, pw, h); c.clip();
      c.strokeStyle = grijs + '55'; c.setLineDash([1, 4]);
      c.beginPath(); c.moveTo(X(nuT), T); c.lineTo(X(nuT), T + ph); c.stroke();
      for (const f of tk) {
        const k = KLEUREN[f.i % KLEUREN.length];
        c.setLineDash([5, 5]); c.strokeStyle = k + 'b0'; c.lineWidth = 2;
        c.beginPath();
        f.punten.forEach(([t, y], n) => (n ? c.lineTo(X(t), Y(naarEenheid(y))) : c.moveTo(X(t), Y(naarEenheid(y)))));
        c.stroke(); c.setLineDash([]);
        const [te, ye] = f.punten[f.punten.length - 1];
        if (te <= t1) {
          const x = X(te), y = Y(naarEenheid(ye));
          c.fillStyle = k; c.beginPath(); c.arc(x, y, 4, 0, 7); c.fill();
          c.font = "700 12px 'Barlow Condensed', sans-serif"; c.textBaseline = 'bottom';
          c.textAlign = x > w - 60 ? 'right' : 'center';
          c.fillText(`KLAAR ${fmtTijd(te)}`, x, y - 6);
        }
      }
      c.restore();
      c.font = "600 12px 'Barlow Condensed', sans-serif";
    }

    // gebeurtenissen
    const zicht = gebeurtenissen.filter((g) => g.t >= t0 && g.t <= t1);
    c.textAlign = 'center'; c.textBaseline = 'top'; c.font = '13px system-ui, sans-serif';
    let vorigeX = -99;
    for (const g of zicht) {
      const x = X(g.t);
      c.strokeStyle = grijs + '88'; c.setLineDash([2, 3]);
      c.beginPath(); c.moveTo(x, T); c.lineTo(x, T + ph); c.stroke(); c.setLineDash([]);
      if (x - vorigeX > 16) { tekenIcoon(c, gebeurtenisInfo(g.type).icoon, x, 10, 15, grijs); vorigeX = x; }
    }

    // aanwijzer
    if (this.cursor != null && this.cursor >= L) {
      const t = t0 + ((this.cursor - L) / pw) * (t1 - t0);
      let best = pts[0];
      for (const m of pts) if (Math.abs(m.t - t) < Math.abs(best.t - t)) best = m;
      const bx = X(best.t);
      c.strokeStyle = grijs; c.lineWidth = 1; c.beginPath(); c.moveTo(bx + 0.5, T); c.lineTo(bx + 0.5, T + ph); c.stroke();
      for (const i of zichtbaar) {
        const x = best.v[i];
        if (x == null) continue;
        c.fillStyle = KLEUREN[i % KLEUREN.length]; c.beginPath(); c.arc(bx, Y(naarEenheid(x)), 4, 0, 7); c.fill();
      }
      const bij = zicht.filter((g) => Math.abs(X(g.t) - bx) < 12);
      this.tip.innerHTML = `<b>${new Date(best.t).toLocaleTimeString('nl-NL')}</b>`
        + zichtbaar.map((i) => (best.v[i] == null ? '' : `<span><i style="background:${KLEUREN[i % KLEUREN.length]}"></i>${esc((voelers[i] || {}).naam || `Voeler ${i + 1}`)}: ${fmt(best.v[i])}${graad()}</span>`)).join('')
        + bij.map((g) => `<span>${ic(gebeurtenisInfo(g.type).icoon)} ${esc(gebeurtenisInfo(g.type).label)}${g.tekst ? ': ' + esc(g.tekst) : ''}</span>`).join('');
      this.tip.hidden = false;
      const tw = this.tip.offsetWidth;
      this.tip.style.left = (bx + 12 + tw > w ? Math.max(0, bx - 12 - tw) : bx + 12) + 'px';
    }
  }
}

/** Mini-grafiekje (sparkline) voor de historie-lijst. */
export function sparkline(canvas, metingen) {
  const w = canvas.clientWidth || 90, h = canvas.clientHeight || 34, dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const c = canvas.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (metingen.length < 2) return;
  const aantal = Math.max(...metingen.map((m) => m.v.length));
  let lo = Infinity, hi = -Infinity;
  metingen.forEach((m) => m.v.forEach((x) => { if (x != null) { lo = Math.min(lo, x); hi = Math.max(hi, x); } }));
  if (!Number.isFinite(lo) || hi === lo) { hi = lo + 1; }
  const t0 = metingen[0].t, t1 = metingen[metingen.length - 1].t || t0 + 1;
  const elke = Math.max(1, Math.floor(metingen.length / w));
  for (let i = 0; i < aantal; i++) {
    c.strokeStyle = KLEUREN[i % KLEUREN.length]; c.lineWidth = 1.5; c.beginPath();
    let pen = false;
    for (let k = 0; k < metingen.length; k += elke) {
      const x = metingen[k].v[i];
      if (x == null) { pen = false; continue; }
      const px = ((metingen[k].t - t0) / (t1 - t0 || 1)) * (w - 2) + 1, py = h - 2 - ((x - lo) / (hi - lo)) * (h - 4);
      if (pen) c.lineTo(px, py); else { c.moveTo(px, py); pen = true; }
    }
    c.stroke();
  }
}
