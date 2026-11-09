// Deelkaart: een mooie afbeelding van een cook (foto, grafiek, cijfers) om te delen.
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Grafiek } from './grafiek.js';
import { statistiek } from './analyse.js';
import { KLEUREN, fmt, isBbq } from './staat.js';
import { fmtDatum, fmtDuur, isNative } from './hulp.js';
import { tekenIcoon } from './iconen.js';

const KOP = "'Barlow Condensed', sans-serif", SERIF = "'Fraunces', Georgia, serif", TEKST = "'Barlow', sans-serif";

const B = 1080, H = 1350;

function afgerond(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

export async function maakDeelkaart(s, metingen, fotoBlob) {
  const cv = document.createElement('canvas'); cv.width = B; cv.height = H;
  const c = cv.getContext('2d');
  await Promise.all([`700 34px ${KOP}`, `600 64px ${SERIF}`, `400 30px ${TEKST}`].map((f) => document.fonts?.load(f).catch(() => {})));
  c.fillStyle = '#121110'; c.fillRect(0, 0, B, H);
  // kop
  tekenIcoon(c, 'vlam', 66, 70, 40, '#e8642e');
  c.fillStyle = '#efe7da'; c.font = `700 34px ${KOP}`; c.textBaseline = 'middle';
  c.letterSpacing = '4px';
  c.fillText('BBQ THERMOMETER', 100, 72);
  c.letterSpacing = '0px';
  c.fillStyle = '#2f2b27'; c.fillRect(48, 112, B - 96, 2);
  // titel
  c.fillStyle = '#efe7da'; c.font = `600 64px ${SERIF}`; c.textBaseline = 'alphabetic';
  let titel = s.naam;
  while (c.measureText(titel).width > B - 96 && titel.length > 4) titel = titel.slice(0, -2);
  if (titel !== s.naam) titel = titel.trim() + '…';
  c.fillText(titel, 48, 190);
  c.font = `600 30px ${KOP}`; c.fillStyle = '#a59a8a';
  c.letterSpacing = '3px';
  c.fillText(`${fmtDatum(s.start)} · ${fmtDuur(s.eind - s.start)}`.toUpperCase(), 48, 240);
  c.letterSpacing = '0px';
  if (s.beoordeling) {
    for (let k = 0; k < 5; k++) tekenIcoon(c, 'ster', B - 48 - 22 - (4 - k) * 46, 230, 40, k < s.beoordeling ? '#dcae4a' : '#443e38', k < s.beoordeling);
  }
  let y = 280;
  // foto
  if (fotoBlob) {
    const img = await new Promise((ok, fout) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fout; i.src = URL.createObjectURL(fotoBlob); });
    const w = B - 96, h = 470, f = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const sw = w / f, sh = h / f;
    c.save(); afgerond(c, 48, y, w, h, 16); c.clip();
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
  c.save(); afgerond(c, 48, y, B - 96, gh, 16); c.fillStyle = '#1a1816'; c.fill(); c.strokeStyle = '#2f2b27'; c.lineWidth = 2; c.stroke(); c.restore();
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
    c.save(); afgerond(c, x, y, tw, 150, 16); c.strokeStyle = '#2f2b27'; c.lineWidth = 2; c.stroke(); c.restore();
    c.fillStyle = k; c.fillRect(x + 24, y + 34, 14, 14);
    c.fillStyle = '#efe7da'; c.font = `700 72px ${KOP}`; c.fillText(groot, x + 22, y + 122);
    c.fillStyle = '#a59a8a'; c.font = `600 24px ${KOP}`;
    let t = klein; while (c.measureText(t).width > tw - 70 && t.length > 4) t = t.slice(0, -2);
    c.fillText((t + (t !== klein ? '…' : '')).toUpperCase(), x + 48, y + 49);
  });
  // voet
  c.fillStyle = '#6e665c'; c.font = `600 24px ${KOP}`; c.textAlign = 'center';
  c.letterSpacing = '4px';
  c.fillText('GEROOKT OP DE WEBER · GEMETEN MET BBQ THERMOMETER', B / 2, H - 40);
  c.letterSpacing = '0px';
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
