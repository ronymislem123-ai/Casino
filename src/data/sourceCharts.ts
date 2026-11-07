/**
 * Transcribed source strategy charts.
 *
 * Images 1-5 were supplied by the user in the chat on 2026-11-07 as low-resolution
 * pictures (roughly 230×340 px). They were transcribed visually. Cells whose colour or
 * symbol could not be read with certainty are stored as '?' (unreadable) — they are
 * NOT guessed and are excluded from every comparison. `notes` lists what each
 * uncertain cell looked like, so a reader can re-check it against a sharper original.
 *
 * Wizard of Odds charts were read from the original chart images
 * https://wizardofodds.com/blackjack/images/bj_4d_s17.gif and bj_4d_h17.gif
 * (page "4-Deck to 8-Deck Blackjack Strategy", last updated Aug 03, 2026, retrieved 2026-11-07).
 *
 * Column order of every row: dealer 2, 3, 4, 5, 6, 7, 8, 9, 10, A.
 */
import type { Rules } from '../engine/rules';

/** Canonical source codes (what the chart literally says). */
export type SrcCode = 'H' | 'S' | 'D' | 'Dh' | 'Ds' | 'P' | 'Ph' | 'R' | 'Rh' | 'Rs' | 'Rp' | '?';

export interface SrcRow {
  /** label as printed */
  label: string;
  kind: 'hard' | 'soft' | 'pair';
  /** hard/soft totals covered by the row, or the pair value index (0 = A, 9 = ten) */
  keys: number[];
  cells: SrcCode[];
}

export interface SourceChart {
  id: string;
  title: string;
  origin: string;
  /** legend: printed symbol -> canonical code + meaning */
  legend: { symbol: string; code: SrcCode; meaning: string }[];
  /** rules the chart states explicitly (heading/legend) */
  statedRules: string;
  /** rules assumed for the comparison (best documented guess, see analysis doc) */
  assumedRules: Partial<Rules>;
  rows: SrcRow[];
  notes: string[];
  confidence: 'hoch' | 'mittel' | 'niedrig';
}

function parse(cells: string, map: Record<string, SrcCode>): SrcCode[] {
  const out = cells
    .trim()
    .split(/\s+/)
    .map((s) => {
      const c = map[s];
      if (!c) throw new Error(`Unbekanntes Symbol ${s}`);
      return c;
    });
  if (out.length !== 10) throw new Error(`Zeile hat ${out.length} statt 10 Zellen: ${cells}`);
  return out;
}

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

// ---------------------------------------------------------------- Image 1 (French)
const FR: Record<string, SrcCode> = { T: 'H', R: 'S', D: 'D', P: 'P', '?': '?' };
const img1: SourceChart = {
  id: 'img1-fr',
  title: 'Bild 1 – Französische Tabelle („Joueur / Groupier“)',
  origin: 'Vom Nutzer bereitgestelltes Bild 1 (Chat, 2026-11-07), niedrige Auflösung.',
  legend: [
    { symbol: 'T', code: 'H', meaning: 'Tirer = Hit (grün)' },
    { symbol: 'R', code: 'S', meaning: 'Rester = Stand (rot)' },
    { symbol: 'D', code: 'D', meaning: 'Doubler = Double (blau), Ersatzaktion nicht angegeben' },
    { symbol: 'P', code: 'P', meaning: 'Partager = Split (orange)' },
  ],
  statedRules: 'Keine Regelangaben auf dem Bild (keine Deckzahl, kein H17/S17, keine Surrender-Spalte).',
  assumedRules: { decks: 6, h17: false, das: true, surrender: 'none' },
  rows: [
    { label: '17+', kind: 'hard', keys: range(17, 21), cells: parse('R R R R R R R R R R', FR) },
    { label: '16', kind: 'hard', keys: [16], cells: parse('R R R R R T T T T T', FR) },
    { label: '15', kind: 'hard', keys: [15], cells: parse('R R R R R T T T T T', FR) },
    { label: '14', kind: 'hard', keys: [14], cells: parse('R R R R R T T T T T', FR) },
    { label: '13', kind: 'hard', keys: [13], cells: parse('R R R R R T T T T T', FR) },
    { label: '12', kind: 'hard', keys: [12], cells: parse('T T R R R T T T T T', FR) },
    { label: '11', kind: 'hard', keys: [11], cells: parse('D D D D D D D D ? ?', FR) },
    { label: '10', kind: 'hard', keys: [10], cells: parse('D D D D D D D D T T', FR) },
    { label: '9', kind: 'hard', keys: [9], cells: parse('T D D D D T T T T T', FR) },
    { label: '8', kind: 'hard', keys: [8], cells: parse('T T T T T T T T T T', FR) },
    { label: '7', kind: 'hard', keys: [7], cells: parse('T T T T T T T T T T', FR) },
    { label: '6', kind: 'hard', keys: [6], cells: parse('T T T T T T T T T T', FR) },
    { label: '5', kind: 'hard', keys: [5], cells: parse('T T T T T T T T T T', FR) },
    { label: 'A-A', kind: 'pair', keys: [0], cells: parse('P P P P P P P P P ?', FR) },
    { label: '10-10', kind: 'pair', keys: [9], cells: parse('R R R R R R R R R R', FR) },
    { label: '9-9', kind: 'pair', keys: [8], cells: parse('P P P P P R P P R R', FR) },
    { label: '8-8', kind: 'pair', keys: [7], cells: parse('P P P P P P P P ? ?', FR) },
    { label: '7-7', kind: 'pair', keys: [6], cells: parse('P P P P P P T T T T', FR) },
    { label: '6-6', kind: 'pair', keys: [5], cells: parse('P P P P P T T T T T', FR) },
    { label: '5-5', kind: 'pair', keys: [4], cells: parse('D D D D D D D D T T', FR) },
    { label: '4-4', kind: 'pair', keys: [3], cells: parse('T T T P P T T T T T', FR) },
    { label: '3-3', kind: 'pair', keys: [2], cells: parse('P P P P P P T T T T', FR) },
    { label: '2-2', kind: 'pair', keys: [1], cells: parse('P P P P P P T T T T', FR) },
    { label: 'A-9', kind: 'soft', keys: [20], cells: parse('R R R R R R R R R R', FR) },
    { label: 'A-8', kind: 'soft', keys: [19], cells: parse('R R R R R R R R R R', FR) },
    { label: 'A-7', kind: 'soft', keys: [18], cells: parse('R D D D D R R T T T', FR) },
    { label: 'A-6', kind: 'soft', keys: [17], cells: parse('T D D D D T T T T T', FR) },
    { label: 'A-5', kind: 'soft', keys: [16], cells: parse('T T D D D T T T T T', FR) },
    { label: 'A-4', kind: 'soft', keys: [15], cells: parse('T T D D D T T T T T', FR) },
    { label: 'A-3', kind: 'soft', keys: [14], cells: parse('T T T D D T T T T T', FR) },
    { label: 'A-2', kind: 'soft', keys: [13], cells: parse('T T T D D T T T T T', FR) },
  ],
  notes: [
    'Hard 11 gegen 10 und gegen A: Farbe bei der vorliegenden Auflösung nicht eindeutig (blau = Double oder grün = Tirer). Nicht übernommen.',
    'Paar 8-8 gegen 10 und A: nicht eindeutig (orange = Split oder grün). Bei European No-Hole-Card mit Verlust aller Einsätze wäre Hit optimal, mit Peek Split.',
    'Paar A-A gegen A: nicht eindeutig. Ebenfalls regelabhängig (ENHC vs. Peek).',
    'Zeile A-10 (Blackjack) wird nicht verglichen – keine Entscheidung; die A-Spalte erscheint in abweichender Farbe.',
    '„D“ gibt keine Ersatzaktion an, wenn Verdoppeln nicht erlaubt ist (z. B. Soft 18 mit drei Karten).',
    'Die Beschriftung lautet „Groupier“ (vermutlich Tippfehler für „Croupier“).',
  ],
  confidence: 'mittel',
};

// ---------------------------------------------------------------- Image 2 (H S D P, colour)
const EN: Record<string, SrcCode> = { H: 'H', S: 'S', D: 'D', P: 'P', '?': '?' };
const img2: SourceChart = {
  id: 'img2-hsdp',
  title: 'Bild 2 – Farbtabelle H/S/D/P (Hard · Soft · Pairs)',
  origin: 'Vom Nutzer bereitgestelltes Bild 2 (Chat, 2026-11-07), niedrige Auflösung.',
  legend: [
    { symbol: 'H', code: 'H', meaning: 'Hit' },
    { symbol: 'S', code: 'S', meaning: 'Stand' },
    { symbol: 'D', code: 'D', meaning: 'Double Down (Ersatzaktion nicht angegeben)' },
    { symbol: 'P', code: 'P', meaning: 'Split' },
  ],
  statedRules: 'Keine Regelangaben (keine Deckzahl, kein H17/S17, keine Surrender-Codes).',
  assumedRules: { decks: 6, h17: false, das: true, surrender: 'none' },
  rows: [
    { label: '4-8', kind: 'hard', keys: range(4, 8), cells: parse('H H H H H H H H H H', EN) },
    { label: '9', kind: 'hard', keys: [9], cells: parse('H D D D D H H H H H', EN) },
    { label: '10', kind: 'hard', keys: [10], cells: parse('D D D D D D D D H H', EN) },
    { label: '11', kind: 'hard', keys: [11], cells: parse('D D D D D D D D D ?', EN) },
    { label: '12', kind: 'hard', keys: [12], cells: parse('H H S S S H H H H H', EN) },
    { label: '13', kind: 'hard', keys: [13], cells: parse('S S S S S H H H H H', EN) },
    { label: '14', kind: 'hard', keys: [14], cells: parse('S S S S S H H H H H', EN) },
    { label: '15', kind: 'hard', keys: [15], cells: parse('S S S S S H H H H H', EN) },
    { label: '16', kind: 'hard', keys: [16], cells: parse('S S S S S H H H H H', EN) },
    { label: '17+', kind: 'hard', keys: range(17, 21), cells: parse('S S S S S S S S S S', EN) },
    { label: 'Soft 13', kind: 'soft', keys: [13], cells: parse('H H H D D H H H H H', EN) },
    { label: 'Soft 14', kind: 'soft', keys: [14], cells: parse('H H H D D H H H H H', EN) },
    { label: 'Soft 15', kind: 'soft', keys: [15], cells: parse('H H D D D H H H H H', EN) },
    { label: 'Soft 16', kind: 'soft', keys: [16], cells: parse('H H D D D H H H H H', EN) },
    { label: 'Soft 17', kind: 'soft', keys: [17], cells: parse('H D D D D H H H H H', EN) },
    { label: 'Soft 18', kind: 'soft', keys: [18], cells: parse('? D D D D S S H H H', EN) },
    { label: 'Soft 19+', kind: 'soft', keys: [19, 20], cells: parse('S S S S ? S S S S S', EN) },
    { label: '2,2', kind: 'pair', keys: [1], cells: parse('P P P P P P H H H H', EN) },
    { label: '3,3', kind: 'pair', keys: [2], cells: parse('P P P P P P H H H H', EN) },
    { label: '4,4', kind: 'pair', keys: [3], cells: parse('H H H P P H H H H H', EN) },
    { label: '5,5', kind: 'pair', keys: [4], cells: parse('D D D D D D D D H H', EN) },
    { label: '6,6', kind: 'pair', keys: [5], cells: parse('P P P P P H H H H H', EN) },
    { label: '7,7', kind: 'pair', keys: [6], cells: parse('P P P P P P H H H H', EN) },
    { label: '8,8', kind: 'pair', keys: [7], cells: parse('P P P P P P P P P P', EN) },
    { label: '9,9', kind: 'pair', keys: [8], cells: parse('P P P P P S P P S S', EN) },
    { label: '10,10', kind: 'pair', keys: [9], cells: parse('S S S S S S S S S S', EN) },
    { label: 'A,A', kind: 'pair', keys: [0], cells: parse('P P P P P P P P P P', EN) },
  ],
  notes: [
    'Hard 11 gegen A: nicht eindeutig lesbar (D bei H17, H bei S17 in Mehrdeck-Spielen).',
    'Soft 18 gegen 2 und Soft 19 gegen 6: Grenzzellen, Farbe nicht sicher (bei H17 jeweils Double/Stand).',
    'Die Tabelle unterscheidet nicht zwischen „Double sonst Hit“ und „Double sonst Stand“ (Soft 18).',
    'Split von 2,2/3,3 gegen 2–3 und 6,6 gegen 2 deutet auf Double After Split (DAS) hin.',
  ],
  confidence: 'mittel',
};

// ---------------------------------------------------------------- Image 3 (ST H D SP)
const C3: Record<string, SrcCode> = { ST: 'S', H: 'H', D: 'D', SP: 'P', '?': '?' };
const img3: SourceChart = {
  id: 'img3-card',
  title: 'Bild 3 – „Blackjack Basic Strategy Card“ (ST/H/D/SP)',
  origin: 'Vom Nutzer bereitgestelltes Bild 3 (Chat, 2026-11-07), niedrige Auflösung.',
  legend: [
    { symbol: 'ST', code: 'S', meaning: 'Stand' },
    { symbol: 'H', code: 'H', meaning: 'Hit' },
    { symbol: 'D', code: 'D', meaning: 'Double (Ersatzaktion nicht angegeben)' },
    { symbol: 'SP', code: 'P', meaning: 'Split' },
  ],
  statedRules: 'Keine Regelangaben.',
  assumedRules: { decks: 6, h17: false, das: true, surrender: 'none' },
  rows: [
    { label: '17+', kind: 'hard', keys: range(17, 21), cells: parse('ST ST ST ST ST ST ST ST ST ST', C3) },
    { label: '16', kind: 'hard', keys: [16], cells: parse('ST ST ST ST ST H H H H H', C3) },
    { label: '15', kind: 'hard', keys: [15], cells: parse('ST ST ST ST ST H H H H H', C3) },
    { label: '14', kind: 'hard', keys: [14], cells: parse('ST ST ST ST ST H H H H H', C3) },
    { label: '13', kind: 'hard', keys: [13], cells: parse('ST ST ST ST ST H H H H H', C3) },
    { label: '12', kind: 'hard', keys: [12], cells: parse('H H ST ST ST H H H H H', C3) },
    { label: '11', kind: 'hard', keys: [11], cells: parse('D D D D D D D D D ?', C3) },
    { label: '10', kind: 'hard', keys: [10], cells: parse('D D D D D D D D H H', C3) },
    { label: '9', kind: 'hard', keys: [9], cells: parse('H D D D D H H H H H', C3) },
    { label: '5-8', kind: 'hard', keys: range(5, 8), cells: parse('H H H H H H H H H H', C3) },
    { label: 'A8-10', kind: 'soft', keys: [19, 20], cells: parse('ST ST ST ST ST ST ST ST ST ST', C3) },
    { label: 'A7', kind: 'soft', keys: [18], cells: parse('ST D D D D ST ST H H H', C3) },
    { label: 'A6', kind: 'soft', keys: [17], cells: parse('H D D D D H H H H H', C3) },
    { label: 'A5', kind: 'soft', keys: [16], cells: parse('H H D D D H H H H H', C3) },
    { label: 'A4', kind: 'soft', keys: [15], cells: parse('H H D D D H H H H H', C3) },
    { label: 'A3', kind: 'soft', keys: [14], cells: parse('H H H D D H H H H H', C3) },
    { label: 'A2', kind: 'soft', keys: [13], cells: parse('H H H D D H H H H H', C3) },
    { label: 'A A, 8 8', kind: 'pair', keys: [0, 7], cells: parse('SP SP SP SP SP SP SP SP SP SP', C3) },
    { label: '10 10', kind: 'pair', keys: [9], cells: parse('ST ST ST ST ST ST ST ST ST ST', C3) },
    { label: '9 9', kind: 'pair', keys: [8], cells: parse('SP SP SP SP SP ST SP SP ST ST', C3) },
    { label: '7 7', kind: 'pair', keys: [6], cells: parse('SP SP SP SP SP SP H H H H', C3) },
    { label: '6 6', kind: 'pair', keys: [5], cells: parse('SP SP SP SP SP H H H H H', C3) },
    { label: '5 5', kind: 'pair', keys: [4], cells: parse('D D D D D D D D H H', C3) },
    { label: '4 4', kind: 'pair', keys: [3], cells: parse('H H H SP SP H H H H H', C3) },
    { label: '3 3', kind: 'pair', keys: [2], cells: parse('SP SP SP SP SP SP H H H H', C3) },
    { label: '2 2', kind: 'pair', keys: [1], cells: parse('SP SP SP SP SP SP H H H H', C3) },
  ],
  notes: [
    'Hard 11 gegen A: nicht eindeutig lesbar.',
    'Zeile „A8-10“ umfasst A,10 = Blackjack (keine Entscheidung); verglichen werden nur Soft 19 und 20.',
    'A,7 = D gegen 3–6 ohne Ersatzaktion; bei verbotenem Double wäre Stand richtig (nicht angegeben).',
    'Split 2,2/3,3 gegen 2–3, 4,4 gegen 5–6 und 6,6 gegen 2 setzt Double After Split voraus.',
  ],
  confidence: 'mittel',
};

// ---------------------------------------------------------------- Image 4 (Bayview 4/6/8 decks H17)
const C4: Record<string, SrcCode> = { H: 'H', S: 'S', D: 'Dh', DS: 'Ds', R: 'Rh', RS: 'Rs', '?': '?' };
const img4: SourceChart = {
  id: 'img4-468-h17',
  title: 'Bild 4 – „Blackjack Basic Strategy Chart, 4/6/8 Decks, Dealer Hits Soft 17“ (Kenneth R Smith, Bayview Strategies)',
  origin: 'Vom Nutzer bereitgestelltes Bild 4 (Chat, 2026-11-07). Aufdruck: © 2008-2017 Bayview Strategies, LLC. Paare laut Karte auf der Rückseite – nicht enthalten.',
  legend: [
    { symbol: 'H', code: 'H', meaning: 'Hit' },
    { symbol: 'S', code: 'S', meaning: 'Stand' },
    { symbol: 'D', code: 'Dh', meaning: 'Double (sonst Hit – implizit, da DS separat existiert)' },
    { symbol: 'DS', code: 'Ds', meaning: 'Double, sonst Stand' },
    { symbol: 'R', code: 'Rh', meaning: 'Surrender (sonst Hit – implizit, da RS separat existiert)' },
    { symbol: 'RS', code: 'Rs', meaning: 'Surrender, sonst Stand' },
  ],
  statedRules: '4/6/8 Decks, Dealer zieht auf Soft 17 (Überschrift). Surrender-Codes vorhanden → Late Surrender angenommen. DAS nicht angegeben (Paarteil fehlt).',
  assumedRules: { decks: 6, h17: true, das: true, surrender: 'late' },
  rows: [
    { label: '5-7', kind: 'hard', keys: [5, 6, 7], cells: parse('H H H H H H H H H H', C4) },
    { label: '8', kind: 'hard', keys: [8], cells: parse('H H H H H H H H H H', C4) },
    { label: '9', kind: 'hard', keys: [9], cells: parse('H D D D D H H H H H', C4) },
    { label: '10', kind: 'hard', keys: [10], cells: parse('D D D D D D D D H H', C4) },
    { label: '11', kind: 'hard', keys: [11], cells: parse('D D D D D D D D D D', C4) },
    { label: '12', kind: 'hard', keys: [12], cells: parse('H H S S S H H H H H', C4) },
    { label: '13', kind: 'hard', keys: [13], cells: parse('S S S S S H H H H H', C4) },
    { label: '14', kind: 'hard', keys: [14], cells: parse('S S S S S H H H H H', C4) },
    { label: '15', kind: 'hard', keys: [15], cells: parse('S S S S S H H H R R', C4) },
    { label: '16', kind: 'hard', keys: [16], cells: parse('S S S S S H H R R R', C4) },
    { label: '17', kind: 'hard', keys: [17], cells: parse('S S S S S S S S S RS', C4) },
    { label: 'A,2', kind: 'soft', keys: [13], cells: parse('H H H D D H H H H H', C4) },
    { label: 'A,3', kind: 'soft', keys: [14], cells: parse('H H H D D H H H H H', C4) },
    { label: 'A,4', kind: 'soft', keys: [15], cells: parse('H H D D D H H H H H', C4) },
    { label: 'A,5', kind: 'soft', keys: [16], cells: parse('H H D D D H H H H H', C4) },
    { label: 'A,6', kind: 'soft', keys: [17], cells: parse('H D D D D H H H H H', C4) },
    { label: 'A,7', kind: 'soft', keys: [18], cells: parse('DS DS DS DS DS S S H H H', C4) },
    { label: 'A,8', kind: 'soft', keys: [19], cells: parse('S S S S DS S S S S S', C4) },
    { label: 'A,9', kind: 'soft', keys: [20], cells: parse('S S S S S S S S S S', C4) },
  ],
  notes: [
    'Die Karte ist trotz geringer Auflösung gut lesbar (Text in jeder Zelle).',
    'Hard 18+ ist auf der Karte nicht als eigene Zeile vorhanden (implizit Stand).',
    'Paare stehen laut Aufdruck auf der Rückseite und liegen nicht vor.',
  ],
  confidence: 'hoch',
};

// ---------------------------------------------------------------- Image 5 (blue card)
const C5: Record<string, SrcCode> = { H: 'H', S: 'S', DD: 'D', SP: 'P', '?': '?' };
const img5: SourceChart = {
  id: 'img5-blue',
  title: 'Bild 5 – Blaue Karte „H=HIT S=STAND DD=DOUBLE SP=SPLIT“',
  origin: 'Vom Nutzer bereitgestelltes Bild 5 (Chat, 2026-11-07), niedrige Auflösung, kleine Schrift.',
  legend: [
    { symbol: 'H', code: 'H', meaning: 'Hit' },
    { symbol: 'S', code: 'S', meaning: 'Stand' },
    { symbol: 'DD', code: 'D', meaning: 'Double (Ersatzaktion nicht angegeben)' },
    { symbol: 'SP', code: 'P', meaning: 'Split' },
  ],
  statedRules: 'Keine Regelangaben.',
  assumedRules: { decks: 1, h17: false, das: false, surrender: 'none' },
  rows: [
    { label: '8-3', kind: 'hard', keys: range(5, 8), cells: parse('H H H H H H H H H H', C5) },
    { label: '9', kind: 'hard', keys: [9], cells: parse('H DD DD DD DD H H H H H', C5) },
    { label: '10', kind: 'hard', keys: [10], cells: parse('DD DD DD DD DD DD DD DD H H', C5) },
    { label: '11', kind: 'hard', keys: [11], cells: parse('DD DD DD DD DD DD DD DD DD ?', C5) },
    { label: '12', kind: 'hard', keys: [12], cells: parse('H H S S S H H H H H', C5) },
    { label: '13', kind: 'hard', keys: [13], cells: parse('S S S S S H H H H H', C5) },
    { label: '14', kind: 'hard', keys: [14], cells: parse('S S S S S H H H H H', C5) },
    { label: '15', kind: 'hard', keys: [15], cells: parse('S S S S S H H H H H', C5) },
    { label: '16', kind: 'hard', keys: [16], cells: parse('S S S S S H H H H H', C5) },
    { label: '17', kind: 'hard', keys: [17], cells: parse('S S S S S S S S S S', C5) },
    { label: 'A-2', kind: 'soft', keys: [13], cells: parse('H H ? DD DD H H H H H', C5) },
    { label: 'A-3', kind: 'soft', keys: [14], cells: parse('H H ? DD DD H H H H H', C5) },
    { label: 'A-4', kind: 'soft', keys: [15], cells: parse('H H DD DD DD H H H H H', C5) },
    { label: 'A-5', kind: 'soft', keys: [16], cells: parse('H H DD DD DD H H H H H', C5) },
    { label: 'A-6', kind: 'soft', keys: [17], cells: parse('? DD DD DD DD H H H H H', C5) },
    { label: 'A-7', kind: 'soft', keys: [18], cells: parse('S DD DD DD DD S S H H ?', C5) },
    { label: 'A-8', kind: 'soft', keys: [19], cells: parse('S S S S ? S S S S S', C5) },
    { label: 'A-9', kind: 'soft', keys: [20], cells: parse('S S S S S S S S S S', C5) },
    { label: '2-2', kind: 'pair', keys: [1], cells: parse('? ? SP SP SP SP H H H H', C5) },
    { label: '3-3', kind: 'pair', keys: [2], cells: parse('? ? SP SP SP SP H H H H', C5) },
    { label: '4-4', kind: 'pair', keys: [3], cells: parse('H H H ? ? H H H H H', C5) },
    { label: '5-5', kind: 'pair', keys: [4], cells: parse('DD DD DD DD DD DD DD DD H H', C5) },
    { label: '6-6', kind: 'pair', keys: [5], cells: parse('? SP SP SP SP H H H H H', C5) },
    { label: '7-7', kind: 'pair', keys: [6], cells: parse('SP SP SP SP SP SP H H ? H', C5) },
    { label: '8-8', kind: 'pair', keys: [7], cells: parse('SP SP SP SP SP SP SP SP SP SP', C5) },
    { label: '9-9', kind: 'pair', keys: [8], cells: parse('SP SP SP SP SP S SP SP S S', C5) },
    { label: '10-10', kind: 'pair', keys: [9], cells: parse('S S S S S S S S S S', C5) },
    { label: 'A-A', kind: 'pair', keys: [0], cells: parse('SP SP SP SP SP SP SP SP SP SP', C5) },
  ],
  notes: [
    'Schrift sehr klein; alle Grenzzellen der Double- und Split-Bereiche sind als unsicher markiert.',
    'Die Zeile ist mit „8-3“ beschriftet; Hard 3/4 entstehen nur aus Paaren – verglichen werden Hard 5–8.',
    'Mehrere Muster (A,7 gegen A, 7,7 gegen 10) wären typische Single-Deck-Abweichungen, sind aber nicht sicher lesbar.',
  ],
  confidence: 'niedrig',
};

// ---------------------------------------------------------------- Wizard of Odds reference charts
const WZ: Record<string, SrcCode> = { H: 'H', S: 'S', Dh: 'Dh', Ds: 'Ds', P: 'P', Ph: 'Ph', Rh: 'Rh', Rs: 'Rs', Rp: 'Rp', '?': '?' };
const wizS17: SourceChart = {
  id: 'wizard-48-s17',
  title: 'Wizard of Odds – 4–8 Decks, Dealer Stands on Soft 17',
  origin: 'https://wizardofodds.com/blackjack/images/bj_4d_s17.gif (Seite „4-Deck to 8-Deck Blackjack Strategy“, aktualisiert 03.08.2026, abgerufen 07.11.2026).',
  legend: [
    { symbol: 'Dh', code: 'Dh', meaning: 'Double if allowed, otherwise hit' },
    { symbol: 'Ds', code: 'Ds', meaning: 'Double if allowed, otherwise stand' },
    { symbol: 'Ph', code: 'Ph', meaning: 'Split if double after split is allowed, otherwise hit' },
    { symbol: 'Rh', code: 'Rh', meaning: 'Surrender if allowed, otherwise hit' },
  ],
  statedRules: '4–8 Decks, S17, Peek; DAS/Surrender als bedingte Codes.',
  assumedRules: { decks: 6, h17: false, das: true, surrender: 'late' },
  rows: [
    { label: '4-8', kind: 'hard', keys: range(4, 8), cells: parse('H H H H H H H H H H', WZ) },
    { label: '9', kind: 'hard', keys: [9], cells: parse('H Dh Dh Dh Dh H H H H H', WZ) },
    { label: '10', kind: 'hard', keys: [10], cells: parse('Dh Dh Dh Dh Dh Dh Dh Dh H H', WZ) },
    { label: '11', kind: 'hard', keys: [11], cells: parse('Dh Dh Dh Dh Dh Dh Dh Dh Dh H', WZ) },
    { label: '12', kind: 'hard', keys: [12], cells: parse('H H S S S H H H H H', WZ) },
    { label: '13', kind: 'hard', keys: [13], cells: parse('S S S S S H H H H H', WZ) },
    { label: '14', kind: 'hard', keys: [14], cells: parse('S S S S S H H H H H', WZ) },
    { label: '15', kind: 'hard', keys: [15], cells: parse('S S S S S H H H Rh H', WZ) },
    { label: '16', kind: 'hard', keys: [16], cells: parse('S S S S S H H Rh Rh Rh', WZ) },
    { label: '17+', kind: 'hard', keys: range(17, 21), cells: parse('S S S S S S S S S S', WZ) },
    { label: 'Soft 13', kind: 'soft', keys: [13], cells: parse('H H H Dh Dh H H H H H', WZ) },
    { label: 'Soft 14', kind: 'soft', keys: [14], cells: parse('H H H Dh Dh H H H H H', WZ) },
    { label: 'Soft 15', kind: 'soft', keys: [15], cells: parse('H H Dh Dh Dh H H H H H', WZ) },
    { label: 'Soft 16', kind: 'soft', keys: [16], cells: parse('H H Dh Dh Dh H H H H H', WZ) },
    { label: 'Soft 17', kind: 'soft', keys: [17], cells: parse('H Dh Dh Dh Dh H H H H H', WZ) },
    { label: 'Soft 18', kind: 'soft', keys: [18], cells: parse('S Ds Ds Ds Ds S S H H H', WZ) },
    { label: 'Soft 19+', kind: 'soft', keys: [19, 20], cells: parse('S S S S S S S S S S', WZ) },
    { label: '2,2', kind: 'pair', keys: [1], cells: parse('Ph Ph P P P P H H H H', WZ) },
    { label: '3,3', kind: 'pair', keys: [2], cells: parse('Ph Ph P P P P H H H H', WZ) },
    { label: '4,4', kind: 'pair', keys: [3], cells: parse('H H H Ph Ph H H H H H', WZ) },
    { label: '6,6', kind: 'pair', keys: [5], cells: parse('Ph P P P P H H H H H', WZ) },
    { label: '7,7', kind: 'pair', keys: [6], cells: parse('P P P P P P H H H H', WZ) },
    { label: '8,8', kind: 'pair', keys: [7], cells: parse('P P P P P P P P P P', WZ) },
    { label: '9,9', kind: 'pair', keys: [8], cells: parse('P P P P P S P P S S', WZ) },
    { label: 'A,A', kind: 'pair', keys: [0], cells: parse('P P P P P P P P P P', WZ) },
  ],
  notes: ['Fünfen und Zehnen werden laut Seite als Hard 10/20 gespielt (keine Split-Zeile).'],
  confidence: 'hoch',
};

const wizH17: SourceChart = {
  id: 'wizard-48-h17',
  title: 'Wizard of Odds – 4–8 Decks, Dealer Hits on Soft 17',
  origin: 'https://wizardofodds.com/blackjack/images/bj_4d_h17.gif (Seite „4-Deck to 8-Deck Blackjack Strategy“, aktualisiert 03.08.2026, abgerufen 07.11.2026).',
  legend: wizS17.legend.concat([
    { symbol: 'Rs', code: 'Rs', meaning: 'Surrender if allowed, otherwise stand' },
    { symbol: 'Rp', code: 'Rp', meaning: 'Surrender if allowed, otherwise split' },
  ]),
  statedRules: '4–8 Decks, H17, Peek; DAS/Surrender als bedingte Codes.',
  assumedRules: { decks: 6, h17: true, das: true, surrender: 'late' },
  rows: [
    { label: '4-8', kind: 'hard', keys: range(4, 8), cells: parse('H H H H H H H H H H', WZ) },
    { label: '9', kind: 'hard', keys: [9], cells: parse('H Dh Dh Dh Dh H H H H H', WZ) },
    { label: '10', kind: 'hard', keys: [10], cells: parse('Dh Dh Dh Dh Dh Dh Dh Dh H H', WZ) },
    { label: '11', kind: 'hard', keys: [11], cells: parse('Dh Dh Dh Dh Dh Dh Dh Dh Dh Dh', WZ) },
    { label: '12', kind: 'hard', keys: [12], cells: parse('H H S S S H H H H H', WZ) },
    { label: '13', kind: 'hard', keys: [13], cells: parse('S S S S S H H H H H', WZ) },
    { label: '14', kind: 'hard', keys: [14], cells: parse('S S S S S H H H H H', WZ) },
    { label: '15', kind: 'hard', keys: [15], cells: parse('S S S S S H H H Rh Rh', WZ) },
    { label: '16', kind: 'hard', keys: [16], cells: parse('S S S S S H H Rh Rh Rh', WZ) },
    { label: '17', kind: 'hard', keys: [17], cells: parse('S S S S S S S S S Rs', WZ) },
    { label: '18+', kind: 'hard', keys: range(18, 21), cells: parse('S S S S S S S S S S', WZ) },
    { label: 'Soft 13', kind: 'soft', keys: [13], cells: parse('H H H Dh Dh H H H H H', WZ) },
    { label: 'Soft 14', kind: 'soft', keys: [14], cells: parse('H H H Dh Dh H H H H H', WZ) },
    { label: 'Soft 15', kind: 'soft', keys: [15], cells: parse('H H Dh Dh Dh H H H H H', WZ) },
    { label: 'Soft 16', kind: 'soft', keys: [16], cells: parse('H H Dh Dh Dh H H H H H', WZ) },
    { label: 'Soft 17', kind: 'soft', keys: [17], cells: parse('H Dh Dh Dh Dh H H H H H', WZ) },
    { label: 'Soft 18', kind: 'soft', keys: [18], cells: parse('Ds Ds Ds Ds Ds S S H H H', WZ) },
    { label: 'Soft 19', kind: 'soft', keys: [19], cells: parse('S S S S Ds S S S S S', WZ) },
    { label: 'Soft 20+', kind: 'soft', keys: [20], cells: parse('S S S S S S S S S S', WZ) },
    { label: '2,2', kind: 'pair', keys: [1], cells: parse('Ph Ph P P P P H H H H', WZ) },
    { label: '3,3', kind: 'pair', keys: [2], cells: parse('Ph Ph P P P P H H H H', WZ) },
    { label: '4,4', kind: 'pair', keys: [3], cells: parse('H H H Ph Ph H H H H H', WZ) },
    { label: '6,6', kind: 'pair', keys: [5], cells: parse('Ph P P P P H H H H H', WZ) },
    { label: '7,7', kind: 'pair', keys: [6], cells: parse('P P P P P P H H H H', WZ) },
    { label: '8,8', kind: 'pair', keys: [7], cells: parse('P P P P P P P P P Rp', WZ) },
    { label: '9,9', kind: 'pair', keys: [8], cells: parse('P P P P P S P P S S', WZ) },
    { label: 'A,A', kind: 'pair', keys: [0], cells: parse('P P P P P P P P P P', WZ) },
  ],
  notes: ['Fünfen und Zehnen werden laut Seite als Hard 10/20 gespielt (keine Split-Zeile).'],
  confidence: 'hoch',
};

export const SOURCE_CHARTS: SourceChart[] = [img1, img2, img3, img4, img5, wizS17, wizH17];
