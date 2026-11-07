import { describe, expect, it } from 'vitest';
import { EVEngine } from '../src/engine/ev';
import { DEFAULT_RULES, Rules } from '../src/engine/rules';
import { fullShoe } from '../src/engine/cards';

const r6: Rules = { ...DEFAULT_RULES, decks: 6 };
const evOf = (e: EVEngine, up: number, hand: number[], extra: Partial<Parameters<EVEngine['evaluate']>[0]> = {}) => {
  const res = e.evaluate({ up, hand, ...extra });
  const m: Record<string, number> = {};
  for (const a of res.actions) m[a.action] = a.ev;
  return { res, m };
};

describe('EV-Engine: Aktionen und Regeln', () => {
  const e = new EVEngine(r6, fullShoe(6));
  it('Paar Asse gegen 6: Split ist beste Aktion', () => {
    expect(evOf(e, 5, [0, 0]).res.best).toBe('split');
  });
  it('Paar Zehnen gegen 6: Stand, kein Split', () => {
    const { res, m } = evOf(e, 5, [9, 9]);
    expect(res.best).toBe('stand');
    expect(m.split).toBeLessThan(m.stand);
  });
  it('Paar Fünfen gegen 6: Double (als Hard 10), Split ist schlechter', () => {
    const { res, m } = evOf(e, 5, [4, 4]);
    expect(res.best).toBe('double');
    expect(m.split).toBeLessThan(m.double);
  });
  it('Paar Achten gegen 6: Split', () => {
    expect(evOf(e, 5, [7, 7]).res.best).toBe('split');
  });
  it('Hard 16 gegen 10 ohne Surrender: Hit knapp vor Stand (6 Decks)', () => {
    const { res, m } = evOf(e, 9, [9, 5]);
    expect(res.best).toBe('hit');
    expect(m.hit - m.stand).toBeLessThan(0.02);
  });
  it('Soft 18 gegen 9: Hit; Soft 17 gegen 6: Double', () => {
    expect(evOf(e, 8, [0, 6]).res.best).toBe('hit');
    expect(evOf(e, 5, [0, 5]).res.best).toBe('double');
  });
  it('Hard 11 gegen Ass (6D S17): Hit; bei H17: Double', () => {
    expect(evOf(e, 0, [5, 4]).res.best).toBe('hit');
    const h = new EVEngine({ ...r6, h17: true }, fullShoe(6));
    expect(evOf(h, 0, [5, 4]).res.best).toBe('double');
  });
  it('Hard 8 gegen 6, Hard 9 gegen 3–6 verdoppeln nur, wenn mathematisch besser', () => {
    expect(evOf(e, 5, [5, 1]).res.best).toBe('hit'); // 6+2 = 8 vs 6 in 6 decks: hit
    expect(evOf(e, 2, [5, 2]).res.best).toBe('double'); // 9 vs 3
  });

  it('Double nur auf erlaubte Totals (Double 9–11)', () => {
    const d = new EVEngine({ ...r6, doubleOn: '9-11' }, fullShoe(6));
    expect(evOf(d, 5, [0, 6]).m.double).toBeUndefined(); // soft 18
    expect(evOf(d, 5, [5, 4]).m.double).toBeDefined(); // hard 11
    expect(evOf(d, 5, [5, 4, 0]).m.double).toBeUndefined(); // three cards
  });
  it('Kein Double nach Split ohne DAS', () => {
    const d = new EVEngine({ ...r6, das: false }, fullShoe(6));
    expect(evOf(d, 5, [7, 2], { isSplitHand: true, handsInRound: 2 }).m.double).toBeUndefined();
    expect(evOf(e, 5, [7, 2], { isSplitHand: true, handsInRound: 2 }).m.double).toBeDefined();
  });
  it('Split-Limit: bei maximaler Handzahl kein weiterer Split', () => {
    expect(evOf(e, 5, [7, 7], { isSplitHand: true, handsInRound: 4 }).m.split).toBeUndefined();
    expect(evOf(e, 5, [7, 7], { isSplitHand: true, handsInRound: 3 }).m.split).toBeDefined();
  });
  it('Resplit Asse nur mit RSA; Split-Asse erhalten nur eine Karte', () => {
    expect(evOf(e, 5, [0, 0], { isSplitHand: true, splitAces: true, handsInRound: 2 }).m.split).toBeUndefined();
    const rsa = new EVEngine({ ...r6, rsa: true }, fullShoe(6));
    expect(evOf(rsa, 5, [0, 0], { isSplitHand: true, splitAces: true, handsInRound: 2 }).m.split).toBeDefined();
    const one = evOf(e, 5, [0, 4], { isSplitHand: true, splitAces: true, handsInRound: 2 }).m;
    expect(one.hit).toBeUndefined();
    expect(one.double).toBeUndefined();
  });
  it('Surrender nur bei erlaubter Regel, nur auf den ersten zwei Karten der Ausgangshand', () => {
    expect(evOf(e, 9, [9, 5]).m.surrender).toBeUndefined();
    const ls = new EVEngine({ ...r6, surrender: 'late' }, fullShoe(6));
    expect(evOf(ls, 9, [9, 5]).m.surrender).toBeCloseTo(-0.5, 12);
    expect(evOf(ls, 9, [9, 5]).res.best).toBe('surrender');
    expect(evOf(ls, 9, [9, 3, 2]).m.surrender).toBeUndefined();
    expect(evOf(ls, 9, [9, 5], { isSplitHand: true, handsInRound: 2 }).m.surrender).toBeUndefined();
  });
  it('Early Surrender gegen Ass wird vor dem Peek (unbedingt) bewertet', () => {
    const es = new EVEngine({ ...r6, surrender: 'early' }, fullShoe(6));
    const { res, m } = evOf(es, 0, [9, 6]);
    expect(res.basis).toBe('unconditional');
    expect(m.surrender).toBeCloseTo(-0.5, 12);
    expect(res.best).toBe('surrender');
  });
  it('Peek-Spiel: EVs gegen Ass/10 sind bedingt auf „kein Dealer-Blackjack“', () => {
    const res = e.evaluate({ up: 0, hand: [9, 7] });
    expect(res.basis).toBe('conditional');
    expect(res.pDealerBJ).toBeCloseTo(95 / 309, 12); // one ten (player) removed from 96
  });
  it('European No-Hole-Card: 11 gegen 10 Hit, 8,8 gegen 10 Hit (Verlust aller Einsätze)', () => {
    const en = new EVEngine({ ...r6, holeCard: 'enhc', obo: false }, fullShoe(6));
    expect(evOf(en, 9, [5, 4]).res.best).toBe('hit');
    expect(evOf(en, 9, [7, 7]).res.best).toBe('hit');
    expect(evOf(e, 9, [5, 4]).res.best).toBe('double');
  });
  it('ENHC mit OBO entspricht in der Entscheidung dem Peek-Spiel', () => {
    const obo = new EVEngine({ ...r6, holeCard: 'enhc', obo: true }, fullShoe(6));
    expect(evOf(obo, 9, [5, 4]).res.best).toBe('double');
    expect(evOf(obo, 9, [7, 7]).res.best).toBe('split');
  });
  it('Versicherung: EV = 3·P(Zehn) − 1 aus der exakten Zusammensetzung', () => {
    const ins = e.insuranceEV(0, [4, 5]);
    expect(ins.pTen).toBeCloseTo(96 / 309, 12);
    expect(ins.ev).toBeCloseTo((3 * 96) / 309 - 1, 12);
    expect(ins.ev).toBeLessThan(0);
  });
  it('Gewinn-, Push-, Verlustwahrscheinlichkeiten summieren sich zu 1', () => {
    const res = e.evaluate({ up: 6, hand: [9, 5] });
    for (const a of res.actions) {
      if (a.action === 'split') continue;
      expect(a.win + a.push + a.lose).toBeCloseTo(1, 10);
    }
  });
  it('Höhere Gewinnwahrscheinlichkeit ≠ besserer EV (Double vs. Hit bei 11 gegen 6)', () => {
    const res = e.evaluate({ up: 5, hand: [5, 4] });
    const hit = res.actions.find((a) => a.action === 'hit')!;
    const dbl = res.actions.find((a) => a.action === 'double')!;
    expect(dbl.ev).toBeGreaterThan(hit.ev);
    expect(hit.win).toBeGreaterThan(dbl.win - 1e-9);
  });
  it('Zusammensetzung wirkt: 16 gegen 10 mit vielen fehlenden kleinen Karten → Stand', () => {
    const removed = new Array(10).fill(0);
    for (let r = 1; r <= 5; r++) removed[r] = 10; // many 2-6 gone
    expect(evOf(e, 9, [9, 5], { removed }).res.best).toBe('stand');
  });
  it('Unmögliche Karten werden abgelehnt', () => {
    const one = new EVEngine({ ...r6, decks: 1 }, fullShoe(1));
    expect(() => one.evaluate({ up: 0, hand: [0, 0], removed: [3, 0, 0, 0, 0, 0, 0, 0, 0, 0] })).toThrow();
  });
});
