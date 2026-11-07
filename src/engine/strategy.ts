/**
 * Rule-dependent basic strategy generation and full-round expected value.
 *
 * The total-dependent basic strategy is *derived* from the exact EV engine:
 * for every table cell (hand class × dealer upcard) the EVs of all allowed actions
 * are aggregated over every two-card composition that forms this hand class,
 * weighted by its probability (conditional on "dealer has no blackjack" where the
 * decision is taken after the peek). The action with the highest aggregated EV wins.
 * Nothing is copied from a printed chart.
 */
import { ACE, TEN, IDX_LABEL, fullShoe, idxValue, INFINITE_PROBS } from './cards';
import { Action, ACTIONS, EVBasis, EVEngine, HandContext, softTotal } from './ev';
import { Rules, rulesKey } from './rules';

export type Code = 'H' | 'S' | 'Dh' | 'Ds' | 'P' | 'Rh' | 'Rs' | 'Rp';

export const CODE_INFO: Record<Code, { label: string; long: string }> = {
  H: { label: 'H', long: 'Hit – Karte ziehen' },
  S: { label: 'S', long: 'Stand – stehen bleiben' },
  Dh: { label: 'Dh', long: 'Double, sonst Hit' },
  Ds: { label: 'Ds', long: 'Double, sonst Stand' },
  P: { label: 'P', long: 'Split' },
  Rh: { label: 'Rh', long: 'Surrender, sonst Hit' },
  Rs: { label: 'Rs', long: 'Surrender, sonst Stand' },
  Rp: { label: 'Rp', long: 'Surrender, sonst Split' },
};

/** Display order of the dealer upcards: 2..9, 10, A (value indices). */
export const UP_ORDER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

export interface Cell {
  code: Code;
  best: Action;
  /** Aggregated EV per allowed action on the decision basis. */
  evs: Partial<Record<Action, number>>;
  basis: EVBasis;
  /** EV advantage of the best over the second best action (per unit). */
  margin: number;
  second: Action | null;
}

export interface CompResult {
  up: number;
  a: number;
  b: number;
  /** probability of this (upcard, composition) deal */
  prob: number;
  /** pre-peek EV per action (unconditional, used for house edge) */
  uncond: Partial<Record<Action, number>>;
  /** EV on the decision basis */
  evs: Partial<Record<Action, number>>;
  basis: EVBasis;
  best: Action;
  playerBJ: boolean;
  bjEV?: number;
  /** P(no dealer BJ | cards) used as conditional weight */
  mass: number;
}

export interface StrategyTable {
  key: string;
  rules: Rules;
  deckModel: 'finite' | 'infinite';
  /** cells indexed [total][upIndex] */
  hard: Record<number, Cell[]>;
  soft: Record<number, Cell[]>;
  /** pairs indexed by pair value index */
  pairs: Record<number, Cell[]>;
  comps: CompResult[];
  /** House edge (positive = casino advantage) in percent of the initial bet. */
  houseEdge: { cdOptimal: number; tdBasic: number };
  /** Player EV per round in units (negative = player disadvantage). */
  playerEV: { cdOptimal: number; tdBasic: number };
  computeMs: number;
  method: string;
}

function argmax(evs: Partial<Record<Action, number>>, exclude: Action[] = []): Action | null {
  let best: Action | null = null;
  for (const a of ACTIONS) {
    if (exclude.includes(a)) continue;
    const v = evs[a];
    if (v === undefined) continue;
    if (best === null || v > (evs[best] as number) + 1e-12) best = a;
  }
  return best;
}

export function codeFromEvs(evs: Partial<Record<Action, number>>): { code: Code; best: Action; second: Action | null; margin: number } {
  const best = argmax(evs) as Action;
  const second = argmax(evs, [best]);
  const margin = second ? (evs[best] as number) - (evs[second] as number) : Infinity;
  let code: Code;
  const hitOrStand = (): 'h' | 's' => ((evs.hit ?? -Infinity) > (evs.stand ?? -Infinity) ? 'h' : 's');
  switch (best) {
    case 'double':
      code = hitOrStand() === 'h' ? 'Dh' : 'Ds';
      break;
    case 'surrender': {
      const alt = argmax(evs, ['surrender', 'double']);
      code = alt === 'split' ? 'Rp' : alt === 'hit' ? 'Rh' : 'Rs';
      break;
    }
    case 'split':
      code = 'P';
      break;
    case 'hit':
      code = 'H';
      break;
    default:
      code = 'S';
  }
  return { code, best, second, margin };
}

/** Resolve a table code for a concrete situation (which actions are possible now). */
export function resolveCode(
  code: Code,
  can: { double: boolean; split: boolean; surrender: boolean },
  fallbackHS: 'H' | 'S',
): Action {
  switch (code) {
    case 'H':
      return 'hit';
    case 'S':
      return 'stand';
    case 'Dh':
      return can.double ? 'double' : 'hit';
    case 'Ds':
      return can.double ? 'double' : 'stand';
    case 'P':
      return can.split ? 'split' : fallbackHS === 'H' ? 'hit' : 'stand';
    case 'Rh':
      return can.surrender ? 'surrender' : 'hit';
    case 'Rs':
      return can.surrender ? 'surrender' : 'stand';
    case 'Rp':
      return can.surrender ? 'surrender' : can.split ? 'split' : fallbackHS === 'H' ? 'hit' : 'stand';
  }
}

export interface GenerateOptions {
  deckModel?: 'finite' | 'infinite';
  /** custom shoe composition (composition-aware analysis) */
  shoe?: number[];
  onProgress?: (done: number, total: number) => void;
  /** see EVEngine.splitDepthCap */
  splitDepthCap?: number;
}

/** Generate the complete rule-dependent strategy table + full-round EVs. */
export function generateStrategy(rules: Rules, opts: GenerateOptions = {}): StrategyTable {
  const t0 = Date.now();
  const deckModel = opts.deckModel ?? 'finite';
  const shoe = opts.shoe ?? fullShoe(rules.decks);
  const engine = new EVEngine(rules, deckModel === 'infinite' ? 'infinite' : shoe, { splitDepthCap: opts.splitDepthCap });
  const N = shoe.reduce((a, b) => a + b, 0);
  const comps: CompResult[] = [];
  const total = 10 * 55;
  let done = 0;

  for (let up = 0; up < 10; up++) {
    const pUp = deckModel === 'infinite' ? INFINITE_PROBS[up] : shoe[up] / N;
    const c = shoe.slice();
    if (deckModel === 'finite') c[up]--;
    const n1 = N - 1;
    for (let a = 0; a < 10; a++) {
      for (let b = a; b < 10; b++) {
        let pComp: number;
        if (deckModel === 'infinite') {
          pComp = a === b ? INFINITE_PROBS[a] ** 2 : 2 * INFINITE_PROBS[a] * INFINITE_PROBS[b];
        } else {
          pComp = a === b ? (c[a] * (c[a] - 1)) / (n1 * (n1 - 1)) : (2 * c[a] * c[b]) / (n1 * (n1 - 1));
        }
        done++;
        if (pComp <= 0 || pUp <= 0) continue;
        const prob = pUp * pComp;
        const playerBJ = (a === ACE && b === TEN) || (a === TEN && b === ACE);
        const ctx: HandContext = { up, hand: [a, b] };
        if (playerBJ) {
          const ins = engine.insuranceEV(up, [a, b]);
          // P(dealer BJ | cards): ten in the hole for A up, ace for T up
          let pD = 0;
          if (up === ACE) pD = ins.pTen;
          if (up === TEN) pD = deckModel === 'infinite' ? INFINITE_PROBS[ACE] : (c[ACE] - (a === ACE || b === ACE ? 1 : 0)) / (n1 - 2);
          comps.push({ up, a, b, prob, uncond: {}, evs: {}, basis: 'unconditional', best: 'stand', playerBJ: true, bjEV: (1 - pD) * rules.bjPayout, mass: 1 - pD });
          continue;
        }
        const raw = engine.rawActions(ctx);
        const basis = engine.basisFor(ctx);
        const evs: Partial<Record<Action, number>> = {};
        for (const r of engine.normalize(raw, basis, ctx)) evs[r.action] = r.ev;
        const uncond: Partial<Record<Action, number>> = {};
        for (const r of engine.normalize(raw, 'unconditional', ctx)) uncond[r.action] = r.ev;
        const best = argmax(evs) as Action;
        comps.push({ up, a, b, prob, uncond, evs, basis, best, playerBJ: false, mass: raw.mass });
      }
      opts.onProgress?.(done, total);
    }
  }

  // ---- aggregate into total-dependent cells
  const byUp = (up: number) => comps.filter((x) => x.up === up && !x.playerBJ);
  const hard: Record<number, Cell[]> = {};
  const soft: Record<number, Cell[]> = {};
  const pairs: Record<number, Cell[]> = {};

  const aggregate = (list: CompResult[], drop: Action[] = []): Cell => {
    const acc: Partial<Record<Action, number>> = {};
    const wsum: Partial<Record<Action, number>> = {};
    let basis: EVBasis = 'conditional';
    for (const x of list) {
      basis = x.basis;
      const w = x.basis === 'conditional' ? x.prob * x.mass : x.prob;
      for (const a of ACTIONS) {
        if (drop.includes(a)) continue;
        const v = x.evs[a];
        if (v === undefined) continue;
        acc[a] = (acc[a] ?? 0) + w * v;
        wsum[a] = (wsum[a] ?? 0) + w;
      }
    }
    const evs: Partial<Record<Action, number>> = {};
    for (const a of ACTIONS) if (acc[a] !== undefined && (wsum[a] as number) > 0) evs[a] = (acc[a] as number) / (wsum[a] as number);
    const { code, best, second, margin } = codeFromEvs(evs);
    return { code, best, second, margin, evs, basis };
  };

  for (let up = 0; up < 10; up++) {
    const list = byUp(up);
    for (let t = 4; t <= 20; t++) {
      let sel = list.filter((x) => x.a !== ACE && x.b !== ACE && x.a !== x.b && idxValue(x.a) + idxValue(x.b) === t);
      let drop: Action[] = [];
      if (sel.length === 0) {
        sel = list.filter((x) => x.a !== ACE && x.a === x.b && idxValue(x.a) * 2 === t);
        drop = ['split'];
      }
      if (sel.length === 0) continue;
      (hard[t] ??= [])[up] = aggregate(sel, drop);
    }
    for (let x = 1; x <= 8; x++) {
      const sel = list.filter((y) => y.a === ACE && y.b === x);
      (soft[13 + x - 1] ??= [])[up] = aggregate(sel);
    }
    for (let p = 0; p < 10; p++) {
      const sel = list.filter((y) => y.a === p && y.b === p);
      if (sel.length) (pairs[p] ??= [])[up] = aggregate(sel);
    }
    // soft 12 (A,A that may not be split any more)
    const aa = list.filter((y) => y.a === ACE && y.b === ACE);
    if (aa.length) (soft[12] ??= [])[up] = aggregate(aa, ['split']);
  }
  // hard 21 (multi-card only) and soft 21: always stand; computed for a representative hand
  for (let up = 0; up < 10; up++) {
    const ctxH: HandContext = { up, hand: [TEN, 8, 1] };
    const ctxS: HandContext = { up, hand: [ACE, 4, 5] };
    for (const [ctx, target] of [
      [ctxH, hard],
      [ctxS, soft],
    ] as const) {
      try {
        const ev = engine.evaluate(ctx);
        const evs: Partial<Record<Action, number>> = {};
        for (const r of ev.actions) evs[r.action] = r.ev;
        const { code, best, second, margin } = codeFromEvs(evs);
        (target[21] ??= [])[up] = { code, best, second, margin, evs, basis: ev.basis };
      } catch {
        /* composition impossible (e.g. tiny custom shoe) */
      }
    }
  }

  // ---- full-round EV
  let evCD = 0;
  let evTD = 0;
  for (const x of comps) {
    if (x.playerBJ) {
      evCD += x.prob * (x.bjEV as number);
      evTD += x.prob * (x.bjEV as number);
      continue;
    }
    // decisions are taken on the decision basis; translate to the unconditional value of that decision
    const cdAction = x.best;
    evCD += x.prob * (x.uncond[cdAction] as number);
    const cell = cellFor({ hard, soft, pairs }, x.a, x.b, x.up);
    let tdAction: Action = 'stand';
    if (cell) {
      tdAction = resolveCode(
        cell.code,
        { double: x.uncond.double !== undefined, split: x.uncond.split !== undefined, surrender: x.uncond.surrender !== undefined },
        x.uncond.hit !== undefined && (x.evs.hit ?? -9) > (x.evs.stand ?? -9) ? 'H' : 'S',
      );
      if (x.uncond[tdAction] === undefined) tdAction = 'stand';
    }
    evTD += x.prob * (x.uncond[tdAction] as number);
  }

  return {
    key: rulesKey(rules) + '|' + deckModel + (opts.shoe ? '|custom' : ''),
    rules,
    deckModel,
    hard,
    soft,
    pairs,
    comps,
    houseEdge: { cdOptimal: -evCD * 100, tdBasic: -evTD * 100 },
    playerEV: { cdOptimal: evCD, tdBasic: evTD },
    computeMs: Date.now() - t0,
    method:
      deckModel === 'infinite'
        ? 'Exakte Rekursion, unendliches Deck (konstante Kartenwahrscheinlichkeiten)'
        : 'Exakte kombinatorische Rekursion ohne Zurücklegen (Split: Standard-Näherung für Kartenentnahme der Nachbarhände)',
  };
}

/** Table cell for a two-card composition. */
export function cellFor(
  t: Pick<StrategyTable, 'hard' | 'soft' | 'pairs'>,
  a: number,
  b: number,
  up: number,
): Cell | undefined {
  if (a === b) return t.pairs[a]?.[up];
  if (a === ACE || b === ACE) {
    const x = a === ACE ? b : a;
    return t.soft[11 + idxValue(x)]?.[up];
  }
  return t.hard[idxValue(a) + idxValue(b)]?.[up];
}

/** Table cell for an arbitrary hand total (multi-card hands): hard or soft row. */
export function cellForTotal(t: Pick<StrategyTable, 'hard' | 'soft'>, hardSum: number, hasAce: boolean, up: number): Cell | undefined {
  const total = softTotal(hardSum, hasAce);
  const soft = hasAce && hardSum + 10 <= 21;
  if (soft) return t.soft[Math.max(13, total)]?.[up] ?? t.soft[total]?.[up];
  const row = Math.max(4, Math.min(21, total));
  return t.hard[row]?.[up] ?? (row >= 17 ? t.hard[17]?.[up] : t.hard[5]?.[up]);
}

export function pairLabel(p: number): string {
  return `${IDX_LABEL[p]},${IDX_LABEL[p]}`;
}
