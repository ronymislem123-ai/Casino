/** worker_threads worker for scripts/report.ts: runs one simulation task. */
import { parentPort } from 'node:worker_threads';
import { Simulator, ShoeMode } from '../src/engine/simulator';
import { buildStrategy } from '../src/engine/strategyFactory';
import { serialStats, summarize } from '../src/engine/stats';
import type { Rules } from '../src/engine/rules';
import type { StrategySpec } from '../src/workers/protocol';

export interface Task {
  id: string;
  rules: Rules;
  spec: StrategySpec;
  rounds: number;
  seed: number;
  shoeMode: ShoeMode;
  recordStream?: boolean;
  /** compute serial-dependence statistics in the worker and return only those */
  serialOnly?: boolean;
}

parentPort!.on('message', (task: Task) => {
  const t0 = Date.now();
  const { strategy, note } = buildStrategy(task.spec, task.rules);
  const sim = new Simulator({ rules: task.rules, shoeMode: task.shoeMode, rounds: task.rounds, seed: task.seed, recordStream: task.recordStream || task.serialOnly }, strategy);
  sim.run(Infinity);
  const serial = task.serialOnly ? serialStats(sim.streamNet) : undefined;
  if (task.serialOnly) {
    sim.streamNet = [];
    sim.streamTC = [];
    sim.streamWager = [];
  }
  parentPort!.postMessage({
    id: task.id,
    name: strategy.name,
    note,
    summary: summarize(sim.counters, sim.batches),
    counters: sim.counters,
    batches: sim.batches,
    checkpoints: sim.checkpoints,
    stream: task.recordStream ? { net: sim.streamNet, wager: sim.streamWager, tc: sim.streamTC } : undefined,
    serial,
    ms: Date.now() - t0,
  });
});
