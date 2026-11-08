/**
 * Live decision logic: combines the rule-dependent basic strategy table, the exact
 * composition-dependent evaluation and (optionally) Hi-Lo index plays — and states
 * transparently which of them the recommendation is based on.
 */
import { ACE, RankLabel, rankToIndex } from './cards';
import { FAB_4, ILLUSTRIOUS_18, IndexPlay, findIndexPlay } from './counting';
import type { Action, HandEvaluation } from './ev';
import { HandInfo, classifyHand } from './hand';
import { Rules, doubleAllowedFor } from './rules';
import { Code, resolveCode } from './strategy';

/** Anything with code cells: a full StrategyTable or a precomputed code grid. */
export interface CodeGrid {
  hard: Record<number, { code: Code }[]>;
  soft: Record<number, { code: Code }[]>;
  pairs: Record<number, { code: Code }[]>;
}

export type LiveMode = 'basic' | 'composition' | 'count';

export interface LiveHand {
  cards: RankLabel[];
  isSplit: boolean;
  splitAces: boolean;
  status: 'open' | 'stand' | 'double' | 'surrender' | 'done';
}

export interface Advice {
  state: 'need-cards' | 'need-dealer' | 'blackjack' | 'bust' | 'twentyone' | 'finished' | 'decide';
  info: HandInfo;
  action: Action | null;
  code: Code | null;
  /** concrete action according to the basic strategy table */
  tableAction: Action | null;
  /** best action according to the exact evaluation (if available) */
  exactBest: Action | null;
  can: { double: boolean; split: boolean; surrender: boolean };
  /** fallback action if the recommended action turns out not to be allowed at the table */
  fallback: Action | null;
  basis: string;
  notes: string[];
  indexPlay: IndexPlay | null;
}

export function allowedFor(rules: Rules, hand: LiveHand, info: HandInfo, handIndex: number, handsInRound: number) {
  const n = hand.cards.length;
  const double = n === 2 && doubleAllowedFor(rules, info.total, info.soft) && (!hand.isSplit || rules.das) && (!hand.splitAces || rules.hsa);
  const split = info.type === 'pair' && handsInRound < rules.maxSplitHands && (info.pairValue !== ACE || !hand.isSplit || rules.rsa);
  const surrender = rules.surrender !== 'none' && n === 2 && handIndex === 0 && handsInRound === 1 && !hand.isSplit;
  return { double, split, surrender };
}

function fallbackOf(code: Code, can: { double: boolean; split: boolean; surrender: boolean }): Action | null {
  switch (code) {
    case 'Dh':
      return 'hit';
    case 'Ds':
      return 'stand';
    case 'Rh':
      return 'hit';
    case 'Rs':
      return 'stand';
    case 'Rp':
      return can.split ? 'split' : 'hit';
    default:
      return null;
  }
}

export function adviseHand(p: {
  rules: Rules;
  grid: CodeGrid | null;
  hand: LiveHand;
  handIndex: number;
  handsInRound: number;
  up: number | null;
  mode: LiveMode;
  exact: HandEvaluation | null;
  trueCount: number | null;
}): Advice {
  const { rules, grid, hand, up, mode, exact } = p;
  const info = classifyHand(hand.cards, { rules, isSplitHand: hand.isSplit, canStillSplit: p.handsInRound < rules.maxSplitHands });
  const base: Advice = {
    state: 'decide', info, action: null, code: null, tableAction: null, exactBest: null,
    can: { double: false, split: false, surrender: false }, fallback: null, basis: '', notes: [], indexPlay: null,
  };
  if (hand.cards.length < 2) return { ...base, state: 'need-cards' };
  if (up === null) return { ...base, state: 'need-dealer' };
  if (info.type === 'blackjack') return { ...base, state: 'blackjack' };
  if (info.type === 'bust') return { ...base, state: 'bust' };
  if (hand.status !== 'open') return { ...base, state: 'finished' };
  if (info.total === 21) return { ...base, state: 'twentyone', action: 'stand' };
  if (hand.splitAces && !rules.hsa && !(info.type === 'pair' && rules.rsa)) {
    return { ...base, state: 'finished', notes: ['Split-Asse erhalten nur eine Karte.'] };
  }
  const can = allowedFor(rules, hand, info, p.handIndex, p.handsInRound);
  // ---- table decision
  let code: Code | null = null;
  if (grid) {
    const cards = hand.cards.map(rankToIndex);
    let cell: { code: Code } | undefined;
    if (info.type === 'pair') cell = grid.pairs[info.pairValue as number]?.[up];
    if (!cell || (cell.code === 'P' && !can.split)) {
      if (info.soft) cell = grid.soft[Math.max(12, info.total)]?.[up];
      else cell = grid.hard[Math.max(4, Math.min(21, info.total))]?.[up];
    }
    void cards;
    code = cell?.code ?? null;
  }
  let tableAction: Action | null = null;
  if (code) {
    const hs = ((): 'H' | 'S' => {
      if (!grid) return 'H';
      const row = info.soft ? grid.soft[Math.max(12, info.total)] : grid.hard[Math.max(4, Math.min(21, info.total))];
      const c = row?.[up]?.code;
      return c === 'S' || c === 'Ds' || c === 'Rs' ? 'S' : 'H';
    })();
    tableAction = resolveCode(code, can, hs);
  }
  // ---- exact decision
  const exactBest = exact && !exact.bust && !exact.isBlackjack ? exact.best : null;
  // ---- count decision
  let indexPlay: IndexPlay | null = null;
  let countAction: Action | null = null;
  if (mode === 'count' && p.trueCount !== null && tableAction) {
    const tc = p.trueCount;
    const plays = ILLUSTRIOUS_18.filter((x) => !(rules.h17 && x.id === '11vA'));
    const hinfo = { hardTotal: info.soft ? null : info.total, pair: info.type === 'pair' ? info.pairValue : null, twoCards: hand.cards.length === 2 };
    let blocked = false;
    if (can.surrender) {
      const f = findIndexPlay(FAB_4, up, hinfo);
      if (f) {
        indexPlay = f;
        if (tc >= f.index) countAction = 'surrender';
        else blocked = true;
      }
    }
    if (!countAction) {
      const pl = findIndexPlay(plays, up, hinfo);
      if (pl) {
        indexPlay = pl;
        let a = (tc >= pl.index ? pl.action : pl.otherwise) as Action;
        if (a === 'double' && !can.double) a = 'hit';
        if (a === 'split' && !can.split) a = 'stand';
        countAction = tableAction === 'surrender' && !blocked ? 'surrender' : a;
      } else if (blocked && tableAction === 'surrender') {
        countAction = code === 'Rs' ? 'stand' : 'hit';
      }
    }
  }
  const notes: string[] = [];
  let action: Action | null;
  let basis: string;
  if (mode === 'composition' && exactBest) {
    action = exactBest;
    basis = 'Exakte Berechnung mit allen bekannten Karten (Composition-Aware)';
    if (tableAction && tableAction !== exactBest) notes.push(`Abweichung von der Basic Strategy (Tabelle: ${tableAction.toUpperCase()}) durch die bekannte Schuhzusammensetzung.`);
  } else if (mode === 'count' && countAction) {
    action = countAction;
    basis = `Basic Strategy + Hi-Lo-Index (${indexPlay?.label}, Index ${indexPlay && indexPlay.index > 0 ? '+' : ''}${indexPlay?.index})`;
  } else if (tableAction) {
    action = tableAction;
    basis = mode === 'count' ? 'Basic Strategy (kein Index-Play für diese Situation)' : 'Basic Strategy für die eingestellten Regeln';
    if (exactBest && exactBest !== tableAction && mode === 'basic') {
      const evT = exact?.actions.find((a) => a.action === tableAction)?.ev;
      const evB = exact?.actions.find((a) => a.action === exactBest)?.ev;
      if (evT !== undefined && evB !== undefined && evB - evT > 1e-6)
        notes.push(`Kompositionsabhängige Ausnahme: Für genau diese Karten wäre ${exactBest.toUpperCase()} um ${((evB - evT) * 100).toFixed(2).replace('.', ',')} % des Einsatzes besser (Composition-Aware-Modus).`);
    }
  } else if (exactBest) {
    action = exactBest;
    basis = 'Exakte Berechnung (Strategietabelle wird noch berechnet)';
  } else {
    action = null;
    basis = 'Berechnung läuft…';
  }
  if (hand.splitAces && rules.hsa === false) notes.push('Split-Asse: nur eine Karte.');
  return { ...base, state: 'decide', action, code, tableAction, exactBest, can, fallback: code ? fallbackOf(code, can) : null, basis, notes, indexPlay };
}
