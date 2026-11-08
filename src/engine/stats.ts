/**
 * Statistics engine: point estimates, standard errors and confidence intervals.
 *
 * Hands inside one shoe are not independent (shared composition), so the primary
 * standard error is computed with the *batch-means* method using one batch per shoe
 * (ratio estimator net/initial bet). The naive i.i.d. standard error is reported for
 * comparison only.
 */
import type { SimBatches, SimCounters } from './simulator';

export interface SimSummary {
  rounds: number;
  hands: number;
  shoes: number;
  batches: number;
  /** EV per unit initial bet (player perspective) */
  ev: number;
  /** house edge in % of initial bets */
  houseEdgePct: number;
  /** EV per round in base units (differs from ev only with bet variation) */
  evPerRound: number;
  /** net result per unit of total money wagered (incl. doubles/splits/insurance) */
  returnPerWagered: number;
  /** standard deviation of one round's result (units) */
  sdPerRound: number;
  seNaive: number;
  seBatch: number;
  ci95: [number, number];
  roundWin: number;
  roundPush: number;
  roundLoss: number;
  handWin: number;
  handPush: number;
  handLoss: number;
  playerBJRate: number;
  dealerBJRate: number;
  doubleRate: number;
  splitRate: number;
  surrenderRate: number;
  insuranceRate: number;
  bustRate: number;
  avgInitialBet: number;
  avgWagered: number;
  maxDrawdown: number;
  maxLossStreak: number;
  totalNet: number;
}

export function batchSE(b: SimBatches): number {
  const K = b.net.length;
  if (K < 2) return NaN;
  let sy = 0;
  let sx = 0;
  for (let k = 0; k < K; k++) {
    sy += b.net[k];
    sx += b.initial[k];
  }
  const r = sy / sx;
  const xbar = sx / K;
  let ss = 0;
  for (let k = 0; k < K; k++) {
    const e = b.net[k] - r * b.initial[k];
    ss += e * e;
  }
  return Math.sqrt(ss / (K * (K - 1))) / xbar;
}

export function summarize(c: SimCounters, b: SimBatches): SimSummary {
  const n = Math.max(1, c.rounds);
  const ev = c.initial > 0 ? c.net / c.initial : 0;
  const meanR = c.net / n;
  const sd = Math.sqrt(Math.max(0, c.net2 / n - meanR * meanR));
  const avgInit = c.initial / n;
  const seNaive = sd / Math.sqrt(n) / (avgInit || 1);
  const seB = batchSE(b);
  const se = Number.isFinite(seB) ? seB : seNaive;
  const h = Math.max(1, c.hands);
  return {
    rounds: c.rounds,
    hands: c.hands,
    shoes: c.shoes,
    batches: b.net.length,
    ev,
    houseEdgePct: -ev * 100,
    evPerRound: meanR,
    returnPerWagered: c.wagered > 0 ? c.net / c.wagered : 0,
    sdPerRound: sd,
    seNaive,
    seBatch: se,
    ci95: [ev - 1.96 * se, ev + 1.96 * se],
    roundWin: c.roundsWon / n,
    roundPush: c.roundsPushed / n,
    roundLoss: c.roundsLost / n,
    handWin: c.handsWon / h,
    handPush: c.handsPushed / h,
    handLoss: c.handsLost / h,
    playerBJRate: c.playerBJ / n,
    dealerBJRate: c.dealerBJ / n,
    doubleRate: c.doubles / n,
    splitRate: c.splits / n,
    surrenderRate: c.surrenders / n,
    insuranceRate: c.insurances / n,
    bustRate: c.busts / h,
    avgInitialBet: avgInit,
    avgWagered: c.wagered / n,
    maxDrawdown: c.maxDrawdown,
    maxLossStreak: c.maxLossStreak,
    totalNet: c.net,
  };
}

/** Standard normal CDF (Abramowitz–Stegun 7.1.26 based erf, |error| < 1.5e-7). */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) *
      Math.exp(-(z * z) / 2);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

export interface PairedComparison {
  /** EV(A) − EV(B) per unit initial bet */
  diff: number;
  se: number;
  ci95: [number, number];
  z: number;
  pValue: number;
  significant: boolean;
  batches: number;
  method: 'paired-batches' | 'independent';
}

/**
 * Compare two strategies simulated with common random numbers (batch k of both runs
 * used the identical shuffled shoe). Falls back to independent SEs if batches don't align.
 */
export function pairedComparison(a: SimBatches, b: SimBatches): PairedComparison {
  const K = Math.min(a.net.length, b.net.length);
  const sum = (x: number[], n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += x[i];
    return s;
  };
  const evA = sum(a.net, a.net.length) / sum(a.initial, a.initial.length);
  const evB = sum(b.net, b.net.length) / sum(b.initial, b.initial.length);
  const diff = evA - evB;
  let se: number;
  let method: PairedComparison['method'] = 'paired-batches';
  if (K >= 10) {
    const rA = sum(a.net, K) / sum(a.initial, K);
    const rB = sum(b.net, K) / sum(b.initial, K);
    const xA = sum(a.initial, K) / K;
    const xB = sum(b.initial, K) / K;
    const d: number[] = [];
    for (let k = 0; k < K; k++) d.push((a.net[k] - rA * a.initial[k]) / xA - (b.net[k] - rB * b.initial[k]) / xB);
    const m = d.reduce((s, v) => s + v, 0) / K;
    const v = d.reduce((s, x) => s + (x - m) * (x - m), 0) / (K - 1);
    se = Math.sqrt(v / K);
  } else {
    method = 'independent';
    se = Math.sqrt(batchSE(a) ** 2 + batchSE(b) ** 2);
  }
  const z = se > 0 ? diff / se : 0;
  const pValue = 2 * (1 - normalCdf(Math.abs(z)));
  return { diff, se, ci95: [diff - 1.96 * se, diff + 1.96 * se], z, pValue, significant: pValue < 0.05, batches: K, method };
}

/** Quantile of a sorted array (linear interpolation). */
export function quantile(sorted: ArrayLike<number>, q: number): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  const pos = (n - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function histogram(values: ArrayLike<number>, bins: number, lo?: number, hi?: number): { edges: number[]; counts: number[] } {
  let min = lo ?? Infinity;
  let max = hi ?? -Infinity;
  if (lo === undefined || hi === undefined)
    for (let i = 0; i < values.length; i++) {
      if (lo === undefined) min = Math.min(min, values[i]);
      if (hi === undefined) max = Math.max(max, values[i]);
    }
  if (!(max > min)) max = min + 1;
  const w = (max - min) / bins;
  const counts = new Array(bins).fill(0);
  for (let i = 0; i < values.length; i++) {
    const k = Math.min(bins - 1, Math.max(0, Math.floor((values[i] - min) / w)));
    counts[k]++;
  }
  const edges = Array.from({ length: bins + 1 }, (_, i) => min + i * w);
  return { edges, counts };
}

/** Least-squares line y = a + b·x (used to estimate advantage per true count from data). */
export function linearFit(x: ArrayLike<number>, y: ArrayLike<number>): { a: number; b: number; n: number } {
  const n = Math.min(x.length, y.length);
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += x[i];
    sy += y[i];
    sxx += x[i] * x[i];
    sxy += x[i] * y[i];
  }
  const den = n * sxx - sx * sx;
  const b = den !== 0 ? (n * sxy - sx * sy) / den : 0;
  const a = (sy - b * sx) / Math.max(1, n);
  return { a, b, n };
}

/**
 * Serial dependence check: sums (Σx, Σx², n) of next-round results grouped by the
 * outcome of the previous round (loss / win / push) along a simulated sequence.
 */
export function serialStats(net: ArrayLike<number>): Record<'loss' | 'win' | 'push', [number, number, number]> {
  const acc: Record<'loss' | 'win' | 'push', [number, number, number]> = { loss: [0, 0, 0], win: [0, 0, 0], push: [0, 0, 0] };
  for (let i = 1; i < net.length; i++) {
    const k = net[i - 1] < 0 ? 'loss' : net[i - 1] > 0 ? 'win' : 'push';
    acc[k][0] += net[i];
    acc[k][1] += net[i] * net[i];
    acc[k][2]++;
  }
  return acc;
}
