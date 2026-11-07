/**
 * Exact dealer final-hand distributions.
 *
 * Outcome indices: 0..4 = final 17..21, 5 = bust, 6 = dealer blackjack.
 *
 * All distributions are returned *unnormalised with respect to the hole card*:
 * when `excludeBJ` is set, hole cards that would complete a dealer blackjack are
 * skipped (not renormalised), so the entries sum to P(no dealer blackjack).
 * This lets the EV engine work with E[payoff · 1{no dealer BJ}] which keeps the
 * player's draws and the dealer's (conditioned) hole card exactly consistent
 * (see docs/MATH_SPEC.md §3).
 */
import { ACE, TEN, idxValue } from './cards';

export const O_BUST = 5;
export const O_BJ = 6;
export const N_OUT = 7;

const POW32: number[] = [];
for (let i = 0, p = 1; i < 10; i++, p *= 32) POW32.push(p);
export { POW32 };

function isBJPair(up: number, hole: number): boolean {
  return (up === ACE && hole === TEN) || (up === TEN && hole === ACE);
}

function terminal(total: number): Float64Array {
  const d = new Float64Array(N_OUT);
  if (total > 21) d[O_BUST] = 1;
  else d[total - 17] = 1;
  return d;
}
const TERM: Float64Array[] = [];
for (let t = 17; t <= 22; t++) TERM[t] = terminal(t);

/**
 * Exact dealer distribution for a finite shoe (sampling without replacement).
 * @param shoe counts per value index of the cards still in the shoe (upcard already removed)
 * @param up   dealer upcard value index
 */
export function dealerDistFinite(shoe: ArrayLike<number>, up: number, h17: boolean, excludeBJ: boolean): Float64Array {
  const counts = Int32Array.from(shoe as ArrayLike<number>);
  let remaining = 0;
  for (let i = 0; i < 10; i++) remaining += counts[i];
  const memo = new Map<number, Float64Array>();

  // state: hard sum (aces as 1), whether any ace held, key of drawn multiset
  function rec(hard: number, ace: boolean, key: number): Float64Array {
    if (hard > 21) return TERM[22];
    const soft = ace && hard + 10 <= 21;
    const total = soft ? hard + 10 : hard;
    if (total > 17 || (total === 17 && !(soft && h17))) return TERM[total];
    const m = memo.get(key);
    if (m) return m;
    const res = new Float64Array(N_OUT);
    const inv = 1 / remaining;
    for (let r = 0; r < 10; r++) {
      const c = counts[r];
      if (c === 0) continue;
      const p = c * inv;
      counts[r] = c - 1;
      remaining--;
      const sub = rec(hard + idxValue(r), ace || r === ACE, key + POW32[r]);
      remaining++;
      counts[r] = c;
      for (let o = 0; o < N_OUT; o++) res[o] += p * sub[o];
    }
    memo.set(key, res);
    return res;
  }

  const res = new Float64Array(N_OUT);
  if (remaining === 0) return res;
  const upHard = idxValue(up);
  const inv = 1 / remaining;
  for (let r = 0; r < 10; r++) {
    const c = counts[r];
    if (c === 0) continue;
    const p = c * inv;
    if (isBJPair(up, r)) {
      if (!excludeBJ) res[O_BJ] += p;
      continue;
    }
    counts[r] = c - 1;
    remaining--;
    const sub = rec(upHard + idxValue(r), up === ACE || r === ACE, POW32[r]);
    remaining++;
    counts[r] = c;
    for (let o = 0; o < N_OUT; o++) res[o] += p * sub[o];
  }
  return res;
}

/**
 * Pre-compiled dealer state graph (one per upcard and H17/S17 flag).
 * States are the multisets of cards drawn by the dealer while still drawing,
 * in topological (breadth-first) order. A forward pass propagates probability
 * mass through the graph for any shoe composition: identical results to the
 * recursive definition, but without hashing/closures (≈5-10× faster).
 */
interface DealerGraph {
  S: number;
  drawn: Int8Array; // S*10
  ndrawn: Int16Array; // S
  child: Int32Array; // S*10 ; >=0 state id, <0 => -1-outcome
  mass: Float64Array; // scratch
}
const graphs = new Map<number, DealerGraph>();

function buildGraph(up: number, h17: boolean): DealerGraph {
  const drawnList: number[][] = [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0]];
  const hardList = [idxValue(up)];
  const aceList = [up === ACE];
  const ids = new Map<number, number>([[0, 0]]);
  const keys = [0];
  const childList: number[] = [];
  for (let s = 0; s < drawnList.length; s++) {
    const d = drawnList[s];
    let n = 0;
    for (let r = 0; r < 10; r++) n += d[r];
    for (let r = 0; r < 10; r++) {
      if (n === 0 && isBJPair(up, r)) {
        childList[s * 10 + r] = -1 - O_BJ;
        continue;
      }
      const hard = hardList[s] + idxValue(r);
      const ace = aceList[s] || r === ACE;
      if (hard > 21) {
        childList[s * 10 + r] = -1 - O_BUST;
        continue;
      }
      const soft = ace && hard + 10 <= 21;
      const total = soft ? hard + 10 : hard;
      if (total > 17 || (total === 17 && !(soft && h17))) {
        childList[s * 10 + r] = -1 - (total - 17);
        continue;
      }
      const key = keys[s] + POW32[r];
      let id = ids.get(key);
      if (id === undefined) {
        id = drawnList.length;
        ids.set(key, id);
        const nd = d.slice();
        nd[r]++;
        drawnList.push(nd);
        hardList.push(hard);
        aceList.push(ace);
        keys.push(key);
      }
      childList[s * 10 + r] = id;
    }
  }
  const S = drawnList.length;
  const drawn = new Int8Array(S * 10);
  const ndrawn = new Int16Array(S);
  for (let s = 0; s < S; s++) {
    let n = 0;
    for (let r = 0; r < 10; r++) {
      drawn[s * 10 + r] = drawnList[s][r];
      n += drawnList[s][r];
    }
    ndrawn[s] = n;
  }
  return { S, drawn, ndrawn, child: Int32Array.from(childList), mass: new Float64Array(S) };
}

export function dealerGraph(up: number, h17: boolean): DealerGraph {
  const k = up * 2 + (h17 ? 1 : 0);
  let g = graphs.get(k);
  if (!g) {
    g = buildGraph(up, h17);
    graphs.set(k, g);
  }
  return g;
}

/** Fast exact dealer distribution for a finite shoe (upcard already removed). */
export function dealerDistFast(shoe: ArrayLike<number>, up: number, h17: boolean, excludeBJ: boolean): Float64Array {
  const g = dealerGraph(up, h17);
  const { S, drawn, ndrawn, child, mass } = g;
  let remTotal = 0;
  for (let r = 0; r < 10; r++) remTotal += shoe[r];
  const out = new Float64Array(N_OUT);
  mass.fill(0);
  mass[0] = 1;
  for (let s = 0; s < S; s++) {
    const m = mass[s];
    if (m === 0) continue;
    const denom = remTotal - ndrawn[s];
    if (denom <= 0) continue;
    const f = m / denom;
    const base = s * 10;
    for (let r = 0; r < 10; r++) {
      const avail = shoe[r] - drawn[base + r];
      if (avail <= 0) continue;
      const p = f * avail;
      const ch = child[base + r];
      if (ch >= 0) mass[ch] += p;
      else {
        const o = -1 - ch;
        if (o === O_BJ && excludeBJ) continue;
        out[o] += p;
      }
    }
  }
  return out;
}

/** Exact dealer distribution for an infinite deck (constant card probabilities). */
export function dealerDistInfinite(probs: readonly number[], up: number, h17: boolean, excludeBJ: boolean): Float64Array {
  const memo = new Map<number, Float64Array>();
  function rec(hard: number, ace: boolean): Float64Array {
    if (hard > 21) return TERM[22];
    const soft = ace && hard + 10 <= 21;
    const total = soft ? hard + 10 : hard;
    if (total > 17 || (total === 17 && !(soft && h17))) return TERM[total];
    const key = hard * 2 + (ace ? 1 : 0);
    const m = memo.get(key);
    if (m) return m;
    const res = new Float64Array(N_OUT);
    for (let r = 0; r < 10; r++) {
      const sub = rec(hard + idxValue(r), ace || r === ACE);
      for (let o = 0; o < N_OUT; o++) res[o] += probs[r] * sub[o];
    }
    memo.set(key, res);
    return res;
  }
  const res = new Float64Array(N_OUT);
  const upHard = idxValue(up);
  for (let r = 0; r < 10; r++) {
    if (isBJPair(up, r)) {
      if (!excludeBJ) res[O_BJ] += probs[r];
      continue;
    }
    const sub = rec(upHard + idxValue(r), up === ACE || r === ACE);
    for (let o = 0; o < N_OUT; o++) res[o] += probs[r] * sub[o];
  }
  return res;
}

/** Normalise a distribution to sum 1 (e.g. to show "given no dealer blackjack"). */
export function normalize(d: Float64Array): Float64Array {
  let s = 0;
  for (let i = 0; i < d.length; i++) s += d[i];
  const out = new Float64Array(d.length);
  if (s > 0) for (let i = 0; i < d.length; i++) out[i] = d[i] / s;
  return out;
}

/**
 * Independent brute-force reference implementation (no memoisation, explicit
 * ordered sequences). Used only by the test-suite to validate dealerDistFinite.
 */
export function dealerDistBruteForce(shoe: readonly number[], up: number, h17: boolean, excludeBJ: boolean): number[] {
  const counts = shoe.slice();
  const res = new Array<number>(N_OUT).fill(0);
  const cards: number[] = [up];
  function value(): { total: number; soft: boolean } {
    let hard = 0;
    let ace = false;
    for (const c of cards) {
      hard += c === ACE ? 1 : c + 1;
      if (c === ACE) ace = true;
    }
    const soft = ace && hard + 10 <= 21;
    return { total: soft ? hard + 10 : hard, soft };
  }
  function draw(prob: number): void {
    const { total, soft } = value();
    if (cards.length === 2 && total === 21) {
      res[O_BJ] += prob;
      return;
    }
    if (total > 21) {
      res[O_BUST] += prob;
      return;
    }
    if (cards.length >= 2 && (total > 17 || (total === 17 && !(soft && h17)))) {
      res[total - 17] += prob;
      return;
    }
    const n = counts.reduce((a, b) => a + b, 0);
    for (let r = 0; r < 10; r++) {
      if (counts[r] === 0) continue;
      if (cards.length === 1 && excludeBJ && isBJPair(up, r)) continue;
      const p = counts[r] / n;
      counts[r]--;
      cards.push(r);
      draw(prob * p);
      cards.pop();
      counts[r]++;
    }
  }
  draw(1);
  return res;
}
