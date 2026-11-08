/** Builds simulation strategies from serializable specs (shared by workers and scripts). */
import { generateStrategy, StrategyTable } from './strategy';
import { Rules, rulesKey } from './rules';
import {
  SimStrategy, basicStrategy, chartStrategy, compositionStrategy, foreignBasicStrategy, hiLoStrategy, mimicDealerStrategy, neverBustStrategy, DEFAULT_RAMP,
} from './simStrategies';
import { SOURCE_CHARTS } from '../data/sourceCharts';
import type { StrategySpec } from '../workers/protocol';

const tables = new Map<string, StrategyTable>();
export function cachedTable(rules: Rules): StrategyTable {
  const k = rulesKey(rules);
  let t = tables.get(k);
  if (!t) {
    t = generateStrategy(rules);
    tables.set(k, t);
  }
  return t;
}

export function buildStrategy(spec: StrategySpec, rules: Rules): { strategy: SimStrategy; note?: string } {
  const t = cachedTable(rules);
  switch (spec.kind) {
    case 'basic':
      return { strategy: basicStrategy(t) };
    case 'foreign':
      return { strategy: foreignBasicStrategy(cachedTable({ ...spec.rules, penetration: rules.penetration }), spec.label) };
    case 'cd2':
      return { strategy: compositionStrategy(t) };
    case 'hilo':
      return { strategy: hiLoStrategy(t, rules, { deviations: spec.deviations, ramp: spec.ramp.length ? spec.ramp : DEFAULT_RAMP }) };
    case 'mimic':
      return { strategy: mimicDealerStrategy(rules) };
    case 'neverbust':
      return { strategy: neverBustStrategy(t) };
    case 'chart': {
      const chart = SOURCE_CHARTS.find((c) => c.id === spec.chartId);
      if (!chart) throw new Error('Unbekannte Tabelle ' + spec.chartId);
      const r = chartStrategy(chart, t, rules);
      return { strategy: r.strategy, note: `${r.filled} unlesbare/fehlende Zellen durch Engine ergänzt` };
    }
  }
}
