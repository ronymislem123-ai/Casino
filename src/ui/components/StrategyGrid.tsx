import { IDX_LABEL } from '../../engine/cards';
import type { Cell, Code, StrategyTable } from '../../engine/strategy';
import { UP_ORDER } from '../../engine/strategy';
import { ACTION_DE } from '../format';

export type CellMark = 'mismatch' | 'fdiff' | 'unreadable' | undefined;

export interface GridSelection {
  kind: 'hard' | 'soft' | 'pairs';
  key: number;
  up: number;
}

const HARD_ROWS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const SOFT_ROWS = [13, 14, 15, 16, 17, 18, 19, 20];
const PAIR_ROWS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

export function codeClass(code: string | null | undefined): string {
  if (!code) return 'c-na';
  if (code === '?') return 'c-q';
  return `c-${code}`;
}

function rowLabel(kind: GridSelection['kind'], key: number): string {
  if (kind === 'hard') return `${key}`;
  if (kind === 'soft') return `A,${key - 11}`;
  return `${IDX_LABEL[key]},${IDX_LABEL[key]}`;
}

export function StrategyGrid({
  table,
  sections = ['hard', 'soft', 'pairs'],
  selected,
  onSelect,
  marks,
  overrideCodes,
  closeThreshold = 0.005,
}: {
  table: Pick<StrategyTable, 'hard' | 'soft' | 'pairs'>;
  sections?: GridSelection['kind'][];
  selected?: GridSelection | null;
  onSelect?: (s: GridSelection) => void;
  marks?: Record<string, CellMark>;
  overrideCodes?: Record<string, string>;
  closeThreshold?: number;
}) {
  const rows = { hard: HARD_ROWS, soft: SOFT_ROWS, pairs: PAIR_ROWS };
  const titles = { hard: 'Hard', soft: 'Soft', pairs: 'Paar' };
  return (
    <div className="stack">
      {sections.map((kind) => (
        <div key={kind} className="tbl-wrap">
          <table className="sgrid" aria-label={titles[kind]}>
            <thead>
              <tr>
                <th className="rowh">{titles[kind]}</th>
                {UP_ORDER.map((u) => (
                  <th key={u}>{IDX_LABEL[u]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows[kind].map((k) => {
                const row = (table[kind] as Record<number, Cell[]>)[k];
                if (!row) return null;
                return (
                  <tr key={k}>
                    <th className="rowh">{rowLabel(kind, k)}</th>
                    {UP_ORDER.map((u) => {
                      const cell = row[u];
                      const id = `${kind}:${k}:${u}`;
                      const code = overrideCodes?.[id] ?? cell?.code;
                      const mark = marks?.[id];
                      const isSel = selected && selected.kind === kind && selected.key === k && selected.up === u;
                      const close = cell && cell.margin < closeThreshold && !overrideCodes;
                      const tip = cell
                        ? `${rowLabel(kind, k)} gegen ${IDX_LABEL[u]}: ${cell.code} — ` +
                          Object.entries(cell.evs)
                            .map(([a, v]) => `${ACTION_DE[a as keyof typeof ACTION_DE]} ${((v as number) * 100).toFixed(1)}%`)
                            .join(', ')
                        : '';
                      return (
                        <td
                          key={u}
                          className={`${codeClass(mark === 'unreadable' ? '?' : (code as Code))} ${mark ?? ''} ${isSel ? 'sel' : ''} ${close ? 'close' : ''}`}
                          title={tip}
                          onClick={() => onSelect?.({ kind, key: k, up: u })}
                        >
                          {mark === 'unreadable' ? '?' : code}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

export function GridLegend({ showClose = true }: { showClose?: boolean }) {
  const items: [string, string][] = [
    ['H', 'Hit'],
    ['S', 'Stand'],
    ['Dh', 'Double, sonst Hit'],
    ['Ds', 'Double, sonst Stand'],
    ['P', 'Split'],
    ['Rh', 'Surrender, sonst Hit'],
    ['Rs', 'Surrender, sonst Stand'],
    ['Rp', 'Surrender, sonst Split'],
  ];
  return (
    <div className="legend">
      {items.map(([c, l]) => (
        <span key={c}>
          <i className={codeClass(c)}>{c}</i>
          {l}
        </span>
      ))}
      {showClose && (
        <span>
          <i className="c-S" style={{ position: 'relative' }}>
            •
          </i>
          knappe Entscheidung (&lt; 0,5 % EV-Abstand)
        </span>
      )}
    </div>
  );
}
