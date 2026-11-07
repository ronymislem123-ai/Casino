import { describe, expect, it } from 'vitest';
import { classifyHand } from '../src/engine/hand';
import { DEFAULT_RULES } from '../src/engine/rules';

describe('Handerkennung (Live Assistant)', () => {
  it('A + A ist ein Paar Asse, nicht nur Soft 12', () => {
    const h = classifyHand(['A', 'A']);
    expect(h.type).toBe('pair');
    expect(h.pairValue).toBe(0);
    expect(h.total).toBe(12);
    expect(h.soft).toBe(true);
  });
  it('8 + 8 ist ein Paar Achten', () => {
    const h = classifyHand(['8', '8']);
    expect(h.type).toBe('pair');
    expect(h.pairValue).toBe(7);
    expect(h.total).toBe(16);
  });
  it('10 + 10 und K + Q sind Paare mit Hard 20 (Split nur als Option)', () => {
    expect(classifyHand(['10', '10']).type).toBe('pair');
    expect(classifyHand(['K', 'Q']).total).toBe(20);
  });
  it('K + Q ist kein Paar, wenn nur gleiche Ränge geteilt werden dürfen', () => {
    const h = classifyHand(['K', 'Q'], { rules: { ...DEFAULT_RULES, splitTensSameRankOnly: true } });
    expect(h.type).toBe('hard');
    expect(h.total).toBe(20);
  });
  it('A + 7 = Soft 18, A + 6 = Soft 17', () => {
    expect(classifyHand(['A', '7'])).toMatchObject({ type: 'soft', total: 18 });
    expect(classifyHand(['A', '6'])).toMatchObject({ type: 'soft', total: 17 });
  });
  it('A + 5 + 10 ist Hard 16 (Ass zählt 1)', () => {
    expect(classifyHand(['A', '5', '10'])).toMatchObject({ type: 'hard', total: 16, soft: false });
  });
  it('Mehrkartenhände: 5 + 4 + 7 = Hard 16, A + A + 9 = Soft 21', () => {
    expect(classifyHand(['5', '4', '7'])).toMatchObject({ type: 'hard', total: 16 });
    expect(classifyHand(['A', 'A', '9'])).toMatchObject({ type: 'soft', total: 21 });
  });
  it('A + K ist Blackjack, nach Split aber nur 21', () => {
    expect(classifyHand(['A', 'K']).type).toBe('blackjack');
    expect(classifyHand(['A', 'K'], { isSplitHand: true }).type).toBe('soft');
  });
  it('Bust wird erkannt', () => {
    expect(classifyHand(['10', '6', '9']).type).toBe('bust');
  });
  it('Paar ohne Split-Möglichkeit (Maximum erreicht) wird als Total gespielt', () => {
    expect(classifyHand(['8', '8'], { canStillSplit: false })).toMatchObject({ type: 'hard', total: 16 });
  });
});
