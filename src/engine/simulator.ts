/**
 * Monte Carlo blackjack simulator.
 *
 * Shoe models (never mixed):
 *  - 'shoe'     : finite shoe, cards drawn without replacement, reshuffle at the cut card
 *  - 'fresh'    : finite shoe, reshuffled before every round (≈ continuous shuffler)
 *  - 'infinite' : draws with replacement (infinite-deck assumption)
 * An optional start composition (known remaining cards) can be used with 'fresh'.
 *
 * Common random numbers: shoe k is shuffled with a seed derived only from
 * (master seed, k). Different strategies therefore play the identical card order in
 * every shoe, which makes strategy comparisons paired and reproducible.
 */
import { ACE, TEN } from './cards';
import type { Action } from './ev';
import { Rules, doubleAllowedFor } from './rules';
import { Xoshiro128, subSeed } from './rng';
import type { HandView, SimStrategy } from './simStrategies';
import { batchSE } from './stats';

export type ShoeMode = 'shoe' | 'fresh' | 'infinite';

export interface SimConfig {
  rules: Rules;
  shoeMode: ShoeMode;
  /** number of rounds to play */
  rounds: number;
  seed: number;
  /** remaining-shoe composition (value-index counts) for shoeMode 'fresh' */
  startComposition?: number[];
  /** rounds per statistical batch for 'fresh'/'infinite' (default 1000) */
  batchSize?: number;
  /** keep per-round net results and true counts (betting lab) */
  recordStream?: boolean;
}

export interface SimCounters {
  rounds: number;
  /** sum of net results in base-bet units */
  net: number;
  /** sum of squared per-round net results */
  net2: number;
  /** sum of initial bets (units) */
  initial: number;
  /** sum of all money put at risk (initial + doubles + splits + insurance) */
  wagered: number;
  roundsWon: number;
  roundsPushed: number;
  roundsLost: number;
  hands: number;
  handsWon: number;
  handsPushed: number;
  handsLost: number;
  playerBJ: number;
  dealerBJ: number;
  doubles: number;
  splits: number;
  surrenders: number;
  insurances: number;
  busts: number;
  shoes: number;
  /** cumulative-result path statistics (units) */
  peak: number;
  cum: number;
  maxDrawdown: number;
  lossStreak: number;
  maxLossStreak: number;
}

export interface SimBatches {
  net: number[];
  initial: number[];
  rounds: number[];
}

export function emptyCounters(): SimCounters {
  return {
    rounds: 0, net: 0, net2: 0, initial: 0, wagered: 0,
    roundsWon: 0, roundsPushed: 0, roundsLost: 0,
    hands: 0, handsWon: 0, handsPushed: 0, handsLost: 0,
    playerBJ: 0, dealerBJ: 0, doubles: 0, splits: 0, surrenders: 0, insurances: 0, busts: 0, shoes: 0,
    peak: 0, cum: 0, maxDrawdown: 0, lossStreak: 0, maxLossStreak: 0,
  };
}

interface SimHand {
  cards: number[]; // value indices
  ranks: number[]; // 0..12 rank codes (for same-rank split rule)
  bet: number;
  isSplit: boolean;
  splitAces: boolean;
  surrendered: boolean;
  doubled: boolean;
}

const RANKS_PER_DECK = (() => {
  // rank codes 0..12: 0 = A, 1..8 = 2..9, 9..12 = 10 J Q K
  const r: number[] = [];
  for (let code = 0; code < 13; code++) for (let s = 0; s < 4; s++) r.push(code);
  return r;
})();
const rankToValue = (code: number) => (code >= 9 ? TEN : code);

export class Simulator {
  readonly cfg: SimConfig;
  readonly rules: Rules;
  readonly strategy: SimStrategy;
  readonly counters: SimCounters = emptyCounters();
  readonly batches: SimBatches = { net: [], initial: [], rounds: [] };
  /** per-round net (units of the round's initial bet) and TC at round start */
  streamNet: number[] = [];
  streamTC: number[] = [];
  /** money at risk per round in units of the initial bet (≥ 1 with doubles/splits) */
  streamWager: number[] = [];
  /** convergence checkpoints: [rounds, mean EV per initial bet, batch standard error] */
  checkpoints: [number, number, number][] = [];

  private template: Uint8Array;
  private cards: Uint8Array;
  private N: number;
  private pos = 0;
  private limit = 0;
  private cut = 0;
  private rng = new Xoshiro128(1);
  private shoeIndex = 0;
  private roundIndex = 0;
  private rc = 0;
  private batchNet = 0;
  private batchInitial = 0;
  private batchRounds = 0;
  private nextCheckpoint = 1000;
  private hands: SimHand[] = [];
  private view: HandView = {
    cards: [], n: 0, hard: 0, ace: false, total: 0, soft: false, pair: -1,
    canDouble: false, canSplit: false, canSurrender: false, isSplitHand: false, handsInRound: 1,
  };

  constructor(cfg: SimConfig, strategy: SimStrategy) {
    this.cfg = cfg;
    this.rules = cfg.rules;
    this.strategy = strategy;
    const ranks: number[] = [];
    if (cfg.startComposition && cfg.shoeMode === 'fresh') {
      for (let v = 0; v < 10; v++) {
        const n = cfg.startComposition[v];
        for (let i = 0; i < n; i++) ranks.push(v === TEN ? 9 + (i % 4) : v);
      }
    } else {
      for (let d = 0; d < cfg.rules.decks; d++) ranks.push(...RANKS_PER_DECK);
    }
    this.template = Uint8Array.from(ranks);
    this.cards = Uint8Array.from(ranks);
    this.N = ranks.length;
    this.cut = Math.floor(this.N * cfg.rules.penetration);
    this.limit = this.N;
    for (let i = 0; i < cfg.rules.maxSplitHands + 1; i++) {
      this.hands.push({ cards: [], ranks: [], bet: 0, isSplit: false, splitAces: false, surrendered: false, doubled: false });
    }
    this.newShoe(0);
    this.shoeIndex = 0;
    this.counters.shoes = 1;
  }

  // ---------------------------------------------------------------- shoe handling
  private newShoe(index: number): void {
    this.cards.set(this.template);
    this.pos = 0;
    this.limit = this.N;
    this.rng.reseed(subSeed(this.cfg.seed, index));
    this.rc = 0;
  }

  private drawRank(): number {
    if (this.cfg.shoeMode === 'infinite') return this.rng.int(13);
    if (this.pos >= this.limit) this.emergencyReshuffle();
    const j = this.pos + this.rng.int(this.limit - this.pos);
    const c = this.cards[j];
    this.cards[j] = this.cards[this.pos];
    this.cards[this.pos] = c;
    this.pos++;
    return c;
  }

  /** Shoe ran out in the middle of a round: reshuffle the discards (cards dealt before this round). */
  private roundStart = 0;
  private forceShuffle = false;
  private emergencyReshuffle(): void {
    const discards = this.roundStart;
    if (discards <= 0) throw new Error('Kartenschuh erschöpft (Zusammensetzung zu klein für eine Runde)');
    // move current-round cards (roundStart..pos) to the end, discards to the front
    const current = this.cards.slice(this.roundStart, this.pos);
    const disc = this.cards.slice(0, discards);
    this.cards.set(disc, 0);
    this.cards.set(current, discards);
    this.limit = discards;
    this.pos = 0;
    this.roundStart = 0;
    this.rc = 0;
    this.forceShuffle = true;
  }

  private tag(rank: number): void {
    if (rank === 0 || rank >= 9) this.rc--;
    else if (rank <= 5) this.rc++;
  }

  trueCount(): number {
    if (this.cfg.shoeMode === 'infinite') return 0;
    const remaining = this.limit - this.pos;
    const decks = Math.max(0.25, remaining / 52);
    return this.rc / decks;
  }

  // ---------------------------------------------------------------- main loop
  /** Run up to `n` more rounds (chunked execution for workers). Returns rounds played. */
  run(n: number): number {
    const target = Math.min(this.cfg.rounds, this.counters.rounds + n);
    const mode = this.cfg.shoeMode;
    const batchSize = this.cfg.batchSize ?? 1000;
    while (this.counters.rounds < target) {
      if (mode === 'shoe') {
        if (this.pos >= this.cut || this.forceShuffle) {
          this.forceShuffle = false;
          this.flushBatch();
          this.shoeIndex++;
          this.newShoe(this.shoeIndex);
          this.counters.shoes++;
        }
      } else {
        if (mode === 'fresh') this.newShoe(this.roundIndex);
        else if (this.roundIndex % batchSize === 0) this.rng.reseed(subSeed(this.cfg.seed, this.roundIndex));
        if (this.batchRounds >= batchSize) this.flushBatch();
      }
      this.playRound();
      this.roundIndex++;
    }
    if (this.counters.rounds >= this.cfg.rounds) this.flushBatch();
    return this.counters.rounds;
  }

  get done(): boolean {
    return this.counters.rounds >= this.cfg.rounds;
  }

  private flushBatch(): void {
    if (this.batchRounds === 0) return;
    this.batches.net.push(this.batchNet);
    this.batches.initial.push(this.batchInitial);
    this.batches.rounds.push(this.batchRounds);
    this.batchNet = 0;
    this.batchInitial = 0;
    this.batchRounds = 0;
  }

  private setView(h: SimHand, handsInRound: number, canSurrender: boolean): HandView {
    const v = this.view;
    let hard = 0;
    let ace = false;
    for (const c of h.cards) {
      hard += c === ACE ? 1 : c + 1;
      if (c === ACE) ace = true;
    }
    const soft = ace && hard + 10 <= 21;
    const total = soft ? hard + 10 : hard;
    const n = h.cards.length;
    const r = this.rules;
    v.cards = h.cards;
    v.n = n;
    v.hard = hard;
    v.ace = ace;
    v.total = total;
    v.soft = soft;
    const isPair = n === 2 && h.cards[0] === h.cards[1] && (!(r.splitTensSameRankOnly && h.cards[0] === TEN) || h.ranks[0] === h.ranks[1]);
    v.pair = n === 2 && h.cards[0] === h.cards[1] ? h.cards[0] : -1;
    v.canDouble = n === 2 && doubleAllowedFor(r, total, soft) && (!h.isSplit || r.das) && (!h.splitAces || r.hsa);
    v.canSplit = isPair && handsInRound < r.maxSplitHands && (h.cards[0] !== ACE || !h.isSplit || r.rsa);
    v.canSurrender = canSurrender;
    v.isSplitHand = h.isSplit;
    v.handsInRound = handsInRound;
    return v;
  }

  private playRound(): void {
    const r = this.rules;
    const S = this.strategy;
    const cnt = this.counters;
    this.roundStart = this.pos;
    const tc0 = this.trueCount();
    const units = Math.max(0, S.betUnits(tc0));
    let net = 0;
    let wagered = units;

    const p1r = this.drawRank();
    const upr = this.drawRank();
    const p2r = this.drawRank();
    const holer = this.drawRank();
    this.tag(p1r);
    this.tag(upr);
    this.tag(p2r);
    const up = rankToValue(upr);
    const hole = rankToValue(holer);
    const p1 = rankToValue(p1r);
    const p2 = rankToValue(p2r);
    const dealerBJ = (up === ACE && hole === TEN) || (up === TEN && hole === ACE);
    const playerBJ = (p1 === ACE && p2 === TEN) || (p1 === TEN && p2 === ACE);
    const peek = r.holeCard === 'peek';
    if (dealerBJ) cnt.dealerBJ++;
    if (playerBJ) cnt.playerBJ++;

    // insurance (offered with an ace up, before the peek)
    if (up === ACE && units > 0 && S.insurance(this.trueCount())) {
      const ins = 0.5 * units;
      wagered += ins;
      cnt.insurances++;
      net += hole === TEN ? 2 * ins : -ins;
    }

    const hand0 = this.hands[0];
    hand0.cards.length = 0;
    hand0.ranks.length = 0;
    hand0.cards.push(p1, p2);
    hand0.ranks.push(p1r, p2r);
    hand0.bet = units;
    hand0.isSplit = false;
    hand0.splitAces = false;
    hand0.surrendered = false;
    hand0.doubled = false;

    let finished = false;
    // early surrender (before the peek) — also how surrender works without a hole card
    const earlyAllowed = r.surrender === 'early' || (r.holeCard === 'enhc' && r.surrender !== 'none');
    if (!playerBJ && earlyAllowed) {
      const v = this.setView(hand0, 1, true);
      if (S.decide(v, up, this.trueCount()) === 'surrender') {
        net -= 0.5 * units;
        cnt.surrenders++;
        hand0.surrendered = true;
        finished = true;
      }
    }
    if (!finished && peek && dealerBJ) {
      net += playerBJ ? 0 : -units;
      finished = true;
    }
    if (!finished && playerBJ) {
      net += dealerBJ ? 0 : r.bjPayout * units;
      finished = true;
    }
    let nHands = 1;
    if (!finished) {
      for (let i = 0; i < nHands; i++) {
        const h = this.hands[i];
        if (h.cards.length === 1) {
          const rr = this.drawRank();
          this.tag(rr);
          h.cards.push(rankToValue(rr));
          h.ranks.push(rr);
        }
        for (;;) {
          let hard = 0;
          let ace = false;
          for (const c of h.cards) {
            hard += c === ACE ? 1 : c + 1;
            if (c === ACE) ace = true;
          }
          const total = ace && hard + 10 <= 21 ? hard + 10 : hard;
          if (hard > 21 || total === 21) break;
          if (h.splitAces && !r.hsa && h.cards.length >= 2 && !(h.cards.length === 2 && h.cards[1] === ACE && r.rsa && nHands < r.maxSplitHands)) break;
          const canSurr = !earlyAllowed && r.surrender === 'late' && peek && i === 0 && nHands === 1 && h.cards.length === 2;
          const v = this.setView(h, nHands, canSurr);
          let a: Action = S.decide(v, up, this.trueCount());
          if ((a === 'double' && !v.canDouble) || (a === 'split' && !v.canSplit) || (a === 'surrender' && !v.canSurrender)) {
            a = total < 12 ? 'hit' : 'stand';
          }
          if (h.splitAces && !r.hsa && a !== 'split') break;
          if (a === 'stand') break;
          if (a === 'surrender') {
            net -= 0.5 * units;
            h.surrendered = true;
            cnt.surrenders++;
            break;
          }
          if (a === 'hit') {
            const rr = this.drawRank();
            this.tag(rr);
            h.cards.push(rankToValue(rr));
            h.ranks.push(rr);
            continue;
          }
          if (a === 'double') {
            wagered += h.bet;
            h.bet *= 2;
            h.doubled = true;
            cnt.doubles++;
            const rr = this.drawRank();
            this.tag(rr);
            h.cards.push(rankToValue(rr));
            h.ranks.push(rr);
            break;
          }
          // split
          const nh = this.hands[nHands++];
          const pv = h.cards[1];
          nh.cards.length = 0;
          nh.ranks.length = 0;
          nh.cards.push(pv);
          nh.ranks.push(h.ranks[1]);
          nh.bet = units;
          nh.isSplit = true;
          nh.splitAces = pv === ACE;
          nh.surrendered = false;
          nh.doubled = false;
          h.cards.length = 1;
          h.ranks.length = 1;
          h.isSplit = true;
          h.splitAces = pv === ACE;
          wagered += units;
          cnt.splits++;
          const rr = this.drawRank();
          this.tag(rr);
          h.cards.push(rankToValue(rr));
          h.ranks.push(rr);
        }
      }

      // dealer
      this.tag(holer);
      let anyLive = false;
      for (let i = 0; i < nHands; i++) {
        const h = this.hands[i];
        if (h.surrendered) continue;
        let hard = 0;
        for (const c of h.cards) hard += c === ACE ? 1 : c + 1;
        if (hard <= 21) anyLive = true;
      }
      if (!peek && dealerBJ) {
        // European no-hole-card: dealer blackjack revealed now
        if (r.obo) {
          if (!hand0.surrendered || nHands > 1) net -= units;
        } else {
          for (let i = 0; i < nHands; i++) if (!this.hands[i].surrendered) net -= this.hands[i].bet;
        }
      } else {
        let dHard = (up === ACE ? 1 : up + 1) + (hole === ACE ? 1 : hole + 1);
        let dAce = up === ACE || hole === ACE;
        let dTotal = dAce && dHard + 10 <= 21 ? dHard + 10 : dHard;
        if (anyLive) {
          while (dTotal < 17 || (dTotal === 17 && r.h17 && dAce && dHard + 10 === 17)) {
            const rr = this.drawRank();
            this.tag(rr);
            const c = rankToValue(rr);
            dHard += c === ACE ? 1 : c + 1;
            if (c === ACE) dAce = true;
            dTotal = dAce && dHard + 10 <= 21 ? dHard + 10 : dHard;
          }
        }
        const dBust = dTotal > 21;
        for (let i = 0; i < nHands; i++) {
          const h = this.hands[i];
          cnt.hands++;
          if (h.surrendered) {
            cnt.handsLost++;
            continue;
          }
          let hard = 0;
          let ace = false;
          for (const c of h.cards) {
            hard += c === ACE ? 1 : c + 1;
            if (c === ACE) ace = true;
          }
          const total = ace && hard + 10 <= 21 ? hard + 10 : hard;
          if (hard > 21) {
            net -= h.bet;
            cnt.busts++;
            cnt.handsLost++;
            continue;
          }
          const natural = r.bjAfterSplit && h.isSplit && h.cards.length === 2 && total === 21;
          if (natural) {
            net += r.bjPayout * h.bet;
            cnt.handsWon++;
          } else if (dBust || total > dTotal) {
            net += h.bet;
            cnt.handsWon++;
          } else if (total === dTotal) {
            cnt.handsPushed++;
          } else {
            net -= h.bet;
            cnt.handsLost++;
          }
        }
      }
      if (!peek && dealerBJ) {
        for (let i = 0; i < nHands; i++) {
          cnt.hands++;
          if (!this.hands[i].surrendered) cnt.handsLost++;
        }
      }
    } else {
      this.tag(holer);
      cnt.hands++;
      if (net > 0) cnt.handsWon++;
      else if (net === 0) cnt.handsPushed++;
      else cnt.handsLost++;
    }

    // ---- bookkeeping
    cnt.rounds++;
    cnt.net += net;
    cnt.net2 += net * net;
    cnt.initial += units;
    cnt.wagered += wagered;
    if (net > 0) {
      cnt.roundsWon++;
      cnt.lossStreak = 0;
    } else if (net < 0) {
      cnt.roundsLost++;
      cnt.lossStreak++;
      if (cnt.lossStreak > cnt.maxLossStreak) cnt.maxLossStreak = cnt.lossStreak;
    } else cnt.roundsPushed++;
    cnt.cum += net;
    if (cnt.cum > cnt.peak) cnt.peak = cnt.cum;
    if (cnt.peak - cnt.cum > cnt.maxDrawdown) cnt.maxDrawdown = cnt.peak - cnt.cum;
    this.batchNet += net;
    this.batchInitial += units;
    this.batchRounds++;
    if (this.cfg.recordStream) {
      this.streamNet.push(units > 0 ? net / units : 0);
      this.streamTC.push(tc0);
      this.streamWager.push(units > 0 ? wagered / units : 0);
    }
    if (cnt.rounds >= this.nextCheckpoint) {
      this.checkpoints.push([cnt.rounds, cnt.initial > 0 ? cnt.net / cnt.initial : 0, batchSE(this.batches)]);
      this.nextCheckpoint = Math.ceil(this.nextCheckpoint * 1.5);
    }
  }
}
