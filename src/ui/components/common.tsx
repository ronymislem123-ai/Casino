import type { ReactNode } from 'react';
import type { ActionResult, EVBasis } from '../../engine/ev';
import { ACTION_DE, pct, prob } from '../format';

export function Seg<T extends string | number>({ value, options, onChange, ariaLabel }: { value: T; options: { v: T; l: ReactNode }[]; onChange: (v: T) => void; ariaLabel?: string }) {
  return (
    <div className="seg" role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={String(o.v)} className={o.v === value ? 'on' : ''} onClick={() => onChange(o.v)} role="radio" aria-checked={o.v === value}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ value, tabs, onChange }: { value: T; tabs: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.v} className={t.v === value ? 'on' : ''} onClick={() => onChange(t.v)} role="tab" aria-selected={t.v === value}>
          {t.l}
        </button>
      ))}
    </div>
  );
}

export function Kpi({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="kpi">
      <div className="l">{label}</div>
      <div className="v">{value}</div>
      {sub && <div className="muted" style={{ fontSize: 12 }}>{sub}</div>}
    </div>
  );
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

export function MethodBadge({ kind }: { kind: 'exact' | 'sim' | 'src' | 'derived' | 'unvalidated' }) {
  const map = {
    exact: ['exact', 'Exakt berechnet'],
    sim: ['sim', 'Simulation (Schätzung)'],
    src: ['src', 'Externe Quelle'],
    derived: ['', 'Abgeleitet'],
    unvalidated: ['warn', 'Nicht validiert'],
  } as const;
  const [c, l] = map[kind];
  return <span className={`badge ${c}`}>{l}</span>;
}

export function EVTable({ actions, best, basis, compact }: { actions: ActionResult[]; best: string | null; basis: EVBasis; compact?: boolean }) {
  const sorted = actions.slice().sort((a, b) => b.ev - a.ev);
  const top = sorted[0]?.ev ?? 0;
  return (
    <div className="tbl-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>Aktion</th>
            <th>EV</th>
            {!compact && <th>Δ zur besten</th>}
            <th>Gewinn</th>
            <th>Push</th>
            <th>Verlust</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((a) => (
            <tr key={a.action} className={a.action === best ? 'best' : ''}>
              <td>
                <b className={`act-${a.action}`}>{ACTION_DE[a.action]}</b>
                {a.action === 'split' && <span className="muted"> ¹</span>}
              </td>
              <td className={a.ev >= 0 ? 'pos' : 'neg'}>{pct(a.ev, 2)}</td>
              {!compact && <td>{a.action === best ? '—' : pct(a.ev - top, 2)}</td>}
              <td>{prob(a.win)}</td>
              <td>{prob(a.push)}</td>
              <td>{prob(a.lose)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>
        EV in % des ursprünglichen Einsatzes{basis === 'conditional' ? ', bedingt darauf, dass der Dealer keinen Blackjack hat (nach dem Peek)' : ', vor Kenntnis eines Dealer-Blackjacks (unbedingt)'}.
        Bei Double/Split ist der Gewinn/Verlust in Einsatzeinheiten größer als die Wahrscheinlichkeiten zeigen. {actions.some((a) => a.action === 'split') && '¹ Split: Wahrscheinlichkeiten pro entstehender Hand.'}
      </div>
    </div>
  );
}
