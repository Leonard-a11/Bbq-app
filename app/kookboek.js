// Kerntemperaturen, opstellingen voor de Weber-ketel en gebeurtenissen.
// Temperaturen = wanneer je het vlees eraf haalt; tijdens het rusten stijgt het nog 1–3°.

export const VLEES = [
  { id: 'brisket', uurPerKg: [1.0, 1.5], naam: 'Brisket', doel: 95, rust: 60, stall: true, tip: 'Klaar als de voeler er zonder weerstand in glijdt (± 93–96°). Stall rond 65–75° is normaal.' },
  { id: 'pulled', uurPerKg: [1.5, 2.0], naam: 'Pulled pork (schouder)', doel: 93, rust: 45, stall: true, tip: 'Trekt makkelijk uit elkaar vanaf ± 93°. Rust ingepakt in een koelbox met handdoeken.' },
  { id: 'spareribs', uren: [5, 6], naam: 'Spareribs', doel: 90, rust: 10, stall: true, tip: 'Buigtest: rib optillen met een tang, het vlees moet scheuren aan de bovenkant.' },
  { id: 'beefribs', uren: [7, 9], naam: 'Beef ribs (short ribs)', doel: 95, rust: 30, stall: true, tip: 'Net als brisket: prik-zacht is belangrijker dan het precieze getal.' },
  { id: 'picanha', uurPerKg: [1.0, 1.4], naam: 'Picanha (medium-rare)', doel: 54, rust: 10, tip: 'Indirect tot ± 50°, daarna kort direct dichtschroeien (reverse sear).' },
  { id: 'cote', uurPerKg: [0.8, 1.2], naam: 'Côte de bœuf / tomahawk', doel: 54, rust: 10, tip: 'Reverse sear: indirect tot 50°, dan heet direct afgrillen.' },
  { id: 'rund-rare', uurPerKg: [0.7, 1.0], naam: 'Rund – rare', doel: 50, rust: 8 },
  { id: 'rund-mr', uurPerKg: [0.8, 1.1], naam: 'Rund – medium-rare', doel: 54, rust: 8 },
  { id: 'rund-m', uurPerKg: [0.9, 1.2], naam: 'Rund – medium', doel: 58, rust: 8 },
  { id: 'rund-wd', uurPerKg: [1.0, 1.4], naam: 'Rund – well done', doel: 68, rust: 8 },
  { id: 'haas', uren: [0.75, 1.25], naam: 'Varkenshaas', doel: 62, rust: 5 },
  { id: 'karbonade', uren: [0.4, 0.7], naam: 'Varkenskarbonade / ribeye', doel: 63, rust: 5 },
  { id: 'kip', uurPerKg: [0.6, 0.8], naam: 'Hele kip (borst)', doel: 74, rust: 15, tip: 'Voeler in het dikste deel van de borst, niet tegen het bot.' },
  { id: 'kipdij', uren: [0.6, 0.9], naam: 'Kippendij / drumstick', doel: 82, rust: 5, tip: 'Dijen worden sappiger en malser boven de 80°.' },
  { id: 'kalkoen', uurPerKg: [0.5, 0.7], naam: 'Kalkoen (borst)', doel: 74, rust: 20 },
  { id: 'lam', uurPerKg: [0.9, 1.2], naam: 'Lamsbout (medium)', doel: 60, rust: 15 },
  { id: 'lamsrack', uren: [0.5, 0.8], naam: 'Lamsrack (rosé)', doel: 56, rust: 8 },
  { id: 'zalm', uren: [0.4, 0.6], naam: 'Zalm', doel: 50, rust: 3 },
  { id: 'worst', uren: [0.3, 0.5], naam: 'Worst / braadworst', doel: 72, rust: 2 },
];

export const OPSTELLINGEN = [
  { id: 'lowslow', naam: 'Low & slow – indirect met diffuser', min: 107, max: 125,
    tip: 'Diffuser tussen kolen en vlees, lekbak met water eronder. Onderste ventiel ± ¼ open, deksel-ventiel helemaal open boven het vlees.' },
  { id: 'snake', naam: 'Snake / minion – lange cook (8 u+)', min: 105, max: 120,
    tip: 'Slang van 2×1 briketten langs de rand, 8–10 aangestoken briketten aan het begin. Onderste ventiel klein open.' },
  { id: 'indirect', naam: 'Indirect 2-zone – kip, ribs, rollade', min: 160, max: 185,
    tip: 'Kolen aan één kant (of in de manden), vlees aan de andere kant. Ventielen half open.' },
  { id: 'hotfast', naam: 'Hot & fast', min: 175, max: 220,
    tip: 'Veel kolen, ventielen ver open. Houd het vlees indirect.' },
  { id: 'reverse', naam: 'Reverse sear – eerst laag, dan heet', min: 110, max: 135,
    tip: 'Indirect tot ± 5° onder de kerntemperatuur, daarna direct boven gloeiende kolen afgrillen.' },
  { id: 'direct', naam: 'Direct grillen (heet)', min: 200, max: null,
    tip: 'Volle kolen, alle ventielen open. Niet te lang weglopen.' },
];

export const GEBEURTENISSEN = [
  { type: 'deksel', label: 'Deksel open', icoon: '👀' },
  { type: 'kolen', label: 'Kolen bijgevuld', icoon: '🔥' },
  { type: 'hout', label: 'Rookhout erbij', icoon: '🪵' },
  { type: 'ventiel', label: 'Ventiel versteld', icoon: '🎚️' },
  { type: 'ingepakt', label: 'Ingepakt', icoon: '📦' },
  { type: 'spritz', label: 'Gespritzt / gemopt', icoon: '💧' },
  { type: 'omgedraaid', label: 'Omgedraaid', icoon: '🔄' },
  { type: 'saus', label: 'Glazuur / saus', icoon: '🍯' },
  { type: 'eraf', label: 'Van de BBQ', icoon: '🍽️' },
  { type: 'notitie', label: 'Notitie', icoon: '📝' },
];
export const AUTO_GEBEURTENISSEN = {
  verbindingWeg: { label: 'Verbinding weg', icoon: '📴' },
  verbindingTerug: { label: 'Verbinding terug', icoon: '📶' },
  klaar: { label: 'Op temperatuur', icoon: '✅' },
  stall: { label: 'Stall begonnen', icoon: '⏸️' },
  dekselAuto: { label: 'Deksel open (gezien)', icoon: '👀' },
};
export function gebeurtenisInfo(type) {
  return GEBEURTENISSEN.find((g) => g.type === type) || AUTO_GEBEURTENISSEN[type] || { label: type, icoon: '•' };
}

export const TIMER_SNEL = [
  { label: 'Spritzen', min: 45, herhaal: true },
  { label: 'Kolen checken', min: 60, herhaal: true },
  { label: 'Omdraaien', min: 15 },
  { label: 'Rusten', min: 15 },
  { label: 'Timer', min: 10 },
];
