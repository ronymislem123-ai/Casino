import { describe, expect, it } from 'vitest';
import { dealerDistBruteForce, dealerDistFast, dealerDistFinite, dealerDistInfinite, normalize } from '../src/engine/dealer';
import { fullShoe, INFINITE_PROBS } from '../src/engine/cards';
import { Xoshiro128 } from '../src/engine/rng';

describe('Dealer-Verteilungen', () => {
  it('schnelle Graph-Methode == Rekursion == unabhängige Brute-Force-Aufzählung', () => {
    const rng = new Xoshiro128(123);
    for (let t = 0; t < 12; t++) {
      const shoe = fullShoe(1);
      for (let k = 0; k < 8; k++) {
        const r = rng.int(10);
        if (shoe[r] > 0) shoe[r]--;
      }
      const up = rng.int(10);
      if (shoe[up] === 0) continue;
      shoe[up]--;
      for (const h17 of [false, true])
        for (const ex of [false, true]) {
          const a = dealerDistFast(shoe, up, h17, ex);
          const b = dealerDistFinite(shoe, up, h17, ex);
          const c = dealerDistBruteForce(shoe, up, h17, ex);
          for (let o = 0; o < 7; o++) {
            expect(a[o]).toBeCloseTo(b[o], 12);
            expect(a[o]).toBeCloseTo(c[o], 12);
          }
        }
    }
  });

  it('Wahrscheinlichkeiten summieren zu 1 bzw. P(kein Dealer-BJ)', () => {
    const s = fullShoe(6);
    s[0]--;
    const d = dealerDistFast(s, 0, true, true);
    const sum = d.reduce((x, y) => x + y, 0);
    expect(sum).toBeCloseTo(1 - 96 / 311, 12);
    const d2 = dealerDistFast(s, 0, true, false);
    expect(d2.reduce((x, y) => x + y, 0)).toBeCloseTo(1, 12);
    expect(d2[6]).toBeCloseTo(96 / 311, 12);
  });

  // Reference: Wizard of Odds, "Dealer Odds in Blackjack under U.S. Rules" (appendix 2a),
  // 1 deck, dealer stands on soft 17, after peek (no BJ); retrieved 2026-11-07.
  it('stimmt mit Wizard-of-Odds-Tabelle (1 Deck, S17, nach Peek) auf 6 Stellen überein', () => {
    const ref: Record<number, number[]> = {
      0: [0.183786, 0.19089, 0.18868, 0.191692, 0.075137, 0.169815],
      1: [0.138976, 0.131762, 0.131815, 0.123948, 0.120526, 0.352973],
      5: [0.166948, 0.106454, 0.107192, 0.100705, 0.097879, 0.420823],
      9: [0.124156, 0.122486, 0.124421, 0.356869, 0.03957, 0.232499],
    };
    for (const [k, v] of Object.entries(ref)) {
      const up = Number(k);
      const s = fullShoe(1);
      s[up]--;
      const d = normalize(dealerDistFast(s, up, false, true));
      v.forEach((x, i) => expect(Math.abs(d[i] - x)).toBeLessThan(1.5e-6));
    }
  });

  it('unendliches Deck: Dealer 6 bustet häufiger als Dealer 10', () => {
    const six = dealerDistInfinite(INFINITE_PROBS, 5, false, false);
    const ten = normalize(dealerDistInfinite(INFINITE_PROBS, 9, false, true));
    expect(six[5]).toBeGreaterThan(0.4);
    expect(six[5]).toBeGreaterThan(ten[5]);
  });

  it('H17 vs. S17: Dealer 6 hat bei H17 weniger finale 17 und mehr Busts', () => {
    const s = fullShoe(6);
    s[5]--;
    const a = dealerDistFast(s, 5, false, true);
    const b = dealerDistFast(s, 5, true, true);
    expect(b[0]).toBeLessThan(a[0]); // fewer final 17s when hitting soft 17
    expect(b[5]).toBeGreaterThan(a[5]); // more busts
  });
});
