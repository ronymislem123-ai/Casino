import { useEffect, useMemo, useState } from 'react';
import { RANK_LABELS, RankLabel, rankToIndex, hiLoTag, ACE } from '../../engine/cards';
import { adviseHand, LiveHand } from '../../engine/advisor';
import { describeRules, payoutLabel } from '../../engine/rules';
import type { Action } from '../../engine/ev';
import { useSettings, LiveMode } from '../../state/settings';
import { useStrategyTable } from '../../state/useStrategy';
import { engineClient, LiveEvaluation } from '../../workers/client';
import { PlayingCard } from '../components/Card';
import { EVTable, Seg } from '../components/common';
import { ACTION_SUB, ACTION_TITLE, pct, prob } from '../format';
import { recordDecision, useSession } from '../../state/session';

interface Round {
  dealer: RankLabel[];
  hands: LiveHand[];
  active: number;
  target: 'auto' | 'dealer' | 'seen' | number;
  seen: RankLabel[];
  pendingDouble: number | null;
}

const emptyRound = (): Round => ({
  dealer: [],
  hands: [{ cards: [], isSplit: false, splitAces: false, status: 'open' }],
  active: 0,
  target: 'auto',
  seen: [],
  pendingDouble: null,
});

const handDone = (h: LiveHand, hsa: boolean): boolean => {
  if (h.status !== 'open') return true;
  let hard = 0;
  let ace = false;
  for (const r of h.cards) {
    const i = rankToIndex(r);
    hard += i === ACE ? 1 : i + 1;
    if (i === ACE) ace = true;
  }
  const total = ace && hard + 10 <= 21 ? hard + 10 : hard;
  if (hard > 21 || total === 21) return true;
  if (h.splitAces && !hsa && h.cards.length >= 2 && !(h.cards.length === 2 && h.cards[1] === 'A')) return true;
  return false;
};

export function LivePage({ goSettings }: { goSettings: () => void }) {
  const { rules, liveMode, update, showDetails } = useSettings();
  const { grid, progress, table } = useStrategyTable(rules);
  const [round, setRound] = useState<Round>(emptyRound);
  const [history, setHistory] = useState<Round[]>([]);
  const [shoeSeen, setShoeSeen] = useState<RankLabel[]>([]);
  const [exact, setExact] = useState<LiveEvaluation | null>(null);
  const [evalErr, setEvalErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const session = useSession();

  const commit = (r: Round) => {
    setHistory((h) => [...h.slice(-80), round]);
    setRound(r);
  };

  const advance = (r: Round): Round => {
    // move to next open hand when the active one is finished
    let a = r.active;
    while (a < r.hands.length && handDone(r.hands[a], rules.hsa) && r.hands[a].cards.length >= 2) a++;
    if (a >= r.hands.length) a = r.hands.length - 1;
    return { ...r, active: a };
  };

  const addCard = (rank: RankLabel) => {
    const r: Round = { ...round, hands: round.hands.map((h) => ({ ...h, cards: [...h.cards] })), dealer: [...round.dealer], seen: [...round.seen] };
    let t = r.target;
    if (t === 'auto') {
      const h0 = r.hands[0];
      if (r.hands.length === 1 && h0.cards.length < 2) t = 0;
      else if (r.dealer.length === 0) t = 'dealer';
      else t = r.active;
    }
    if (t === 'dealer') {
      r.dealer.push(rank);
      r.target = 'auto';
    } else if (t === 'seen') {
      r.seen.push(rank);
    } else {
      const idx = t as number;
      const h = r.hands[idx];
      h.cards.push(rank);
      if (r.pendingDouble === idx) {
        h.status = 'double';
        r.pendingDouble = null;
      }
      r.target = 'auto';
      if (idx === r.active) Object.assign(r, advance(r));
    }
    commit(r);
  };

  const removeCard = (where: 'dealer' | 'seen' | number, i: number) => {
    const r: Round = { ...round, hands: round.hands.map((h) => ({ ...h, cards: [...h.cards] })), dealer: [...round.dealer], seen: [...round.seen] };
    if (where === 'dealer') r.dealer.splice(i, 1);
    else if (where === 'seen') r.seen.splice(i, 1);
    else {
      r.hands[where].cards.splice(i, 1);
      r.hands[where].status = 'open';
      r.active = where;
    }
    commit(r);
  };

  const undo = () => {
    setHistory((h) => {
      if (!h.length) return h;
      setRound(h[h.length - 1]);
      return h.slice(0, -1);
    });
  };

  const newRound = () => {
    if (liveMode !== 'basic') setShoeSeen((s) => [...s, ...round.dealer, ...round.seen, ...round.hands.flatMap((h) => h.cards)]);
    setHistory([]);
    setRound(emptyRound());
  };

  const resetHand = () => {
    const r: Round = { ...round, hands: round.hands.map((h, i) => (i === round.active ? { ...h, cards: h.isSplit ? h.cards.slice(0, 1) : [], status: 'open' } : h)) };
    commit(r);
  };

  // ---------------------------------------------------------------- derived
  const up = round.dealer.length ? rankToIndex(round.dealer[0]) : null;
  const hand = round.hands[round.active];
  const removedCounts = useMemo(() => {
    if (liveMode === 'basic') return undefined;
    const c = new Array(10).fill(0);
    const add = (x: RankLabel) => c[rankToIndex(x)]++;
    shoeSeen.forEach(add);
    round.seen.forEach(add);
    round.dealer.slice(1).forEach(add);
    round.hands.forEach((h, i) => i !== round.active && h.cards.forEach(add));
    return c;
  }, [liveMode, shoeSeen, round]);

  const allSeen = useMemo(() => [...shoeSeen, ...round.seen, ...round.dealer, ...round.hands.flatMap((h) => h.cards)], [shoeSeen, round]);
  const rc = allSeen.reduce((s, x) => s + hiLoTag(rankToIndex(x)), 0);
  const cardsLeft = rules.decks * 52 - allSeen.length;
  const tc = rc / Math.max(0.25, cardsLeft / 52);

  const evalKey = JSON.stringify([rules, liveMode, round.active, hand?.cards, hand?.isSplit, up, removedCounts, round.hands.length]);
  useEffect(() => {
    setExact(null);
    setEvalErr(null);
    if (!hand || up === null || hand.cards.length < 2) return;
    let alive = true;
    setBusy(true);
    engineClient
      .evaluate(rules, {
        up,
        hand: hand.cards.map(rankToIndex),
        removed: removedCounts,
        handsInRound: round.hands.length,
        isSplitHand: hand.isSplit,
        splitAces: hand.splitAces,
        splitForbidden: rules.splitTensSameRankOnly && hand.cards.length === 2 && rankToIndex(hand.cards[0]) === 9 && hand.cards[0] !== hand.cards[1],
      })
      .then((e) => alive && setExact(e))
      .catch((e) => alive && setEvalErr((e as Error).message))
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evalKey]);

  const advice = hand
    ? adviseHand({ rules, grid, hand, handIndex: round.active, handsInRound: round.hands.length, up, mode: liveMode, exact, trueCount: liveMode === 'count' ? tc : null })
    : null;

  const doAction = (a: Action) => {
    if (!hand) return;
    if (session.active && advice?.action) recordDecision(a === advice.action);
    const r: Round = { ...round, hands: round.hands.map((h) => ({ ...h, cards: [...h.cards] })) };
    const h = r.hands[r.active];
    if (a === 'stand') h.status = 'stand';
    if (a === 'surrender') h.status = 'surrender';
    if (a === 'double') {
      r.pendingDouble = r.active;
      r.target = r.active;
    }
    if (a === 'split' && h.cards.length === 2) {
      const [c1, c2] = h.cards;
      const aces = rankToIndex(c1) === ACE;
      r.hands.splice(r.active, 1, { cards: [c1], isSplit: true, splitAces: aces, status: 'open' }, { cards: [c2], isSplit: true, splitAces: aces, status: 'open' });
      r.target = r.active;
    }
    if (a === 'hit') r.target = r.active;
    commit(a === 'stand' || a === 'surrender' ? advance(r) : r);
  };

  const targetLabel =
    round.target === 'dealer' ? 'Dealer' : round.target === 'seen' ? 'Gesehene Karten' : typeof round.target === 'number' ? `Hand ${round.target + 1}` : (() => {
      if (round.hands.length === 1 && round.hands[0].cards.length < 2) return 'Meine Karten';
      if (round.dealer.length === 0) return 'Dealer-Karte';
      return `Hand ${round.active + 1}`;
    })();

  // ---------------------------------------------------------------- render
  const adv = advice;
  const advClass = adv?.state === 'decide' && adv.action ? adv.action : adv?.state === 'twentyone' ? 'stand' : 'none';
  const conditional =
    adv?.code && adv.action && (adv.code === 'Dh' || adv.code === 'Ds' || adv.code === 'Rh' || adv.code === 'Rs' || adv.code === 'Rp') && adv.fallback && adv.action !== adv.fallback
      ? `sonst ${ACTION_TITLE[adv.fallback]}`
      : null;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Live Assistant</h1>
          <button className="chip" onClick={goSettings} title="Regeln ändern">
            <b>Regeln</b> {describeRules(rules).split(' · ').slice(0, 6).join(' · ')}
          </button>
        </div>
        <Seg<LiveMode>
          ariaLabel="Entscheidungsmodus"
          value={liveMode}
          onChange={(m) => update({ liveMode: m })}
          options={[
            { v: 'basic', l: 'Basic' },
            { v: 'composition', l: 'Komposition' },
            { v: 'count', l: 'Hi-Lo' },
          ]}
        />
      </div>

      {/* recommendation */}
      <div className={`advice ${advClass}`} aria-live="polite">
        {!adv || adv.state === 'need-cards' ? (
          <>
            <div className="main-act muted" style={{ fontSize: 24 }}>{hand?.isSplit ? `Hand ${round.active + 1}: zweite Karte` : 'Karten eingeben'}</div>
            <div className="sub">{hand?.isSplit ? 'Nach dem Split erhält jede Hand eine zweite Karte – jetzt eingeben.' : 'Zuerst deine zwei Karten, dann die offene Dealer-Karte.'}</div>
          </>
        ) : adv.state === 'need-dealer' ? (
          <>
            <div className="main-act muted" style={{ fontSize: 24 }}>Dealer-Karte?</div>
            <div className="sub">{adv.info.label} — jetzt die offene Karte des Dealers eingeben.</div>
          </>
        ) : adv.state === 'blackjack' ? (
          <>
            <div className="main-act act-stand">BLACKJACK</div>
            <div className="sub">Auszahlung {payoutLabel(rules.bjPayout)}{up !== null && up === ACE ? ' · Even Money entspricht einer Versicherung (siehe unten)' : ''}</div>
          </>
        ) : adv.state === 'bust' ? (
          <>
            <div className="main-act act-hit">BUST</div>
            <div className="sub">{adv.info.label} — Hand verloren.</div>
          </>
        ) : adv.state === 'twentyone' ? (
          <>
            <div className="main-act act-stand">STAND</div>
            <div className="sub">21 — stehen bleiben.</div>
          </>
        ) : adv.state === 'finished' ? (
          <>
            <div className="main-act muted" style={{ fontSize: 24 }}>Hand abgeschlossen</div>
            <div className="sub">{hand?.status === 'double' ? 'Verdoppelt' : hand?.status === 'surrender' ? 'Aufgegeben' : adv.notes[0] ?? 'Stand'} · {adv.info.label}</div>
          </>
        ) : adv.action ? (
          <>
            <div className={`main-act act-${adv.action}`}>
              {ACTION_TITLE[adv.action]}
              {conditional && <span style={{ fontSize: 18, fontWeight: 700, marginLeft: 10 }} className="muted">({conditional})</span>}
            </div>
            <div className="sub">
              {ACTION_SUB[adv.action]} · {adv.info.label} gegen {round.dealer[0]}
            </div>
            <div className="muted" style={{ fontSize: 12.5 }}>
              Grundlage: {adv.basis}
              {exact?.best && exact.actions.length > 1 && (() => {
                const s = exact.actions.slice().sort((a, b) => b.ev - a.ev);
                return ` · EV ${pct(s.find((x) => x.action === adv.action)?.ev ?? s[0].ev)} · Vorsprung ${pct((s[0].ev - s[1].ev), 2, false)} vor ${ACTION_TITLE[s[1].action]}`;
              })()}
            </div>
            {adv.notes.map((n) => (
              <div key={n} className="note warn">{n}</div>
            ))}
          </>
        ) : (
          <div className="main-act muted" style={{ fontSize: 22 }}>{busy ? 'Berechne…' : 'Strategie wird berechnet…'} {progress > 0 && progress < 1 ? `${Math.round(progress * 100)} %` : ''}</div>
        )}
      </div>

      {/* table */}
      <div className="table-felt stack">
        <div className={`zone ${targetLabel === 'Dealer' || targetLabel === 'Dealer-Karte' ? 'target' : ''}`} onClick={() => setRound({ ...round, target: 'dealer' })}>
          <div className="zone-label">
            <span>Dealer</span>
            {up === ACE && <span className="hand-status">Ass offen · Peek {rules.holeCard === 'peek' ? 'ja' : 'nein'}</span>}
          </div>
          <div className="cards-row">
            {round.dealer.length === 0 && <PlayingCard rank={null} />}
            {round.dealer.map((c, i) => (
              <PlayingCard key={i} rank={c} idx={i + 1} onClick={() => removeCard('dealer', i)} />
            ))}
          </div>
        </div>
        <div className="hands">
          {round.hands.map((h, i) => {
            const isTarget = round.target === i || (round.target === 'auto' && targetLabel === (i === 0 && round.hands.length === 1 && h.cards.length < 2 ? 'Meine Karten' : `Hand ${i + 1}`));
            const info = adviseHand({ rules, grid, hand: h, handIndex: i, handsInRound: round.hands.length, up, mode: 'basic', exact: null, trueCount: null }).info;
            return (
              <div key={i} className={`zone hand-box ${isTarget ? 'target' : ''}`} onClick={() => setRound({ ...round, active: i, target: i })}>
                <div className="zone-label">
                  <span>{round.hands.length > 1 ? `Hand ${i + 1}${i === round.active ? ' ◂' : ''}` : 'Meine Karten'}</span>
                  <span className="hand-status">
                    {info.type !== 'empty' ? info.label : '–'}
                    {h.status !== 'open' ? ` · ${h.status === 'stand' ? 'Stand' : h.status === 'double' ? 'Double' : h.status === 'surrender' ? 'Surrender' : 'fertig'}` : ''}
                    {round.pendingDouble === i ? ' · Double: 1 Karte' : ''}
                  </span>
                </div>
                <div className="cards-row">
                  {h.cards.length === 0 && <PlayingCard rank={null} />}
                  {h.cards.map((c, j) => (
                    <PlayingCard key={j} rank={c} idx={j + i * 2} onClick={() => removeCard(i, j)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {liveMode !== 'basic' && (
          <div className={`zone ${round.target === 'seen' ? 'target' : ''}`} onClick={() => setRound({ ...round, target: round.target === 'seen' ? 'auto' : 'seen' })}>
            <div className="zone-label">
              <span>Andere gesehene Karten (diese Runde)</span>
              <span className="hand-status">Schuh: {allSeen.length} gesehen · {cardsLeft} übrig{liveMode === 'count' ? ` · RC ${rc > 0 ? '+' : ''}${rc} · TC ${tc >= 0 ? '+' : ''}${tc.toFixed(1)}` : ''}</span>
            </div>
            <div className="cards-row" style={{ minHeight: 40 }}>
              {round.seen.length === 0 && <span className="muted" style={{ fontSize: 12 }}>Antippen, um Karten anderer Spieler einzugeben</span>}
              {round.seen.map((c, i) => (
                <PlayingCard key={i} rank={c} idx={i} small onClick={() => removeCard('seen', i)} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* keypad */}
      <div className="panel tight stack">
        <div className="row between">
          <span className="muted" style={{ fontSize: 12.5 }}>
            Eingabe für: <b style={{ color: 'var(--gold)' }}>{targetLabel}</b>
          </span>
          <span className="muted" style={{ fontSize: 12 }}>Karte antippen = entfernen</span>
        </div>
        <div className="keypad">
          {RANK_LABELS.map((r) => (
            <button key={r} onClick={() => addCard(r)} aria-label={`Karte ${r}`}>
              {r}
            </button>
          ))}
        </div>
        <div className="row">
          <button className="btn small" onClick={undo} disabled={!history.length}>↶ Rückgängig</button>
          <button className="btn small" onClick={resetHand}>Hand zurücksetzen</button>
          <button className="btn small primary" onClick={newRound}>Neue Runde</button>
          {liveMode !== 'basic' && (
            <button className="btn small ghost" onClick={() => { setShoeSeen([]); newRound(); }}>Neuer Schuh (gemischt)</button>
          )}
        </div>
      </div>

      {/* action buttons */}
      {adv?.state === 'decide' && (
        <div className="panel tight">
          <div className="row">
            <span className="muted" style={{ fontSize: 12.5 }}>Gespielt:</span>
            {(['hit', 'stand', 'double', 'split', 'surrender'] as Action[])
              .filter((a) => a === 'hit' || a === 'stand' || (a === 'double' && adv.can.double) || (a === 'split' && adv.can.split) || (a === 'surrender' && adv.can.surrender))
              .map((a) => (
                <button key={a} className={`btn small ${a === adv.action ? 'primary' : ''}`} onClick={() => doAction(a)}>
                  {ACTION_TITLE[a]}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* details */}
      {showDetails && hand && hand.cards.length >= 2 && up !== null && (
        <div className="grid2">
          <div className="panel">
            <h2>Erwartungswerte <span className="badge exact">Exakt berechnet</span></h2>
            {evalErr && <div className="note warn">{evalErr}</div>}
            {exact && exact.actions.length > 0 ? (
              <EVTable actions={exact.actions} best={exact.best} basis={exact.basis} />
            ) : (
              <div className="muted">{busy ? 'Berechne…' : 'Keine Entscheidung erforderlich.'}</div>
            )}
            {exact && (
              <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>
                Methode: kombinatorische Rekursion ohne Zurücklegen{liveMode === 'basic' ? ' (nur eigene Karten + Dealer-Karte entfernt)' : ' (alle bekannten Karten entfernt)'} · {exact.ms.toFixed(0)} ms
                {exact.actions.some((a) => a.action === 'split') && ' · Split: Standard-Näherung für Kartenentnahme der Nachbarhände'}
              </div>
            )}
          </div>
          <div className="panel stack">
            <h2>Dealer & Versicherung</h2>
            {exact?.dealer && (
              <div className="tbl-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Dealer-Endstand</th>
                      {['17', '18', '19', '20', '21', 'Bust', 'BJ'].map((x) => (
                        <th key={x}>{x}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Wahrscheinlichkeit</td>
                      {exact.dealer.map((p, i) => (
                        <td key={i}>{prob(p)}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            {exact?.insurance && (
              <div className={`note ${exact.insurance.ev > 0 ? 'info' : ''}`}>
                Versicherung: P(Zehn als Hole Card) = {prob(exact.insurance.pTen, 2)} → EV {pct(exact.insurance.ev)} pro versicherter Einheit —{' '}
                <b>{exact.insurance.ev > 0 ? 'Versicherung lohnt sich bei dieser Zusammensetzung' : 'keine Versicherung'}</b>
                {liveMode === 'count' && ` · Hi-Lo-Regel: Versicherung ab TC +3 (aktuell ${tc.toFixed(1)})`}
              </div>
            )}
            {liveMode === 'count' && (
              <div className="note info">
                Hi-Lo: Running Count {rc > 0 ? '+' : ''}{rc}, True Count {tc.toFixed(2)} ({(cardsLeft / 52).toFixed(1)} Decks übrig).
                {adv?.indexPlay ? ` Index-Play: ${adv.indexPlay.label} (Index ${adv.indexPlay.index >= 0 ? '+' : ''}${adv.indexPlay.index}).` : ' Kein Index-Play in dieser Situation.'} Zählen ist eine optionale Erweiterung und ersetzt nicht die Basic Strategy.
              </div>
            )}
            {!table && <div className="note">Strategietabelle für diese Regeln wird im Hintergrund exakt berechnet ({Math.round(progress * 100)} %).</div>}
            <div className="note">Keine Gewinngarantie: Auch optimale Entscheidungen beseitigen den Hausvorteil nicht.</div>
          </div>
        </div>
      )}
    </div>
  );
}
