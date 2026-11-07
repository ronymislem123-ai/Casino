import { EVEngine } from '../src/engine/ev';
import { situationMC } from '../src/engine/validation';
import { DEFAULT_RULES } from '../src/engine/rules';
import { fullShoe } from '../src/engine/cards';
const rules = { ...DEFAULT_RULES, decks: 2, h17: true, surrender: 'late' as const };
const shoe = fullShoe(2);
const eng = new EVEngine(rules, shoe);
const cases: [number, number[], string[]][] = [[9, [9, 5], ['stand', 'hit', 'surrender']], [5, [7, 7], ['split', 'hit', 'stand']], [0, [0, 0], ['split', 'hit']], [4, [0, 6], ['double', 'hit', 'stand']], [8, [7, 7], ['split', 'stand', 'hit']]];
for (const [up, hand, acts] of cases) for (const a of acts) {
  const t0 = Date.now();
  const r = situationMC(eng, { up, hand, shoe }, a as never, 200000, 7);
  console.log(up, hand.join(','), a, 'exact', r.exact.toFixed(4), 'mc', r.mean.toFixed(4), '±', r.se.toFixed(4), 'z', r.z.toFixed(2), (Date.now() - t0) + 'ms');
}
