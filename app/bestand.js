// Bestanden opslaan/delen en foto's verkleinen.
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNative } from './hulp.js';

/** Tekstbestand opslaan: in de app via "Delen" (Drive, WhatsApp, Bestanden…), in de browser als download. */
export async function bewaarBestand(naam, tekst, type = 'text/plain') {
  const veilig = naam.replace(/[\\/:*?"<>|]/g, '').trim() || 'bestand';
  if (isNative()) {
    const r = await Filesystem.writeFile({ path: veilig, data: tekst, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: veilig, files: [r.uri] });
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([tekst], { type }));
  a.download = veilig;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/** Foto verkleinen tot max 1400 px (JPEG), zodat de opslag klein blijft. */
export async function verkleinFoto(bestand, max = 1400) {
  const url = URL.createObjectURL(bestand);
  try {
    const img = await new Promise((ok, fout) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fout; i.src = url; });
    const f = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * f); c.height = Math.round(img.naturalHeight * f);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.85));
  } finally {
    URL.revokeObjectURL(url);
  }
}
