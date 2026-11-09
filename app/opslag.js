// Opslag op het apparaat (IndexedDB): sessies, metingen en foto's.

let dbBelofte;
function db() {
  dbBelofte ||= new Promise((ok, fout) => {
    const r = indexedDB.open('bbq-thermometer', 2);
    r.onupgradeneeded = (e) => {
      const d = r.result;
      if (e.oldVersion < 1) {
        d.createObjectStore('sessies', { keyPath: 'id', autoIncrement: true });
        d.createObjectStore('metingen', { autoIncrement: true }).createIndex('sessie', 'sessie');
      }
      if (e.oldVersion < 2) d.createObjectStore('fotos'); // sleutel = sessie-id
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fout(r.error);
  });
  return dbBelofte;
}
async function tx(stores, modus, fn) {
  const d = await db();
  return new Promise((ok, fout) => {
    const t = d.transaction(stores, modus);
    let res;
    Promise.resolve(fn(t)).then((r) => { res = r; }, fout);
    t.oncomplete = () => ok(res);
    t.onerror = () => fout(t.error);
    t.onabort = () => fout(t.error);
  });
}
const req = (r) => new Promise((ok, fout) => { r.onsuccess = () => ok(r.result); r.onerror = () => fout(r.error); });
const sorteer = (m) => m.sort((a, b) => a.t - b.t);

export const opslag = {
  sessieMaken: (s) => tx(['sessies'], 'readwrite', (t) => req(t.objectStore('sessies').add(s))),
  sessieBewaren: (s) => tx(['sessies'], 'readwrite', (t) => { t.objectStore('sessies').put(s); }),
  sessie: (id) => tx(['sessies'], 'readonly', (t) => req(t.objectStore('sessies').get(id))),
  sessies: () => tx(['sessies'], 'readonly', (t) => req(t.objectStore('sessies').getAll())),
  meting: (m) => tx(['metingen'], 'readwrite', (t) => { t.objectStore('metingen').add(m); }),
  metingen: async (id) => sorteer(await tx(['metingen'], 'readonly', (t) =>
    req(t.objectStore('metingen').index('sessie').getAll(IDBKeyRange.only(id))))),
  /** Metingen van sessie 'van' overzetten naar sessie 'naar' (sessies samenvoegen). */
  verhuis: (van, naar) => tx(['metingen'], 'readwrite', async (t) => {
    const st = t.objectStore('metingen');
    const idx = st.index('sessie');
    await new Promise((ok, fout) => {
      const c = idx.openCursor(IDBKeyRange.only(van));
      c.onsuccess = () => {
        const cur = c.result;
        if (!cur) { ok(); return; }
        cur.update({ ...cur.value, sessie: naar });
        cur.continue();
      };
      c.onerror = () => fout(c.error);
    });
  }),
  wis: (id) => tx(['sessies', 'metingen', 'fotos'], 'readwrite', async (t) => {
    t.objectStore('sessies').delete(id);
    t.objectStore('fotos').delete(id);
    const st = t.objectStore('metingen');
    const keys = await req(st.index('sessie').getAllKeys(IDBKeyRange.only(id)));
    keys.forEach((k) => st.delete(k));
  }),
  fotoBewaren: (id, blob) => tx(['fotos'], 'readwrite', (t) => { t.objectStore('fotos').put(blob, id); }),
  foto: (id) => tx(['fotos'], 'readonly', (t) => req(t.objectStore('fotos').get(id))),
  fotoWissen: (id) => tx(['fotos'], 'readwrite', (t) => { t.objectStore('fotos').delete(id); }),
};

const naarDataUrl = (blob) => new Promise((ok, fout) => {
  const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => fout(r.error); r.readAsDataURL(blob);
});

/** Alles als één JSON-tekst (back-up). */
export async function maakBackup() {
  const sessies = await opslag.sessies();
  const uit = { app: 'bbq-thermometer', versie: 2, gemaakt: Date.now(), sessies: [] };
  for (const s of sessies) {
    const metingen = (await opslag.metingen(s.id)).map((m) => [m.t, m.v]);
    const foto = await opslag.foto(s.id);
    uit.sessies.push({ ...s, metingen, foto: foto ? await naarDataUrl(foto) : null });
  }
  return JSON.stringify(uit);
}

/** Back-up terugzetten; sessies die er al zijn (zelfde start) worden overgeslagen. */
export async function zetBackupTerug(tekst) {
  const data = JSON.parse(tekst);
  if (data.app !== 'bbq-thermometer' || !Array.isArray(data.sessies)) throw new Error('Dit is geen back-up van deze app');
  const bestaand = new Set((await opslag.sessies()).map((s) => s.start));
  let nieuw = 0;
  for (const s of data.sessies) {
    if (bestaand.has(s.start)) continue;
    const { metingen = [], foto, id: _oud, ...rest } = s;
    const id = await opslag.sessieMaken({ ...rest, open: false });
    await tx(['metingen'], 'readwrite', (t) => {
      const st = t.objectStore('metingen');
      metingen.forEach(([tijd, v]) => st.add({ sessie: id, t: tijd, v }));
    });
    if (foto) await opslag.fotoBewaren(id, await (await fetch(foto)).blob());
    nieuw++;
  }
  return nieuw;
}
