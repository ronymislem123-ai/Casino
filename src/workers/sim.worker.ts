/// <reference lib="webworker" />
/**
 * Simulation worker: Monte Carlo strategy comparisons (chunked, pausable,
 * cancellable) and the betting & risk lab. Progress messages only report
 * numbers that were actually computed.
 */
import { Simulator } from '../engine/simulator';
import { basicStrategy, hiLoStrategy } from '../engine/simStrategies';
import { summarize, pairedComparison } from '../engine/stats';
import { fitKellyModel, runBettingSystem } from '../engine/betting';
import { buildStrategy, cachedTable as tableFor } from '../engine/strategyFactory';
import type { BettingRunConfig, SimRunConfig } from './protocol';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

interface Run {
  id: string;
  sims: Simulator[];
  notes: (string | undefined)[];
  cfg: SimRunConfig;
  paused: boolean;
  cancelled: boolean;
  t0: number;
  elapsedBefore: number;
}
let current: Run | null = null;

function report(run: Run, final: boolean) {
  const elapsed = run.elapsedBefore + (run.paused ? 0 : performance.now() - run.t0);
  const results = run.sims.map((s, i) => ({
    name: s.strategy.name,
    description: s.strategy.description,
    kind: s.strategy.kind,
    note: run.notes[i],
    summary: summarize(s.counters, s.batches),
    checkpoints: s.checkpoints,
  }));
  const ref = run.sims[run.cfg.reference] ?? run.sims[0];
  const comparisons = run.sims.map((s) => (s === ref ? null : pairedComparison(s.batches, ref.batches)));
  const done = run.sims.reduce((a, s) => a + s.counters.rounds, 0);
  ctx.postMessage({
    type: final ? 'done' : 'progress',
    runId: run.id,
    elapsedMs: elapsed,
    roundsDone: done,
    roundsPlanned: run.cfg.rounds * run.sims.length,
    rate: elapsed > 0 ? done / (elapsed / 1000) : 0,
    results,
    comparisons,
    cancelled: run.cancelled,
  });
}

function step() {
  const run = current;
  if (!run || run.paused) return;
  if (run.cancelled) {
    report(run, true);
    current = null;
    return;
  }
  const tEnd = performance.now() + 250;
  let allDone = true;
  while (performance.now() < tEnd) {
    allDone = true;
    for (const s of run.sims) {
      if (!s.done) {
        s.run(20000);
        allDone = false;
      }
    }
    if (allDone) break;
  }
  if (allDone) {
    report(run, true);
    current = null;
    return;
  }
  report(run, false);
  setTimeout(step, 0);
}

ctx.onmessage = (ev: MessageEvent) => {
  const msg = ev.data;
  try {
    switch (msg.type) {
      case 'start': {
        const cfg: SimRunConfig = msg.config;
        ctx.postMessage({ type: 'status', runId: msg.runId, text: 'Strategietabellen werden exakt berechnet…' });
        const built = cfg.strategies.map((s) => buildStrategy(s, cfg.rules));
        const sims = built.map(
          (b) =>
            new Simulator(
              { rules: cfg.rules, shoeMode: cfg.shoeMode, rounds: cfg.rounds, seed: cfg.seed, startComposition: cfg.startComposition },
              b.strategy,
            ),
        );
        current = { id: msg.runId, sims, notes: built.map((b) => b.note), cfg, paused: false, cancelled: false, t0: performance.now(), elapsedBefore: 0 };
        setTimeout(step, 0);
        break;
      }
      case 'pause':
        if (current && !current.paused) {
          current.elapsedBefore += performance.now() - current.t0;
          current.paused = true;
          report(current, false);
        }
        break;
      case 'resume':
        if (current && current.paused) {
          current.paused = false;
          current.t0 = performance.now();
          setTimeout(step, 0);
        }
        break;
      case 'cancel':
        if (current) {
          current.cancelled = true;
          if (current.paused) {
            current.paused = false;
            report(current, true);
            current = null;
          }
        }
        break;
      case 'betting': {
        const cfg: BettingRunConfig = msg.config;
        const t = tableFor(cfg.rules);
        const strategy = cfg.stream === 'hilo' ? hiLoStrategy(t, cfg.rules, { deviations: true, ramp: [1] }) : basicStrategy(t);
        const n = cfg.betting.sessions * cfg.betting.handsPerSession;
        const sim = new Simulator({ rules: cfg.rules, shoeMode: cfg.shoeMode, rounds: n, seed: cfg.seed, recordStream: true }, strategy);
        const t0 = performance.now();
        while (!sim.done) {
          sim.run(100000);
          ctx.postMessage({ type: 'betting-progress', runId: msg.runId, done: sim.counters.rounds, total: n });
        }
        const stream = { net: sim.streamNet, wager: sim.streamWager, tc: sim.streamTC };
        const kelly = fitKellyModel(stream);
        const systems = cfg.systems.map((id) => runBettingSystem(id, stream, cfg.betting, kelly));
        ctx.postMessage({
          type: 'betting-done',
          runId: msg.runId,
          streamSummary: summarize(sim.counters, sim.batches),
          kelly,
          systems,
          ms: performance.now() - t0,
          strategyName: strategy.name,
        });
        break;
      }
    }
  } catch (err) {
    ctx.postMessage({ type: 'error', runId: msg.runId, error: (err as Error).message });
  }
};
