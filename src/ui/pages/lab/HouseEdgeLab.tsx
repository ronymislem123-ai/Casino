import { useState } from 'react';
import { Rules, describeRules, rulesKey } from '../../../engine/rules';
import { useSettings } from '../../../state/settings';
import { engineClient, HouseEdgeResult } from '../../../workers/client';
import { CIChart } from '../../components/Charts';
import { Progress } from '../../components/common';
import { num } from '../../format';
import { RulesForm } from '../../components/RulesForm';

function variantsOf(b: Rules): { label: string; rules: Rules }[] {
  const v: { label: string; rules: Rules }[] = [];
  const add = (label: string, r: Partial<Rules>) => {
    const rules = { ...b, ...r };
    if (rulesKey(rules) !== rulesKey(b)) v.push({ label, rules });
  };
  for (const d of [1, 2, 4, 6, 8]) add(`${d} Deck${d > 1 ? 's' : ''}`, { decks: d });
  add(b.h17 ? 'Dealer steht auf Soft 17 (S17)' : 'Dealer zieht auf Soft 17 (H17)', { h17: !b.h17 });
  add(b.das ? 'Kein Double nach Split' : 'Double nach Split (DAS)', { das: !b.das });
  add('Kein Surrender', { surrender: 'none' });
  add('Late Surrender', { surrender: 'late' });
  if (b.holeCard === 'peek') add('Early Surrender', { surrender: 'early' });
  add('Blackjack zahlt 6:5', { bjPayout: 1.2 });
  add('Blackjack zahlt 1:1', { bjPayout: 1 });
  add('Blackjack zahlt 3:2', { bjPayout: 1.5 });
  if (b.holeCard === 'peek') {
    add('European No-Hole-Card (alle Einsätze verloren)', { holeCard: 'enhc', obo: false, surrender: 'none' });
    add('No-Hole-Card mit OBO', { holeCard: 'enhc', obo: true, surrender: 'none' });
  } else add('Amerikanisch mit Peek', { holeCard: 'peek', obo: true });
  add(b.rsa ? 'Kein Resplit von Assen' : 'Resplit von Assen (RSA)', { rsa: !b.rsa });
  add(b.hsa ? 'Nur 1 Karte auf Split-Asse' : 'Ziehen auf Split-Asse', { hsa: !b.hsa });
  for (const n of [2, 3, 4]) add(`Split bis ${n} Hände`, { maxSplitHands: n });
  add('Kein Split', { maxSplitHands: 1 });
  add('Double nur 9–11', { doubleOn: '9-11' });
  add('Double nur 10–11', { doubleOn: '10-11' });
  add('Double auf alle zwei Karten', { doubleOn: 'any2' });
  return v;
}

export function HouseEdgeLab() {
  const settings = useSettings();
  const [base, setBase] = useState<Rules>(settings.rules);
  const [res, setRes] = useState<HouseEdgeResult | null>(null);
  const [partial, setPartial] = useState<HouseEdgeResult['variants']>([]);
  const [prog, setProg] = useState(0);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const variants = variantsOf(base);

  const run = async () => {
    setRunning(true);
    setRes(null);
    setErr(null);
    setPartial([]);
    try {
      const r = await engineClient.houseEdge(base, variants, (d, t, p) => {
        setProg(d / t);
        if (p) setPartial(p as HouseEdgeResult['variants']);
      });
      setRes(r);
    } catch (e) {
      setErr((e as Error).message);
    }
    setRunning(false);
  };

  const rows = res?.variants ?? partial;
  const baseCd = res?.base.cd;
  return (
    <div className="stack">
      <div className="panel stack">
        <h2>House Edge Analyzer <span className="badge exact">Exakt berechnet</span></h2>
        <p className="muted">
          Für die Basis-Regeln und jede Einzeländerung wird die komplette Strategie exakt neu berechnet und der Hausvorteil aus allen Startsituationen gewichtet (frischer Schuh je Runde).
          „Optimal“ = kompositionsabhängig beste Entscheidung je Zweikarten-Hand, „Basic“ = total-abhängige Tabelle. Rechenzeit ca. 0,5–2 s je Variante.
        </p>
        <details>
          <summary>Basis-Regeln: {describeRules(base)}</summary>
          <RulesForm rules={base} onChange={setBase} showPenetration={false} />
        </details>
        <div className="row">
          <button className="btn primary" onClick={run} disabled={running}>
            ▶ {variants.length} Regelvarianten exakt berechnen
          </button>
        </div>
        {running && <Progress value={prog} />}
        {err && <div className="note warn">{err}</div>}
      </div>
      {rows.length > 0 && (
        <div className="grid2">
          <div className="panel">
            <h2>Hausvorteil je Variante</h2>
            {baseCd !== undefined && (
              <div className="kpi" style={{ marginBottom: 10 }}>
                <div className="l">Basis</div>
                <div className="v">{num(baseCd, 3)} %</div>
                <div className="muted" style={{ fontSize: 12 }}>Basic-Tabelle: {num(res!.base.td, 3)} %</div>
              </div>
            )}
            <div className="tbl-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Variante</th>
                    <th>Optimal</th>
                    <th>Basic</th>
                    <th>Δ zur Basis</th>
                    <th>geänderte Zellen</th>
                  </tr>
                </thead>
                <tbody>
                  {rows
                    .slice()
                    .sort((a, b) => a.cd - b.cd)
                    .map((v) => (
                      <tr key={v.label} title={v.changes.join(' · ')}>
                        <td>{v.label}</td>
                        <td>{num(v.cd, 3)} %</td>
                        <td>{num(v.td, 3)} %</td>
                        <td className={baseCd !== undefined ? (v.cd > baseCd ? 'neg' : 'pos') : ''}>{baseCd !== undefined ? `${v.cd - baseCd > 0 ? '+' : ''}${num(v.cd - baseCd, 3)}` : '…'}</td>
                        <td>{v.changedCells}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="note">Positive Δ = schlechter für den Spieler. „Geänderte Zellen“ zählt, wie viele Felder der Basic-Strategy-Tabelle sich durch die Regeländerung ändern (Tooltip zeigt Beispiele).</div>
          </div>
          {baseCd !== undefined && (
            <div className="panel">
              <h2>Veränderung des Hausvorteils (%-Punkte)</h2>
              <CIChart
                rows={rows
                  .slice()
                  .sort((a, b) => a.cd - b.cd)
                  .map((v) => ({ name: v.label, value: v.cd - baseCd, lo: v.cd - baseCd, hi: v.cd - baseCd, color: v.cd > baseCd ? 'var(--series-2)' : 'var(--series-1)' }))}
                fmt={(v) => `${v > 0 ? '+' : ''}${v.toFixed(2)}`}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
