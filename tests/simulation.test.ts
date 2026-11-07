import { describe, expect, it } from 'vitest';
import { generateStrategy } from '../src/engine/strategy';
import { DEFAULT_RULES, Rules } from '../src/engine/rules';
import { Simulator } from '../src/engine/simulator';
import { basicStrategy, hiLoStrategy, mimicDealerStrategy, DEFAULT_RAMP } from '../src/engine/simStrategies';
import { summarize, pairedComparison, normalCdf, batchSE } from '../src/engine/stats';
import { runBettingSystem, BettingConfig } from '../src/engine/betting';
import { Xoshiro128, subSeed } from '../src/engine/rng';
import { EVEngine } from '../src/engine/ev';
import { situationMC } from '../src/engine/validation';
import { fullShoe } from '../src/engine/cards';

const rules: Rules = { ...DEFAULT_RULES, decks: 6 };
const table = generateStrategy(rules);

describe('Zufallszahlen', () => {
  it('reproduzierbar mit gleichem Seed, verschieden mit anderem Seed', () => {
    const a = new Xoshiro128(5), b = new Xoshiro128(5), c = new Xoshiro128(6);
    const sa = Array.from({ length: 5 }, () => a.nextU32());
    expect(Array.from({ length: 5 }, () => b.nextU32())).toEqual(sa);
    expect(Array.from({ length: 5 }, () => c.nextU32())).not.toEqual(sa);
  });
  it('gleichverteilte Ganzzahlen (Chi-Quadrat, 13 Ränge)', () => {
    const r = new Xoshiro128(subSeed(1, 2));
    const counts = new Array(13).fill(0);
    const n = 130000;
    for (let i = 0; i < n; i++) counts[r.int(13)]++;
    const chi = counts.reduce((s, x) => s + (x - n / 13) ** 2 / (n / 13), 0);
    expect(chi).toBeLessThan(32.9); // 99.9 % quantile, 12 df
  });
});

describe('Monte-Carlo-Simulator', () => {
  it('reproduzierbar: gleicher Seed → identische Ergebnisse', () => {
    const run = () => {
      const s = new Simulator({ rules, shoeMode: 'shoe', rounds: 20000, seed: 77 }, basicStrategy(table));
      s.run(Infinity);
      return s.counters;
    };
    expect(run()).toEqual(run());
  });
  it('Kartenschuh wird nach der Schnittkarte neu gemischt (Anzahl Schuhe plausibel)', () => {
    const s = new Simulator({ rules: { ...rules, penetration: 0.75 }, shoeMode: 'shoe', rounds: 50000, seed: 3 }, basicStrategy(table));
    s.run(Infinity);
    // ≈ 234 cards per shoe, ≈ 5.4 cards per round → ≈ 43 rounds per shoe
    const perShoe = s.counters.rounds / s.counters.shoes;
    expect(perShoe).toBeGreaterThan(35);
    expect(perShoe).toBeLessThan(50);
    expect(s.batches.net.length).toBe(s.counters.shoes);
  });
  it('frischer Schuh: Monte-Carlo-EV stimmt mit exakter Rechnung überein (|z| < 4)', () => {
    const s = new Simulator({ rules, shoeMode: 'fresh', rounds: 1_500_000, seed: 2024 }, basicStrategy(table));
    s.run(Infinity);
    const sum = summarize(s.counters, s.batches);
    const z = (sum.ev - table.playerEV.tdBasic) / sum.seBatch;
    expect(Math.abs(z)).toBeLessThan(4);
    expect(sum.sdPerRound).toBeGreaterThan(1.1);
    expect(sum.sdPerRound).toBeLessThan(1.2);
  }, 30000);
  it('Splits, Doubles und mehrere Hände treten auf und werden korrekt gezählt', () => {
    const s = new Simulator({ rules, shoeMode: 'shoe', rounds: 100000, seed: 9 }, basicStrategy(table));
    s.run(Infinity);
    const c = s.counters;
    expect(c.splits / c.rounds).toBeGreaterThan(0.015);
    expect(c.doubles / c.rounds).toBeGreaterThan(0.08);
    expect(c.hands).toBeGreaterThan(c.rounds);
    expect(c.roundsWon + c.roundsLost + c.roundsPushed).toBe(c.rounds);
  });
  it('„Dealer imitieren“ ist deutlich schlechter als Basic Strategy (gepaarter Vergleich)', () => {
    const a = new Simulator({ rules, shoeMode: 'shoe', rounds: 200000, seed: 11 }, basicStrategy(table));
    const b = new Simulator({ rules, shoeMode: 'shoe', rounds: 200000, seed: 11 }, mimicDealerStrategy(rules));
    a.run(Infinity);
    b.run(Infinity);
    const cmp = pairedComparison(a.batches, b.batches);
    expect(cmp.diff).toBeGreaterThan(0.03);
    expect(cmp.significant).toBe(true);
  });
  it('Hi-Lo: Einsätze steigen bei hohem True Count', () => {
    const st = hiLoStrategy(table, rules, { deviations: true, ramp: DEFAULT_RAMP });
    expect(st.betUnits(-2)).toBe(1);
    expect(st.betUnits(5)).toBe(8);
    expect(st.insurance(3.2)).toBe(true);
    expect(st.insurance(1)).toBe(false);
  });
});

describe('Statistik', () => {
  it('Normalverteilungsfunktion', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 3);
  });
  it('Batch-Standardfehler ≈ naiver SE bei unabhängigen Batches', () => {
    const r = new Xoshiro128(1);
    const net: number[] = [], initial: number[] = [], rounds: number[] = [];
    for (let k = 0; k < 2000; k++) {
      let s = 0;
      for (let i = 0; i < 50; i++) s += r.next() < 0.5 ? 1 : -1;
      net.push(s); initial.push(50); rounds.push(50);
    }
    const se = batchSE({ net, initial, rounds });
    expect(se).toBeGreaterThan(0.8 / Math.sqrt(100000));
    expect(se).toBeLessThan(1.2 / Math.sqrt(100000));
  });
});

describe('Betting & Risk', () => {
  const sim = new Simulator({ rules, shoeMode: 'shoe', rounds: 400000, seed: 5, recordStream: true }, basicStrategy(table));
  sim.run(Infinity);
  const stream = { net: sim.streamNet, wager: sim.streamWager, tc: sim.streamTC };
  const cfg: BettingConfig = { bankroll: 1000, baseBet: 10, tableMin: 10, tableMax: 5000, sessions: 2000, handsPerSession: 200, percent: 1, paroliSteps: 3, customSequence: [1, 2, 3], kellyFraction: 0.5 };
  it('Einsatzsysteme ändern den Ertrag pro eingesetzter Einheit nicht (nur Varianz/Risiko)', () => {
    const flat = runBettingSystem('flat', stream, cfg);
    const mart = runBettingSystem('martingale', stream, cfg);
    expect(Math.abs(flat.evPerWagered - mart.evPerWagered)).toBeLessThan(0.02);
    expect(mart.ruinProb).toBeGreaterThan(flat.ruinProb);
    expect(mart.meanMaxDrawdown).toBeGreaterThan(flat.meanMaxDrawdown);
  });
});

describe('Methode C: Exakt vs. Monte Carlo für eine Situation', () => {
  it('16 gegen 10 (Stand/Hit) stimmt innerhalb von 4 Standardfehlern', () => {
    const r2 = { ...DEFAULT_RULES, decks: 2 };
    const e = new EVEngine(r2, fullShoe(2));
    for (const a of ['stand', 'hit'] as const) {
      const res = situationMC(e, { up: 9, hand: [9, 5], shoe: fullShoe(2) }, a, 60000, 1);
      expect(Math.abs(res.z)).toBeLessThan(4);
    }
  });
});
