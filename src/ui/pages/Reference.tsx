import { useEffect, useMemo, useState } from 'react';
import { IDX_LABEL } from '../../engine/cards';
import { describeRules } from '../../engine/rules';
import type { Cell } from '../../engine/strategy';
import { CODE_INFO } from '../../engine/strategy';
import type { ChartComparison } from '../../engine/chartCompare';
import { SOURCE_CHARTS } from '../../data/sourceCharts';
import analysis from '../../data/chartAnalysis.json';
import { useSettings } from '../../state/settings';
import { useStrategyTable } from '../../state/useStrategy';
import { engineClient } from '../../workers/client';
import { GridLegend, GridSelection, StrategyGrid, CellMark } from '../components/StrategyGrid';
import { Progress, Tabs } from '../components/common';
import { ACTION_DE, num, pct } from '../format';

type Tab = 'engine' | 'sources';

function CellDetail({ cell, sel }: { cell: Cell | undefined; sel: GridSelection }) {
  if (!cell) return <div className="muted">Keine Daten für diese Zelle.</div>;
  const label = sel.kind === 'hard' ? `Hard ${sel.key}` : sel.kind === 'soft' ? `Soft ${sel.key} (A,${sel.key - 11})` : `Paar ${IDX_LABEL[sel.key]},${IDX_LABEL[sel.key]}`;
  const sorted = Object.entries(cell.evs).sort((a, b) => (b[1] as number) - (a[1] as number));
  return (
    <div className="stack">
      <div>
        <b>{label}</b> gegen Dealer <b>{IDX_LABEL[sel.up]}</b>: <span className={`badge`}>{cell.code}</span> {CODE_INFO[cell.code].long}
      </div>
      <table className="data">
        <thead>
          <tr>
            <th>Aktion</th>
            <th>EV (gewichtet über alle Zweikarten-Kombinationen)</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(([a, v]) => (
            <tr key={a} className={a === cell.best ? 'best' : ''}>
              <td>{ACTION_DE[a as keyof typeof ACTION_DE]}</td>
              <td>{pct(v as number, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="muted" style={{ fontSize: 12 }}>
        Vorsprung der besten Aktion: {pct(cell.margin, 3, false)} des Einsatzes{cell.margin < 0.005 ? ' — knappe Entscheidung' : ''}. Grundlage: {cell.basis === 'conditional' ? 'nach dem Peek (kein Dealer-BJ)' : 'vor Kenntnis eines Dealer-BJ'}.
      </div>
    </div>
  );
}

export function ReferencePage() {
  const { rules } = useSettings();
  const { table, progress } = useStrategyTable(rules);
  const [tab, setTab] = useState<Tab>('engine');
  const [sel, setSel] = useState<GridSelection | null>({ kind: 'hard', key: 16, up: 9 });
  const [chartId, setChartId] = useState(SOURCE_CHARTS[3].id);
  const [cmp, setCmp] = useState<ChartComparison | null>(null);
  const [cmpErr, setCmpErr] = useState<string | null>(null);
  const chart = SOURCE_CHARTS.find((c) => c.id === chartId)!;

  useEffect(() => {
    if (tab !== 'sources') return;
    setCmp(null);
    setCmpErr(null);
    engineClient.compareChart(rules, chartId).then(setCmp).catch((e) => setCmpErr((e as Error).message));
  }, [tab, chartId, rules]);

  const { marks, overrides } = useMemo(() => {
    const marks: Record<string, CellMark> = {};
    const overrides: Record<string, string> = {};
    if (cmp) {
      for (const c of cmp.cells) {
        const kind = c.kind === 'pair' ? 'pairs' : c.kind;
        const id = `${kind}:${c.key}:${c.up}`;
        overrides[id] = c.src;
        if (c.status === 'mismatch') marks[id] = 'mismatch';
        if (c.status === 'fallback-diff') marks[id] = 'fdiff';
        if (c.status === 'unreadable') marks[id] = 'unreadable';
      }
    }
    return { marks, overrides };
  }, [cmp]);

  const selCell = sel && table ? (table[sel.kind] as Record<number, Cell[]>)[sel.key]?.[sel.up] : undefined;
  const inferred = (analysis as Record<string, { best: { rules: { decks: number; h17: boolean; das: boolean; surrender: string; holeCard: string }; mismatches: number; matchRate: number }[]; unreadable: number }>)[chartId];

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Strategy Reference</h1>
          <div className="muted" style={{ fontSize: 12.5 }}>{describeRules(rules)}</div>
        </div>
      </div>
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ v: 'engine', l: 'Berechnete Basic Strategy' }, { v: 'sources', l: 'Quelltabellen & Vergleich' }]} />
      {!table && (
        <div className="panel stack">
          <div>Strategie für diese Regeln wird exakt berechnet…</div>
          <Progress value={progress} />
        </div>
      )}
      {table && tab === 'engine' && (
        <div className="grid2">
          <div className="panel stack">
            <div className="row between">
              <h2>Basic Strategy <span className="badge exact">Exakt berechnet</span></h2>
              <span className="muted" style={{ fontSize: 12 }}>Hausvorteil: {num(table.houseEdge.tdBasic, 3)} % (Tabelle) · {num(table.houseEdge.cdOptimal, 3)} % (optimal)</span>
            </div>
            <StrategyGrid table={table} selected={sel} onSelect={setSel} />
            <GridLegend />
          </div>
          <div className="panel stack">
            <h2>Warum?</h2>
            {sel ? <CellDetail cell={selCell} sel={sel} /> : <div className="muted">Zelle antippen.</div>}
            <div className="note">
              Jede Zelle ist das Ergebnis eines EV-Vergleichs: Für alle Zweikarten-Kombinationen dieser Hand werden die Erwartungswerte jeder erlaubten Aktion exakt berechnet, nach Wahrscheinlichkeit gewichtet und verglichen. Die Tabelle passt sich bei jeder Regeländerung an.
            </div>
            <div className="note">Methode: {table.method}. Berechnet in {table.computeMs} ms.</div>
          </div>
        </div>
      )}
      {tab === 'sources' && (
        <div className="stack">
          <div className="panel stack">
            <label className="field">
              Quelltabelle
              <select value={chartId} onChange={(e) => setChartId(e.target.value)}>
                {SOURCE_CHARTS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="muted" style={{ fontSize: 12.5 }}>{chart.origin}</div>
            <div><b>Angegebene Regeln:</b> {chart.statedRules}</div>
            <div className="row">
              <span className={`badge ${chart.confidence === 'hoch' ? 'exact' : chart.confidence === 'mittel' ? 'warn' : 'bad'}`}>Lesbarkeit: {chart.confidence}</span>
              {chart.legend.map((l) => (
                <span key={l.symbol} className="badge">{l.symbol} = {l.meaning}</span>
              ))}
            </div>
          </div>
          <div className="grid2">
            <div className="panel stack">
              <h2>Tabelle vs. Engine (aktuelle Regeln)</h2>
              {cmpErr && <div className="note warn">{cmpErr}</div>}
              {!cmp && !cmpErr && <div className="muted">Vergleiche…</div>}
              {cmp && (
                <>
                  <div className="row">
                    <span className="badge exact">{cmp.counts.match} übereinstimmend</span>
                    <span className="badge bad">{cmp.counts.mismatch} abweichend</span>
                    <span className="badge warn">{cmp.counts['fallback-diff']} andere Ersatzaktion</span>
                    <span className="badge">{cmp.counts.unreadable} unlesbar</span>
                  </div>
                  <StrategyGrid
                    table={table ?? { hard: {}, soft: {}, pairs: {} }}
                    sections={(['hard', 'soft', 'pairs'] as const).filter((k) => chart.rows.some((r) => (k === 'pairs' ? r.kind === 'pair' : r.kind === k)))}
                    marks={marks}
                    overrideCodes={overrides}
                  />
                  <div className="legend">
                    <span><i className="c-H" style={{ outline: '3px solid #ff5d5d', outlineOffset: -3 }} /> Abweichung zur Engine</span>
                    <span><i className="c-q">?</i> unlesbar – nicht bewertet</span>
                    <span><i className="c-Dh" style={{ outline: '2px dashed var(--warn)', outlineOffset: -3 }} /> abweichende Ersatzaktion</span>
                  </div>
                </>
              )}
            </div>
            <div className="panel stack">
              <h2>Abweichungen & Regel-Inferenz</h2>
              {cmp && cmp.cells.filter((c) => c.status === 'mismatch').length === 0 && <div className="note info">Unter den aktuellen Regeln stimmen alle lesbaren Zellen mit der exakt berechneten Strategie überein.</div>}
              {cmp && cmp.cells.filter((c) => c.status === 'mismatch').length > 0 && (
                <table className="data">
                  <thead>
                    <tr>
                      <th>Hand</th>
                      <th>Dealer</th>
                      <th>Tabelle</th>
                      <th>Engine</th>
                      <th>EV-Verlust</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cmp.cells
                      .filter((c) => c.status === 'mismatch')
                      .map((c, i) => (
                        <tr key={i}>
                          <td>{c.kind === 'pair' ? `${IDX_LABEL[c.key]},${IDX_LABEL[c.key]}` : `${c.kind === 'soft' ? 'Soft' : 'Hard'} ${c.key}`}</td>
                          <td>{IDX_LABEL[c.up]}</td>
                          <td>{c.src} → {c.srcAction ? ACTION_DE[c.srcAction] : '–'}</td>
                          <td>{c.engineCode} → {c.engineBest ? ACTION_DE[c.engineBest] : '–'}</td>
                          <td>{pct(c.evLoss, 3, false)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
              {inferred && (
                <div className="stack">
                  <div><b>Am besten passende Regeln</b> (Analyse über 36 exakt berechnete Regelkonfigurationen):</div>
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Regeln</th>
                        <th>Abweichungen</th>
                        <th>Treffer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inferred.best.map((b, i) => (
                        <tr key={i}>
                          <td>{b.rules.decks}D {b.rules.h17 ? 'H17' : 'S17'} {b.rules.das ? 'DAS' : 'kein DAS'} {b.rules.surrender === 'late' ? 'LS' : 'kein Surr.'} {b.rules.holeCard === 'enhc' ? 'ENHC' : 'Peek'}</td>
                          <td>{b.mismatches}</td>
                          <td>{(b.matchRate * 100).toFixed(1)} %</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="stack">
                <b>Transkriptionshinweise</b>
                {chart.notes.map((n) => (
                  <div key={n} className="note">{n}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
