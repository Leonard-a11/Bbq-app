// Deelkaart: een mooie afbeelding van een cook (foto, grafiek, cijfers) om te delen.
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Grafiek } from './grafiek.js';
import { statistiek } from './analyse.js';
import { KLEUREN, fmt, isBbq } from './staat.js';
import { fmtDatum, fmtDuur, isNative } from './hulp.js';

const B = 1080, H = 1350;
const VLAM = new Path2D('M12 2c1 3.5-1.5 5-1.5 7.5 0 1.4 1 2.5 2.3 2.5 1.5 0 2.2-1.2 2.2-2.6 0-.6-.1-1.2-.3-1.7C17.4 9.4 19 12 19 14.6 19 18.7 15.9 22 12 22s-7-3.3-7-7.4C5 9.3 10.2 6.7 12 2z');

function afgerond(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

export async function maakDeelkaart(s, metingen, fotoBlob) {
  const cv = document.createElement('canvas'); cv.width = B; cv.height = H;
  const c = cv.getContext('2d');
  // achtergrond met gloed
  c.fillStyle = '#0e0f12'; c.fillRect(0, 0, B, H);
  const g = c.createRadialGradient(B / 2, -200, 50, B / 2, -200, 900);
  g.addColorStop(0, 'rgba(255,122,26,.45)'); g.addColorStop(1, 'rgba(255,122,26,0)');
  c.fillStyle = g; c.fillRect(0, 0, B, H);
  // kop
  c.save(); c.translate(48, 42); c.scale(2.2, 2.2); c.fillStyle = '#ff7a1a'; c.fill(VLAM); c.restore();
  c.fillStyle = '#f1f2f5'; c.font = '700 34px system-ui, sans-serif'; c.textBaseline = 'middle';
  c.fillText('BBQ Thermometer', 112, 70);
  // titel
  c.font = '800 64px system-ui, sans-serif'; c.textBaseline = 'alphabetic';
  let titel = s.naam;
  while (c.measureText(titel).width > B - 96 && titel.length > 4) titel = titel.slice(0, -2);
  if (titel !== s.naam) titel = titel.trim() + '…';
  c.fillText(titel, 48, 190);
  c.font = '400 32px system-ui, sans-serif'; c.fillStyle = '#8f96a3';
  c.fillText(`${fmtDatum(s.start)} · ${fmtDuur(s.eind - s.start)}`, 48, 240);
  if (s.beoordeling) {
    c.font = '40px system-ui, sans-serif'; c.fillStyle = '#ffb13b';
    c.fillText('★'.repeat(s.beoordeling) + '☆'.repeat(5 - s.beoordeling), B - 48 - c.measureText('★★★★★').width, 240);
  }
  let y = 280;
  // foto
  if (fotoBlob) {
    const img = await new Promise((ok, fout) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fout; i.src = URL.createObjectURL(fotoBlob); });
    const w = B - 96, h = 470, f = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const sw = w / f, sh = h / f;
    c.save(); afgerond(c, 48, y, w, h, 32); c.clip();
    c.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 48, y, w, h);
    c.restore();
    URL.revokeObjectURL(img.src);
    y += h + 30;
  }
  // grafiek (getekend met dezelfde grafiek als in de app)
  const gh = fotoBlob ? 380 : 780;
  const vak = document.createElement('div');
  vak.style.cssText = `position:fixed;left:-3000px;top:0;width:${(B - 96) / 2}px;height:${gh / 2}px`;
  const gc = document.createElement('canvas'); gc.style.cssText = 'width:100%;height:100%;display:block';
  const tip = document.createElement('div');
  vak.append(gc, tip); document.body.appendChild(vak);
  const aantal = Math.max(0, ...metingen.map((m) => m.v.length));
  const voelers = Array.from({ length: aantal }, (_, i) => Object.assign({ naam: `Voeler ${i + 1}` }, s.voelers?.[i]));
  const graf = new Grafiek(gc, tip);
  graf.zet(metingen, { voelers, gebeurtenissen: s.gebeurtenissen || [], historie: true, schaal: 2 });
  c.save(); afgerond(c, 48, y, B - 96, gh, 28); c.fillStyle = '#17191e'; c.fill(); c.restore();
  c.drawImage(gc, 48, y + 10, B - 96, gh - 20);
  vak.remove();
  y += gh + 34;
  // cijfers
  const tegels = [];
  voelers.forEach((v, i) => {
    const st = statistiek(metingen, i, isBbq(v) ? v : null);
    if (!st) return;
    if (isBbq(v)) tegels.push([KLEUREN[i % 6], `${fmt(st.gem, 0)}°`, `${v.naam} gemiddeld${st.binnen != null ? ` · ${Math.round(st.binnen * 100)}% in bereik` : ''}`]);
    else tegels.push([KLEUREN[i % 6], `${fmt(st.max, 0)}°`, `${v.naam}${v.doel ? ` · doel ${fmt(v.doel, 0)}°` : ''}`]);
  });
  const per = Math.min(3, Math.max(1, tegels.length));
  const tw = (B - 96 - (per - 1) * 20) / per;
  tegels.slice(0, 3).forEach(([k, groot, klein], n) => {
    const x = 48 + n * (tw + 20);
    c.save(); afgerond(c, x, y, tw, 150, 24); c.fillStyle = '#17191e'; c.fill(); c.restore();
    c.fillStyle = k; c.beginPath(); c.arc(x + 32, y + 40, 9, 0, 7); c.fill();
    c.fillStyle = '#f1f2f5'; c.font = '800 56px system-ui, sans-serif'; c.fillText(groot, x + 28, y + 108);
    c.fillStyle = '#8f96a3'; c.font = '400 24px system-ui, sans-serif';
    let t = klein; while (c.measureText(t).width > tw - 70 && t.length > 4) t = t.slice(0, -2);
    c.fillText(t + (t !== klein ? '…' : ''), x + 52, y + 48);
  });
  // voet
  c.fillStyle = '#5e6470'; c.font = '400 24px system-ui, sans-serif'; c.textAlign = 'center';
  c.fillText('Gemeten met BBQ Thermometer · Weber-ketel 🔥', B / 2, H - 36);
  return new Promise((ok) => cv.toBlob(ok, 'image/png'));
}

/** Afbeelding delen (app: deelmenu, browser: delen of downloaden). */
export async function deelAfbeelding(blob, naam) {
  const bestand = `${naam.replace(/[\\/:*?"<>|]/g, '').trim() || 'bbq'}.png`;
  if (isNative()) {
    const data = await new Promise((ok, fout) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = fout; r.readAsDataURL(blob); });
    const r = await Filesystem.writeFile({ path: bestand, data, directory: Directory.Cache });
    await Share.share({ title: naam, files: [r.uri] });
    return;
  }
  const f = new File([blob], bestand, { type: 'image/png' });
  if (navigator.canShare?.({ files: [f] })) { await navigator.share({ files: [f], title: naam }); return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = bestand; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
