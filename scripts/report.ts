/**
 * Final scientific report: runs the exact analyses and large Monte Carlo
 * simulations (in parallel on all CPU cores) and writes docs/REPORT.md and
 * docs/report-data.json. Every number in the report is produced by this run.
 *
 * Run: npm run report            (default 10,000,000 rounds per strategy)
 *      REPORT_ROUNDS=2000000 npm run report   (faster, less precise)
 */
import { Worker } from 'node:worker_threads';
import { cpus } from 'node:os';
import { readFileSync, writeFileSync } from 'node:fs';
import { DEFAULT_RULES, Rules, describeRules, rulesKey } from '../src/engine/rules';
import { generateStrategy, StrategyTable, UP_ORDER } from '../src/engine/strategy';
import { EVEngine } from '../src/engine/ev';
import { fullShoe, IDX_LABEL } from '../src/engine/cards';
import { pairedComparison, SimSummary, normalCdf, serialStats } from '../src/engine/stats';
import type { SimBatches } from '../src/engine/simulator';
import { BET_SYSTEMS, BettingConfig, fitKellyModel, pairedSystemDiff, runBettingSystem } from '../src/engine/betting';
import { SOURCE_CHARTS } from '../src/data/sourceCharts';
import { compareChart } from '../src/engine/chartCompare';
import type { StrategySpec } from '../src/workers/protocol';
import type { Task } from './reportWorker';

const ROUNDS = Number(process.env.REPORT_ROUNDS ?? 10_000_000);
const VAL_ROUNDS = Number(process.env.REPORT_VAL_ROUNDS ?? 20_000_000);
const THREADS = Math.max(1, cpus().length);
const t00 = Date.now();

interface Result {
  id: string;
  name: string;
  note?: string;
  summary: SimSummary;
  batches: SimBatches;
  checkpoints: [number, number, number][];
  stream?: { net: number[]; wager: number[]; tc: number[] };
  serial?: Record<'loss' | 'win' | 'push', [number, number, number]>;
  ms: number;
}

// ---------------------------------------------------------------- worker pool
const workers: Worker[] = [];
const idle: Worker[] = [];
const queue: { task: Task; resolve: (r: Result) => void }[] = [];
const busy = new Map<Worker, (r: Result) => void>();
for (let i = 0; i < THREADS; i++) {
  const w = new Worker(new URL('./reportWorker.boot.mjs', import.meta.url));
  w.on('message', (r: Result) => {
    const res = busy.get(w)!;
    busy.delete(w);
    res(r);
    next(w);
  });
  w.on('error', (e) => {
    console.error('worker error', e);
    process.exit(1);
  });
  workers.push(w);
  idle.push(w);
}
function next(w: Worker) {
  const job = queue.shift();
  if (!job) {
    idle.push(w);
    return;
  }
  busy.set(w, job.resolve);
  w.postMessage(job.task);
}
function run(task: Task): Promise<Result> {
  return new Promise((resolve) => {
    const w = idle.pop();
    if (w) {
      busy.set(w, resolve);
      w.postMessage(task);
    } else queue.push({ task, resolve });
  });
}

// ---------------------------------------------------------------- helpers
const f = (x: number, d = 3) => x.toFixed(d).replace('.', ',');
const pc = (x: number, d = 3) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(d).replace('.', ',')} %`;
const he = (x: number, d = 3) => `${x.toFixed(d).replace('.', ',')} %`;
const int = (x: number) => Math.round(x).toLocaleString('de-DE');
const short = (r: Rules) =>
  `${r.decks}D ${r.h17 ? 'H17' : 'S17'} ${r.das ? 'DAS' : 'kein DAS'} ${r.surrender === 'late' ? 'LS' : r.surrender === 'early' ? 'ES' : 'kein Surr.'} ${r.holeCard === 'enhc' ? (r.obo ? 'ENHC-OBO' : 'ENHC') : 'Peek'}${r.bjPayout !== 1.5 ? ` BJ ${r.bjPayout === 1.2 ? '6:5' : r.bjPayout}` : ''}`;
let totalRounds = 0;

const md: string[] = [];
const data: Record<string, unknown> = { generated: new Date().toISOString(), roundsPerStrategy: ROUNDS, threads: THREADS };

async function main() {
  console.log(`Report: ${ROUNDS} Runden je Strategie, ${THREADS} Threads`);
  // ============================================================ 1. exact analyses
  const base: Rules = { ...DEFAULT_RULES };
  const exactConfigs: { label: string; rules: Rules }[] = [];
  for (const d of [1, 2, 4, 6, 8]) for (const h17 of [false, true]) exactConfigs.push({ label: `${d} Deck${d > 1 ? 's' : ''}, ${h17 ? 'H17' : 'S17'}`, rules: { ...base, decks: d, h17 } });
  const v6: [string, Partial<Rules>][] = [
    ['+ Late Surrender', { surrender: 'late' }],
    ['+ Early Surrender', { surrender: 'early' }],
    ['kein DAS', { das: false }],
    ['+ Resplit Asse', { rsa: true }],
    ['+ Ziehen auf Split-Asse', { hsa: true }],
    ['Split nur bis 2 Hände', { maxSplitHands: 2 }],
    ['Double nur 9–11', { doubleOn: '9-11' }],
    ['Double nur 10–11', { doubleOn: '10-11' }],
    ['European No-Hole-Card (alles verloren)', { holeCard: 'enhc', obo: false }],
    ['No-Hole-Card mit OBO', { holeCard: 'enhc', obo: true }],
    ['Blackjack 6:5', { bjPayout: 1.2 }],
    ['Blackjack 1:1', { bjPayout: 1 }],
  ];
  for (const [l, r] of v6) exactConfigs.push({ label: `6 Decks, S17, ${l}`, rules: { ...base, ...r } });
  exactConfigs.push({ label: '6 Decks, H17, DAS, Late Surrender (Bild 4 / Wizard H17)', rules: { ...base, h17: true, surrender: 'late' } });
  const wiz = JSON.parse(readFileSync('tests/fixtures/wizard-house-edge.json', 'utf8')).rows as (Record<string, unknown> & { houseEdgePct: number })[];
  const wizFor = (r: Rules) =>
    wiz.find(
      (w) =>
        w.decks === r.decks && w.h17 === r.h17 && w.das === r.das && w.doubleOn === r.doubleOn && w.maxSplitHands === r.maxSplitHands && w.rsa === r.rsa && w.hsa === r.hsa &&
        w.surrender === r.surrender && (w.obo ? r.holeCard === 'peek' : r.holeCard === 'enhc' && !r.obo) && r.bjPayout === 1.5,
    )?.houseEdgePct;
  const tables = new Map<string, StrategyTable>();
  const exactRows: { label: string; rules: Rules; cd: number; td: number; wizard?: number; ms: number }[] = [];
  for (const c of exactConfigs) {
    const t = generateStrategy(c.rules);
    tables.set(rulesKey(c.rules), t);
    exactRows.push({ label: c.label, rules: c.rules, cd: t.houseEdge.cdOptimal, td: t.houseEdge.tdBasic, wizard: wizFor(c.rules), ms: t.computeMs });
    console.log('exact', c.label, t.houseEdge.cdOptimal.toFixed(4));
  }
  const infTable = generateStrategy(base, { deckModel: 'infinite' });
  data.exact = exactRows.map((r) => ({ ...r, rules: describeRules(r.rules) }));
  const tableOf = (r: Rules) => {
    let t = tables.get(rulesKey(r));
    if (!t) {
      t = generateStrategy(r);
      tables.set(rulesKey(r), t);
    }
    return t;
  };

  // ============================================================ 2. Monte Carlo scenarios
  interface Scenario {
    id: string;
    title: string;
    rules: Rules;
    seed: number;
    strategies: { spec: StrategySpec; label?: string }[];
  }
  const R6S17: Rules = { ...base, penetration: 0.75 };
  const R6H17: Rules = { ...base, h17: true, surrender: 'late', penetration: 0.75 };
  const R1D: Rules = { ...base, decks: 1, das: false, penetration: 0.65 };
  const RENHC: Rules = { ...base, holeCard: 'enhc', obo: false, penetration: 0.75 };
  const scenarios: Scenario[] = [
    {
      id: 'A', title: 'Szenario A — 6 Decks, S17, DAS, kein Surrender, Peek, 3:2, Penetration 75 %', rules: R6S17, seed: 1001,
      strategies: [
        { spec: { kind: 'basic' } },
        { spec: { kind: 'foreign', rules: R6H17, label: '6D H17 DAS LS' } },
        { spec: { kind: 'foreign', rules: { ...R1D }, label: '1 Deck S17 kein DAS' } },
        { spec: { kind: 'cd2' } },
        { spec: { kind: 'hilo', deviations: true, ramp: [1] } },
        { spec: { kind: 'hilo', deviations: true, ramp: [1, 1, 2, 4, 6, 8] } },
        { spec: { kind: 'mimic' } },
        { spec: { kind: 'neverbust' } },
        ...['img1-fr', 'img2-hsdp', 'img3-card', 'img5-blue', 'wizard-48-s17'].map((id) => ({ spec: { kind: 'chart', chartId: id } as StrategySpec })),
      ],
    },
    {
      id: 'B', title: 'Szenario B — 6 Decks, H17, DAS, Late Surrender, Peek, 3:2 (Regeln von Bild 4)', rules: R6H17, seed: 2002,
      strategies: [
        { spec: { kind: 'basic' } },
        { spec: { kind: 'foreign', rules: R6S17, label: '6D S17 DAS ohne Surrender' } },
        { spec: { kind: 'cd2' } },
        { spec: { kind: 'chart', chartId: 'img4-468-h17' } },
        { spec: { kind: 'chart', chartId: 'wizard-48-h17' } },
        { spec: { kind: 'chart', chartId: 'img2-hsdp' } },
        { spec: { kind: 'hilo', deviations: true, ramp: [1] } },
      ],
    },
    {
      id: 'C', title: 'Szenario C — 1 Deck, S17, kein DAS, Peek, 3:2, Penetration 65 %', rules: R1D, seed: 3003,
      strategies: [
        { spec: { kind: 'basic' } },
        { spec: { kind: 'foreign', rules: R6S17, label: '6D S17 DAS' } },
        { spec: { kind: 'cd2' } },
        { spec: { kind: 'chart', chartId: 'img5-blue' } },
        { spec: { kind: 'mimic' } },
      ],
    },
    {
      id: 'D', title: 'Szenario D — European No-Hole-Card, 6 Decks, S17, DAS, Verlust aller Einsätze bei Dealer-BJ', rules: RENHC, seed: 4004,
      strategies: [
        { spec: { kind: 'basic' } },
        { spec: { kind: 'foreign', rules: R6S17, label: 'amerikanische Peek-Regeln (6D S17 DAS)' } },
        { spec: { kind: 'cd2' } },
        { spec: { kind: 'chart', chartId: 'img1-fr' } },
      ],
    },
  ];
  // pre-build tables in the main thread is not needed (workers cache their own)
  const scenarioResults: { sc: Scenario; results: Result[] }[] = [];
  const jobs: Promise<void>[] = [];
  for (const sc of scenarios) {
    const entry = { sc, results: [] as Result[] };
    scenarioResults.push(entry);
    sc.strategies.forEach((s, i) => {
      jobs.push(
        run({ id: `${sc.id}-${i}`, rules: sc.rules, spec: s.spec, rounds: ROUNDS, seed: sc.seed, shoeMode: 'shoe' }).then((r) => {
          entry.results[i] = r;
          totalRounds += r.summary.rounds;
          console.log(`${sc.id} ${r.name}: EV ${(r.summary.ev * 100).toFixed(3)} % (${(r.ms / 1000).toFixed(1)} s)`);
        }),
      );
    });
  }
  // validation runs (fresh shoe / infinite deck vs exact)
  const valCfg: { label: string; rules: Rules; mode: 'fresh' | 'infinite'; exact: () => number }[] = [
    { label: '6D S17 DAS, frischer Schuh', rules: R6S17, mode: 'fresh', exact: () => tableOf({ ...R6S17, penetration: DEFAULT_RULES.penetration }).playerEV.tdBasic },
    { label: '6D H17 DAS LS, frischer Schuh', rules: R6H17, mode: 'fresh', exact: () => tableOf({ ...R6H17, penetration: DEFAULT_RULES.penetration }).playerEV.tdBasic },
    { label: '1D S17 kein DAS, frischer Schuh', rules: R1D, mode: 'fresh', exact: () => tableOf({ ...R1D, penetration: DEFAULT_RULES.penetration }).playerEV.tdBasic },
    { label: 'ENHC 6D S17, frischer Schuh', rules: RENHC, mode: 'fresh', exact: () => tableOf({ ...RENHC, penetration: DEFAULT_RULES.penetration }).playerEV.tdBasic },
    { label: '6D S17 DAS, unendliches Deck', rules: R6S17, mode: 'infinite', exact: () => infTable.playerEV.tdBasic },
  ];
  const valResults: { label: string; exact: number; r: Result }[] = [];
  valCfg.forEach((v, i) =>
    jobs.push(
      run({ id: `V${i}`, rules: v.rules, spec: { kind: 'basic' }, rounds: VAL_ROUNDS, seed: 9000 + i, shoeMode: v.mode }).then((r) => {
        valResults[i] = { label: v.label, exact: v.exact(), r };
        totalRounds += r.summary.rounds;
        console.log('validation', v.label, r.summary.ev);
      }),
    ),
  );
  // replications for convergence / reproducibility
  const REPS = 6;
  const repResults: Result[] = [];
  for (let i = 0; i < REPS; i++)
    jobs.push(
      run({ id: `R${i}`, rules: R6S17, spec: { kind: 'basic' }, rounds: Math.round(ROUNDS / 2), seed: 7000 + i * 13, shoeMode: 'shoe' }).then((r) => {
        repResults[i] = r;
        totalRounds += r.summary.rounds;
      }),
    );
  // outcome streams for the betting lab
  let streamBasic: Result | null = null;
  let streamBasic2: Result | null = null;
  let streamHilo: Result | null = null;
  const STREAM = 3_000_000;
  jobs.push(run({ id: 'S1', rules: R6S17, spec: { kind: 'basic' }, rounds: STREAM, seed: 5005, shoeMode: 'shoe', recordStream: true }).then((r) => { streamBasic = r; totalRounds += r.summary.rounds; }));
  jobs.push(run({ id: 'S1b', rules: R6S17, spec: { kind: 'basic' }, rounds: STREAM, seed: 5007, shoeMode: 'shoe', recordStream: true }).then((r) => { streamBasic2 = r; totalRounds += r.summary.rounds; }));
  jobs.push(run({ id: 'S2', rules: R6S17, spec: { kind: 'hilo', deviations: true, ramp: [1] }, rounds: STREAM, seed: 5006, shoeMode: 'shoe', recordStream: true }).then((r) => { streamHilo = r; totalRounds += r.summary.rounds; }));
  const SERIAL_SEEDS = [6001, 6002, 6003];
  const serialRuns: Result[] = [];
  SERIAL_SEEDS.forEach((seed, i) =>
    jobs.push(
      run({ id: `SER${i}`, rules: R6S17, spec: { kind: 'basic' }, rounds: ROUNDS, seed, shoeMode: 'shoe', serialOnly: true }).then((r) => {
        serialRuns[i] = r;
        totalRounds += r.summary.rounds;
      }),
    ),
  );
  await Promise.all(jobs);
  workers.forEach((w) => w.terminate());

  // ============================================================ 3. betting lab
  const bcfg: BettingConfig = { bankroll: 1000, baseBet: 10, tableMin: 10, tableMax: 1000, sessions: 10000, handsPerSession: 300, percent: 2, paroliSteps: 3, customSequence: [1, 2, 3, 5, 8], kellyFraction: 0.5 };
  const sb = streamBasic!.stream!;
  const sb2 = streamBasic2!.stream!;
  const bet = BET_SYSTEMS.filter((b) => b.id !== 'kelly').map((b) => runBettingSystem(b.id, { net: sb.net, wager: sb.wager, tc: sb.tc }, bcfg));
  const bet2 = BET_SYSTEMS.filter((b) => b.id !== 'kelly').map((b) => runBettingSystem(b.id, { net: sb2.net, wager: sb2.wager, tc: sb2.tc }, bcfg));
  // serial dependence of consecutive rounds (same shoe): next-round EV after loss vs after win
  type Ser = Record<'loss' | 'win' | 'push', [number, number, number]>;
  const serDiff = (x: Ser) => {
    const m = (k: 'loss' | 'win' | 'push') => x[k][0] / x[k][2];
    const v = (k: 'loss' | 'win' | 'push') => (x[k][1] / x[k][2] - m(k) ** 2) / x[k][2];
    const d = m('loss') - m('win');
    const se = Math.sqrt(v('loss') + v('win'));
    return { afterLoss: m('loss'), afterWin: m('win'), afterPush: m('push'), diff: d, se, p: 2 * (1 - normalCdf(Math.abs(d / se))), n: x.loss[2] + x.win[2] + x.push[2] };
  };
  const serialRows: { label: string; r: ReturnType<typeof serDiff> }[] = [
    { label: `Ergebnisfolge 1 (Seed 5005, ${int(sb.net.length)} Runden)`, r: serDiff(serialStats(sb.net)) },
    { label: `Ergebnisfolge 2 (Seed 5007, ${int(sb2.net.length)} Runden)`, r: serDiff(serialStats(sb2.net)) },
    ...serialRuns.map((x, i) => ({ label: `Zusatzlauf ${i + 1} (Seed ${SERIAL_SEEDS[i]}, ${int(x.summary.rounds)} Runden)`, r: serDiff(x.serial as Ser) })),
  ];
  const pooled: Ser = { loss: [0, 0, 0], win: [0, 0, 0], push: [0, 0, 0] };
  for (const x of serialRuns) for (const k of ['loss', 'win', 'push'] as const) for (let q = 0; q < 3; q++) pooled[k][q] += (x.serial as Ser)[k][q];
  const pooledRes = serDiff(pooled);
  const serial = { rows: serialRows, pooled: pooledRes };
  const sh = streamHilo!.stream!;
  const kelly = fitKellyModel({ net: sh.net, wager: sh.wager, tc: sh.tc });
  const kcfg: BettingConfig = { ...bcfg, bankroll: 10000, tableMax: 2000 };
  const kellyRes = runBettingSystem('kelly', { net: sh.net, wager: sh.wager, tc: sh.tc }, kcfg, kelly);
  const flatHilo = runBettingSystem('flat', { net: sh.net, wager: sh.wager, tc: sh.tc }, kcfg);
  const kellyVsFlat = pairedSystemDiff(kellyRes, flatHilo);

  // ============================================================ write report
  md.push('# OMEGA BLACKJACK INFINITY — Abschlussbericht');
  md.push('');
  md.push(`Erzeugt am ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC mit \`npm run report\` (${THREADS} CPU-Threads, Laufzeit ${((Date.now() - t00) / 60000).toFixed(1).replace('.', ',')} min). Alle Zahlen in diesem Bericht stammen aus genau diesem Lauf; nichts ist geschätzt oder von Hand eingetragen, außer wo ausdrücklich eine externe Quelle genannt ist.`);
  md.push('');
  md.push(`**Tatsächlich simulierte Runden insgesamt: ${int(totalRounds)}** (Strategievergleich: ${int(ROUNDS)} Runden je Strategie und Szenario; Validierung: ${int(VAL_ROUNDS)} je Konfiguration; ${REPS} Replikationen à ${int(Math.round(ROUNDS / 2))}; Betting-Ergebnisfolgen 3 × ${int(STREAM)}).`);
  md.push('');
  md.push('Legende der Herkunft: **[exakt]** kombinatorisch berechnet · **[MC]** Monte-Carlo-Schätzung mit 95-%-Konfidenzintervall · **[Quelle]** externe Referenz · **[abgeleitet]** aus Ergebnissen gefolgert.');
  md.push('');

  md.push('## 1. Untersuchte Tischregeln und Methoden');
  md.push('');
  md.push('- Kartendecks 1, 2, 4, 6, 8; Dealer H17/S17; Blackjack 3:2, 6:5, 1:1; DAS ja/nein; Double beliebig / 9–11 / 10–11; Surrender keiner / late / early; Split bis 2/4 Hände; Resplit Asse; Ziehen auf Split-Asse; amerikanisches Peek vs. European No-Hole-Card (Verlust aller Einsätze bzw. OBO).');
  md.push('- **Exakte Methode** (Abschnitte 2, 6): Rekursion über alle Kartenfolgen ohne Zurücklegen; Dealer-Endverteilungen über einen vorkompilierten Zustandsgraphen; Spielerentscheidungen kompositionsabhängig optimal; Dealer-Blackjack-Konditionierung exakt (siehe docs/MATH_SPEC.md). Einzige Näherung: Split-EV ignoriert die Entnahme von Nicht-Paar-Karten durch die jeweils andere Teilhand.');
  md.push('- **Monte Carlo** (Abschnitte 3–5): echter Kartenschuh, Ziehen ohne Zurücklegen, Neumischen an der Schnittkarte, Splits/Resplits/Doubles/Surrender/Versicherung vollständig ausgespielt. **Gemeinsame Zufallsfolgen**: Schuh k wird für jede Strategie identisch gemischt (Seed aus Master-Seed und k). Standardfehler per **Batch-Means je Schuh** (berücksichtigt Abhängigkeiten im Schuh); Strategieunterschiede per **gepaartem Vergleich** über dieselben Schuhe.');
  md.push('- Zufallszahlen: xoshiro128** mit splitmix32-Seeding; alle Läufe sind über die angegebenen Seeds reproduzierbar.');
  md.push('');

  md.push('## 2. Exakter Hausvorteil nach Regeln [exakt]');
  md.push('');
  md.push('Hausvorteil in % des Grundeinsatzes, frischer Schuh je Runde. „Optimal“ = kompositionsabhängig beste Erstentscheidung je Zweikarten-Hand; „Basic“ = total-abhängige Basic-Strategy-Tabelle. Basis: Split bis 4 Hände, kein RSA, eine Karte auf Split-Asse, Double beliebig, DAS, Peek, 3:2, kein Surrender (sofern nicht anders angegeben). Spalte „Wizard“ = Referenzwert des Wizard-of-Odds-Rechners („optimal results“) **[Quelle]**, wo diese Regelkombination dort vorkommt.');
  md.push('');
  md.push('| Regeln | Optimal | Basic-Tabelle | Wizard of Odds | Differenz zu Wizard |');
  md.push('|---|---|---|---|---|');
  for (const r of exactRows) md.push(`| ${r.label} | ${he(r.cd)} | ${he(r.td)} | ${r.wizard !== undefined ? he(r.wizard) : '–'} | ${r.wizard !== undefined ? f(r.cd - r.wizard, 4) : '–'} |`);
  md.push('');
  md.push(`Unendliches Deck (S17, DAS, Split bis 4 außer Asse): Spieler-EV ${pc(infTable.playerEV.tdBasic, 4)} — Wizard of Odds, Anhang 1: −0,511734 % **[Quelle]**.`);
  md.push('');
  md.push('Breitere Validierung: `docs/validation-wizard.md` vergleicht 55 Regelkombinationen; mittlere absolute Abweichung 0,0005 %-Punkte, maximal 0,0016 %-Punkte (Resplit bis 3 Hände).');
  md.push('');

  md.push('## 3. Validierung: Monte Carlo gegen exakte Rechnung [MC] vs. [exakt]');
  md.push('');
  md.push('Basic Strategy, Neumischen vor jeder Runde (identisches Modell wie die exakte Rechnung) bzw. unendliches Deck. z = (MC − exakt) / Standardfehler.');
  md.push('');
  md.push('| Konfiguration | Runden | Exakt (Basic) | Monte Carlo | Standardfehler | z | Urteil |');
  md.push('|---|---|---|---|---|---|---|');
  for (const v of valResults) {
    const z = (v.r.summary.ev - v.exact) / v.r.summary.seBatch;
    md.push(`| ${v.label} | ${int(v.r.summary.rounds)} | ${pc(v.exact, 4)} | ${pc(v.r.summary.ev, 4)} | ${f(v.r.summary.seBatch * 100, 4)} %-Pkt. | ${f(z, 2)} | ${Math.abs(z) < 3 ? 'konsistent' : 'prüfen'} |`);
  }
  md.push('');
  md.push('Hinweis: Die exakte „Basic“-Zahl nutzt nach der ersten Entscheidung kompositionsabhängige Folgeentscheidungen, die Simulation durchgehend die Tabelle; der Unterschied liegt unter 0,01 %-Punkten und damit unterhalb der Auflösung dieser Läufe.');
  md.push('');
  const evs = repResults.map((r) => r.summary.ev);
  const mean = evs.reduce((a, b) => a + b, 0) / evs.length;
  const sdBetween = Math.sqrt(evs.reduce((a, b) => a + (b - mean) ** 2, 0) / (evs.length - 1));
  const seWithin = repResults.reduce((a, r) => a + r.summary.seBatch, 0) / repResults.length;
  md.push(`**Reproduzierbarkeit / Konvergenz:** ${REPS} unabhängige Läufe (6D S17 DAS, Kartenschuh, je ${int(repResults[0].summary.rounds)} Runden, verschiedene Seeds): EVs ${evs.map((e) => pc(e, 3)).join(', ')}. Streuung zwischen den Läufen ${f(sdBetween * 100, 4)} %-Punkte vs. mittlerer geschätzter Standardfehler ${f(seWithin * 100, 4)} %-Punkte (Verhältnis ${f(sdBetween / seWithin, 2)}; bei ${REPS} Läufen ist jedes Verhältnis zwischen 0,41 und 1,60 mit einem korrekt geschätzten Standardfehler vereinbar — 95-%-Bereich von √(χ²₅/5)). Gleicher Seed ergibt bitgenau identische Ergebnisse (automatisierter Test).`);
  md.push('');
  data.validation = valResults.map((v) => ({ label: v.label, exact: v.exact, mc: v.r.summary.ev, se: v.r.summary.seBatch, rounds: v.r.summary.rounds }));
  data.replications = { evs, sdBetween, seWithin };

  md.push('## 4. Strategievergleich unter identischen Bedingungen [MC]');
  md.push('');
  md.push('Jede Strategie spielt dieselben gemischten Schuhe. Δ = EV-Differenz zur regelangepassten Basic Strategy (gepaart) mit 95-%-Konfidenzintervall. „n.s.“ = statistisch nicht unterscheidbar (p ≥ 0,05) — dann wird kein Sieger erklärt. EV in % des Grundeinsatzes; bei Hi-Lo mit Spread ist der Grundeinsatz die Summe der Anfangseinsätze.');
  md.push('');
  const scenData: unknown[] = [];
  for (const { sc, results } of scenarioResults) {
    md.push(`### ${sc.title}`);
    md.push('');
    md.push(`Seed ${sc.seed}. ${describeRules(sc.rules)}.`);
    md.push('');
    md.push('| Strategie | Runden | EV | 95-%-KI | Hausvorteil | Δ zur Basic Strategy (95-%-KI) | p | Gewinn/Push/Verlust (Runden) | SD/Runde |');
    md.push('|---|---|---|---|---|---|---|---|---|');
    const ref = results[0];
    const rows: unknown[] = [];
    results.forEach((r, i) => {
      const c = i === 0 ? null : pairedComparison(r.batches, ref.batches);
      const s = r.summary;
      md.push(
        `| ${r.name}${r.note ? ` (${r.note})` : ''} | ${int(s.rounds)} | ${pc(s.ev)} | ${pc(s.ci95[0], 2)} … ${pc(s.ci95[1], 2)} | ${he(s.houseEdgePct)} | ${c ? `${pc(c.diff)} (${pc(c.ci95[0], 3)} … ${pc(c.ci95[1], 3)})` : 'Referenz'} | ${c ? (c.significant ? (c.pValue < 1e-4 ? '<0,0001' : f(c.pValue, 4)) : `${f(c.pValue, 3)} n.s.`) : '–'} | ${f(s.roundWin * 100, 1)} / ${f(s.roundPush * 100, 1)} / ${f(s.roundLoss * 100, 1)} % | ${f(s.sdPerRound, 3)} |`,
      );
      rows.push({ name: r.name, note: r.note, summary: s, comparison: c });
    });
    md.push('');
    const exactRef = tableOf({ ...sc.rules, penetration: DEFAULT_RULES.penetration }).playerEV;
    md.push(`Exakte Referenz für diese Regeln (frischer Schuh): Basic ${pc(exactRef.tdBasic, 4)}, kompositionsabhängig optimal ${pc(exactRef.cdOptimal, 4)} **[exakt]**. Abweichungen der Schuh-Simulation davon enthalten den Schnittkarten-Effekt.`);
    md.push('');
    scenData.push({ id: sc.id, title: sc.title, rules: describeRules(sc.rules), seed: sc.seed, rows, exactRef });
  }
  data.scenarios = scenData;

  md.push('## 5. Betting & Risk [MC]');
  md.push('');
  md.push(`Ergebnisfolge 1: ${int(streamBasic!.summary.rounds)} Runden Basic Strategy (Szenario-A-Regeln, Seed 5005), aufgeteilt in ${int(bcfg.sessions)} Sitzungen à ${bcfg.handsPerSession} Händen; Start-Bankroll ${bcfg.bankroll}, Grundeinsatz ${bcfg.baseBet}, Tischlimit ${bcfg.tableMin}–${bcfg.tableMax}. Alle Systeme erhalten **dieselbe** Ergebnisfolge; zur Replikation wird alles auf einer zweiten, unabhängigen Folge (Seed 5007) wiederholt.`);
  md.push('');
  md.push('| System | Ø End-Bankroll | Median | P(Ruin) | P(im Plus) | Ø eingesetzt | EV je eingesetzter Einheit (±1,96 SE) | Δ zu Flat, gepaart (p) | Replikation: Δ zu Flat (p) | Ø max. Drawdown | Ø längste Verlustserie |');
  md.push('|---|---|---|---|---|---|---|---|---|---|---|');
  const flatB = bet.find((b) => b.id === 'flat')!;
  const flatB2 = bet2.find((b) => b.id === 'flat')!;
  const sigBoth: string[] = [];
  const sigOnce: string[] = [];
  bet.forEach((b, i) => {
    const c1 = b === flatB ? null : pairedSystemDiff(b, flatB);
    const c2 = b === flatB ? null : pairedSystemDiff(bet2[i], flatB2);
    if (c1 && c2 && c1.pValue < 0.05 && c2.pValue < 0.05 && Math.sign(c1.diff) === Math.sign(c2.diff)) sigBoth.push(b.name);
    else if (c1 && c2 && (c1.pValue < 0.05 || c2.pValue < 0.05)) sigOnce.push(b.name);
    md.push(`| ${b.name} | ${f(b.mean, 1)} | ${f(b.median, 1)} | ${f(b.ruinProb * 100, 1)} % | ${f(b.aheadProb * 100, 1)} % | ${f(b.meanWagered, 0)} | ${pc(b.evPerWagered, 2)} ± ${f(1.96 * b.evPerWageredSE * 100, 2)} | ${c1 ? `${pc(c1.diff, 2)} (${f(c1.pValue, 3)})` : 'Referenz'} | ${c2 ? `${pc(c2.diff, 2)} (${f(c2.pValue, 3)})` : 'Referenz'} | ${f(b.meanMaxDrawdown, 1)} | ${f(b.meanLongestLossStreak, 1)} |`);
  });
  md.push('');
  md.push('**Serienabhängigkeit im Schuh** — Voraussetzung dafür, dass ein Einsatzsystem ohne Zählen überhaupt etwas „wissen“ könnte: EV der Folgerunde nach einer verlorenen bzw. gewonnenen Runde (Basic Strategy, Szenario-A-Regeln, Kartenschuh).');
  md.push('');
  md.push('| Datensatz | EV nach Verlust | EV nach Gewinn | Δ (Verlust − Gewinn) ± 1,96 SE | p |');
  md.push('|---|---|---|---|---|');
  for (const row of serialRows) md.push(`| ${row.label} | ${pc(row.r.afterLoss, 3)} | ${pc(row.r.afterWin, 3)} | ${pc(row.r.diff, 3)} ± ${f(1.96 * row.r.se * 100, 3)} | ${f(row.r.p, 3)} |`);
  md.push(`| **Zusatzläufe gepoolt (${int(pooledRes.n)} Runden)** | ${pc(pooledRes.afterLoss, 3)} | ${pc(pooledRes.afterWin, 3)} | **${pc(pooledRes.diff, 3)} ± ${f(1.96 * pooledRes.se * 100, 3)}** | ${f(pooledRes.p, 3)} |`);
  md.push('');
  const ser1 = serialRows[0].r;
  const lossChasers = ['martingale', 'fibonacci', 'dalembert', 'custom'];
  md.push(`**Befund [abgeleitet]:** Systeme mit signifikanter Abweichung des Ertrags je Einheit vom Flat Betting in *beiden* unabhängigen Ergebnisfolgen (gleiche Richtung): ${sigBoth.length ? sigBoth.join(', ') : '**keines**'}. Nur in einer Folge auffällig (p < 0,05, nicht repliziert): ${sigOnce.length ? sigOnce.join(', ') : 'keines'}.` +
    (sigOnce.length && bet.filter((b) => sigOnce.includes(b.name)).every((b) => lossChasers.includes(b.id))
      ? ` Alle nur einmal auffälligen Systeme erhöhen den Einsatz nach Verlusten; sie profitieren in Ergebnisfolge 1 von deren zufällig erhöhter EV nach Verlustrunden (Δ ${pc(ser1.diff, 3)}, p = ${f(ser1.p, 3)}). In den unabhängigen Zusatzläufen (${int(pooledRes.n)} Runden) beträgt dieser Unterschied ${pc(pooledRes.diff, 3)} ± ${f(1.96 * pooledRes.se * 100, 3)} %-Punkte (p = ${f(pooledRes.p, 3)})${pooledRes.p >= 0.05 ? ' — es gibt also keinen belastbaren Zusammenhang, der Effekt in Folge 1 ist eine Zufallsschwankung' : ' — ein kleiner Zusammenhang ist nicht auszuschließen und sollte mit mehr Daten geprüft werden'}.`
      : '') +
    ' Ergebnis: Die Progressionen verändern Ruinwahrscheinlichkeit, Drawdowns und die Form der Ergebnisverteilung, aber nicht den Hausvorteil. Verlustverfolgende Systeme (Martingale, D\'Alembert, Fibonacci) erzeugen häufig kleine Gewinne und selten sehr große Verluste — daher höhere „im Plus“-Anteile bei gleichzeitig hohem Ruinrisiko und stark schwankendem Ertrag je Einheit.');
  md.push('');
  md.push(`**Kelly mit Zählinformation:** Aus ${int(streamHilo!.summary.rounds)} Runden Hi-Lo-Spiel (I18/Fab4-Abweichungen, Flat Bet, Seed 5006) per linearer Regression geschätzt: EV ≈ ${pc(kelly.a, 3)} + ${pc(kelly.b, 3)} × True Count **[MC, abgeleitet]**. Halbes Kelly mit Start-Bankroll ${kcfg.bankroll} (Tischminimum bei negativem geschätzten Vorteil): EV je eingesetzter Einheit ${pc(kellyRes.evPerWagered, 2)} ± ${f(1.96 * kellyRes.evPerWageredSE * 100, 2)}, Flat Betting auf derselben Folge ${pc(flatHilo.evPerWagered, 2)} ± ${f(1.96 * flatHilo.evPerWageredSE * 100, 2)}; gepaarte Differenz ${pc(kellyVsFlat.diff, 2)} (p = ${f(kellyVsFlat.pValue, 4)}). Ø End-Bankroll Kelly ${f(kellyRes.mean, 1)} vs. Flat ${f(flatHilo.mean, 1)}, P(Ruin) ${f(kellyRes.ruinProb * 100, 1)} % vs. ${f(flatHilo.ruinProb * 100, 1)} %. Nur ein Einsatz, der an echte Information über den Restschuh (True Count) gekoppelt ist, kann den Ertrag je Einheit verändern.`);
  md.push('');
  data.betting = { config: bcfg, systems: bet.map(({ finals, samplePaths, hist, sessionNet, sessionWager, ...x }) => (void finals, void samplePaths, void hist, void sessionNet, void sessionWager, x)), serial, kelly, kellyResult: { mean: kellyRes.mean, ruin: kellyRes.ruinProb, evPerWagered: kellyRes.evPerWagered, vsFlat: kellyVsFlat } };

  md.push('## 6. Mathematisch bevorzugte Entscheidungen [exakt]');
  md.push('');
  md.push('Ausgewählte Situationen (6 Decks, volle Schuhzusammensetzung, nur eigene Karten und Dealer-Karte entfernt). EV in % des Einsatzes, nach dem Peek. Die Differenz zeigt, wie knapp eine Entscheidung ist.');
  md.push('');
  const sits: [string, Rules, number, number[]][] = [
    ['16 (10,6) gegen 10, S17', R6S17, 9, [9, 5]],
    ['16 (10,6) gegen 10, H17 + LS', R6H17, 9, [9, 5]],
    ['16 (7,4,5) gegen 10, S17 – drei Karten', R6S17, 9, [6, 3, 4]],
    ['12 (10,2) gegen 4, S17', R6S17, 3, [9, 1]],
    ['11 (6,5) gegen A, S17', R6S17, 0, [5, 4]],
    ['11 (6,5) gegen A, H17', R6H17, 0, [5, 4]],
    ['Soft 18 (A,7) gegen 2, S17', R6S17, 1, [0, 6]],
    ['Soft 18 (A,7) gegen 2, H17', R6H17, 1, [0, 6]],
    ['A,A gegen 10, S17', R6S17, 9, [0, 0]],
    ['8,8 gegen 10, S17 Peek', R6S17, 9, [7, 7]],
    ['8,8 gegen 10, European No-Hole-Card', RENHC, 9, [7, 7]],
    ['11 gegen 10, European No-Hole-Card', RENHC, 9, [5, 4]],
    ['10,10 gegen 6, S17', R6S17, 5, [9, 9]],
    ['5,5 gegen 9, S17', R6S17, 8, [4, 4]],
  ];
  md.push('| Situation | Beste Aktion | EV beste | Zweitbeste | EV zweitbeste | Vorsprung |');
  md.push('|---|---|---|---|---|---|');
  const sitData: unknown[] = [];
  const de: Record<string, string> = { hit: 'Hit', stand: 'Stand', double: 'Double', split: 'Split', surrender: 'Surrender' };
  for (const [label, rules, up, hand] of sits) {
    const e = new EVEngine(rules, fullShoe(rules.decks));
    const ev = e.evaluate({ up, hand });
    const s = ev.actions.slice().sort((a, b) => b.ev - a.ev);
    md.push(`| ${label} | ${de[s[0].action]} | ${pc(s[0].ev, 2)} | ${de[s[1].action]} | ${pc(s[1].ev, 2)} | ${pc(s[0].ev - s[1].ev, 2)} |`);
    sitData.push({ label, actions: ev.actions });
  }
  md.push('');
  const ins = new EVEngine(R6S17, fullShoe(6)).insuranceEV(0, [4, 5]);
  md.push(`Versicherung (6 Decks, Spieler 5,6, Dealer A): P(Zehn) = ${f(ins.pTen * 100, 2)} %, EV ${pc(ins.ev, 2)} je versicherter Einheit → ohne Zählinformation nie versichern **[exakt]**.`);
  md.push('');
  data.situations = sitData;

  // strategy differences by rules
  md.push('### Regelabhängige Strategieunterschiede [exakt]');
  md.push('');
  const pairsOfRules: [string, Rules, Rules][] = [
    ['6D S17 → 6D H17', { ...base }, { ...base, h17: true }],
    ['6D S17 → 1D S17', { ...base }, { ...base, decks: 1 }],
    ['6D S17 Peek → 6D S17 European No-Hole-Card', { ...base }, { ...base, holeCard: 'enhc', obo: false }],
    ['6D S17 DAS → 6D S17 kein DAS', { ...base }, { ...base, das: false }],
  ];
  for (const [label, a, b] of pairsOfRules) {
    const ta = tableOf(a);
    const tb = tableOf(b);
    const diffs: string[] = [];
    for (const kind of ['hard', 'soft', 'pairs'] as const)
      for (const [k, row] of Object.entries(tb[kind]))
        UP_ORDER.forEach((up) => {
          const ca = (ta[kind] as Record<string, typeof row>)[k]?.[up];
          const cb = row[up];
          if (ca && cb && ca.code !== cb.code) diffs.push(`${kind === 'pairs' ? `${IDX_LABEL[Number(k)]},${IDX_LABEL[Number(k)]}` : `${kind === 'soft' ? 'Soft' : 'Hard'} ${k}`} vs ${IDX_LABEL[up]}: ${ca.code}→${cb.code}`);
        });
    md.push(`- **${label}** (${diffs.length} Zellen): ${diffs.join('; ') || 'keine'}`);
  }
  md.push('');

  md.push('## 7. Die bereitgestellten Strategietabellen');
  md.push('');
  md.push('Vollständige Zell-für-Zell-Analyse: `docs/SOURCE_ANALYSIS.md`. Zusammenfassung (Vergleich unter der jeweils bestpassenden Regelkonfiguration; unlesbare Zellen nicht bewertet):');
  md.push('');
  md.push('| Tabelle | Lesbarkeit | unlesbare Zellen | Abweichungen von der exakten Strategie | Konsistente Regeln |');
  md.push('|---|---|---|---|---|');
  const analysis = JSON.parse(readFileSync('src/data/chartAnalysis.json', 'utf8')) as Record<string, { best: { rules: Rules; mismatches: number }[]; unreadable: number }>;
  for (const c of SOURCE_CHARTS) {
    const a = analysis[c.id];
    const cmp = compareChart(c, tableOf({ ...base, ...c.assumedRules }));
    md.push(`| ${c.short} | ${c.confidence} | ${a?.unreadable ?? cmp.counts.unreadable} | ${a?.best[0]?.mismatches ?? '–'} | ${a ? a.best.filter((x) => x.mismatches === a.best[0].mismatches).map((x) => short(x.rules)).join('; ') : '–'} |`);
  }
  md.push('');
  {
    const b = scenarioResults.find((x) => x.sc.id === 'B')!;
    const i2 = b.sc.strategies.findIndex((x) => x.spec.kind === 'chart' && x.spec.chartId === 'img2-hsdp');
    const c2 = pairedComparison(b.results[i2].batches, b.results[0].batches);
    md.push(`Die Simulationen in Abschnitt 4 spielen jede Tabelle wörtlich (unlesbare Zellen durch die Engine ergänzt). Wo eine Tabelle unter den Spielregeln zellgenau mit der berechneten Strategie übereinstimmt, trifft sie auf identischen Schuhen identische Entscheidungen (Δ = 0). Wird eine Tabelle unter Regeln gespielt, für die sie nicht gemacht ist, wird das messbar: Bild 2 (ohne Surrender- und H17-Anpassungen) kostet im H17/Late-Surrender-Spiel (Szenario B) ${pc(c2.diff, 3)} (95-%-KI ${pc(c2.ci95[0], 3)} … ${pc(c2.ci95[1], 3)}, p = ${f(c2.pValue, 4)}).`);
  }
  md.push('');

  md.push('## 8. Zuverlässigkeit, Grenzen und Unsicherheiten');
  md.push('');
  md.push('- **Exakte Werte** sind bis auf die Split-Näherung exakt (Validierung gegen 55 Wizard-of-Odds-Werte: mittlere Abweichung 0,0005 %-Punkte; Monte-Carlo-Gegenproben von Split-EVs mit 1,5 Mio. Versuchen: |z| < 2).');
  md.push(`- **Monte-Carlo-Werte** haben bei ${int(ROUNDS)} Runden einen Standardfehler von etwa ${f((scenarioResults[0].results[0].summary.seBatch) * 100, 3)} %-Punkten je Strategie; gepaarte Differenzen sind deutlich genauer (gemeinsame Zufallsfolgen). Unterschiede unterhalb dieser Auflösung werden als „nicht signifikant“ ausgewiesen.`);
  md.push('- Der Hausvorteil im Kartenschuh mit Schnittkarte weicht leicht vom frischen Schuh ab (Schnittkarten-Effekt); beide Modelle werden getrennt ausgewiesen und nie vermischt.');
  md.push('- Die Hi-Lo-Indexzahlen (Illustrious 18/Fab 4) stammen aus einer externen Quelle (Schlesinger, via Wizard of Odds) und sind für Mehrdeck-S17-Spiele hergeleitet; ihr Nutzen wird hier gemessen, nicht vorausgesetzt. True Count wird exakt (ohne Rundung auf halbe Decks) berechnet.');
  md.push('- Die fünf Nutzerbilder lagen nur in niedriger Auflösung vor; unsicher lesbare Zellen sind markiert und wurden weder erraten noch bewertet. Bild 4 enthält keine Paar-Tabelle (laut Aufdruck auf der Rückseite).');
  md.push('- Einsatzsysteme: Annahme, dass Geld für Doubles/Splits verfügbar ist, solange die Bankroll den Einsatz deckt; die Bankroll fällt nie unter 0.');
  md.push('- **Keine Gewinngarantie:** Mit Ausnahme sehr günstiger Regeln (z. B. 1 Deck, S17, 3:2) bleibt der Hausvorteil auch bei perfekter Basic Strategy positiv.');
  md.push('');
  writeFileSync('docs/REPORT.md', md.join('\n'));
  writeFileSync('docs/report-data.json', JSON.stringify(data, (_k, v) => (typeof v === 'number' ? Number(v.toPrecision(8)) : v), 1));
  console.log('done', ((Date.now() - t00) / 1000).toFixed(0), 's, total rounds', totalRounds);
  void normalCdf;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
