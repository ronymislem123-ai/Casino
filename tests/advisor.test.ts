import { describe, expect, it } from 'vitest';
import { adviseHand, LiveHand } from '../src/engine/advisor';
import { generateStrategy } from '../src/engine/strategy';
import { DEFAULT_RULES, Rules } from '../src/engine/rules';
import type { RankLabel } from '../src/engine/cards';
import { SOURCE_CHARTS } from '../src/data/sourceCharts';
import { chartStrategy } from '../src/engine/simStrategies';

const rules: Rules = { ...DEFAULT_RULES, decks: 6, h17: true, surrender: 'late' };
const table = generateStrategy(rules);
const hand = (cards: RankLabel[], extra: Partial<LiveHand> = {}): LiveHand => ({ cards, isSplit: false, splitAces: false, status: 'open', ...extra });
const advise = (cards: RankLabel[], up: number, extra: Partial<Parameters<typeof adviseHand>[0]> = {}, h: Partial<LiveHand> = {}) =>
  adviseHand({ rules, grid: table, hand: hand(cards, h), handIndex: 0, handsInRound: 1, up, mode: 'basic', exact: null, trueCount: null, ...extra });

describe('Live-Advisor', () => {
  it('A,A gegen 6 → SPLIT (als Paar erkannt)', () => {
    const a = advise(['A', 'A'], 5);
    expect(a.info.type).toBe('pair');
    expect(a.action).toBe('split');
  });
  it('10,10 gegen 5 → STAND, 5,5 gegen 6 → DOUBLE', () => {
    expect(advise(['10', 'K'], 4).action).toBe('stand');
    expect(advise(['5', '5'], 5).action).toBe('double');
  });
  it('bedingte Entscheidung: Soft 18 gegen 2 (H17) = Double, Ersatz Stand', () => {
    const a = advise(['A', '7'], 1);
    expect(a.code).toBe('Ds');
    expect(a.action).toBe('double');
    expect(a.fallback).toBe('stand');
  });
  it('Soft 18 gegen 2 mit drei Karten → Stand (Double nicht mehr erlaubt)', () => {
    expect(advise(['A', '4', '3'], 1).action).toBe('stand');
  });
  it('16 gegen 10: Surrender, mit drei Karten Hit', () => {
    expect(advise(['10', '6'], 9).action).toBe('surrender');
    expect(advise(['10', '4', '2'], 9).action).toBe('hit');
  });
  it('8,8 gegen A (H17, LS): Surrender, ohne Surrender-Möglichkeit (Split-Hand) Split', () => {
    expect(advise(['8', '8'], 0).action).toBe('surrender');
    const a = adviseHand({ rules, grid: table, hand: hand(['8', '8'], { isSplit: true }), handIndex: 0, handsInRound: 2, up: 0, mode: 'basic', exact: null, trueCount: null });
    expect(a.action).toBe('split');
  });
  it('8,8 bei erreichtem Split-Limit wird als Hard 16 gespielt', () => {
    const a = adviseHand({ rules, grid: table, hand: hand(['8', '8'], { isSplit: true }), handIndex: 1, handsInRound: 4, up: 9, mode: 'basic', exact: null, trueCount: null });
    expect(a.info.type).toBe('hard');
    expect(a.can.split).toBe(false);
    expect(a.action).toBe('hit');
  });
  it('kein Double nach Split ohne DAS', () => {
    const r: Rules = { ...rules, das: false };
    const t = generateStrategy(r);
    const a = adviseHand({ rules: r, grid: t, hand: hand(['9', '2'], { isSplit: true }), handIndex: 0, handsInRound: 2, up: 5, mode: 'basic', exact: null, trueCount: null });
    expect(a.can.double).toBe(false);
    expect(a.action).toBe('hit');
  });
  it('Split-Asse: nach einer Karte abgeschlossen', () => {
    const a = adviseHand({ rules, grid: table, hand: hand(['A', '6'], { isSplit: true, splitAces: true }), handIndex: 0, handsInRound: 2, up: 5, mode: 'basic', exact: null, trueCount: null });
    expect(a.state).toBe('finished');
  });
  it('Blackjack, Bust und 21 werden erkannt', () => {
    expect(advise(['A', 'K'], 5).state).toBe('blackjack');
    expect(advise(['10', '9', '5'], 5).state).toBe('bust');
    expect(advise(['7', '7', '7'], 5).state).toBe('twentyone');
  });
  it('Hi-Lo-Modus: 16 gegen 10 ohne Surrender bei TC ≥ 0 → Stand, bei TC < 0 → Hit', () => {
    const r: Rules = { ...rules, surrender: 'none' };
    const t = generateStrategy(r);
    const base = { rules: r, grid: t, hand: hand(['10', '6']), handIndex: 0, handsInRound: 1, up: 9, exact: null };
    expect(adviseHand({ ...base, mode: 'count', trueCount: 0.5 }).action).toBe('stand');
    expect(adviseHand({ ...base, mode: 'count', trueCount: -1 }).action).toBe('hit');
    expect(adviseHand({ ...base, mode: 'basic', trueCount: null }).action).toBe('hit');
  });
  it('Quelltabellen-Strategie ergänzt unlesbare Zellen durch die Engine', () => {
    const chart = SOURCE_CHARTS.find((c) => c.id === 'img5-blue')!;
    const { filled } = chartStrategy(chart, table, rules);
    const unreadable = chart.rows.reduce((s, r) => s + r.cells.filter((c) => c === '?').length * r.keys.length, 0);
    expect(filled).toBe(unreadable);
  });
});
