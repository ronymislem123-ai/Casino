/**
 * Exact / near-exact expected-value engine (combinatorial analysis).
 *
 * For a given shoe composition the engine evaluates Stand, Hit, Double, Split and
 * Surrender by recursion over every possible card sequence, sampling WITHOUT
 * replacement (or with constant probabilities for the infinite deck).
 *
 * Exact parts: stand, hit (with optimal composition-dependent continuation),
 * double, surrender, insurance, dealer distributions, dealer-blackjack conditioning.
 * Approximate part: split EV. Each split hand is evaluated with exact card removal of
 * its own cards and of the pair cards drawn by the resplit process, but ignoring the
 * removal of non-pair cards drawn to the *other* split hands. This is the standard
 * approach of published combinatorial analyzers; its error is far below 0.01 % of
 * the house edge (validated against independent reference values, see tests).
 *
 * All internal values are "unnormalised" U = E[payoff · 1{dealer has no BJ}] when the
 * dealer blackjack is excluded (peek or OBO); see docs/MATH_SPEC.md.
 */
import { ACE, TEN, idxValue, INFINITE_PROBS } from './cards';
import { dealerDistFast, dealerDistFinite, dealerDistInfinite, O_BJ, O_BUST } from './dealer';
import { Rules, dealerBJExcluded, doubleAllowedFor } from './rules';

export type Action = 'stand' | 'hit' | 'double' | 'split' | 'surrender';
export const ACTIONS: Action[] = ['stand', 'hit', 'double', 'split', 'surrender'];

/** EV plus outcome masses. For split, w/p/l are *expected numbers of hands*. */
export interface Stat {
  ev: number;
  w: number;
  p: number;
  l: number;
}

const ZERO: Stat = { ev: 0, w: 0, p: 0, l: 0 };

function addScaled(acc: Stat, s: Stat, f: number): void {
  acc.ev += f * s.ev;
  acc.w += f * s.w;
  acc.p += f * s.p;
  acc.l += f * s.l;
}

export function softTotal(hard: number, ace: boolean): number {
  return ace && hard + 10 <= 21 ? hard + 10 : hard;
}

export interface HandContext {
  /** Dealer upcard value index. */
  up: number;
  /** Cards of the hand being decided (value indices). */
  hand: number[];
  /** Other cards known to be out of the shoe (counts per value index): other hands, seen cards. */
  removed?: number[];
  /** Number of player hands currently in the round (1 = no split yet). */
  handsInRound?: number;
  /** The hand results from a split. */
  isSplitHand?: boolean;
  /** The hand is a split-ace hand. */
  splitAces?: boolean;
  /** For split pairs of ten-value cards with differing ranks the split may be forbidden. */
  splitForbidden?: boolean;
}

export interface RawActions {
  stats: Partial<Record<Action, Stat>>;
  /** Expected number of final hands produced by splitting. */
  splitHands?: number;
  /** P(no dealer blackjack | known cards) — 1 if no blackjack is possible or ENHC-all mode. */
  mass: number;
  /** P(dealer blackjack | known cards). */
  pBJ: number;
}

export interface ActionResult {
  action: Action;
  /** EV per initial unit bet on the basis given by `basis`. */
  ev: number;
  /** Probabilities of win / push / loss of the hand (for split: per resulting hand). */
  win: number;
  push: number;
  lose: number;
}

export type EVBasis = 'conditional' | 'unconditional';

export interface HandEvaluation {
  actions: ActionResult[];
  best: Action | null;
  basis: EVBasis;
  pDealerBJ: number;
  splitHands?: number;
  /** Composition flags. */
  total: number;
  soft: boolean;
  isBlackjack: boolean;
  bust: boolean;
}

interface Comp {
  A: Stat;
  B: Stat;
  q: number;
  hA: number;
}

export class EVEngine {
  readonly rules: Rules;
  readonly infinite: boolean;
  readonly exBJ: boolean;
  readonly base: Int32Array;
  private readonly pow: number[];
  private readonly probs: readonly number[];

  // mutable working state
  private rem = new Int32Array(10);
  private remTotal = 0;
  private key = 0;

  private dealerCache: Map<number, Float64Array>[] = [];
  private hsMemo: Map<number, Stat>[] = [];

  /** Max. number of extra pair cards whose removal is tracked exactly in the resplit DP. */
  readonly splitDepthCap: number;

  /** @param shoe composition of the shoe (counts per value index) or 'infinite' */
  constructor(rules: Rules, shoe: number[] | 'infinite', opts: { splitDepthCap?: number } = {}) {
    this.rules = rules;
    this.splitDepthCap = opts.splitDepthCap ?? 3;
    this.infinite = shoe === 'infinite';
    this.exBJ = dealerBJExcluded(rules);
    this.base = new Int32Array(10);
    this.pow = new Array(10).fill(0);
    this.probs = INFINITE_PROBS;
    if (shoe !== 'infinite') {
      let p = 1;
      for (let r = 0; r < 10; r++) {
        this.base[r] = shoe[r];
        this.pow[r] = p;
        p *= shoe[r] + 1;
      }
      if (p > Number.MAX_SAFE_INTEGER) throw new Error('Kartenschuh zu groß für exakte Schlüssel');
    }
    for (let i = 0; i < 20; i++) this.dealerCache.push(new Map());
  }

  // ---------------------------------------------------------------- state helpers
  private pr(r: number): number {
    if (this.infinite) return this.probs[r];
    return this.remTotal > 0 ? this.rem[r] / this.remTotal : 0;
  }
  private take(r: number): void {
    if (this.infinite) return;
    this.rem[r]--;
    this.remTotal--;
    this.key += this.pow[r];
  }
  private untake(r: number): void {
    if (this.infinite) return;
    this.rem[r]++;
    this.remTotal++;
    this.key -= this.pow[r];
  }
  private available(r: number): boolean {
    return this.infinite || this.rem[r] > 0;
  }

  /** Initialise the working shoe = base − upcard − hand − removed. */
  private setState(up: number, hand: number[], removed?: number[]): void {
    if (this.infinite) return;
    this.rem.set(this.base);
    this.remTotal = 0;
    for (let r = 0; r < 10; r++) this.remTotal += this.base[r];
    this.key = 0;
    const all = [up, ...hand];
    if (removed) for (let r = 0; r < 10; r++) for (let k = 0; k < (removed[r] || 0); k++) all.push(r);
    for (const c of all) {
      if (this.rem[c] <= 0) throw new Error('Unmögliche Kartenkombination: Karte nicht mehr im Schuh');
      this.take(c);
    }
  }

  /** P(hole card completes a dealer blackjack) for the current state. */
  private pHoleBJ(up: number): number {
    if (up === ACE) return this.pr(TEN);
    if (up === TEN) return this.pr(ACE);
    return 0;
  }
  /** Mass of the hole-card distribution used by U values (P(no BJ) if excluded, else 1). */
  private mass(up: number): number {
    return this.exBJ ? 1 - this.pHoleBJ(up) : 1;
  }

  /** Dealer distribution for the current working shoe (cached). */
  dealer(up: number): Float64Array {
    const m = this.dealerCache[up * 2 + (this.exBJ ? 1 : 0)];
    const hit = m.get(this.key);
    if (hit) return hit;
    const d = this.infinite
      ? dealerDistInfinite(this.probs, up, this.rules.h17, this.exBJ)
      : dealerDistFast(this.rem, up, this.rules.h17, this.exBJ);
    m.set(this.key, d);
    return d;
  }

  // ---------------------------------------------------------------- primitive values
  private standStat(up: number, total: number, bet: number): Stat {
    const d = this.dealer(up);
    let w = d[O_BUST];
    let p = 0;
    let l = d[O_BJ];
    for (let t = 17; t <= 21; t++) {
      const x = d[t - 17];
      if (total > t) w += x;
      else if (total === t) p += x;
      else l += x;
    }
    return { ev: bet * (w - l), w, p, l };
  }

  private bjStat(up: number): Stat {
    // a natural (only possible after split with bjAfterSplit): wins unless dealer BJ
    const d = this.dealer(up);
    let w = 0;
    for (let o = 0; o < O_BJ; o++) w += d[o];
    return { ev: this.rules.bjPayout * w, w, p: d[O_BJ], l: 0 };
  }

  private bustStat(up: number, bet: number): Stat {
    const m = this.mass(up);
    return { ev: -bet * m, w: 0, p: 0, l: m };
  }

  /** Optimal hit/stand value of a non-busted hand (composition dependent). */
  private hsBest(up: number, hard: number, ace: boolean): Stat {
    const idx = up * 64 + hard * 2 + (ace ? 1 : 0);
    let m = this.hsMemo[idx];
    if (!m) m = this.hsMemo[idx] = new Map();
    const c = m.get(this.key);
    if (c) return c;
    const total = softTotal(hard, ace);
    let best = this.standStat(up, total, 1);
    if (total < 21) {
      const h = this.hitStat(up, hard, ace);
      if (h.ev > best.ev) best = h;
    }
    m.set(this.key, best);
    return best;
  }

  private hitStat(up: number, hard: number, ace: boolean): Stat {
    const acc: Stat = { ev: 0, w: 0, p: 0, l: 0 };
    for (let r = 0; r < 10; r++) {
      if (!this.available(r)) continue;
      const p = this.pr(r);
      this.take(r);
      const nh = hard + idxValue(r);
      const sub = nh > 21 ? this.bustStat(up, 1) : this.hsBest(up, nh, ace || r === ACE);
      this.untake(r);
      addScaled(acc, sub, p);
    }
    return acc;
  }

  private doubleStat(up: number, hard: number, ace: boolean): Stat {
    const acc: Stat = { ev: 0, w: 0, p: 0, l: 0 };
    for (let r = 0; r < 10; r++) {
      if (!this.available(r)) continue;
      const p = this.pr(r);
      this.take(r);
      const nh = hard + idxValue(r);
      const sub = nh > 21 ? this.bustStat(up, 2) : this.standStat(up, softTotal(nh, ace || r === ACE), 2);
      this.untake(r);
      addScaled(acc, sub, p);
    }
    return acc;
  }

  /** Best value of a two-card hand {P, c} that arose from a split (no further split). */
  private splitHandValue(up: number, P: number, c: number): Stat {
    const hard = idxValue(P) + idxValue(c);
    const ace = P === ACE || c === ACE;
    const total = softTotal(hard, ace);
    const soft = ace && hard + 10 <= 21;
    if (P === ACE && !this.rules.hsa) {
      if (total === 21 && this.rules.bjAfterSplit) return this.bjStat(up);
      return this.standStat(up, total, 1);
    }
    if (total === 21 && this.rules.bjAfterSplit && P !== c && (P === ACE || c === ACE)) return this.bjStat(up);
    let best = this.hsBest(up, hard, ace);
    if (this.rules.das && doubleAllowedFor(this.rules, total, soft)) {
      const d = this.doubleStat(up, hard, ace);
      if (d.ev > best.ev) best = d;
    }
    return best;
  }

  /**
   * Split EV with resplitting (DP over hands-in-play, pending hands and extra pair
   * cards removed). Precondition: working state has both pair cards removed.
   */
  private splitStat(up: number, P: number, handsNow: number): { stat: Stat; hands: number } {
    const canResplit = P !== ACE || this.rules.rsa;
    const nCap = canResplit ? this.rules.maxSplitHands : handsNow + 1;
    const comps = new Map<number, Comp>();
    const getK = (kIn: number): Comp => {
      const k = this.infinite ? 0 : Math.min(kIn, this.splitDepthCap);
      const hit = comps.get(k);
      if (hit) return hit;
      let taken = 0;
      let ok = true;
      for (let i = 0; i < k; i++) {
        if (!this.available(P)) {
          ok = false;
          break;
        }
        this.take(P);
        taken++;
      }
      const A: Stat = { ev: 0, w: 0, p: 0, l: 0 };
      const B: Stat = { ev: 0, w: 0, p: 0, l: 0 };
      let q = 0;
      let hA = 0;
      if (ok && (this.infinite || this.remTotal > 0)) {
        q = this.available(P) ? this.pr(P) : 0;
        for (let c = 0; c < 10; c++) {
          if (c === P || !this.available(c)) continue;
          const p = this.pr(c);
          this.take(c);
          addScaled(A, this.splitHandValue(up, P, c), p);
          this.untake(c);
          hA += p;
        }
        if (q > 0) {
          this.take(P);
          addScaled(B, this.splitHandValue(up, P, P), q);
          this.untake(P);
        }
      }
      for (let i = 0; i < taken; i++) this.untake(P);
      const res = { A, B, q, hA };
      comps.set(k, res);
      return res;
    };
    const memo = new Map<number, { s: Stat; n: number }>();
    const W = (h: number, pend: number, k: number): { s: Stat; n: number } => {
      if (pend === 0) return { s: ZERO, n: 0 };
      const key = (h * 32 + pend) * 128 + k;
      const m = memo.get(key);
      if (m) return m;
      const { A, B, q, hA } = getK(k);
      const s: Stat = { ev: A.ev, w: A.w, p: A.p, l: A.l };
      let n = hA;
      const rest = W(h, pend - 1, k);
      addScaled(s, rest.s, 1 - q);
      n += (1 - q) * rest.n;
      if (q > 0) {
        if (h < nCap) {
          const nx = W(h + 1, pend + 1, k + 1);
          addScaled(s, nx.s, q);
          n += q * nx.n;
        } else {
          addScaled(s, B, 1);
          n += q;
          const nx = W(h, pend - 1, k + 1);
          addScaled(s, nx.s, q);
          n += q * nx.n;
        }
      }
      const res = { s, n };
      memo.set(key, res);
      return res;
    };
    const r = W(handsNow + 1, 2, 0);
    return { stat: r.s, hands: r.n };
  }

  // ---------------------------------------------------------------- public API
  /** Raw (unnormalised) action values for a hand. Only allowed actions are present. */
  rawActions(ctx: HandContext): RawActions {
    const { up, hand } = ctx;
    const handsInRound = ctx.handsInRound ?? 1;
    const isSplitHand = !!ctx.isSplitHand;
    const splitAces = !!ctx.splitAces;
    this.setState(up, hand, ctx.removed);
    const pBJ = this.pHoleBJ(up);
    const mass = this.mass(up);
    const stats: Partial<Record<Action, Stat>> = {};
    let hard = 0;
    let ace = false;
    for (const c of hand) {
      hard += idxValue(c);
      if (c === ACE) ace = true;
    }
    if (hard > 21) return { stats, mass, pBJ };
    const total = softTotal(hard, ace);
    const soft = ace && hard + 10 <= 21;
    const n = hand.length;
    const r = this.rules;
    const oneCardOnly = splitAces && !r.hsa && n >= 2;

    stats.stand = this.standStat(up, total, 1);
    if (total < 21 && !oneCardOnly) stats.hit = this.hitStat(up, hard, ace);

    if (n === 2 && !oneCardOnly && doubleAllowedFor(r, total, soft) && (!isSplitHand || r.das)) {
      stats.double = this.doubleStat(up, hard, ace);
    }
    let splitHands: number | undefined;
    if (n === 2 && hand[0] === hand[1] && !ctx.splitForbidden && handsInRound < r.maxSplitHands) {
      const P = hand[0];
      const allowed = P !== ACE || !isSplitHand || r.rsa;
      if (allowed) {
        const s = this.splitStat(up, P, handsInRound);
        stats.split = s.stat;
        splitHands = s.hands;
      }
    }
    if (n === 2 && !isSplitHand && handsInRound === 1 && r.surrender !== 'none') {
      stats.surrender = { ev: -0.5 * mass, w: 0, p: 0, l: mass };
    }
    return { stats, mass, pBJ, splitHands };
  }

  /** Which basis is relevant for the decision at this point. */
  basisFor(ctx: HandContext): EVBasis {
    const r = this.rules;
    if (r.holeCard === 'enhc') return 'unconditional';
    const n = ctx.hand.length;
    const surrenderNow = r.surrender === 'early' && n === 2 && !ctx.isSplitHand && (ctx.handsInRound ?? 1) === 1;
    if (surrenderNow && (ctx.up === ACE || ctx.up === TEN)) return 'unconditional';
    return 'conditional';
  }

  /** Normalise raw values into per-unit EVs and probabilities on the given basis. */
  normalize(raw: RawActions, basis: EVBasis, ctx: HandContext): ActionResult[] {
    const out: ActionResult[] = [];
    const r = this.rules;
    const { mass, pBJ } = raw;
    const rootHand = !ctx.isSplitHand && (ctx.handsInRound ?? 1) === 1;
    for (const a of ACTIONS) {
      const s = raw.stats[a];
      if (!s) continue;
      let ev: number;
      let w = s.w;
      let p = s.p;
      let l = s.l;
      let denom = 1;
      if (a === 'split' && raw.splitHands && raw.splitHands > 0) {
        w /= raw.splitHands;
        p /= raw.splitHands;
        l /= raw.splitHands;
      }
      if (basis === 'conditional') {
        denom = mass > 0 ? mass : 1;
        ev = s.ev / denom;
        w /= denom;
        p /= denom;
        l /= denom;
      } else {
        // unconditional: add the dealer-blackjack part that U excludes
        if (a === 'surrender' && (r.surrender === 'early' || r.holeCard === 'enhc')) {
          ev = -0.5;
          w = 0;
          p = 0;
          l = 1;
        } else if (this.exBJ && rootHand) {
          ev = s.ev - pBJ;
          l += pBJ;
        } else {
          ev = s.ev;
        }
      }
      out.push({ action: a, ev, win: w, push: p, lose: l });
    }
    return out;
  }

  /** Full evaluation of a hand: allowed actions, EVs, best action. */
  evaluate(ctx: HandContext): HandEvaluation {
    let hard = 0;
    let ace = false;
    for (const c of ctx.hand) {
      hard += idxValue(c);
      if (c === ACE) ace = true;
    }
    const total = softTotal(hard, ace);
    const soft = ace && hard + 10 <= 21;
    const isBJ =
      ctx.hand.length === 2 && total === 21 && !ctx.isSplitHand && (ctx.handsInRound ?? 1) === 1;
    const basis = this.basisFor(ctx);
    if (hard > 21 || isBJ) {
      this.setState(ctx.up, ctx.hand, ctx.removed);
      return {
        actions: [],
        best: null,
        basis,
        pDealerBJ: this.pHoleBJ(ctx.up),
        total,
        soft,
        isBlackjack: isBJ,
        bust: hard > 21,
      };
    }
    const raw = this.rawActions(ctx);
    const actions = this.normalize(raw, basis, ctx);
    let best: ActionResult | null = null;
    for (const a of actions) if (!best || a.ev > best.ev + 1e-12) best = a;
    return {
      actions,
      best: best ? best.action : null,
      basis,
      pDealerBJ: raw.pBJ,
      splitHands: raw.splitHands,
      total,
      soft,
      isBlackjack: false,
      bust: false,
    };
  }

  /**
   * Composition-dependent hit/stand decision for an arbitrary hand (used as the
   * continuation policy of Monte Carlo validation runs). True = hitting has higher EV.
   */
  shouldHit(up: number, hand: number[], removed?: number[]): boolean {
    this.setState(up, hand, removed);
    let hard = 0;
    let ace = false;
    for (const c of hand) {
      hard += idxValue(c);
      if (c === ACE) ace = true;
    }
    const total = softTotal(hard, ace);
    if (hard > 21 || total >= 21) return false;
    const st = this.standStat(up, total, 1);
    const h = this.hitStat(up, hard, ace);
    return h.ev > st.ev;
  }

  /** EV of the insurance side bet per unit insured, given the known cards. */
  insuranceEV(up: number, hand: number[], removed?: number[]): { ev: number; pTen: number } {
    this.setState(up, hand, removed);
    const pTen = this.pr(TEN);
    return { ev: 3 * pTen - 1, pTen };
  }

  /** Dealer final distribution (unconditional incl. BJ) for the given known cards. */
  dealerOutcome(up: number, hand: number[], removed?: number[]): Float64Array {
    this.setState(up, hand, removed);
    const d = this.infinite
      ? dealerDistInfinite(this.probs, up, this.rules.h17, false)
      : dealerDistFinite(this.rem, up, this.rules.h17, false);
    return d;
  }

  /** Drop all caches (memory control between independent batches). */
  clearCaches(): void {
    for (const m of this.dealerCache) m.clear();
    this.hsMemo = [];
  }

  /** Number of cached dealer distributions (diagnostics). */
  cacheSize(): number {
    let s = 0;
    for (const m of this.dealerCache) s += m.size;
    return s;
  }
}
