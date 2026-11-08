import { useEffect, useState } from 'react';
import { IDX_LABEL } from '../../engine/cards';
import { describeRules } from '../../engine/rules';
import { dbAll, dbDelete } from '../../state/db';
import { useSettings } from '../../state/settings';
import { addResult, endSession, sessionStats, startSession, undoResult, useSession } from '../../state/session';
import { engineClient } from '../../workers/client';
import { CIChart, LineChart } from '../components/Charts';
import { Kpi, Tabs } from '../components/common';
import { int, money, num, pct, prob } from '../format';
import type { StrategyResult } from '../simRunner';
import type { PairedComparison } from '../../engine/stats';

type Tab = 'sims' | 'session' | 'dealer';

interface SavedSim {
  id: string;
  timestamp: string;
  engineVersion: string;
  method: string;
  rulesText: string;
  strategies: string[];
  results: StrategyResult[];
  comparisons: (PairedComparison | null)[];
  roundsDone: number;
  elapsedMs: number;
  cancelled: boolean;
  config: { seed: number; rounds: number; shoeMode: string };
  exactReference: { tdBasic: number; cdOptimal: number } | null;
}

function SavedSims() {
  const [list, setList] = useState<SavedSim[]>([]);
  const [sel, setSel] = useState<string[]>([]);
  const load = () => dbAll<SavedSim>('sims').then((l) => setList(l.sort((a, b) => b.timestamp.localeCompare(a.timestamp))));
  useEffect(() => {
    void load();
  }, []);
  const chosen = list.filter((s) => sel.includes(s.id));
  const rows = chosen.flatMap((s) =>
    s.results.map((r) => ({ name: `${r.name} · ${s.id.slice(-5)}`, value: r.summary.ev * 100, lo: r.summary.ci95[0] * 100, hi: r.summary.ci95[1] * 100, note: s.rulesText })),
  );
  const exportJson = (s: SavedSim) => {
    const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${s.id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  if (!list.length) return <div className="panel empty">Noch keine gespeicherten Simulationen. Im Simulation Lab nach einem Lauf „Ergebnis speichern“ wählen.</div>;
  return (
    <div className="stack">
      <div className="panel">
        {list.map((s) => (
          <div key={s.id} className="list-item">
            <input type="checkbox" checked={sel.includes(s.id)} onChange={(e) => setSel((x) => (e.target.checked ? [...x, s.id] : x.filter((y) => y !== s.id)))} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div><b>{s.strategies.join(' · ')}</b></div>
              <div className="muted" style={{ fontSize: 12 }}>
                {new Date(s.timestamp).toLocaleString('de-DE')} · ID {s.id} · Seed {s.config.seed} · {int(s.roundsDone)} Runden {s.cancelled ? '(abgebrochen)' : ''} · {s.method}
              </div>
              <div className="muted" style={{ fontSize: 12 }}>{s.rulesText} · {s.engineVersion}</div>
            </div>
            <button className="btn small" onClick={() => exportJson(s)}>Export</button>
            <button className="btn small danger" onClick={() => dbDelete('sims', s.id).then(load)}>Löschen</button>
          </div>
        ))}
      </div>
      {chosen.length > 0 && (
        <div className="panel">
          <h2>Vergleich der ausgewählten Läufe</h2>
          <CIChart rows={rows} fmt={(v) => `${v.toFixed(2)}%`} />
          <div className="tbl-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Strategie (Lauf)</th>
                  <th>Runden</th>
                  <th>EV</th>
                  <th>95-%-KI</th>
                  <th>Δ Referenz</th>
                  <th>Gewinn / Push / Verlust</th>
                </tr>
              </thead>
              <tbody>
                {chosen.flatMap((s) =>
                  s.results.map((r, i) => (
                    <tr key={s.id + i}>
                      <td>{r.name} <span className="muted">· {s.id.slice(-5)}</span></td>
                      <td>{int(r.summary.rounds)}</td>
                      <td>{pct(r.summary.ev, 3)}</td>
                      <td>{pct(r.summary.ci95[0], 2)} … {pct(r.summary.ci95[1], 2)}</td>
                      <td>{s.comparisons[i] ? `${pct(s.comparisons[i]!.diff, 3)} (p=${num(s.comparisons[i]!.pValue, 3)})` : 'Ref.'}</td>
                      <td>{prob(r.summary.roundWin)} / {prob(r.summary.roundPush)} / {prob(r.summary.roundLoss)}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
          <div className="note">Läufe mit unterschiedlichen Regeln oder Seeds sind nicht gepaart – Unterschiede nur anhand der Konfidenzintervalle beurteilen.</div>
        </div>
      )}
    </div>
  );
}

function SessionPanel() {
  const s = useSession();
  const [bankroll, setBankroll] = useState(1000);
  const [stopLoss, setStopLoss] = useState(300);
  const [stopWin, setStopWin] = useState(0);
  const [timeLimit, setTimeLimit] = useState(90);
  const [bet, setBet] = useState(10);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);
  if (!s.active && !s.entries.length)
    return (
      <div className="panel stack">
        <h2>Neue Session</h2>
        <div className="form-grid">
          <label className="field">Start-Bankroll<input type="number" value={bankroll} onChange={(e) => setBankroll(Number(e.target.value))} /></label>
          <label className="field">Verlustlimit (0 = aus)<input type="number" value={stopLoss} onChange={(e) => setStopLoss(Number(e.target.value))} /></label>
          <label className="field">Gewinnziel (0 = aus)<input type="number" value={stopWin} onChange={(e) => setStopWin(Number(e.target.value))} /></label>
          <label className="field">Zeitlimit Minuten (0 = aus)<input type="number" value={timeLimit} onChange={(e) => setTimeLimit(Number(e.target.value))} /></label>
        </div>
        <button className="btn primary" onClick={() => startSession(bankroll, { stopLoss: stopLoss || null, stopWin: stopWin || null, timeLimitMin: timeLimit || null })}>Session starten</button>
        <div className="note">Limits sind persönliche Erinnerungen, keine Garantie gegen Verluste. Die Einhaltung der Basic Strategy wird erfasst, wenn im Live Assistant die gespielte Aktion angetippt wird.</div>
      </div>
    );
  const st = sessionStats(s);
  const mins = (now - s.startedAt) / 60000;
  const warnings: string[] = [];
  if (s.stopLoss && st.net <= -s.stopLoss) warnings.push('Verlustlimit erreicht.');
  if (s.stopWin && st.net >= s.stopWin) warnings.push('Gewinnziel erreicht.');
  if (s.timeLimitMin && mins >= s.timeLimitMin) warnings.push('Zeitlimit erreicht.');
  let cum = s.startBankroll;
  const path: [number, number][] = [[0, cum]];
  s.entries.forEach((e, i) => {
    cum += e.net;
    path.push([i + 1, cum]);
  });
  return (
    <div className="stack">
      {warnings.map((w) => <div key={w} className="callout">{w} Eine Pause wird empfohlen.</div>)}
      <div className="kpis">
        <Kpi label="Bankroll" value={money(s.bankroll)} sub={`Start ${money(s.startBankroll)}`} />
        <Kpi label="Gewinn / Verlust" value={`${st.net > 0 ? '+' : ''}${money(st.net)}`} sub={`${st.hands} Hände`} />
        <Kpi label="Eingesetzt" value={money(st.wagered)} sub={`Ø Einsatz ${money(st.avgBet)}`} />
        <Kpi label="Max. Drawdown" value={money(st.maxDD)} sub={`Längste Verlustserie ${st.maxStreak}`} />
        <Kpi label="Strategietreue" value={s.decisions ? `${((s.followed / s.decisions) * 100).toFixed(0)} %` : '–'} sub={`${s.followed} / ${s.decisions} Entscheidungen`} />
        <Kpi label="Dauer" value={`${Math.floor(mins)} min`} sub={s.timeLimitMin ? `Limit ${s.timeLimitMin} min` : 'kein Limit'} />
      </div>
      {s.active && (
        <div className="panel stack">
          <h2>Ergebnis der Runde erfassen</h2>
          <label className="field" style={{ maxWidth: 160 }}>Einsatz<input type="number" value={bet} onChange={(e) => setBet(Number(e.target.value))} /></label>
          <div className="row">
            {[[-2, '−2× (Double verloren)'], [-1, '−1× Verlust'], [-0.5, '−½ Surrender'], [0, 'Push'], [1, '+1× Gewinn'], [1.5, '+1,5× Blackjack'], [2, '+2× (Double gewonnen)']].map(([m, l]) => (
              <button key={String(m)} className="btn small" onClick={() => addResult(bet, bet * (m as number))}>{l as string}</button>
            ))}
            <button className="btn small ghost" onClick={undoResult}>↶</button>
          </div>
          <button className="btn danger small" style={{ alignSelf: 'flex-start' }} onClick={endSession}>Session beenden</button>
        </div>
      )}
      {!s.active && (
        <button className="btn" onClick={() => startSession(1000, { stopLoss: null, stopWin: null, timeLimitMin: null })}>Neue Session (Zurücksetzen)</button>
      )}
      {path.length > 1 && (
        <div className="panel">
          <h2>Bankroll-Verlauf</h2>
          <LineChart series={[{ name: 'Bankroll', points: path }]} yFmt={(v) => money(v)} xFmt={(v) => int(v)} xLabel="Hand" refLines={[{ y: s.startBankroll, label: 'Start' }]} />
        </div>
      )}
    </div>
  );
}

function DealerProbs() {
  const { rules } = useSettings();
  const [rows, setRows] = useState<{ up: number; cond: number[]; uncond: number[] }[] | null>(null);
  const [cond, setCond] = useState(true);
  useEffect(() => {
    setRows(null);
    engineClient.dealerProbs(rules).then(setRows);
  }, [rules]);
  if (!rows) return <div className="panel">Berechne…</div>;
  const order = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
  return (
    <div className="panel stack">
      <div className="row between">
        <h2>Dealer-Endwahrscheinlichkeiten <span className="badge exact">Exakt</span></h2>
        <div className="seg">
          <button className={cond ? 'on' : ''} onClick={() => setCond(true)}>Nach Peek (kein BJ)</button>
          <button className={!cond ? 'on' : ''} onClick={() => setCond(false)}>Vor Peek</button>
        </div>
      </div>
      <div className="muted" style={{ fontSize: 12.5 }}>{describeRules(rules)} · voller Schuh, nur die Dealer-Karte entfernt.</div>
      <div className="tbl-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Dealer</th>
              {['17', '18', '19', '20', '21', 'Bust', ...(cond ? [] : ['BJ'])].map((h) => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {order.map((u) => {
              const r = rows.find((x) => x.up === u)!;
              const v = cond ? r.cond.slice(0, 6) : r.uncond;
              return (
                <tr key={u}>
                  <td><b>{IDX_LABEL[u]}</b></td>
                  {v.map((p, i) => <td key={i} style={i === 5 ? { color: 'var(--gold)' } : undefined}>{prob(p, 2)}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="note">Validiert gegen die veröffentlichten Tabellen von Wizard of Odds (1 Deck, S17) auf 6 Nachkommastellen (siehe Tests).</div>
    </div>
  );
}

export function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>('sims');
  return (
    <div>
      <div className="page-head"><h1>Analytics</h1></div>
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ v: 'sims', l: 'Gespeicherte Simulationen' }, { v: 'session', l: 'Session & Bankroll' }, { v: 'dealer', l: 'Wahrscheinlichkeiten' }]} />
      {tab === 'sims' && <SavedSims />}
      {tab === 'session' && <SessionPanel />}
      {tab === 'dealer' && <DealerProbs />}
    </div>
  );
}
