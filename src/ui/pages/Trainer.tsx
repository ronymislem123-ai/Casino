import { useCallback, useEffect, useMemo, useState } from 'react';
import { ACE, IDX_LABEL, RankLabel, TEN, fullShoe } from '../../engine/cards';
import type { Action } from '../../engine/ev';
import { adviseHand } from '../../engine/advisor';
import { describeRules } from '../../engine/rules';
import { CODE_INFO } from '../../engine/strategy';
import { useSettings } from '../../state/settings';
import { useStrategyTable } from '../../state/useStrategy';
import { lsGet, lsSet } from '../../state/db';
import { engineClient, LiveEvaluation } from '../../workers/client';
import { PlayingCard } from '../components/Card';
import { EVTable, Kpi, Seg } from '../components/common';
import { ACTION_DE, ACTION_TITLE, pct } from '../format';
import { Xoshiro128 } from '../../engine/rng';

type Level = 'easy' | 'medium' | 'hard' | 'expert';
interface Stats {
  total: number;
  correct: number;
  streak: number;
  best: number;
  byCat: Record<string, [number, number]>;
  missed: Record<string, number>;
}
const EMPTY: Stats = { total: 0, correct: 0, streak: 0, best: 0, byCat: {}, missed: {} };

const TEN_RANKS: RankLabel[] = ['10', 'J', 'Q', 'K'];
function toRank(i: number, rng: Xoshiro128): RankLabel {
  if (i === ACE) return 'A';
  if (i === TEN) return TEN_RANKS[rng.int(4)];
  return String(i + 1) as RankLabel;
}

interface Situation {
  cards: RankLabel[];
  up: RankLabel;
  cat: 'hard' | 'soft' | 'pair' | 'multi';
}

function drawSituation(level: Level, rng: Xoshiro128, decks: number): Situation {
  const shoe = fullShoe(decks);
  const total = shoe.reduce((a, b) => a + b, 0);
  const draw = () => {
    let x = rng.int(total);
    for (let r = 0; r < 10; r++) {
      if (x < shoe[r]) return r;
      x -= shoe[r];
    }
    return TEN;
  };
  for (let guard = 0; guard < 500; guard++) {
    const a = draw();
    const b = draw();
    const up = draw();
    const isPair = a === b;
    const soft = !isPair && (a === ACE || b === ACE);
    if ((a === ACE && b === TEN) || (a === TEN && b === ACE)) continue;
    const hardTotal = (a === ACE ? 1 : a + 1) + (b === ACE ? 1 : b + 1);
    let cat: Situation['cat'] = isPair ? 'pair' : soft ? 'soft' : 'hard';
    if (level === 'easy' && cat !== 'hard') continue;
    if (level === 'easy' && hardTotal < 8) continue;
    if (level === 'medium' && cat === 'pair') continue;
    const cards = [toRank(a, rng), toRank(b, rng)];
    if (level === 'expert' && rng.next() < 0.35 && !isPair) {
      // multi-card hand: add a card that keeps the hand alive
      const c = draw();
      const ht = hardTotal + (c === ACE ? 1 : c + 1);
      if (ht <= 18) {
        cards.push(toRank(c, rng));
        cat = 'multi';
      }
    }
    // skip trivial hands for higher levels
    if (level !== 'easy' && cat === 'hard' && (hardTotal >= 18 || hardTotal <= 7)) continue;
    return { cards, up: toRank(up, rng), cat };
  }
  return { cards: ['10', '6'], up: '10', cat: 'hard' };
}

export function TrainerPage() {
  const { rules } = useSettings();
  const { grid } = useStrategyTable(rules);
  const [level, setLevel] = useState<Level>(() => lsGet<Level>('omega.trainer.level', 'medium'));
  const [stats, setStats] = useState<Stats>(() => lsGet('omega.trainer.stats', EMPTY));
  const rng = useMemo(() => new Xoshiro128((Date.now() & 0x7fffffff) ^ 0x5bd1e995), []);
  const [sit, setSit] = useState<Situation>(() => drawSituation(level, rng, rules.decks));
  const [answer, setAnswer] = useState<Action | null>(null);
  const [ev, setEv] = useState<LiveEvaluation | null>(null);

  useEffect(() => lsSet('omega.trainer.stats', stats), [stats]);
  useEffect(() => lsSet('omega.trainer.level', level), [level]);

  const next = useCallback(() => {
    setSit(drawSituation(level, rng, rules.decks));
    setAnswer(null);
    setEv(null);
  }, [level, rng, rules.decks]);

  useEffect(() => {
    next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, rules]);

  const upIdx = sit.up === 'A' ? 0 : ['10', 'J', 'Q', 'K'].includes(sit.up) ? 9 : Number(sit.up) - 1;
  const hand = { cards: sit.cards, isSplit: false, splitAces: false, status: 'open' as const };
  const advice = adviseHand({ rules, grid, hand, handIndex: 0, handsInRound: 1, up: upIdx, mode: 'basic', exact: null, trueCount: null });
  const correct = advice.tableAction;
  const choices: Action[] = ['hit', 'stand', ...(advice.can.double ? ['double' as Action] : []), ...(advice.can.split ? ['split' as Action] : []), ...(advice.can.surrender ? ['surrender' as Action] : [])];
  const key = `${advice.info.label} vs ${sit.up === 'J' || sit.up === 'Q' || sit.up === 'K' ? '10' : sit.up}`;

  const choose = (a: Action) => {
    if (answer || !correct) return;
    setAnswer(a);
    const ok = a === correct;
    const cat = sit.cat;
    setStats((s) => {
      const bc = s.byCat[cat] ?? [0, 0];
      return {
        total: s.total + 1,
        correct: s.correct + (ok ? 1 : 0),
        streak: ok ? s.streak + 1 : 0,
        best: Math.max(s.best, ok ? s.streak + 1 : s.streak),
        byCat: { ...s.byCat, [cat]: [bc[0] + (ok ? 1 : 0), bc[1] + 1] },
        missed: ok ? s.missed : { ...s.missed, [key]: (s.missed[key] ?? 0) + 1 },
      };
    });
    engineClient
      .evaluate(rules, { up: upIdx, hand: sit.cards.map((r) => (r === 'A' ? 0 : ['10', 'J', 'Q', 'K'].includes(r) ? 9 : Number(r) - 1)) })
      .then(setEv)
      .catch(() => undefined);
  };

  const acc = stats.total ? stats.correct / stats.total : 0;
  const missed = Object.entries(stats.missed).sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Basic Strategy Trainer</h1>
          <div className="muted" style={{ fontSize: 12.5 }}>{describeRules(rules)}</div>
        </div>
        <Seg<Level>
          value={level}
          onChange={setLevel}
          options={[
            { v: 'easy', l: 'Einsteiger' },
            { v: 'medium', l: 'Fortgeschritten' },
            { v: 'hard', l: 'Profi' },
            { v: 'expert', l: 'Experte' },
          ]}
        />
      </div>
      <div className="muted" style={{ fontSize: 12.5 }}>
        Einsteiger: Hard Totals · Fortgeschritten: + Soft Hands · Profi: + Paare & Surrender · Experte: + Mehrkartenhände
      </div>
      <div className="table-felt stack">
        <div className="zone">
          <div className="zone-label"><span>Dealer</span></div>
          <div className="cards-row"><PlayingCard rank={sit.up} idx={1} /></div>
        </div>
        <div className="zone">
          <div className="zone-label"><span>Deine Hand</span><span className="hand-status">{answer ? advice.info.label : '?'}</span></div>
          <div className="cards-row">{sit.cards.map((c, i) => <PlayingCard key={i} rank={c} idx={i + 2} />)}</div>
        </div>
      </div>
      <div className="row">
        {choices.map((a) => (
          <button key={a} className={`btn ${answer ? (a === correct ? 'primary' : a === answer ? 'danger' : '') : ''}`} style={{ flex: '1 1 110px', minHeight: 54, fontSize: 16 }} onClick={() => choose(a)} disabled={!!answer || !correct}>
            {ACTION_TITLE[a]}
          </button>
        ))}
      </div>
      {!correct && <div className="note">Strategietabelle wird berechnet…</div>}
      {answer && correct && (
        <div className={`advice ${answer === correct ? 'stand' : 'hit'}`}>
          <div className="main-act" style={{ fontSize: 26 }}>{answer === correct ? '✓ Richtig' : '✗ Falsch'}</div>
          <div className="sub">
            Deine Wahl: <b>{ACTION_DE[answer]}</b> · Optimal laut Basic Strategy: <b>{ACTION_DE[correct]}</b>
            {advice.code && <> ({advice.code}: {CODE_INFO[advice.code].long})</>}
          </div>
          {ev && (() => {
            const mine = ev.actions.find((x) => x.action === answer)?.ev;
            const best = ev.actions.find((x) => x.action === correct)?.ev;
            return mine !== undefined && best !== undefined && answer !== correct ? (
              <div className="sub">Kosten des Fehlers für genau diese Karten: {pct(best - mine, 2, false)} des Einsatzes.</div>
            ) : null;
          })()}
          {ev && ev.best && ev.best !== correct && (
            <div className="note warn">Hinweis: Für genau diese Kartenkombination wäre kompositionsabhängig {ACTION_DE[ev.best]} minimal besser – die Basic Strategy gilt für die Summe.</div>
          )}
          <button className="btn primary" onClick={next} style={{ alignSelf: 'flex-start' }}>Nächste Hand →</button>
        </div>
      )}
      {answer && ev && (
        <div className="panel">
          <h2>Erwartungswerte <span className="badge exact">Exakt</span></h2>
          <EVTable actions={ev.actions} best={ev.best} basis={ev.basis} compact />
        </div>
      )}
      <div className="kpis">
        <Kpi label="Genauigkeit" value={`${(acc * 100).toFixed(1).replace('.', ',')} %`} sub={`${stats.correct} / ${stats.total}`} />
        <Kpi label="Serie" value={stats.streak} sub={`Bestwert ${stats.best}`} />
        {(['hard', 'soft', 'pair', 'multi'] as const).map((c) => {
          const v = stats.byCat[c];
          return v ? <Kpi key={c} label={{ hard: 'Hard', soft: 'Soft', pair: 'Paare', multi: 'Mehrkarten' }[c]} value={`${((v[0] / v[1]) * 100).toFixed(0)} %`} sub={`${v[0]} / ${v[1]}`} /> : null;
        })}
      </div>
      {missed.length > 0 && (
        <div className="panel">
          <h2>Häufigste Fehler</h2>
          <div className="row">{missed.map(([k, n]) => <span key={k} className="chip">{k} <b>{n}×</b></span>)}</div>
          <button className="btn small ghost" style={{ marginTop: 8 }} onClick={() => setStats(EMPTY)}>Statistik zurücksetzen</button>
        </div>
      )}
      <div className="note">Lernfortschritt wird nur lokal in diesem Browser gespeichert. Karten werden mit den Wahrscheinlichkeiten eines vollen Schuhs gezogen ({IDX_LABEL.length} Werte, Zehner 4-fach).</div>
    </div>
  );
}
