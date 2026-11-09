// Prestaties (badges) op basis van de historie.
import { statistiek, stallDuur } from './analyse.js';

/** Korte samenvatting van een sessie, bewaard bij het afronden (scheelt rekenwerk). */
export function samenvatting(s, metingen) {
  const voelers = s.voelers || [];
  const r = { duur: s.eind - s.start, binnen: null, stall: 0, klaar: [] };
  voelers.forEach((v, i) => {
    if (!v) return;
    if (v.rol === 'bbq') {
      const st = statistiek(metingen, i, v);
      if (st?.binnen != null) r.binnen = Math.max(r.binnen ?? 0, st.binnen);
    } else {
      const st = statistiek(metingen, i);
      if (st && v.doel != null && st.max >= v.doel) r.klaar.push(v.preset || 'vlees');
      if (st && st.max > 60) r.stall = Math.max(r.stall, stallDuur(metingen, i));
    }
  });
  return r;
}

export const BADGES = [
  { id: 'eerste', icoon: '🔥', naam: 'Aangestoken', uitleg: 'Je eerste sessie', test: (ss) => ss.length >= 1 },
  { id: 'vijf', icoon: '🍖', naam: 'Smaak te pakken', uitleg: '5 sessies', test: (ss) => ss.length >= 5 },
  { id: 'tien', icoon: '💯', naam: 'Pitmaster', uitleg: '10 sessies', test: (ss) => ss.length >= 10 },
  { id: 'marathon', icoon: '⏳', naam: 'Marathon', uitleg: 'Een cook van 10 uur of langer', test: (ss) => ss.some((s) => s.samenvatting?.duur >= 10 * 3600e3) },
  { id: 'brisket', icoon: '🥩', naam: 'Brisket-baas', uitleg: 'Een brisket op temperatuur gekregen', test: (ss) => ss.some((s) => s.samenvatting?.klaar?.includes('brisket')) },
  { id: 'pulled', icoon: '🐷', naam: 'Pulled pork pro', uitleg: 'Een varkensschouder op temperatuur', test: (ss) => ss.some((s) => s.samenvatting?.klaar?.includes('pulled')) },
  { id: 'stall', icoon: '⏸️', naam: 'Stall overwonnen', uitleg: 'Door een stall van een uur of langer heen en toch klaar', test: (ss) => ss.some((s) => s.samenvatting?.stall >= 3600e3 && s.samenvatting?.klaar?.length) },
  { id: 'strak', icoon: '🎯', naam: 'Strakke BBQ', uitleg: '4 uur of langer, 90% binnen het bereik', test: (ss) => ss.some((s) => s.samenvatting?.duur >= 4 * 3600e3 && s.samenvatting?.binnen >= 0.9) },
  { id: 'sterren', icoon: '⭐', naam: 'Perfectie', uitleg: 'Een cook met 5 sterren', test: (ss) => ss.some((s) => s.beoordeling === 5) },
  { id: 'recept', icoon: '📖', naam: 'Receptvolger', uitleg: 'Een cook met een recept', test: (ss) => ss.some((s) => s.recept) },
  { id: 'nacht', icoon: '🌙', naam: 'Nachtdienst', uitleg: 'Begonnen vóór 6 uur \'s ochtends', test: (ss) => ss.some((s) => new Date(s.start).getHours() < 6) },
  { id: 'foto', icoon: '📸', naam: 'Food-fotograaf', uitleg: 'Een foto bij een sessie', test: (ss) => ss.some((s) => s.heeftFoto) },
];

export function behaald(sessies) {
  const echt = sessies.filter((s) => !s.demo && !s.open);
  return new Set(BADGES.filter((b) => b.test(echt)).map((b) => b.id));
}
