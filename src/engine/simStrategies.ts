/**
 * Playing strategies for the Monte Carlo simulator.
 * All strategies receive identical information (hand, upcard, true count) and must
 * return an allowed action; the simulator enforces the rules regardless.
 */
import type { SourceChart } from '../data/sourceCharts';
import { ACE, TEN } from './cards';
import { FAB_4, ILLUSTRIOUS_18, findIndexPlay } from './counting';
import type { Action } from './ev';
import type { Rules } from './rules';
import { Code, StrategyTable, UP_ORDER } from './strategy';

export interface HandView {
  /** value indices of the hand */
  cards: number[];
  n: number;
  hard: number;
  ace: boolean;
  total: number;
  soft: boolean;
  /** pair value index if the hand consists of two cards of equal value, else -1 */
  pair: number;
  canDouble: boolean;
  canSplit: boolean;
  canSurrender: boolean;
  isSplitHand: boolean;
  handsInRound: number;
}

export interface SimStrategy {
  id: string;
  name: string;
  description: string;
  kind: 'basic' | 'composition' | 'counting' | 'heuristic' | 'custom';
  decide(v: HandView, up: number, tc: number): Action;
  insurance(tc: number): boolean;
  /** bet in units of the base bet (flat = 1) */
  betUnits(tc: number): number;
}

// ---------------------------------------------------------------- compact code tables
const C: Record<Code, number> = { H: 0, S: 1, Dh: 2, Ds: 3, P: 4, Rh: 5, Rs: 6, Rp: 7 };
const CODES: Code[] = ['H', 'S', 'Dh', 'Ds', 'P', 'Rh', 'Rs', 'Rp'];

export interface CompactTable {
  hard: Uint8Array; // [total*10 + up], totals 0..21
  soft: Uint8Array; // [total*10 + up], totals 12..21
  pair: Uint8Array; // [pair*10 + up]
}

export function compactFromTable(t: Pick<StrategyTable, 'hard' | 'soft' | 'pairs'>): CompactTable {
  const hard = new Uint8Array(22 * 10).fill(C.H);
  const soft = new Uint8Array(22 * 10).fill(C.H);
  const pair = new Uint8Array(10 * 10).fill(C.H);
  for (let up = 0; up < 10; up++) {
    for (let tot = 4; tot <= 21; tot++) {
      const c = t.hard[tot]?.[up];
      if (c) hard[tot * 10 + up] = C[c.code];
      else if (tot >= 17) hard[tot * 10 + up] = C.S;
    }
    for (let tot = 12; tot <= 21; tot++) {
      const c = t.soft[tot]?.[up];
      if (c) soft[tot * 10 + up] = C[c.code];
      else if (tot >= 19) soft[tot * 10 + up] = C.S;
    }
    for (let p = 0; p < 10; p++) {
      const c = t.pairs[p]?.[up];
      if (c) pair[p * 10 + up] = C[c.code];
      else {
        // pair not in table (e.g. no splitting allowed): play as total
        const tot = p === ACE ? 12 : 2 * (p + 1);
        pair[p * 10 + up] = p === ACE ? soft[12 * 10 + up] : hard[tot * 10 + up];
      }
    }
  }
  return { hard, soft, pair };
}

/** Code of the row for the total (ignoring pairs). */
function totalCode(t: CompactTable, v: HandView, up: number): number {
  return v.soft ? t.soft[Math.max(12, v.total) * 10 + up] : t.hard[Math.max(4, v.total) * 10 + up];
}

function resolve(t: CompactTable, code: number, v: HandView, up: number): Action {
  switch (code) {
    case 0:
      return 'hit';
    case 1:
      return 'stand';
    case 2:
      return v.canDouble ? 'double' : 'hit';
    case 3:
      return v.canDouble ? 'double' : 'stand';
    case 4:
      return v.canSplit ? 'split' : resolve(t, totalCode(t, v, up), v, up);
    case 5:
      return v.canSurrender ? 'surrender' : 'hit';
    case 6:
      return v.canSurrender ? 'surrender' : 'stand';
    default:
      return v.canSurrender ? 'surrender' : v.canSplit ? 'split' : resolve(t, totalCode(t, v, up), v, up);
  }
}

export function tableDecide(t: CompactTable, v: HandView, up: number): Action {
  const code = v.n === 2 && v.pair >= 0 ? t.pair[v.pair * 10 + up] : totalCode(t, v, up);
  return resolve(t, code, v, up);
}

// ---------------------------------------------------------------- strategies
export function basicStrategy(table: StrategyTable, name = 'Basic Strategy (regelangepasst)', id = 'basic'): SimStrategy {
  const ct = compactFromTable(table);
  return {
    id,
    name,
    description: 'Total-abhängige Basic Strategy, exakt für die eingestellten Regeln berechnet.',
    kind: 'basic',
    decide: (v, up) => tableDecide(ct, v, up),
    insurance: () => false,
    betUnits: () => 1,
  };
}

/** Basic strategy computed for *other* rules (e.g. a generic chart) played in this game. */
export function foreignBasicStrategy(table: StrategyTable, label: string): SimStrategy {
  const s = basicStrategy(table, `Basic Strategy für ${label}`, 'foreign');
  s.description = `Basic Strategy, die für andere Regeln (${label}) berechnet wurde – misst die Kosten einer nicht passenden Tabelle.`;
  return s;
}

/** Two-card composition-dependent strategy: best action for each exact initial composition. */
export function compositionStrategy(table: StrategyTable): SimStrategy {
  const ct = compactFromTable(table);
  const best = new Map<number, Action>();
  for (const c of table.comps) if (!c.playerBJ) best.set(c.up * 100 + c.a * 10 + c.b, c.best);
  return {
    id: 'cd2',
    name: 'Zusammensetzungsabhängig (2 Karten)',
    description: 'Erste Entscheidung nach exakter Zweikarten-Zusammensetzung (CD), danach Basic Strategy.',
    kind: 'composition',
    decide: (v, up) => {
      if (v.n === 2 && !v.isSplitHand && v.handsInRound === 1) {
        const a = Math.min(v.cards[0], v.cards[1]);
        const b = Math.max(v.cards[0], v.cards[1]);
        const act = best.get(up * 100 + a * 10 + b);
        if (act && (act !== 'double' || v.canDouble) && (act !== 'split' || v.canSplit) && (act !== 'surrender' || v.canSurrender)) return act;
      }
      return tableDecide(ct, v, up);
    },
    insurance: () => false,
    betUnits: () => 1,
  };
}

export interface HiLoOptions {
  deviations: boolean;
  /** bet ramp: units by true count floor (index 0 = TC <= 0); last entry = max */
  ramp: number[];
}

export const DEFAULT_RAMP = [1, 1, 2, 4, 6, 8];

export function hiLoStrategy(table: StrategyTable, rules: Rules, opts: HiLoOptions): SimStrategy {
  const ct = compactFromTable(table);
  // 11 vs A is a basic-strategy double under H17 (multi-deck); the published S17 index would contradict it.
  const plays = ILLUSTRIOUS_18.filter((p) => !(rules.h17 && p.id === '11vA'));
  const surr = FAB_4;
  const rampLabel = opts.ramp.join('-');
  return {
    id: opts.deviations ? 'hilo-i18' : 'hilo-bet',
    name: opts.deviations ? `Hi-Lo + I18/Fab4, Spread ${rampLabel}` : `Hi-Lo Einsatzspread ${rampLabel} (nur Basic)`,
    description: opts.deviations
      ? 'Basic Strategy plus Illustrious-18- und Fab-4-Abweichungen nach True Count; Versicherung ab TC +3; Einsatz nach Rampe.'
      : 'Basic Strategy ohne Abweichungen; nur der Einsatz folgt dem True Count.',
    kind: 'counting',
    decide: (v, up, tc) => {
      const base = tableDecide(ct, v, up);
      if (!opts.deviations) return base;
      const info = { hardTotal: v.soft ? null : v.total, pair: v.n === 2 && v.pair >= 0 ? v.pair : null, twoCards: v.n === 2 };
      let surrenderBlocked = false;
      if (v.canSurrender) {
        const f = findIndexPlay(surr, up, info);
        if (f) {
          if (tc >= f.index) return 'surrender';
          surrenderBlocked = true;
        }
      }
      const p = findIndexPlay(plays, up, info);
      if (p) {
        const act = (tc >= p.index ? p.action : p.otherwise) as Action;
        if (act === 'double' && !v.canDouble) return 'hit';
        if (act === 'split' && !v.canSplit) return 'stand';
        if (base === 'surrender' && !surrenderBlocked) return base;
        return act;
      }
      if (base === 'surrender' && surrenderBlocked) {
        const alt = tableDecide(ct, { ...v, canSurrender: false }, up);
        return alt;
      }
      return base;
    },
    insurance: (tc) => opts.deviations && tc >= 3,
    betUnits: (tc) => {
      const i = Math.max(0, Math.min(opts.ramp.length - 1, Math.floor(tc)));
      return opts.ramp[i];
    },
  };
}

export function mimicDealerStrategy(rules: Rules): SimStrategy {
  return {
    id: 'mimic',
    name: 'Dealer imitieren',
    description: 'Ziehen bis 17 wie der Dealer (Soft 17 nach Regel), nie Double/Split/Surrender.',
    kind: 'heuristic',
    decide: (v) => (v.total < 17 || (v.total === 17 && v.soft && rules.h17) ? 'hit' : 'stand'),
    insurance: () => false,
    betUnits: () => 1,
  };
}

export function neverBustStrategy(table: StrategyTable): SimStrategy {
  const ct = compactFromTable(table);
  return {
    id: 'neverbust',
    name: 'Nie überkaufen',
    description: 'Basic Strategy, aber niemals Ziehen/Verdoppeln auf Hard 12 oder mehr.',
    kind: 'heuristic',
    decide: (v, up) => {
      const a = tableDecide(ct, v, up);
      if (!v.soft && v.total >= 12 && (a === 'hit' || a === 'double')) return 'stand';
      return a;
    },
    insurance: () => false,
    betUnits: () => 1,
  };
}

/**
 * Strategy from a source chart. Cells marked '?' and missing rows are filled from the
 * engine table (reported to the user). Unspecified fallbacks ('D', 'R') follow the engine.
 */
export function chartStrategy(chart: SourceChart, table: StrategyTable, rules: Rules): { strategy: SimStrategy; filled: number } {
  const ct = compactFromTable(table);
  const hard = ct.hard.slice();
  const soft = ct.soft.slice();
  const pair = ct.pair.slice();
  let filled = 0;
  for (const row of chart.rows) {
    for (const key of row.keys) {
      row.cells.forEach((src, col) => {
        const up = UP_ORDER[col];
        const arr = row.kind === 'hard' ? hard : row.kind === 'soft' ? soft : pair;
        const idx = key * 10 + up;
        const engineCode = CODES[arr[idx]];
        let code: Code | null = null;
        switch (src) {
          case 'H':
          case 'S':
          case 'Dh':
          case 'Ds':
          case 'P':
          case 'Rh':
          case 'Rs':
          case 'Rp':
            code = src;
            break;
          case 'D':
            code = engineCode === 'Ds' ? 'Ds' : 'Dh';
            break;
          case 'R':
            code = 'Rh';
            break;
          case 'Ph':
            code = rules.das ? 'P' : 'H';
            break;
          default:
            code = null;
        }
        if (code === null) {
          filled++;
          return;
        }
        arr[idx] = C[code];
      });
    }
  }
  const t2: CompactTable = { hard, soft, pair };
  return {
    filled,
    strategy: {
      id: `chart-${chart.id}`,
      name: `Tabelle: ${chart.short}`,
      description: `Gespielt exakt nach der transkribierten Tabelle (${filled} unlesbare Zellen durch die Engine ergänzt).`,
      kind: 'custom',
      decide: (v, up) => tableDecide(t2, v, up),
      insurance: () => false,
      betUnits: () => 1,
    },
  };
}

/** User-defined strategy from a code grid (same layout as the engine table). */
export function customStrategy(codes: CompactTable, name: string): SimStrategy {
  return {
    id: 'custom',
    name,
    description: 'Benutzerdefinierte Strategietabelle.',
    kind: 'custom',
    decide: (v, up) => tableDecide(codes, v, up),
    insurance: () => false,
    betUnits: () => 1,
  };
}

export { CODES as CODE_LIST, C as CODE_INDEX };
export const TEN_IDX = TEN;
