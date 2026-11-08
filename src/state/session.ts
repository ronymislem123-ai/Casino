/** Optional session tracking (bankroll, results, strategy compliance) in localStorage. */
import { useSyncExternalStore } from 'react';
import { lsGet, lsSet } from './db';

export interface SessionEntry {
  t: number;
  bet: number;
  net: number;
}
export interface SessionState {
  active: boolean;
  startedAt: number;
  startBankroll: number;
  bankroll: number;
  entries: SessionEntry[];
  decisions: number;
  followed: number;
  stopLoss: number | null;
  stopWin: number | null;
  timeLimitMin: number | null;
}

const KEY = 'omega.session';
const EMPTY: SessionState = { active: false, startedAt: 0, startBankroll: 0, bankroll: 0, entries: [], decisions: 0, followed: 0, stopLoss: null, stopWin: null, timeLimitMin: null };
let state: SessionState = lsGet(KEY, EMPTY);
const subs = new Set<() => void>();
function set(s: SessionState) {
  state = s;
  lsSet(KEY, s);
  subs.forEach((f) => f());
}

export function useSession(): SessionState {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => state,
  );
}
export function startSession(bankroll: number, limits: { stopLoss: number | null; stopWin: number | null; timeLimitMin: number | null }) {
  set({ ...EMPTY, active: true, startedAt: Date.now(), startBankroll: bankroll, bankroll, ...limits });
}
export function endSession() {
  set({ ...state, active: false });
}
export function addResult(bet: number, net: number) {
  set({ ...state, bankroll: state.bankroll + net, entries: [...state.entries, { t: Date.now(), bet, net }] });
}
export function undoResult() {
  const e = state.entries[state.entries.length - 1];
  if (!e) return;
  set({ ...state, bankroll: state.bankroll - e.net, entries: state.entries.slice(0, -1) });
}
export function recordDecision(followed: boolean) {
  set({ ...state, decisions: state.decisions + 1, followed: state.followed + (followed ? 1 : 0) });
}
export function sessionStats(s: SessionState) {
  let peak = s.startBankroll;
  let cur = s.startBankroll;
  let maxDD = 0;
  let streak = 0;
  let maxStreak = 0;
  let wagered = 0;
  for (const e of s.entries) {
    cur += e.net;
    wagered += e.bet;
    peak = Math.max(peak, cur);
    maxDD = Math.max(maxDD, peak - cur);
    if (e.net < 0) {
      streak++;
      maxStreak = Math.max(maxStreak, streak);
    } else if (e.net > 0) streak = 0;
  }
  return { hands: s.entries.length, net: s.bankroll - s.startBankroll, wagered, avgBet: s.entries.length ? wagered / s.entries.length : 0, maxDD, maxStreak };
}
