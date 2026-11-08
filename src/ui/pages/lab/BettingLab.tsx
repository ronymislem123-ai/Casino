import { useState } from 'react';
import { BET_SYSTEMS, BetSystemId, BettingConfig } from '../../../engine/betting';
import { describeRules } from '../../../engine/rules';
import type { ShoeMode } from '../../../engine/simulator';
import { useSettings } from '../../../state/settings';
import { runBetting, BettingResult } from '../../simRunner';
import { Histogram, LineChart, RangeChart, SERIES } from '../../components/Charts';
import { Progress, Seg } from '../../components/common';
import { int, money, num, pct, prob, uid } from '../../format';

export function BettingLab() {
  const { rules } = useSettings();
  const [cfg, setCfg] = useState<BettingConfig>({
    bankroll: 1000,
    baseBet: 10,
    tableMin: 10,
    tableMax: 1000,
    sessions: 2000,
    handsPerSession: 300,
    stopLoss: 0,
    stopWin: 0,
    percent: 2,
    paroliSteps: 3,
    customSequence: [1, 2, 3, 5, 8],
    kellyFraction: 0.5,
  });
  const [systems, setSystems] = useState<BetSystemId[]>(['flat', 'martingale', 'paroli', 'fibonacci', 'dalembert', 'percent']);
  const [stream, setStream] = useState<'basic' | 'hilo'>('basic');
  const [shoeMode, setShoeMode] = useState<ShoeMode>('shoe');
  const [seed, setSeed] = useState(4711);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [res, setRes] = useState<BettingResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState(0);
  const set = <K extends keyof BettingConfig>(k: K, v: BettingConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));

  const run = () => {
    setRunning(true);
    setErr(null);
    setRes(null);
    setProgress(0);
    runBetting(uid('bet'), { rules, seed, stream, shoeMode, betting: cfg, systems: systems.includes('kelly') && stream !== 'hilo' ? systems.filter((s) => s !== 'kelly') : systems }, {
      progress: (d, t) => setProgress(d / t),
      done: (r) => {
        setRes(r);
        setRunning(false);
        setSel(0);
      },
      error: (e) => {
        setErr(e);
        setRunning(false);
      },
    });
  };

  const numField = (label: string, k: keyof BettingConfig, step = 1) => (
    <label className="field">
      {label}
      <input type="number" step={step} value={cfg[k] as number} onChange={(e) => set(k, Number(e.target.value) as never)} />
    </label>
  );

  const s = res?.systems[sel];
  return (
    <div className="stack">
      <div className="callout">
        <b>Zentrale mathematische Regel:</b> Ein Einsatzsystem ändert den Hausvorteil nicht, solange es keine Information über die Karten nutzt. Es verändert nur Varianz, Drawdowns und Ruinrisiko.
        Alle Systeme werden hier auf <i>dieselbe</i> simulierte Folge von Rundenergebnissen angewendet (gleiche Spielentscheidungen) — Unterschiede entstehen allein durch die Einsatzhöhe.
      </div>
      <div className="panel stack">
        <h2>Konfiguration</h2>
        <div className="form-grid">
          {numField('Start-Bankroll', 'bankroll')}
          {numField('Grundeinsatz', 'baseBet')}
          {numField('Tischminimum', 'tableMin')}
          {numField('Tischmaximum', 'tableMax')}
          {numField('Sitzungen', 'sessions')}
          {numField('Hände je Sitzung', 'handsPerSession')}
          {numField('Stop-Loss (0 = aus)', 'stopLoss')}
          {numField('Stop-Win (0 = aus)', 'stopWin')}
          {numField('Prozent-Einsatz (%)', 'percent', 0.5)}
          {numField('Paroli-Stufen', 'paroliSteps')}
          {numField('Kelly-Anteil', 'kellyFraction', 0.05)}
          <label className="field">
            Eigene Progression (Einheiten)
            <input value={cfg.customSequence.join(',')} onChange={(e) => set('customSequence', e.target.value.split(',').map(Number).filter((x) => x > 0))} />
          </label>
          <label className="field">
            Zufallsseed
            <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) | 0)} />
          </label>
        </div>
        <div className="row">
          <Seg value={stream} onChange={setStream} options={[{ v: 'basic', l: 'Spiel: Basic Strategy' }, { v: 'hilo', l: 'Spiel: Basic + Hi-Lo-Abweichungen' }]} />
          <Seg<ShoeMode> value={shoeMode} onChange={setShoeMode} options={[{ v: 'shoe', l: 'Kartenschuh' }, { v: 'fresh', l: 'Neu mischen' }]} />
        </div>
        <div className="row" style={{ gap: '2px 16px' }}>
          {BET_SYSTEMS.map((b) => (
            <label key={b.id} className="check" title={b.description}>
              <input type="checkbox" checked={systems.includes(b.id)} onChange={(e) => setSystems((x) => (e.target.checked ? [...x, b.id] : x.filter((y) => y !== b.id)))} />
              {b.name}
            </label>
          ))}
        </div>
        {systems.includes('kelly') && stream !== 'hilo' && <div className="note warn">Kelly benötigt einen nachweisbaren Vorteil aus dem True Count — bitte „Basic + Hi-Lo“ wählen. Ohne Zählinformation wird Kelly übersprungen.</div>}
        <div className="row">
          <button className="btn primary" onClick={run} disabled={running || !systems.length}>
            ▶ {int(cfg.sessions * cfg.handsPerSession)} Runden simulieren
          </button>
          <span className="muted" style={{ fontSize: 12 }}>{describeRules(rules)}</span>
        </div>
        {running && <Progress value={progress} />}
        {err && <div className="note warn">{err}</div>}
      </div>
      {res && (
        <>
          <div className="panel stack">
            <h2>Ergebnisse <span className="badge sim">Simulation</span></h2>
            <div className="muted" style={{ fontSize: 12.5 }}>
              Ergebnisfolge: {int(res.streamSummary.rounds)} Runden mit „{res.strategyName}“, EV pro Grundeinsatz {pct(res.streamSummary.ev, 3)} (95-%-KI {pct(res.streamSummary.ci95[0], 2)} … {pct(res.streamSummary.ci95[1], 2)}).
              {stream === 'hilo' && ` Aus den Daten geschätzt: EV ≈ ${pct(res.kelly.a, 2)} + ${pct(res.kelly.b, 2)} × True Count (lineare Regression, n = ${int(res.kelly.n)}).`}
            </div>
            <div className="tbl-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>System</th>
                    <th>Ø End-Bankroll</th>
                    <th>Median</th>
                    <th>Ruin</th>
                    <th>Im Plus</th>
                    <th>Ø Einsatz gesamt</th>
                    <th>EV / Einsatz</th>
                    <th>Ø max. Drawdown</th>
                    <th>Ø längste Verlustserie</th>
                    <th>Ø Einsatz</th>
                    <th>Max. Einsatz</th>
                    <th>Limit erreicht</th>
                  </tr>
                </thead>
                <tbody>
                  {res.systems.map((x, i) => (
                    <tr key={x.id} className={i === sel ? 'best' : ''} onClick={() => setSel(i)} style={{ cursor: 'pointer' }}>
                      <td><span style={{ color: SERIES[i % 8] }}>■</span> {x.name}</td>
                      <td>{money(x.mean)}</td>
                      <td>{money(x.median)}</td>
                      <td className={x.ruinProb > 0.05 ? 'neg' : ''}>{prob(x.ruinProb)}</td>
                      <td>{prob(x.aheadProb)}</td>
                      <td>{money(x.meanWagered)}</td>
                      <td title="± 1,96 Standardfehler">{pct(x.evPerWagered, 2)} <span className="muted">± {pct(1.96 * x.evPerWageredSE, 2, false)}</span></td>
                      <td>{money(x.meanMaxDrawdown)}</td>
                      <td>{num(x.meanLongestLossStreak, 1)}</td>
                      <td>{money(x.avgBet)}</td>
                      <td>{money(x.maxBetSeen)}</td>
                      <td>{int(x.tableLimitHits)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="note">
              „EV / Einsatz“ = Summe aller Ergebnisse ÷ Summe aller riskierten Einsätze (inkl. Doubles/Splits). Bei Systemen ohne Karteninformation liegt dieser Wert im Rahmen der Zufallsschwankung beim Hausvorteil des Spiels.
              Annahme: Geld für Doubles/Splits ist verfügbar, solange die Bankroll ≥ Einsatz; die Bankroll fällt nie unter 0. Ruin = Bankroll unter Tischminimum.
            </div>
          </div>
          <div className="grid2">
            <div className="panel">
              <h2>End-Bankroll: 50-%- und 90-%-Bereich</h2>
              <RangeChart rows={res.systems.map((x) => ({ name: x.name, p5: x.p5, p25: x.p25, median: x.median, p75: x.p75, p95: x.p95, mean: x.mean }))} fmt={(v) => money(v)} refValue={cfg.bankroll} refLabel="Start" />
            </div>
            {s && (
              <div className="panel">
                <h2>Verteilung: {s.name}</h2>
                <Histogram edges={s.hist.edges} counts={s.hist.counts} fmt={(v) => money(v)} color={SERIES[sel % 8]} refValue={cfg.bankroll} refLabel="Start" />
              </div>
            )}
          </div>
          {s && (
            <div className="panel">
              <h2>Beispielverläufe: {s.name} (erste {s.samplePaths.length} Sitzungen)</h2>
              <LineChart
                legend={false}
                series={s.samplePaths.slice(0, 12).map((p, i) => ({ name: `Sitzung ${i + 1}`, color: SERIES[sel % 8], points: p.map((v, j) => [(j * cfg.handsPerSession) / Math.max(1, p.length - 1), v] as [number, number]) }))}
                yFmt={(v) => money(v)}
                xFmt={(v) => int(v)}
                xLabel="Hand"
                refLines={[{ y: cfg.bankroll, label: 'Start' }]}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
