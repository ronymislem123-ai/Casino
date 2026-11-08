import { describe, expect, it } from 'vitest';
import { generateStrategy, resolveCode } from '../src/engine/strategy';
import { DEFAULT_RULES } from '../src/engine/rules';
import { SOURCE_CHARTS } from '../src/data/sourceCharts';
import { compareChart } from '../src/engine/chartCompare';
import wizard from './fixtures/wizard-house-edge.json';

const T6S17 = generateStrategy({ ...DEFAULT_RULES, decks: 6, surrender: 'late' });
const T6H17 = generateStrategy({ ...DEFAULT_RULES, decks: 6, h17: true, surrender: 'late' });

describe('Basic-Strategy-Generierung', () => {
  it('reproduziert das Wizard-of-Odds-Chart 4–8 Decks S17 zellgenau', () => {
    const c = compareChart(SOURCE_CHARTS.find((x) => x.id === 'wizard-48-s17')!, T6S17);
    expect(c.counts.mismatch).toBe(0);
    expect(c.counts['fallback-diff']).toBe(0);
    expect(c.counts.match).toBeGreaterThan(300);
  });
  it('reproduziert das Wizard-of-Odds-Chart 4–8 Decks H17 zellgenau', () => {
    const c = compareChart(SOURCE_CHARTS.find((x) => x.id === 'wizard-48-h17')!, T6H17);
    expect(c.counts.mismatch).toBe(0);
    expect(c.counts['fallback-diff']).toBe(0);
  });
  it('bedingte Codes: Rp, Rs, Ds, Dh unter 6D H17 LS', () => {
    expect(T6H17.pairs[7][0].code).toBe('Rp'); // 8,8 vs A
    expect(T6H17.hard[17][0].code).toBe('Rs'); // 17 vs A
    expect(T6H17.soft[18][1].code).toBe('Ds'); // soft 18 vs 2
    expect(T6H17.hard[11][0].code).toBe('Dh'); // 11 vs A
    expect(T6S17.hard[11][0].code).toBe('H'); // 11 vs A under S17
  });
  it('Auflösung bedingter Codes je nach erlaubten Aktionen', () => {
    expect(resolveCode('Ds', { double: false, split: false, surrender: false }, 'S')).toBe('stand');
    expect(resolveCode('Rp', { double: false, split: true, surrender: false }, 'H')).toBe('split');
    expect(resolveCode('Rh', { double: false, split: false, surrender: true }, 'H')).toBe('surrender');
  });
  it('unendliches Deck: Spieler-EV −0,5117 % (Wizard of Odds, Anhang 1: S17, DAS, Split bis 4 Hände außer Asse)', () => {
    const t = generateStrategy({ ...DEFAULT_RULES }, { deckModel: 'infinite' });
    expect(t.playerEV.tdBasic * 100).toBeCloseTo(-0.511734, 4);
  });
  it('Blackjack-Wahrscheinlichkeit des Spielers (6 Decks) = 2·24/312·96/311', () => {
    const p = T6S17.comps.filter((c) => c.playerBJ).reduce((s, c) => s + c.prob, 0);
    expect(p).toBeCloseTo((2 * 24 * 96) / (312 * 311), 12);
  });
  it('Regression: Hard 21 und Soft 21 (Mehrkartenhände) sind gegen jede Upcard Stand', () => {
    for (let up = 0; up < 10; up++) {
      expect(T6S17.hard[21][up].code).toBe('S');
      expect(T6S17.soft[21][up].code).toBe('S');
      expect(T6H17.soft[21][up].code).toBe('S');
    }
  });
  it('Wahrscheinlichkeiten aller Startsituationen summieren zu 1', () => {
    expect(T6S17.comps.reduce((s, c) => s + c.prob, 0)).toBeCloseTo(1, 12);
  });
});

describe('Hausvorteil vs. Wizard-of-Odds-Rechner (Referenz-Fixture)', () => {
  const rows = (wizard as { rows: Record<string, unknown>[] }).rows.filter((r) => r.decks === 1 || r.decks === 2).slice(0, 10);
  for (const r of rows) {
    const name = `${r.decks}D ${r.h17 ? 'H17' : 'S17'} ${r.das ? 'DAS' : 'noDAS'} ${r.surrender} ${r.obo ? 'peek' : 'ENHC'}`;
    it(`${name}: |Abweichung| < 0,003 %-Punkte`, () => {
      const t = generateStrategy({
        ...DEFAULT_RULES,
        decks: r.decks as number, h17: r.h17 as boolean, das: r.das as boolean, doubleOn: r.doubleOn as never,
        maxSplitHands: r.maxSplitHands as number, rsa: r.rsa as boolean, hsa: r.hsa as boolean,
        holeCard: r.obo ? 'peek' : 'enhc', obo: r.obo as boolean, surrender: r.surrender as never,
      });
      expect(Math.abs(t.houseEdge.cdOptimal - (r.houseEdgePct as number))).toBeLessThan(0.003);
    });
  }
});
