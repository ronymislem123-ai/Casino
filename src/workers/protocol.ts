import type { Rules } from '../engine/rules';
import type { ShoeMode } from '../engine/simulator';
import type { BettingConfig, BetSystemId } from '../engine/betting';

/** Serializable description of a simulation strategy. */
export type StrategySpec =
  | { kind: 'basic' }
  | { kind: 'foreign'; rules: Rules; label: string }
  | { kind: 'cd2' }
  | { kind: 'hilo'; deviations: boolean; ramp: number[] }
  | { kind: 'mimic' }
  | { kind: 'neverbust' }
  | { kind: 'chart'; chartId: string };

export interface SimRunConfig {
  rules: Rules;
  shoeMode: ShoeMode;
  rounds: number;
  seed: number;
  strategies: StrategySpec[];
  /** index of the reference strategy for paired comparisons */
  reference: number;
  startComposition?: number[];
}

export interface BettingRunConfig {
  rules: Rules;
  seed: number;
  /** playing strategy producing the outcome stream */
  stream: 'basic' | 'hilo';
  shoeMode: ShoeMode;
  betting: BettingConfig;
  systems: BetSystemId[];
}
