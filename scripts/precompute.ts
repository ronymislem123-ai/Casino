/**
 * Precomputes compact code grids for the rule presets so that the live assistant
 * has an exact, rule-matched basic strategy instantly (and offline) on first load.
 * Output: src/data/presetCodes.json. Run: npm run precompute
 */
import { writeFileSync } from 'node:fs';
import { RULE_PRESETS, rulesKey } from '../src/engine/rules';
import { generateStrategy } from '../src/engine/strategy';

const out: Record<string, unknown> = {};
for (const p of RULE_PRESETS) {
  const t = generateStrategy(p.rules);
  const pick = (rows: Record<number, { code: string }[]>) =>
    Object.fromEntries(Object.entries(rows).map(([k, row]) => [k, row.map((c) => ({ code: c.code }))]));
  out[rulesKey(p.rules)] = { hard: pick(t.hard), soft: pick(t.soft), pairs: pick(t.pairs) };
  console.log(p.id, t.computeMs, 'ms', 'HE', t.houseEdge.cdOptimal.toFixed(4));
}
writeFileSync('src/data/presetCodes.json', JSON.stringify(out));
