// Receptenboek voor de Weber-ketel (57 cm). Hoeveelheden gelden voor `personen`.
// Ingrediënt: { h: hoeveelheid, e: eenheid, n: naam }  (h = null → naar smaak)
// Stap: { k: korte titel, t: tekst, timer?: minuten, herhaal?: true, bij?: kerntemp (°C) }
// `vlees` = snelkeuze uit kookboek.js (doel/rust), `opstelling` = BBQ-opstelling.

export const CATEGORIEEN = [
  { id: 'rund', naam: 'Rund' },
  { id: 'varken', naam: 'Varken' },
  { id: 'gevogelte', naam: 'Gevogelte' },
  { id: 'vis', naam: 'Vis' },
  { id: 'lam', naam: 'Lam' },
  { id: 'wild', naam: 'Wild' },
  { id: 'vega', naam: 'Vega' },
  { id: 'rub', naam: 'Rubs & sauzen' },
  { id: 'bij', naam: 'Bijgerechten' },
  { id: 'dessert', naam: 'Desserts' },
];

import { MEER } from './recepten-meer.js';
export { leesIngredient, leesStap } from './receptnotatie.js';

export const RECEPTEN = [
  {
    id: 'brisket', naam: 'Texas brisket', cat: 'rund', emoji: '🥩', tijd: '10–14 uur', niveau: 3, personen: 12,
    vlees: 'brisket', opstelling: 'snake', gewicht: 5, hout: 'Eik of kers (3–4 brokken)',
    intro: 'De koning van de low & slow. Simpele rub, veel geduld, en een bark om van te dromen.',
    ingredienten: [
      { h: 5, e: 'kg', n: 'hele brisket (packer)' },
      { h: 4, e: 'el', n: 'grof zout' },
      { h: 4, e: 'el', n: 'grof gemalen zwarte peper' },
      { h: 1, e: 'el', n: 'knoflookpoeder' },
      { h: 250, e: 'ml', n: 'appelciderazijn + water (spritz, 1:1)' },
      { h: 1, e: 'rol', n: 'slagerspapier (of aluminiumfolie)' },
    ],
    stappen: [
      { k: 'Trimmen', t: 'Snijd het harde vet weg en laat ± 0,5 cm vet op de vetkant. Rond scherpe randen af, die verbranden anders.' },
      { k: 'Rub', t: 'Meng zout, peper en knoflook. Bestrooi het vlees royaal aan alle kanten. Liefst de avond ervoor, anders minstens 1 uur.' },
      { k: 'BBQ klaarzetten', t: 'Snake van 2×1 briketten langs de rand (± 90 stuks), 10 aangestoken briketten aan het begin. Diffuser en lekbak met water. Onderste ventiel ¼ open. Wacht tot 110–120°.' },
      { k: 'Vlees erop', t: 'Vetkant richting de kolen, voeler in het dikste deel van de flat. Rookhout op de eerste briketten van de slang.' },
      { k: 'Spritzen', t: 'Na 3 uur elke 60 minuten licht besproeien als het oppervlak droog wordt.', timer: 60, herhaal: true },
      { k: 'Inpakken bij ± 70°', t: 'Is de bark donker en hecht hij goed? Strak inpakken in slagerspapier. Dat helpt door de stall.', bij: 70 },
      { k: 'Prik-test vanaf 90°', t: 'Steek de voeler op een paar plekken in: klaar als hij er als in boter in glijdt (meestal 93–96°).', bij: 90 },
      { k: 'Rusten', t: 'Ingepakt in een droge handdoek in een koelbox, minstens 1 uur (tot 3 uur kan prima).', timer: 60 },
      { k: 'Snijden', t: 'Scheid point en flat. Snijd de flat tegen de draad in plakken van een potloodbreedte, de point in blokjes.' },
    ],
    tips: ['Stall rond 65–75° kan uren duren: niet de BBQ hoger zetten, wel inpakken.', 'Bewaar het vet uit het papier, heerlijk over de plakken.'],
  },
  {
    id: 'pulled', naam: 'Pulled pork', cat: 'varken', emoji: '🐷', tijd: '8–12 uur', niveau: 2, personen: 10,
    vlees: 'pulled', opstelling: 'snake', gewicht: 3, hout: 'Appel, kers of hickory',
    intro: 'Varkensschouder die na urenlang roken zo uit elkaar valt. Ideaal voor een grote groep.',
    ingredienten: [
      { h: 3, e: 'kg', n: 'varkensschouder (met bot)' },
      { h: 2, e: 'el', n: 'gele mosterd (als lijm)' },
      { h: 6, e: 'el', n: 'Memphis rub (zie recept)' },
      { h: 250, e: 'ml', n: 'appelsap + appelciderazijn (spritz)' },
      { h: 300, e: 'ml', n: 'BBQ-saus' },
      { h: 10, e: 'stuks', n: 'brioche-broodjes' },
      { h: null, e: '', n: 'coleslaw (zie recept)' },
    ],
    stappen: [
      { k: 'Inwrijven', t: 'Smeer dun in met mosterd en bestrooi royaal met de rub. Mag de avond ervoor.' },
      { k: 'BBQ klaarzetten', t: 'Snake of minion op 110–120°, diffuser en lekbak. Rookhout op de kolen.' },
      { k: 'Vlees erop', t: 'Vetkant boven. Voeler in het dikste deel, niet tegen het bot.' },
      { k: 'Spritzen', t: 'Na 3 uur elk uur besproeien.', timer: 60, herhaal: true },
      { k: 'Inpakken (optioneel) bij 75°', t: 'Sneller door de stall: inpakken in folie met een scheutje appelsap.', bij: 75 },
      { k: 'Klaar bij 93°', t: 'Het bot moet er makkelijk uit te draaien zijn.', bij: 93 },
      { k: 'Rusten', t: 'Ingepakt in de koelbox, minimaal 45 minuten.', timer: 45 },
      { k: 'Trekken', t: 'Met twee vorken of berenklauwen uit elkaar trekken, vet en kraakbeen eruit. Meng met wat van het vocht en een beetje saus.' },
    ],
    tips: ['Een schouder met bot blijft sappiger dan zonder.'],
  },
  {
    id: 'ribs321', naam: 'Spareribs 3-2-1', cat: 'varken', emoji: '🍖', tijd: '6 uur', niveau: 2, personen: 4,
    vlees: 'spareribs', opstelling: 'lowslow', gewicht: 2.5, hout: 'Appel of kers',
    intro: '3 uur roken, 2 uur ingepakt, 1 uur glazuren. Foolproof en lekker kleverig.',
    ingredienten: [
      { h: 2, e: 'racks', n: 'spareribs (St. Louis cut)' },
      { h: 4, e: 'el', n: 'Memphis rub' },
      { h: 50, e: 'g', n: 'boter' },
      { h: 3, e: 'el', n: 'honing' },
      { h: 3, e: 'el', n: 'bruine suiker' },
      { h: 100, e: 'ml', n: 'appelsap' },
      { h: 200, e: 'ml', n: 'BBQ-saus' },
    ],
    stappen: [
      { k: 'Vlies verwijderen', t: 'Trek met een keukenpapiertje het vlies van de botkant.' },
      { k: 'Rub', t: 'Royaal inwrijven aan beide kanten.' },
      { k: 'BBQ op 110–120°', t: 'Indirect met diffuser, rookhout erop.' },
      { k: '3 uur roken', t: 'Ribs erop, botkant onder. Deksel dicht.', timer: 180 },
      { k: '2 uur ingepakt', t: 'Leg per rack boter, honing, suiker en een scheut appelsap op folie, ribs met de vleeskant erop, strak dichtvouwen.', timer: 120 },
      { k: '1 uur glazuren', t: 'Uitpakken, insmeren met saus, nog een uur zonder folie (tussendoor nog een laagje).', timer: 60 },
      { k: 'Buigtest', t: 'Til het rack op met een tang: het vlees moet aan de bovenkant scheuren. Even rusten en snijden.' },
    ],
    tips: ['Babyback ribs zijn kleiner: gebruik 2-2-1.'],
  },
  {
    id: 'beefribs', naam: 'Beef short ribs', cat: 'rund', emoji: '🦴', tijd: '7–9 uur', niveau: 2, personen: 4,
    vlees: 'beefribs', opstelling: 'lowslow', gewicht: 2, hout: 'Eik',
    intro: '"Dino ribs": dikke runderribben met een zwarte bark en vlees dat van het bot glijdt.',
    ingredienten: [
      { h: 2, e: 'kg', n: 'short rib plate (3–4 botten)' },
      { h: 3, e: 'el', n: 'Texas SPG-rub' },
      { h: 250, e: 'ml', n: 'appelciderazijn + water (spritz)' },
    ],
    stappen: [
      { k: 'Trimmen & rub', t: 'Verwijder het vlies en dikke vetlagen bovenop. Ruim SPG erop.' },
      { k: 'BBQ op 120–130°', t: 'Indirect met diffuser, eik op de kolen.' },
      { k: 'Spritzen', t: 'Na 3 uur elk uur.', timer: 60, herhaal: true },
      { k: 'Klaar bij ± 95°', t: 'Prik-zacht tussen de botten.', bij: 95 },
      { k: 'Rusten', t: 'Minstens 30 minuten losjes ingepakt.', timer: 30 },
    ],
    tips: ['Niet inpakken geeft de mooiste bark; duurt wel langer.'],
  },
  {
    id: 'picanha', naam: 'Picanha reverse sear', cat: 'rund', emoji: '🔥', tijd: '1,5–2 uur', niveau: 2, personen: 5,
    vlees: 'picanha', opstelling: 'reverse', gewicht: 1.2, hout: 'Eik of beuk (1 brokje)',
    intro: 'Eerst zacht garen, dan keihard dichtschroeien: perfect rosé van rand tot rand.',
    ingredienten: [
      { h: 1.2, e: 'kg', n: 'picanha (staartstuk) met vetlaag' },
      { h: 2, e: 'el', n: 'grof zeezout' },
      { h: 1, e: 'el', n: 'zwarte peper' },
      { h: null, e: '', n: 'chimichurri om erbij te serveren' },
    ],
    stappen: [
      { k: 'Inkerven & zouten', t: 'Kerf de vetlaag ruitvormig in (niet in het vlees). Royaal zouten, liefst 1–12 uur vooraf.' },
      { k: 'BBQ op 120°', t: 'Kolen aan één kant, vlees aan de andere kant met de vetkant boven.' },
      { k: 'Starter klaarzetten bij 45°', t: 'Steek nu een halve starter briketten aan voor het afschroeien.', bij: 45 },
      { k: 'Eraf bij 50°', t: 'Haal het vlees eraf, stort de gloeiende kolen bij elkaar, deksel even open.', bij: 50 },
      { k: 'Dichtschroeien', t: 'Direct boven de kolen, 1 minuut per kant, vetkant als laatste (pas op voor vlammen).', timer: 5 },
      { k: 'Rusten & snijden', t: '8 minuten rusten, dan in dunne plakken tegen de draad.', timer: 8 },
    ],
    tips: ['Kerntemperatuur na het rusten: ± 54° = medium-rare.'],
  },
  {
    id: 'cote', naam: 'Côte de bœuf', cat: 'rund', emoji: '🥩', tijd: '1–1,5 uur', niveau: 2, personen: 3,
    vlees: 'cote', opstelling: 'reverse', gewicht: 1.2, hout: 'Eik (optioneel)',
    intro: 'Dikke rib-eye aan het bot, reverse seared. Showstopper.',
    ingredienten: [
      { h: 1.2, e: 'kg', n: 'côte de bœuf (± 5 cm dik)' },
      { h: 1, e: 'el', n: 'grof zout' },
      { h: 1, e: 'tl', n: 'zwarte peper' },
      { h: 40, e: 'g', n: 'boter met knoflook en tijm' },
    ],
    stappen: [
      { k: 'Zouten', t: 'Zout aan alle kanten, minstens 1 uur vooraf (onafgedekt in de koelkast mag een nacht).' },
      { k: 'Indirect op 120°', t: 'Vlees aan de koele kant, voeler in het midden.' },
      { k: 'Starter aansteken bij 44°', t: 'Halve starter briketten aansteken.', bij: 44 },
      { k: 'Eraf bij 49°', t: 'Even van de BBQ, kolen bij elkaar.', bij: 49 },
      { k: 'Afschroeien', t: 'Heet direct, 60–90 seconden per kant, ook de randen. Klontje boter erop.', timer: 4 },
      { k: 'Rusten', t: '10 minuten rusten.', timer: 10 },
    ],
    tips: ['Liever medium? Haal hem bij 53° eraf.'],
  },
  {
    id: 'kip', naam: 'Spatchcock kip', cat: 'gevogelte', emoji: '🐔', tijd: '1–1,5 uur', niveau: 1, personen: 4,
    vlees: 'kip', opstelling: 'indirect', gewicht: 1.6, hout: 'Appel of kers',
    intro: 'Opengeklapte kip: gaart gelijkmatig en krijgt een krokant velletje.',
    ingredienten: [
      { h: 1, e: 'stuks', n: 'kip (± 1,6 kg)' },
      { h: 16, e: 'g', n: 'zout (droog pekelen, 1%)' },
      { h: 2, e: 'el', n: 'kip-rub of paprika, knoflook, tijm' },
      { h: 1, e: 'el', n: 'olijfolie' },
      { h: 1, e: 'stuks', n: 'citroen' },
    ],
    stappen: [
      { k: 'Openknippen', t: 'Knip de ruggengraat eruit, klap open en druk het borstbeen plat.' },
      { k: 'Droog pekelen', t: 'Zout erover en onafgedekt in de koelkast, liefst een nacht (minimaal 1 uur).' },
      { k: 'Rub', t: 'Dun met olie insmeren en de rub erover.' },
      { k: 'BBQ op 180–200°', t: 'Kolen in de manden aan twee kanten of aan één kant, kip in het midden met het vel boven.' },
      { k: 'Klaar bij 74° (borst)', t: 'Controleer ook de dij: die mag 80° of meer zijn.', bij: 74 },
      { k: 'Rusten', t: '10 minuten rusten, citroen erover.', timer: 10 },
    ],
    tips: ['Velletje niet krokant? Laatste 5 minuten direct boven de kolen, vel naar beneden.'],
  },
  {
    id: 'kipdij', naam: 'Kippendijen met glazuur', cat: 'gevogelte', emoji: '🍗', tijd: '45 min', niveau: 1, personen: 4,
    vlees: 'kipdij', opstelling: 'indirect', gewicht: 1, hout: 'Kers',
    intro: 'Dijen met vel en bot: vergevingsgezind, sappig en snel.',
    ingredienten: [
      { h: 8, e: 'stuks', n: 'kippendijen met vel en bot' },
      { h: 3, e: 'el', n: 'BBQ-rub' },
      { h: 150, e: 'ml', n: 'BBQ-saus' },
      { h: 1, e: 'el', n: 'honing' },
    ],
    stappen: [
      { k: 'Rub', t: 'Dijen droogdeppen en royaal inwrijven.' },
      { k: 'Indirect op 180°', t: 'Velkant boven, deksel dicht.' },
      { k: 'Glazuren bij 75°', t: 'Saus met honing erop smeren.', bij: 75 },
      { k: 'Klaar bij 82°', t: 'Even boven de kolen voor een karamellaagje.', bij: 82 },
    ],
    tips: ['Dijen worden juist malser boven de 80°.'],
  },
  {
    id: 'burntends', naam: 'Pork belly burnt ends', cat: 'varken', emoji: '🍬', tijd: '5 uur', niveau: 2, personen: 6,
    vlees: null, opstelling: 'lowslow', gewicht: 1.5, hout: 'Kers of hickory',
    intro: '"Meat candy": blokjes buikspek die smelten in je mond.',
    ingredienten: [
      { h: 1.5, e: 'kg', n: 'varkensbuik zonder zwoerd' },
      { h: 4, e: 'el', n: 'Memphis rub' },
      { h: 75, e: 'g', n: 'boter' },
      { h: 3, e: 'el', n: 'honing' },
      { h: 150, e: 'ml', n: 'BBQ-saus' },
    ],
    stappen: [
      { k: 'Snijden & rub', t: 'In blokjes van 4 cm, rub erover.' },
      { k: 'Roken 3 uur op 120°', t: 'Blokjes op het rooster, een beetje uit elkaar.', timer: 180 },
      { k: 'In de bak 1,5 uur', t: 'In een aluminium bakje met boter, honing en saus, afdekken met folie.', timer: 90 },
      { k: 'Laatste 15 minuten open', t: 'Folie eraf, saus laten indikken tot het plakt.', timer: 15 },
    ],
    tips: ['Zijn ze prik-zacht? Dan zijn ze klaar.'],
  },
  {
    id: 'zalm', naam: 'Zalm op cederplank', cat: 'vis', emoji: '🐟', tijd: '30 min (+ 1 u weken)', niveau: 1, personen: 4,
    vlees: 'zalm', opstelling: 'indirect', gewicht: 0.6, hout: 'De plank zelf',
    intro: 'Zachte rookgeur van ceder, smeuïge zalm.',
    ingredienten: [
      { h: 600, e: 'g', n: 'zalmfilet met vel' },
      { h: 1, e: 'stuks', n: 'cederplank' },
      { h: 2, e: 'el', n: 'bruine suiker' },
      { h: 1, e: 'tl', n: 'zout' },
      { h: 1, e: 'stuks', n: 'citroen (rasp + partjes)' },
      { h: null, e: '', n: 'verse dille' },
    ],
    stappen: [
      { k: 'Plank weken', t: 'Leg de plank minstens een uur onder water.', timer: 60 },
      { k: 'Kruiden', t: 'Meng suiker, zout en citroenrasp; verdeel over de zalm.' },
      { k: 'Indirect op 160°', t: 'Plank eerst 3 minuten boven de kolen tot hij kraakt en rookt, dan naar de koele kant met de zalm erop.' },
      { k: 'Klaar bij 50°', t: 'Dille en citroen erover.', bij: 50 },
    ],
    tips: ['Liever helemaal gaar? 55°.'],
  },
  {
    id: 'lam', naam: 'Lamsbout met knoflook & rozemarijn', cat: 'lam', emoji: '🐑', tijd: '2–2,5 uur', niveau: 2, personen: 6,
    vlees: 'lam', opstelling: 'indirect', gewicht: 2, hout: 'Kers of druivenrank',
    intro: 'Feestelijk, rosé en vol van smaak.',
    ingredienten: [
      { h: 2, e: 'kg', n: 'lamsbout met bot' },
      { h: 4, e: 'tenen', n: 'knoflook in plakjes' },
      { h: 3, e: 'takjes', n: 'rozemarijn' },
      { h: 2, e: 'el', n: 'olijfolie' },
      { h: 1, e: 'el', n: 'grof zout' },
    ],
    stappen: [
      { k: 'Prikken & vullen', t: 'Steek kleine gaatjes in het vlees en stop er knoflook en rozemarijn in. Insmeren met olie en zout.' },
      { k: 'Indirect op 140–150°', t: 'Bout op de koele kant, voeler in het dikste deel.' },
      { k: 'Klaar bij 60°', t: 'Voor rosé. Kort boven de kolen voor een korstje.', bij: 60 },
      { k: 'Rusten', t: '15 minuten onder losse folie.', timer: 15 },
    ],
    tips: [],
  },
  {
    id: 'haas', naam: 'Varkenshaas in spek', cat: 'varken', emoji: '🥓', tijd: '1 uur', niveau: 1, personen: 4,
    vlees: 'haas', opstelling: 'indirect', gewicht: 1, hout: 'Appel',
    intro: 'Snel, makkelijk en altijd raak.',
    ingredienten: [
      { h: 2, e: 'stuks', n: 'varkenshaas' },
      { h: 16, e: 'plakjes', n: 'ontbijtspek' },
      { h: 2, e: 'el', n: 'BBQ-rub' },
      { h: 3, e: 'el', n: 'BBQ-saus (glazuur)' },
    ],
    stappen: [
      { k: 'Rub & spek', t: 'Rub erover en omwikkelen met spek, eindjes onder.' },
      { k: 'Indirect op 150°', t: 'Haas op de koele kant.' },
      { k: 'Glazuren bij 58°', t: 'Saus erop smeren.', bij: 58 },
      { k: 'Klaar bij 62°', t: 'Even boven de kolen om het spek krokant te maken.', bij: 62 },
      { k: 'Rusten', t: '5 minuten rusten.', timer: 5 },
    ],
    tips: [],
  },
  {
    id: 'moinks', naam: 'Moink balls', cat: 'rund', emoji: '🧆', tijd: '1,5 uur', niveau: 1, personen: 6,
    vlees: 'worst', opstelling: 'lowslow', gewicht: 0.8, hout: 'Kers',
    intro: '"Moo" + "oink": gehaktballetjes in spek. Perfecte snack tijdens een lange cook.',
    ingredienten: [
      { h: 800, e: 'g', n: 'rundergehakt' },
      { h: 24, e: 'plakjes', n: 'ontbijtspek (gehalveerd)' },
      { h: 2, e: 'el', n: 'BBQ-rub' },
      { h: 150, e: 'ml', n: 'BBQ-saus' },
    ],
    stappen: [
      { k: 'Draaien', t: 'Draai balletjes van ± 30 g, rub erover, half plakje spek eromheen met een prikker.' },
      { k: 'Roken op 120°', t: 'Indirect, voeler in één balletje.' },
      { k: 'Glazuren bij 65°', t: 'In de saus dopen.', bij: 65 },
      { k: 'Klaar bij 72°', t: 'Laat de saus nog 10 minuten plakkerig worden.', bij: 72 },
    ],
    tips: [],
  },
  // ---------- Rubs & sauzen ----------
  {
    id: 'memphis', naam: 'Memphis rub', cat: 'rub', emoji: '🌶️', tijd: '5 min', niveau: 1, personen: 8,
    intro: 'Zoete, rode allround-rub voor varken en kip. Genoeg voor ± 3 kg vlees.',
    ingredienten: [
      { h: 4, e: 'el', n: 'paprikapoeder (zoet)' },
      { h: 3, e: 'el', n: 'bruine suiker' },
      { h: 1, e: 'el', n: 'gerookt paprikapoeder' },
      { h: 1, e: 'el', n: 'zout' },
      { h: 1, e: 'el', n: 'zwarte peper' },
      { h: 1, e: 'el', n: 'knoflookpoeder' },
      { h: 1, e: 'el', n: 'uienpoeder' },
      { h: 1, e: 'tl', n: 'mosterdpoeder' },
      { h: 0.5, e: 'tl', n: 'cayennepeper' },
    ],
    stappen: [{ k: 'Mengen', t: 'Alles goed mengen, klontjes suiker fijnwrijven. Luchtdicht bewaren (± 3 maanden).' }],
    tips: [],
  },
  {
    id: 'spg', naam: 'Texas SPG', cat: 'rub', emoji: '🧂', tijd: '2 min', niveau: 1, personen: 8,
    intro: 'Salt, Pepper, Garlic. Meer heb je niet nodig voor rund.',
    ingredienten: [
      { h: 4, e: 'el', n: 'grof zout' },
      { h: 4, e: 'el', n: 'grof gemalen zwarte peper (16 mesh)' },
      { h: 1, e: 'el', n: 'grof knoflookgranulaat' },
    ],
    stappen: [{ k: 'Mengen', t: 'Mengen in een strooibus. Op gewicht: gelijke delen zout en peper.' }],
    tips: [],
  },
  {
    id: 'saus', naam: 'Kansas City BBQ-saus', cat: 'rub', emoji: '🥫', tijd: '25 min', niveau: 1, personen: 8,
    intro: 'Dikke, zoete saus met een rokerig randje.',
    ingredienten: [
      { h: 400, e: 'ml', n: 'ketchup' },
      { h: 80, e: 'ml', n: 'appelciderazijn' },
      { h: 80, e: 'g', n: 'bruine suiker' },
      { h: 2, e: 'el', n: 'melasse of stroop' },
      { h: 1, e: 'el', n: 'worcestershiresaus' },
      { h: 1, e: 'el', n: 'Memphis rub' },
      { h: 1, e: 'tl', n: 'gerookt paprikapoeder' },
      { h: 25, e: 'g', n: 'boter' },
    ],
    stappen: [
      { k: 'Inkoken', t: 'Alles in een pan, aan de kook brengen en 20 minuten zacht laten pruttelen. Af en toe roeren.', timer: 20 },
      { k: 'Bewaren', t: 'Afkoelen en in een fles; houdbaar ± 3 weken in de koelkast.' },
    ],
    tips: [],
  },
  {
    id: 'spritz', naam: 'Spritz & mop', cat: 'rub', emoji: '💧', tijd: '2 min', niveau: 1, personen: 8,
    intro: 'Om de bark vochtig en het vlees sappig te houden.',
    ingredienten: [
      { h: 125, e: 'ml', n: 'appelsap' },
      { h: 125, e: 'ml', n: 'appelciderazijn' },
      { h: 1, e: 'el', n: 'worcestershiresaus' },
    ],
    stappen: [{ k: 'Mengen', t: 'In een plantenspuit. Na 3 uur roken elk uur licht spritzen.' }],
    tips: [],
  },
  // ---------- Bijgerechten ----------
  {
    id: 'coleslaw', naam: 'Coleslaw', cat: 'bij', emoji: '🥬', tijd: '15 min', niveau: 1, personen: 6,
    intro: 'Fris en krokant: hoort bij pulled pork.',
    ingredienten: [
      { h: 0.5, e: 'stuks', n: 'witte kool, fijn gesneden' },
      { h: 0.25, e: 'stuks', n: 'rode kool, fijn gesneden' },
      { h: 2, e: 'stuks', n: 'wortels, geraspt' },
      { h: 150, e: 'ml', n: 'mayonaise' },
      { h: 2, e: 'el', n: 'appelciderazijn' },
      { h: 1, e: 'el', n: 'suiker' },
      { h: 1, e: 'tl', n: 'mosterd' },
    ],
    stappen: [
      { k: 'Dressing', t: 'Mayonaise, azijn, suiker en mosterd mengen, op smaak met zout en peper.' },
      { k: 'Mengen', t: 'Groente erdoor, minstens 30 minuten in de koelkast.', timer: 30 },
    ],
    tips: [],
  },
  {
    id: 'mac', naam: 'Gerookte mac & cheese', cat: 'bij', emoji: '🧀', tijd: '1 uur', niveau: 1, personen: 6,
    opstelling: 'indirect', intro: 'Gaat mee de BBQ in naast het vlees.',
    ingredienten: [
      { h: 400, e: 'g', n: 'macaroni' },
      { h: 300, e: 'g', n: 'cheddar, geraspt' },
      { h: 150, e: 'g', n: 'goudse kaas, geraspt' },
      { h: 400, e: 'ml', n: 'melk' },
      { h: 200, e: 'ml', n: 'room' },
      { h: 40, e: 'g', n: 'boter' },
      { h: 2, e: 'el', n: 'bloem' },
      { h: 1, e: 'tl', n: 'gerookt paprikapoeder' },
    ],
    stappen: [
      { k: 'Pasta', t: 'Macaroni 2 minuten korter koken dan op het pak.' },
      { k: 'Kaassaus', t: 'Roux van boter en bloem, melk en room erbij, dan 2/3 van de kaas.' },
      { k: 'De BBQ in', t: 'Mengen in een ovenschaal, rest kaas en paprika erover. 40 minuten indirect op 150–175°.', timer: 40 },
    ],
    tips: [],
  },
  ...MEER,
];

/** Hoeveelheid netjes afronden na omrekenen (met ¼ ½ ¾). */
const HELE = /^(el|tl|stuks?|tenen|takjes|plakjes|racks?|rol|blik)$/i;
export function hoeveel(h, factor, eenheid = '') {
  if (h == null) return '';
  let x = h * factor;
  if (HELE.test(eenheid) && x < 10) x = Math.max(0.5, Math.round(x * 2) / 2); // lepels/stuks: op halven
  if (x >= 100) return String(Math.round(x / 5) * 5);
  if (x >= 10) return String(Math.round(x));
  const kwart = Math.round(x * 4) / 4;
  if (Math.abs(kwart - x) < 0.07 && x < 5) {
    const heel = Math.floor(kwart), rest = { 0: '', 0.25: '¼', 0.5: '½', 0.75: '¾' }[kwart - heel];
    return heel ? `${heel}${rest}` : rest || '0';
  }
  return x.toLocaleString('nl-NL', { maximumFractionDigits: 1 });
}
