/**
 * Method C – cross-validation of exact EVs by Monte Carlo for one concrete situation.
 *
 * Each trial deals from the exact remaining shoe (known cards removed). When the
 * engine reports EVs conditional on "dealer has no blackjack" (peek games), trials
 * whose hole card completes a dealer blackjack are rejected, which samples exactly
 * that conditional distribution. Continuation decisions after the first action use
 * the engine's composition-dependent hit/stand policy, resplits are always taken
 * (as in the engine's split model), so the MC run estimates the same quantity the
 * engine computes. The comparison is reported as a z-score.
 */
import { ACE, TEN, idxValue } from './cards';
import type { Action, EVBasis, EVEngine } from './ev';
import { doubleAllowedFor } from './rules';
import { Xoshiro128 } from './rng';

export interface SituationInput {
  up: number;
  hand: number[];
  /** other known removed cards (counts per value index) */
  removed?: number[];
  /** full shoe composition before any card is removed */
  shoe: number[];
}

export interface MCActionResult {
  action: Action;
  trials: number;
  mean: number;
  se: number;
  exact: number;
  z: number;
  basis: EVBasis;
}

function handTotal(cards: number[]): { hard: number; total: number; soft: boolean } {
  let hard = 0;
  let ace = false;
  for (const c of cards) {
    hard += idxValue(c);
    if (c === ACE) ace = true;
  }
  const soft = ace && hard + 10 <= 21;
  return { hard, total: soft ? hard + 10 : hard, soft };
}

export function situationMC(engine: EVEngine, inp: SituationInput, action: Action, trials: number, seed: number): MCActionResult {
  const rules = engine.rules;
  const ctx = { up: inp.up, hand: inp.hand, removed: inp.removed };
  const evalRes = engine.evaluate(ctx);
  const basis = evalRes.basis;
  const exactAct = evalRes.actions.find((a) => a.action === action);
  if (!exactAct) throw new Error(`Aktion ${action} ist in dieser Situation nicht erlaubt`);
  // remaining shoe
  const counts = inp.shoe.slice();
  const rm = (c: number) => {
    if (counts[c] <= 0) throw new Error('Karte nicht im Schuh');
    counts[c]--;
  };
  rm(inp.up);
  inp.hand.forEach(rm);
  if (inp.removed) inp.removed.forEach((n, c) => {
    for (let i = 0; i < n; i++) rm(c);
  });
  const template: number[] = [];
  counts.forEach((n, c) => {
    for (let i = 0; i < n; i++) template.push(c);
  });
  const deck = Uint8Array.from(template);
  const tpl = Uint8Array.from(template);
  const rng = new Xoshiro128(seed);
  let pos = 0;
  const draw = () => {
    const j = pos + rng.int(deck.length - pos);
    const c = deck[j];
    deck[j] = deck[pos];
    deck[pos] = c;
    pos++;
    return c;
  };
  const conditional = basis === 'conditional';
  const removedBase = inp.removed ? inp.removed.slice() : new Array(10).fill(0);
  let sum = 0;
  let sum2 = 0;
  let n = 0;
  let guard = 0;
  while (n < trials && guard < trials * 20) {
    guard++;
    deck.set(tpl);
    pos = 0;
    const hole = draw();
    const dealerBJ = (inp.up === ACE && hole === TEN) || (inp.up === TEN && hole === ACE);
    if (dealerBJ && conditional) continue; // rejection sampling: condition on no dealer BJ
    let payoff = 0;
    if (action === 'surrender') {
      payoff = -0.5;
    } else {
      // player hands: [cards, bet]
      const hands: { cards: number[]; bet: number; isSplit: boolean }[] = [];
      if (action === 'split') {
        const P = inp.hand[0];
        const queue = [P, P];
        let nHands = 2;
        const maxH = P === ACE && !rules.rsa ? 2 : rules.maxSplitHands;
        for (let i = 0; i < queue.length; i++) {
          const cards = [queue[i]];
          for (;;) {
            const c = draw();
            if (c === P && nHands < maxH) {
              queue.push(P);
              nHands++;
              continue;
            }
            cards.push(c);
            break;
          }
          hands.push({ cards, bet: 1, isSplit: true });
        }
        // play each split hand (policy computed ignoring other split hands' non-pair cards, like the engine)
        for (const h of hands) {
          const extra = removedBase.slice();
          extra[P] += nHands - 1;
          if (P === ACE && !rules.hsa) continue;
          const { total, soft } = handTotal(h.cards);
          if (total === 21) continue;
          const ev = engine.evaluate({ up: inp.up, hand: h.cards, removed: extra, handsInRound: maxH, isSplitHand: true });
          let best: Action = 'stand';
          let bestEv = -Infinity;
          for (const a of ev.actions) {
            if (a.action === 'split' || a.action === 'surrender') continue;
            if (a.action === 'double' && !(rules.das && doubleAllowedFor(rules, total, soft))) continue;
            if (a.ev > bestEv) {
              bestEv = a.ev;
              best = a.action;
            }
          }
          if (best === 'double') {
            h.bet = 2;
            h.cards.push(draw());
          } else if (best === 'hit') {
            h.cards.push(draw());
            while (handTotal(h.cards).hard <= 21 && engine.shouldHit(inp.up, h.cards, extra)) h.cards.push(draw());
          }
        }
      } else {
        const cards = inp.hand.slice();
        let bet = 1;
        if (action === 'double') {
          bet = 2;
          cards.push(draw());
        } else if (action === 'hit') {
          cards.push(draw());
          while (handTotal(cards).hard <= 21 && engine.shouldHit(inp.up, cards, inp.removed)) cards.push(draw());
        }
        hands.push({ cards, bet, isSplit: false });
      }
      if (dealerBJ) {
        // unconditional basis: dealer blackjack settles now
        payoff = rules.holeCard === 'enhc' && !rules.obo ? -hands.reduce((s, h) => s + h.bet, 0) : -1;
      } else {
        // dealer plays
        let dh = idxValue(inp.up) + idxValue(hole);
        let da = inp.up === ACE || hole === ACE;
        let dt = da && dh + 10 <= 21 ? dh + 10 : dh;
        const live = hands.some((h) => handTotal(h.cards).hard <= 21);
        if (live)
          while (dt < 17 || (dt === 17 && rules.h17 && da && dh + 10 === 17)) {
            const c = draw();
            dh += idxValue(c);
            if (c === ACE) da = true;
            dt = da && dh + 10 <= 21 ? dh + 10 : dh;
          }
        for (const h of hands) {
          const { hard, total } = handTotal(h.cards);
          if (hard > 21) payoff -= h.bet;
          else if (dt > 21 || total > dt) payoff += h.bet;
          else if (total < dt) payoff -= h.bet;
        }
      }
    }
    sum += payoff;
    sum2 += payoff * payoff;
    n++;
  }
  const mean = sum / n;
  const se = Math.sqrt(Math.max(0, sum2 / n - mean * mean) / n);
  return { action, trials: n, mean, se, exact: exactAct.ev, z: se > 0 ? (mean - exactAct.ev) / se : 0, basis };
}
