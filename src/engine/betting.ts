/**
 * Betting & risk lab.
 *
 * Every betting system is applied to the *same* stream of simulated round outcomes
 * (common random numbers). The outcome stream is produced by one fixed playing
 * strategy, so differences between systems are caused by bet sizing only — the
 * quality of the playing decisions is identical for all systems.
 *
 * Central fact (verified, not assumed, by the "EV per wagered unit" column):
 * a bet progression cannot change the expected return per unit wagered, as long as
 * it uses no information about the cards. It only reshapes variance, drawdowns and
 * the probability of ruin.
 */
import { histogram, linearFit, quantile } from './stats';

export type BetSystemId = 'flat' | 'martingale' | 'paroli' | 'fibonacci' | 'dalembert' | 'percent' | 'custom' | 'kelly';

export const BET_SYSTEMS: { id: BetSystemId; name: string; description: string }[] = [
  { id: 'flat', name: 'Flat Betting', description: 'Immer derselbe Grundeinsatz.' },
  { id: 'martingale', name: 'Martingale', description: 'Nach jedem Verlust verdoppeln, nach Gewinn zurück zum Grundeinsatz.' },
  { id: 'paroli', name: 'Paroli (Reverse Martingale)', description: 'Nach Gewinn verdoppeln (max. 3 Stufen), nach Verlust Grundeinsatz.' },
  { id: 'fibonacci', name: 'Fibonacci', description: 'Nach Verlust eine Stufe vor (1,1,2,3,5,…), nach Gewinn zwei zurück.' },
  { id: 'dalembert', name: "D'Alembert", description: 'Nach Verlust +1 Einheit, nach Gewinn −1 Einheit.' },
  { id: 'percent', name: 'Prozentualer Einsatz', description: 'Fester Anteil der aktuellen Bankroll.' },
  { id: 'custom', name: 'Eigene Progression', description: 'Einheiten-Folge nach aufeinanderfolgenden Verlusten (Reset nach Gewinn).' },
  { id: 'kelly', name: 'Fractional Kelly (Count)', description: 'Einsatz ∝ geschätztem Vorteil aus dem True Count; nur bei positivem Vorteil über Tischminimum.' },
];

export interface BettingConfig {
  bankroll: number;
  baseBet: number;
  tableMin: number;
  tableMax: number;
  sessions: number;
  handsPerSession: number;
  stopLoss?: number;
  stopWin?: number;
  percent: number;
  paroliSteps: number;
  customSequence: number[];
  kellyFraction: number;
}

export interface OutcomeStream {
  /** net result per round in units of the initial bet */
  net: ArrayLike<number>;
  /** money at risk per round in units of the initial bet */
  wager: ArrayLike<number>;
  /** true count at round start */
  tc: ArrayLike<number>;
}

export interface SystemResult {
  id: BetSystemId;
  name: string;
  finals: number[];
  mean: number;
  median: number;
  p5: number;
  p25: number;
  p75: number;
  p95: number;
  ruinProb: number;
  aheadProb: number;
  meanWagered: number;
  /** total net / total wagered over all sessions */
  evPerWagered: number;
  meanMaxDrawdown: number;
  meanLongestLossStreak: number;
  meanHandsPlayed: number;
  avgBet: number;
  maxBetSeen: number;
  tableLimitHits: number;
  hist: { edges: number[]; counts: number[] };
  /** a few downsampled bankroll paths for charts */
  samplePaths: number[][];
}

export interface KellyModel {
  /** estimated EV per initial bet at TC = 0 */
  a: number;
  /** estimated change of EV per +1 true count */
  b: number;
  n: number;
  variance: number;
}

/** Estimate EV as a linear function of the true count from the stream itself. */
export function fitKellyModel(stream: OutcomeStream): KellyModel {
  const fit = linearFit(stream.tc, stream.net);
  let s = 0;
  let s2 = 0;
  const n = stream.net.length;
  for (let i = 0; i < n; i++) {
    s += stream.net[i];
    s2 += stream.net[i] * stream.net[i];
  }
  const variance = n > 1 ? s2 / n - (s / n) ** 2 : 1.3;
  return { a: fit.a, b: fit.b, n: fit.n, variance };
}

const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765];

export function runBettingSystem(id: BetSystemId, stream: OutcomeStream, cfg: BettingConfig, kelly?: KellyModel): SystemResult {
  const meta = BET_SYSTEMS.find((s) => s.id === id)!;
  const finals: number[] = [];
  let ruined = 0;
  let ahead = 0;
  let totWagered = 0;
  let totNet = 0;
  let sumDD = 0;
  let sumStreak = 0;
  let sumHands = 0;
  let sumBets = 0;
  let nBets = 0;
  let maxBetSeen = 0;
  let limitHits = 0;
  const samplePaths: number[][] = [];
  const H = cfg.handsPerSession;
  const total = stream.net.length;
  for (let s = 0; s < cfg.sessions; s++) {
    const offset = s * H;
    if (offset + H > total) break;
    let B = cfg.bankroll;
    let peak = B;
    let maxDD = 0;
    let streak = 0;
    let longest = 0;
    // system state
    let lastBet = cfg.baseBet;
    let lastOutcome = 0;
    let winsInRow = 0;
    let lossesInRow = 0;
    let fibIdx = 0;
    let dalUnits = 1;
    let played = 0;
    const path: number[] = [];
    const record = s < 12;
    const step = Math.max(1, Math.floor(H / 200));
    for (let i = 0; i < H; i++) {
      if (B < cfg.tableMin) {
        ruined++;
        break;
      }
      if (cfg.stopLoss !== undefined && cfg.stopLoss > 0 && B <= cfg.bankroll - cfg.stopLoss) break;
      if (cfg.stopWin !== undefined && cfg.stopWin > 0 && B >= cfg.bankroll + cfg.stopWin) break;
      let bet: number;
      switch (id) {
        case 'flat':
          bet = cfg.baseBet;
          break;
        case 'martingale':
          bet = i === 0 ? cfg.baseBet : lastOutcome < 0 ? lastBet * 2 : lastOutcome > 0 ? cfg.baseBet : lastBet;
          break;
        case 'paroli':
          bet = winsInRow > 0 && winsInRow < cfg.paroliSteps ? lastBet * 2 : cfg.baseBet;
          if (lastOutcome === 0 && i > 0) bet = lastBet;
          break;
        case 'fibonacci':
          bet = cfg.baseBet * FIB[Math.min(fibIdx, FIB.length - 1)];
          break;
        case 'dalembert':
          bet = cfg.baseBet * dalUnits;
          break;
        case 'percent':
          bet = (B * cfg.percent) / 100;
          break;
        case 'custom': {
          const seq = cfg.customSequence.length ? cfg.customSequence : [1];
          bet = cfg.baseBet * seq[Math.min(lossesInRow, seq.length - 1)];
          break;
        }
        case 'kelly': {
          const k = kelly ?? { a: 0, b: 0, variance: 1.3, n: 0 };
          const adv = k.a + k.b * stream.tc[offset + i];
          bet = adv > 0 ? (cfg.kellyFraction * adv * B) / Math.max(0.5, k.variance) : cfg.tableMin;
          break;
        }
      }
      if (bet < cfg.tableMin) bet = cfg.tableMin;
      if (bet > cfg.tableMax) {
        bet = cfg.tableMax;
        limitHits++;
      }
      if (bet > B) bet = B;
      const m = stream.net[offset + i];
      const result = bet * m;
      totWagered += bet * stream.wager[offset + i];
      totNet += result;
      sumBets += bet;
      nBets++;
      if (bet > maxBetSeen) maxBetSeen = bet;
      B += result;
      if (B < 0) B = 0;
      played++;
      if (B > peak) peak = B;
      if (peak - B > maxDD) maxDD = peak - B;
      if (m < 0) {
        streak++;
        if (streak > longest) longest = streak;
        lossesInRow++;
        winsInRow = 0;
        fibIdx++;
        dalUnits++;
      } else if (m > 0) {
        streak = 0;
        lossesInRow = 0;
        winsInRow = winsInRow + 1 >= cfg.paroliSteps ? 0 : winsInRow + 1;
        fibIdx = Math.max(0, fibIdx - 2);
        dalUnits = Math.max(1, dalUnits - 1);
      }
      lastBet = bet;
      lastOutcome = m;
      if (record && i % step === 0) path.push(B);
    }
    if (record) {
      path.push(B);
      samplePaths.push(path);
    }
    finals.push(B);
    if (B > cfg.bankroll) ahead++;
    sumDD += maxDD;
    sumStreak += longest;
    sumHands += played;
  }
  const n = finals.length || 1;
  const sorted = finals.slice().sort((a, b) => a - b);
  return {
    id,
    name: meta.name,
    finals,
    mean: finals.reduce((s, v) => s + v, 0) / n,
    median: quantile(sorted, 0.5),
    p5: quantile(sorted, 0.05),
    p25: quantile(sorted, 0.25),
    p75: quantile(sorted, 0.75),
    p95: quantile(sorted, 0.95),
    ruinProb: ruined / n,
    aheadProb: ahead / n,
    meanWagered: totWagered / n,
    evPerWagered: totWagered > 0 ? totNet / totWagered : 0,
    meanMaxDrawdown: sumDD / n,
    meanLongestLossStreak: sumStreak / n,
    meanHandsPlayed: sumHands / n,
    avgBet: nBets ? sumBets / nBets : 0,
    maxBetSeen,
    tableLimitHits: limitHits,
    hist: histogram(finals, 30),
    samplePaths,
  };
}
