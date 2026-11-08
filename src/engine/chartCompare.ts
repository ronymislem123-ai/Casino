/**
 * Compares a (transcribed) source chart with the strategy computed by the engine
 * for a given rule set. Each readable cell is classified and, for mismatches, the
 * EV cost of following the chart is reported. Unreadable cells are never guessed.
 */
import type { SourceChart, SrcCode } from '../data/sourceCharts';
import type { Action } from './ev';
import type { Rules } from './rules';
import { Cell, Code, StrategyTable, UP_ORDER } from './strategy';

export type CellStatus = 'match' | 'fallback-diff' | 'mismatch' | 'unreadable' | 'not-applicable';

export interface CellComparison {
  rowLabel: string;
  kind: 'hard' | 'soft' | 'pair';
  key: number;
  up: number;
  src: SrcCode;
  srcAction: Action | null;
  engineCode: Code | null;
  engineBest: Action | null;
  status: CellStatus;
  /** EV(best) − EV(source action), per unit initial bet; 0 for matches */
  evLoss: number;
}

export interface ChartComparison {
  chartId: string;
  rules: Rules;
  cells: CellComparison[];
  counts: Record<CellStatus, number>;
  /** share of comparable cells that match (incl. fallback-diff) */
  matchRate: number;
  /** sum of EV losses over mismatching cells (unweighted, per unit) */
  sumEvLoss: number;
}

/** Translate a source code into the concrete action for a two-card hand under `rules`. */
export function resolveSourceCode(code: SrcCode, rules: Rules, can: { double: boolean; split: boolean; surrender: boolean }): Action | null {
  switch (code) {
    case 'H':
      return 'hit';
    case 'S':
      return 'stand';
    case 'D':
      return can.double ? 'double' : null;
    case 'Dh':
      return can.double ? 'double' : 'hit';
    case 'Ds':
      return can.double ? 'double' : 'stand';
    case 'P':
      return can.split ? 'split' : null;
    case 'Ph':
      return can.split && rules.das ? 'split' : 'hit';
    case 'R':
    case 'Rh':
      return can.surrender ? 'surrender' : 'hit';
    case 'Rs':
      return can.surrender ? 'surrender' : 'stand';
    case 'Rp':
      return can.surrender ? 'surrender' : can.split ? 'split' : null;
    default:
      return null;
  }
}

/** Fallback (multi-card) behaviour a source code specifies, if any. */
function srcFallback(code: SrcCode): 'H' | 'S' | null {
  if (code === 'Dh' || code === 'Rh') return 'H';
  if (code === 'Ds' || code === 'Rs') return 'S';
  return null;
}
function engineFallback(code: Code): 'H' | 'S' | null {
  if (code === 'Dh' || code === 'Rh') return 'H';
  if (code === 'Ds' || code === 'Rs') return 'S';
  return null;
}

export function lookupCell(table: StrategyTable, kind: 'hard' | 'soft' | 'pair', key: number, up: number): Cell | undefined {
  if (kind === 'hard') return table.hard[key]?.[up];
  if (kind === 'soft') return table.soft[key]?.[up];
  return table.pairs[key]?.[up];
}

export function compareChart(chart: SourceChart, table: StrategyTable): ChartComparison {
  const cells: CellComparison[] = [];
  const counts: Record<CellStatus, number> = { match: 0, 'fallback-diff': 0, mismatch: 0, unreadable: 0, 'not-applicable': 0 };
  let sumEvLoss = 0;
  for (const row of chart.rows) {
    for (const key of row.keys) {
      for (let col = 0; col < 10; col++) {
        const up = UP_ORDER[col];
        const src = row.cells[col];
        const cell = lookupCell(table, row.kind, key, up);
        const base = { rowLabel: row.label, kind: row.kind, key, up, src };
        if (src === '?') {
          cells.push({ ...base, srcAction: null, engineCode: cell?.code ?? null, engineBest: cell?.best ?? null, status: 'unreadable', evLoss: 0 });
          counts.unreadable++;
          continue;
        }
        if (!cell) {
          cells.push({ ...base, srcAction: null, engineCode: null, engineBest: null, status: 'not-applicable', evLoss: 0 });
          counts['not-applicable']++;
          continue;
        }
        const can = { double: cell.evs.double !== undefined, split: cell.evs.split !== undefined, surrender: cell.evs.surrender !== undefined };
        const srcAction = resolveSourceCode(src, table.rules, can);
        if (!srcAction || cell.evs[srcAction] === undefined) {
          cells.push({ ...base, srcAction, engineCode: cell.code, engineBest: cell.best, status: 'not-applicable', evLoss: 0 });
          counts['not-applicable']++;
          continue;
        }
        let status: CellStatus;
        let evLoss = 0;
        if (srcAction === cell.best) {
          const sf = srcFallback(src);
          const ef = engineFallback(cell.code);
          status = sf && ef && sf !== ef ? 'fallback-diff' : 'match';
        } else {
          status = 'mismatch';
          evLoss = (cell.evs[cell.best] as number) - (cell.evs[srcAction] as number);
          sumEvLoss += evLoss;
        }
        counts[status]++;
        cells.push({ ...base, srcAction, engineCode: cell.code, engineBest: cell.best, status, evLoss });
      }
    }
  }
  const comparable = counts.match + counts['fallback-diff'] + counts.mismatch;
  return {
    chartId: chart.id,
    rules: table.rules,
    cells,
    counts,
    matchRate: comparable ? (counts.match + counts['fallback-diff']) / comparable : 0,
    sumEvLoss,
  };
}
