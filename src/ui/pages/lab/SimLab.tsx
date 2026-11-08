import { useMemo, useRef, useState } from 'react';
import { RULE_PRESETS, Rules, describeRules, rulesKey } from '../../../engine/rules';
import type { ShoeMode } from '../../../engine/simulator';
import { SOURCE_CHARTS } from '../../../data/sourceCharts';
import { DEFAULT_RAMP } from '../../../engine/simStrategies';
import { useSettings } from '../../../state/settings';
import { useStrategyTable } from '../../../state/useStrategy';
import { dbPut } from '../../../state/db';
import type { StrategySpec } from '../../../workers/protocol';
import { startSimulation, pauseSimulation, resumeSimulation, cancelSimulation, SimProgress } from '../../simRunner';
import { RulesForm } from '../../components/RulesForm';
import { CIChart, LineChart, SERIES } from '../../components/Charts';
import { Kpi, Progress, Seg } from '../../components/common';
import { duration, int, num, pct, prob, uid } from '../../format';

interface Option {
  id: string;
  label: string;
  group: string;
  spec: StrategySpec;
}

export const ENGINE_VERSION = 'omega-engine 1.0';

export function SimLab() {
  const settings = useSettings();
  const [rules, setRules] = useState<Rules>(settings.rules);
  const [shoeMode, setShoeMode] = useState<ShoeMode>('shoe');
  const [rounds, setRounds] = useState(1_000_000);
  const [seed, setSeed] = useState(20261107);
  const [foreignId, setForeignId] = useState(RULE_PRESETS.find((p) => rulesKey(p.rules) !== rulesKey(settings.rules))?.id ?? RULE_PRESETS[0].id);
  const [selected, setSelected] = useState<string[]>(['basic', 'cd2', 'foreign', 'mimic']);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prog, setProg] = useState<SimProgress | null>(null);
  const [paused, setPaused] = useState(false);
  const [running, setRunning] = useState(false);
  const [saved, setSaved] = useState(false);
  const runRef = useRef<{ id: string; cfg: unknown; opts: Option[] } | null>(null);
  const { table } = useStrategyTable(rules);

  const foreign = RULE_PRESETS.find((p) => p.id === foreignId)!;
  const options: Option[] = useMemo(
    () => [
      { id: 'basic', label: 'Basic Strategy (regelangepasst)', group: 'Basic', spec: { kind: 'basic' } },
      { id: 'foreign', label: `Basic Strategy für „${foreign.name}“`, group: 'Basic', spec: { kind: 'foreign', rules: foreign.rules, label: foreign.name } },
      { id: 'cd2', label: 'Zusammensetzungsabhängig (2 Karten)', group: 'Erweitert', spec: { kind: 'cd2' } },
      { id: 'hilo-dev', label: 'Hi-Lo: I18/Fab4-Abweichungen, Flat Bet', group: 'Zählen', spec: { kind: 'hilo', deviations: true, ramp: [1] } },
      { id: 'hilo-spread', label: `Hi-Lo: Abweichungen + Spread ${DEFAULT_RAMP.join('-')}`, group: 'Zählen', spec: { kind: 'hilo', deviations: true, ramp: DEFAULT_RAMP } },
      { id: 'mimic', label: 'Dealer imitieren', group: 'Heuristik', spec: { kind: 'mimic' } },
      { id: 'neverbust', label: 'Nie überkaufen', group: 'Heuristik', spec: { kind: 'neverbust' } },
      ...SOURCE_CHARTS.map((c) => ({ id: 'chart-' + c.id, label: c.short, group: 'Quelltabellen', spec: { kind: 'chart', chartId: c.id } as StrategySpec })),
    ],
    [foreign],
  );

  const start = () => {
    const opts = options.filter((o) => selected.includes(o.id));
    if (!opts.length) return;
    const id = uid('sim');
    const cfg = { rules, shoeMode, rounds, seed, strategies: opts.map((o) => o.spec), reference: 0 };
    runRef.current = { id, cfg, opts };
    setProg(null);
    setError(null);
    setSaved(false);
    setRunning(true);
    setPaused(false);
    setStatus('Starte…');
    startSimulation(id, cfg, {
      progress: (p) => {
        setProg(p);
        setStatus(null);
        if (p.type === 'done') setRunning(false);
      },
      status: setStatus,
      error: (e) => {
        setError(e);
        setRunning(false);
      },
    });
  };

  const save = async () => {
    if (!prog || !runRef.current) return;
    const rec = {
      id: runRef.current.id,
      timestamp: new Date().toISOString(),
      engineVersion: ENGINE_VERSION,
      method: `Monte Carlo (${shoeMode === 'shoe' ? 'Kartenschuh mit Schnittkarte' : shoeMode === 'fresh' ? 'neu gemischt je Runde' : 'unendliches Deck'}), gemeinsame Zufallsfolgen, Batch-Means je Schuh`,
      config: runRef.current.cfg,
      rulesText: describeRules(rules),
      strategies: runRef.current.opts.map((o) => o.label),
      results: prog.results.map((r) => ({ ...r, checkpoints: r.checkpoints })),
      comparisons: prog.comparisons,
      roundsDone: prog.roundsDone,
      elapsedMs: prog.elapsedMs,
      cancelled: prog.cancelled,
      exactReference: table ? { tdBasic: table.playerEV.tdBasic, cdOptimal: table.playerEV.cdOptimal } : null,
    };
    await dbPut('sims', rec.id, rec);
    setSaved(true);
  };

  const pr = prog ? prog.roundsDone / prog.roundsPlanned : 0;
  const eta = prog && prog.rate > 0 ? ((prog.roundsPlanned - prog.roundsDone) / prog.rate) * 1000 : 0;
  const groups = [...new Set(options.map((o) => o.group))];

  return (
    <div className="stack">
      <div className="panel stack">
        <h2>Simulation konfigurieren</h2>
        <div className="grid2">
          <div className="stack">
            <div className="field">
              Kartenmodell
              <Seg<ShoeMode>
                value={shoeMode}
                onChange={setShoeMode}
                options={[
                  { v: 'shoe', l: 'Schuh + Schnittkarte' },
                  { v: 'fresh', l: 'Neu mischen je Runde' },
                  { v: 'infinite', l: 'Unendliches Deck' },
                ]}
              />
            </div>
            <div className="form-grid">
              <label className="field">
                Runden je Strategie
                <select value={rounds} onChange={(e) => setRounds(Number(e.target.value))}>
                  {[100_000, 500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000, 25_000_000, 50_000_000].map((n) => (
                    <option key={n} value={n}>
                      {int(n)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Zufallsseed
                <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) | 0)} />
              </label>
            </div>
            <button className="btn small ghost" onClick={() => setSeed((Math.random() * 2 ** 31) | 0)}>
              Neuer Zufallsseed
            </button>
            <details>
              <summary>Regeln dieser Simulation ({describeRules(rules).split(' · ').slice(0, 3).join(' · ')}…)</summary>
              <RulesForm rules={rules} onChange={setRules} />
            </details>
          </div>
          <div className="stack">
            <div className="field">Strategien (die erste gewählte ist die Referenz für Vergleiche)</div>
            {groups.map((g) => (
              <div key={g}>
                <div className="muted" style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.08em' }}>{g}</div>
                {options
                  .filter((o) => o.group === g)
                  .map((o) => (
                    <label key={o.id} className="check">
                      <input
                        type="checkbox"
                        checked={selected.includes(o.id)}
                        onChange={(e) => setSelected((s) => (e.target.checked ? [...s, o.id] : s.filter((x) => x !== o.id)))}
                      />
                      {o.label}
                    </label>
                  ))}
              </div>
            ))}
            <label className="field">
              Fremde Regelvariante für „Basic Strategy für …“
              <select value={foreignId} onChange={(e) => setForeignId(e.target.value)}>
                {RULE_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="row">
          {!running ? (
            <button className="btn primary" onClick={start} disabled={!selected.length}>
              ▶ Simulation starten
            </button>
          ) : (
            <>
              {!paused ? (
                <button className="btn" onClick={() => { pauseSimulation(); setPaused(true); }}>⏸ Pausieren</button>
              ) : (
                <button className="btn" onClick={() => { resumeSimulation(); setPaused(false); }}>▶ Fortsetzen</button>
              )}
              <button className="btn danger" onClick={() => cancelSimulation()}>■ Abbrechen</button>
            </>
          )}
          {prog && !running && (
            <button className="btn" onClick={save} disabled={saved}>
              {saved ? '✓ Gespeichert' : 'Ergebnis speichern'}
            </button>
          )}
          <span className="muted" style={{ fontSize: 12 }}>
            Geplant: {int(rounds * selected.length)} Runden · gleiche Kartenfolge je Schuh für alle Strategien
          </span>
        </div>
        {status && <div className="note info">{status}</div>}
        {error && <div className="note warn">{error}</div>}
      </div>

      {prog && (
        <>
          <div className="panel stack">
            <div className="row between">
              <h2>
                {prog.type === 'done' ? (prog.cancelled ? 'Abgebrochen' : 'Abgeschlossen') : paused ? 'Pausiert' : 'Läuft…'} <span className="badge sim">Simulation (Schätzung)</span>
              </h2>
              <span className="muted mono" style={{ fontSize: 12 }}>
                {int(prog.roundsDone)} / {int(prog.roundsPlanned)} Runden · {int(prog.rate)} Runden/s · {duration(prog.elapsedMs)}
                {prog.type !== 'done' && eta > 0 ? ` · Rest ≈ ${duration(eta)}` : ''}
              </span>
            </div>
            <Progress value={pr} />
            <div className="tbl-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Strategie</th>
                    <th>Runden</th>
                    <th>EV / Grundeinsatz</th>
                    <th>95-%-KI</th>
                    <th>Hausvorteil</th>
                    <th>Δ zur Referenz</th>
                    <th>p-Wert</th>
                    <th>Gewinn</th>
                    <th>Push</th>
                    <th>Verlust</th>
                    <th>SD/Runde</th>
                    <th>EV / Einsatz gesamt</th>
                    <th>Max. Drawdown</th>
                    <th>Längste Verlustserie</th>
                  </tr>
                </thead>
                <tbody>
                  {prog.results.map((r, i) => {
                    const c = prog.comparisons[i];
                    return (
                      <tr key={i}>
                        <td title={r.description + (r.note ? ` (${r.note})` : '')}>
                          <span style={{ color: SERIES[i % 8] }}>■</span> {r.name}
                        </td>
                        <td>{int(r.summary.rounds)}</td>
                        <td className={r.summary.ev >= 0 ? 'pos' : 'neg'}>{pct(r.summary.ev, 3)}</td>
                        <td className="muted">{pct(r.summary.ci95[0], 2)} … {pct(r.summary.ci95[1], 2)}</td>
                        <td>{num(r.summary.houseEdgePct, 3)} %</td>
                        <td>{c ? `${pct(c.diff, 3)} ± ${pct(1.96 * c.se, 3, false)}` : 'Referenz'}</td>
                        <td>{c ? (c.significant ? <b>{c.pValue < 0.0001 ? '<0,0001' : num(c.pValue, 4)}</b> : <span className="muted">{num(c.pValue, 3)} (n.s.)</span>) : '—'}</td>
                        <td>{prob(r.summary.roundWin)}</td>
                        <td>{prob(r.summary.roundPush)}</td>
                        <td>{prob(r.summary.roundLoss)}</td>
                        <td>{num(r.summary.sdPerRound, 3)}</td>
                        <td>{pct(r.summary.returnPerWagered, 3)}</td>
                        <td>{num(r.summary.maxDrawdown, 0)}</td>
                        <td>{r.summary.maxLossStreak}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="note">
              EV in Einheiten des Grundeinsatzes; Konfidenzintervalle per Batch-Means je Schuh (berücksichtigt Abhängigkeiten im Schuh).
              Δ zur Referenz: gepaarter Vergleich auf identischen Schuhen; „n.s.“ = statistisch nicht von der Referenz unterscheidbar (p ≥ 0,05) — es wird kein Sieger konstruiert.
            </div>
          </div>
          <div className="grid2">
            <div className="panel">
              <h2>Erwartungswert mit 95-%-Konfidenzintervall</h2>
              <CIChart
                rows={prog.results.map((r) => ({ name: r.name, value: r.summary.ev * 100, lo: r.summary.ci95[0] * 100, hi: r.summary.ci95[1] * 100, note: `${int(r.summary.rounds)} Runden` }))}
                fmt={(v) => `${v.toFixed(2)}%`}
                refValue={table && shoeMode !== 'infinite' ? table.playerEV.tdBasic * 100 : undefined}
                refLabel={table ? 'exakt' : undefined}
              />
            </div>
            <div className="panel">
              <h2>Konvergenz</h2>
              <LineChart
                logX
                series={prog.results.map((r) => ({
                  name: r.name,
                  points: r.checkpoints.map((c) => [c[0], c[1] * 100] as [number, number]),
                  band: r.checkpoints.filter((c) => Number.isFinite(c[2])).map((c) => [c[0], (c[1] - 1.96 * c[2]) * 100, (c[1] + 1.96 * c[2]) * 100] as [number, number, number]),
                }))}
                yFmt={(v) => `${v.toFixed(2)}%`}
                xFmt={(v) => (v >= 1e6 ? `${v / 1e6} Mio` : v >= 1e3 ? `${v / 1e3}k` : String(v))}
                xLabel="Runden"
                yLabel="EV in % (mit 95-%-Band)"
              />
            </div>
          </div>
          <div className="kpis">
            {prog.results.slice(0, 4).map((r) => (
              <Kpi key={r.name} label={r.name} value={`${num(r.summary.houseEdgePct, 3)} %`} sub={`Hausvorteil · Splits ${prob(r.summary.splitRate)} · Doubles ${prob(r.summary.doubleRate)}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
