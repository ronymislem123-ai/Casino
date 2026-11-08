import { useEffect, useState } from 'react';
import { IDX_LABEL } from '../../../engine/cards';
import type { Action } from '../../../engine/ev';
import type { MCActionResult } from '../../../engine/validation';
import { describeRules } from '../../../engine/rules';
import { useSettings } from '../../../state/settings';
import { engineClient, LiveEvaluation } from '../../../workers/client';
import { EVTable, Progress } from '../../components/common';
import { PlayingCard } from '../../components/Card';
import { ACTION_DE, int, num, pct, prob } from '../../format';

const VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const label = (i: number) => IDX_LABEL[i];

export function SituationLab() {
  const { rules } = useSettings();
  const [hand, setHand] = useState<number[]>([9, 5]);
  const [up, setUp] = useState(9);
  const [ev, setEv] = useState<LiveEvaluation | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [trials, setTrials] = useState(200000);
  const [mc, setMc] = useState<MCActionResult[] | null>(null);
  const [mcProg, setMcProg] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setEv(null);
    setMc(null);
    setErr(null);
    engineClient.evaluate(rules, { up, hand }).then(setEv).catch((e) => setErr((e as Error).message));
  }, [rules, up, hand]);

  const runMC = async () => {
    if (!ev) return;
    setRunning(true);
    setMcProg(0);
    try {
      const acts = ev.actions.map((a) => a.action) as Action[];
      setMc(await engineClient.situationMC(rules, up, hand, acts, trials, 12345, (d, t) => setMcProg(d / t)));
    } catch (e) {
      setErr((e as Error).message);
    }
    setRunning(false);
  };

  return (
    <div className="stack">
      <div className="panel stack">
        <h2>Situationsanalyse: Wahrscheinlichkeiten & Erwartungswerte</h2>
        <p className="muted">Wähle eine konkrete Hand und die Dealer-Karte. Die Engine bewertet jede erlaubte Aktion exakt; optional prüft eine unabhängige Monte-Carlo-Simulation dieselben Werte (Methode C).</p>
        <div className="row">
          <span className="muted">Spielerhand:</span>
          {hand.map((c, i) => (
            <select key={i} value={c} onChange={(e) => setHand(hand.map((x, j) => (j === i ? Number(e.target.value) : x)))} className="btn small">
              {VALUES.map((v) => (
                <option key={v} value={v}>{label(v)}</option>
              ))}
            </select>
          ))}
          <button className="btn small" onClick={() => setHand([...hand, 1])} disabled={hand.length >= 6}>+ Karte</button>
          <button className="btn small" onClick={() => setHand(hand.slice(0, -1))} disabled={hand.length <= 2}>− Karte</button>
          <span className="muted">Dealer:</span>
          <select value={up} onChange={(e) => setUp(Number(e.target.value))} className="btn small">
            {VALUES.map((v) => (
              <option key={v} value={v}>{label(v)}</option>
            ))}
          </select>
        </div>
        <div className="row">
          {hand.map((c, i) => (
            <PlayingCard key={i} rank={(c === 0 ? 'A' : String(c + 1)) as never} idx={i} small />
          ))}
          <span className="muted" style={{ margin: '0 8px' }}>vs</span>
          <PlayingCard rank={(up === 0 ? 'A' : String(up + 1)) as never} idx={3} small />
        </div>
        <div className="muted" style={{ fontSize: 12 }}>{describeRules(rules)}</div>
      </div>
      {err && <div className="note warn">{err}</div>}
      {ev && (
        <div className="grid2">
          <div className="panel">
            <h2>Exakte Bewertung <span className="badge exact">Exakt</span></h2>
            {ev.actions.length ? <EVTable actions={ev.actions} best={ev.best} basis={ev.basis} /> : <div className="muted">{ev.isBlackjack ? 'Blackjack – keine Entscheidung.' : ev.bust ? 'Bust.' : 'Keine Entscheidung.'}</div>}
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Beste Aktion: <b>{ev.best ? ACTION_DE[ev.best] : '–'}</b> · Rechenzeit {num(ev.ms, 0)} ms · P(Dealer-BJ | Karten) = {prob(ev.pDealerBJ, 2)}</div>
          </div>
          <div className="panel">
            <h2>Dealer-Endergebnis</h2>
            <table className="data">
              <tbody>
                {['17', '18', '19', '20', '21', 'Bust', 'Blackjack'].map((l, i) => (
                  <tr key={l}>
                    <td>{l}</td>
                    <td>{prob(ev.dealer[i], 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="muted" style={{ fontSize: 12 }}>Unbedingt (vor dem Peek), exakt aus dem Restschuh nach Entnahme von Spielerkarten und Dealer-Karte.</div>
          </div>
        </div>
      )}
      {ev && ev.actions.length > 0 && (
        <div className="panel stack">
          <h2>Monte-Carlo-Gegenprobe <span className="badge sim">Simulation</span></h2>
          <div className="row">
            <label className="field" style={{ maxWidth: 200 }}>
              Versuche je Aktion
              <select value={trials} onChange={(e) => setTrials(Number(e.target.value))}>
                {[50000, 200000, 500000, 1000000].map((n) => (
                  <option key={n} value={n}>{int(n)}</option>
                ))}
              </select>
            </label>
            <button className="btn primary" onClick={runMC} disabled={running}>▶ Gegenprobe starten</button>
          </div>
          {running && <Progress value={mcProg} />}
          {mc && (
            <div className="tbl-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Aktion</th>
                    <th>Exakt</th>
                    <th>Monte Carlo</th>
                    <th>Standardfehler</th>
                    <th>z</th>
                    <th>Versuche</th>
                    <th>Bewertung</th>
                  </tr>
                </thead>
                <tbody>
                  {mc.map((r) => (
                    <tr key={r.action}>
                      <td>{ACTION_DE[r.action]}</td>
                      <td>{pct(r.exact, 3)}</td>
                      <td>{pct(r.mean, 3)}</td>
                      <td>{pct(r.se, 3, false)}</td>
                      <td>{num(r.z, 2, true)}</td>
                      <td>{int(r.trials)}</td>
                      <td>{Math.abs(r.z) < 3 ? <span className="badge exact">konsistent</span> : <span className="badge bad">Abweichung prüfen</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="note">
                z = (MC − exakt) / Standardfehler. |z| &lt; 3 bedeutet: Unterschied im Rahmen der Zufallsschwankung. Die Simulation zieht ohne Zurücklegen aus dem exakten Restschuh,
                konditioniert (bei Peek) per Verwerfen auf „kein Dealer-Blackjack“ und nutzt für Folgeentscheidungen die exakte Hit/Stand-Politik der Engine.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
