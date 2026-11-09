// Compacte notatie voor recepten (ook gebruikt voor eigen recepten).
const EENHEDEN = 'kg|g|gr|ml|l|dl|el|tl|stuks|stuk|st|plakjes|plakje|tenen|teen|takjes|takje|racks|rack|blik|blikken|bos|bosje|snufje|scheut|flesjes|flesje|kolven|bollen|vellen|zakje';
export function leesIngredient(regel) {
  const m = new RegExp(`^(\\d+(?:[.,]\\d+)?|½|¼|¾)\\s*(${EENHEDEN})?\\.?\\s+(.+)$`, 'i').exec(regel.trim());
  if (!m) return { h: null, e: '', n: regel.trim() };
  const h = { '½': 0.5, '¼': 0.25, '¾': 0.75 }[m[1]] ?? parseFloat(m[1].replace(',', '.'));
  return { h, e: (m[2] || '').toLowerCase(), n: m[3].trim() };
}
export function leesStap(regel) {
  // "[70°] Inpakken – uitleg" of "[45m] Spritzen – uitleg" of "[45m↻] …"
  let t = regel.trim(), bij, timer, herhaal;
  const tag = /^\[(\d+)\s*(°|m|min|u)(↻|\+)?\]\s*/i.exec(t);
  if (tag) {
    t = t.slice(tag[0].length);
    if (tag[2] === '°') bij = +tag[1]; else timer = /u/i.test(tag[2]) ? +tag[1] * 60 : +tag[1];
    herhaal = !!tag[3];
  }
  const [k, ...rest] = t.split(/\s+[–-]\s+/);
  return { k: k.trim(), t: rest.join(' – ').trim() || '', ...(bij ? { bij } : {}), ...(timer ? { timer } : {}), ...(herhaal ? { herhaal } : {}) };
}

/** Recept uit compacte notatie: ingrediënten als "1 kg tri-tip", stappen als "[50°] Eraf – uitleg". */
export function R(id, naam, cat, info, ingredienten, stappen, tips = []) {
  return { id, naam, cat, ...info, ingredienten: ingredienten.map(leesIngredient), stappen: stappen.map(leesStap), tips };
}
