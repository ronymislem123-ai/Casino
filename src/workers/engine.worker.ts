/// <reference lib="webworker" />
/**
 * Engine worker: strategy tables, exact hand evaluation, house-edge analysis,
 * chart comparisons and Monte Carlo situation checks — off the UI thread.
 */
import { EVEngine, HandContext } from '../engine/ev';
import { generateStrategy, StrategyTable } from '../engine/strategy';
import { Rules, rulesKey } from '../engine/rules';
import { fullShoe } from '../engine/cards';
import { dealerDistFast, dealerDistInfinite, normalize } from '../engine/dealer';
import { INFINITE_PROBS } from '../engine/cards';
import { SOURCE_CHARTS } from '../data/sourceCharts';
import { compareChart } from '../engine/chartCompare';
import { situationMC } from '../engine/validation';
import type { Action } from '../engine/ev';

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const tables = new Map<string, StrategyTable>();
const engines = new Map<string, EVEngine>();

function tableFor(rules: Rules, id: number, deckModel: 'finite' | 'infinite' = 'finite'): StrategyTable {
  const key = rulesKey(rules) + '|' + deckModel;
  let t = tables.get(key);
  if (!t) {
    t = generateStrategy(rules, {
      deckModel,
      onProgress: (done, total) => ctx.postMessage({ id, type: 'progress', done, total }),
    });
    tables.set(key, t);
    if (tables.size > 24) tables.delete(tables.keys().next().value as string);
  }
  return t;
}

function engineFor(rules: Rules): EVEngine {
  const key = rulesKey(rules);
  let e = engines.get(key);
  if (!e) {
    e = new EVEngine(rules, fullShoe(rules.decks));
    engines.set(key, e);
    if (engines.size > 4) {
      const first = engines.keys().next().value as string;
      engines.delete(first);
    }
  }
  return e;
}

ctx.onmessage = (ev: MessageEvent) => {
  const msg = ev.data;
  const { id } = msg;
  try {
    switch (msg.type) {
      case 'table': {
        if (msg.table) {
          tables.set(rulesKey(msg.rules) + '|' + (msg.deckModel ?? 'finite'), msg.table);
          ctx.postMessage({ id, type: 'result', data: true });
          break;
        }
        const t = tableFor(msg.rules, id, msg.deckModel);
        ctx.postMessage({ id, type: 'result', data: t });
        break;
      }
      case 'evaluate': {
        const e = engineFor(msg.rules);
        const c: HandContext = msg.ctx;
        const t0 = performance.now();
        const res = e.evaluate(c);
        const ins = c.up === 0 && c.hand.length === 2 && !c.isSplitHand ? e.insuranceEV(c.up, c.hand, c.removed) : null;
        const dealer = Array.from(normalize(e.dealerOutcome(c.up, c.hand, c.removed)));
        ctx.postMessage({ id, type: 'result', data: { ...res, insurance: ins, dealer, ms: performance.now() - t0 } });
        break;
      }
      case 'houseEdge': {
        const variants: { label: string; rules: Rules }[] = msg.variants;
        const base = tableFor(msg.base, id);
        const out = [] as unknown[];
        variants.forEach((v, i) => {
          const t = tableFor(v.rules, id);
          let changed = 0;
          const list: string[] = [];
          for (const kind of ['hard', 'soft', 'pairs'] as const)
            for (const [k, row] of Object.entries(t[kind]))
              row.forEach((cell, up) => {
                const b = (base[kind] as Record<string, typeof row>)[k]?.[up];
                if (b && cell && b.code !== cell.code) {
                  changed++;
                  if (list.length < 40) list.push(`${kind}:${k}:${up}:${b.code}>${cell.code}`);
                }
              });
          out.push({ label: v.label, rules: v.rules, cd: t.houseEdge.cdOptimal, td: t.houseEdge.tdBasic, changedCells: changed, changes: list });
          ctx.postMessage({ id, type: 'progress', done: i + 1, total: variants.length, partial: out });
        });
        ctx.postMessage({ id, type: 'result', data: { base: { cd: base.houseEdge.cdOptimal, td: base.houseEdge.tdBasic }, variants: out } });
        break;
      }
      case 'compareChart': {
        const chart = SOURCE_CHARTS.find((c) => c.id === msg.chartId);
        if (!chart) throw new Error('Unbekannte Tabelle');
        const t = tableFor(msg.rules, id);
        ctx.postMessage({ id, type: 'result', data: compareChart(chart, t) });
        break;
      }
      case 'dealerProbs': {
        const rules: Rules = msg.rules;
        const rows = [] as { up: number; cond: number[]; uncond: number[] }[];
        for (let up = 0; up < 10; up++) {
          let cond: Float64Array;
          let uncond: Float64Array;
          if (msg.infinite) {
            cond = normalize(dealerDistInfinite(INFINITE_PROBS, up, rules.h17, true));
            uncond = dealerDistInfinite(INFINITE_PROBS, up, rules.h17, false);
          } else {
            const s = fullShoe(rules.decks);
            s[up]--;
            cond = normalize(dealerDistFast(s, up, rules.h17, true));
            uncond = dealerDistFast(s, up, rules.h17, false);
          }
          rows.push({ up, cond: Array.from(cond), uncond: Array.from(uncond) });
        }
        ctx.postMessage({ id, type: 'result', data: rows });
        break;
      }
      case 'situationMC': {
        const e = engineFor(msg.rules);
        const results = (msg.actions as Action[]).map((a, i) => {
          const r = situationMC(e, { up: msg.up, hand: msg.hand, removed: msg.removed, shoe: fullShoe(msg.rules.decks) }, a, msg.trials, msg.seed + i);
          ctx.postMessage({ id, type: 'progress', done: i + 1, total: msg.actions.length });
          return r;
        });
        ctx.postMessage({ id, type: 'result', data: results });
        break;
      }
      default:
        throw new Error('Unbekannte Nachricht ' + msg.type);
    }
  } catch (err) {
    ctx.postMessage({ id, type: 'error', error: (err as Error).message });
  }
};
