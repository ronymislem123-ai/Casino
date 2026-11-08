/**
 * Phase A – analysis of the supplied strategy charts.
 * For every chart: compare against engine-computed strategies for a grid of rule
 * sets, infer which rules the chart is consistent with, list every deviation with
 * its EV cost. Writes docs/SOURCE_ANALYSIS.md and src/data/chartAnalysis.json.
 * Run: npx tsx scripts/analyzeCharts.ts
 */
import { writeFileSync } from 'node:fs';
import { SOURCE_CHARTS } from '../src/data/sourceCharts';
import { compareChart, ChartComparison } from '../src/engine/chartCompare';
import { generateStrategy, StrategyTable, UP_ORDER } from '../src/engine/strategy';
import { DEFAULT_RULES, Rules, describeRules } from '../src/engine/rules';
import { IDX_LABEL } from '../src/engine/cards';

const grid: Rules[] = [];
for (const decks of [1, 2, 6])
  for (const h17 of [false, true])
    for (const das of [false, true])
      for (const surrender of ['none', 'late'] as const)
        for (const enhc of [false, true]) {
          if (enhc && surrender === 'late') continue;
          grid.push({ ...DEFAULT_RULES, decks, h17, das, surrender, holeCard: enhc ? 'enhc' : 'peek', obo: !enhc });
        }

const t0 = Date.now();
const tables: StrategyTable[] = grid.map((r, i) => {
  const t = generateStrategy(r);
  console.log(`table ${i + 1}/${grid.length} ${describeRules(r)} ${t.computeMs} ms`);
  return t;
});

const upLabel = (u: number) => IDX_LABEL[u];
const actDe: Record<string, string> = { hit: 'Hit', stand: 'Stand', double: 'Double', split: 'Split', surrender: 'Surrender' };
const short = (r: Rules) =>
  `${r.decks}D ${r.h17 ? 'H17' : 'S17'} ${r.das ? 'DAS' : 'noDAS'} ${r.surrender === 'late' ? 'LS' : 'noSurr'} ${r.holeCard === 'enhc' ? 'ENHC' : 'Peek'}`;

const md: string[] = [];
const json: Record<string, unknown> = {};
md.push('# Analyse der bereitgestellten Strategietabellen (Phase A)');
md.push('');
md.push(`Erzeugt mit \`npx tsx scripts/analyzeCharts.ts\` am ${new Date().toISOString().slice(0, 10)}. ${grid.length} Regelkonfigurationen wurden exakt berechnet (Laufzeit ${((Date.now() - t0) / 1000).toFixed(0)} s).`);
md.push('');
md.push('Methode: Jede lesbare Zelle wird in die konkrete Aktion für eine Zweikarten-Hand unter der jeweiligen Regelkonfiguration übersetzt (z. B. „Ph“ = Split nur mit DAS) und mit der Aktion mit dem höchsten exakt berechneten Erwartungswert verglichen. Unlesbare Zellen („?“) werden nicht bewertet. „EV-Verlust“ = Erwartungswert der besten Aktion minus Erwartungswert der Tabellenaktion, in Prozent des Einsatzes, für genau diese Zweikarten-Hand.');
md.push('');

for (const chart of SOURCE_CHARTS) {
  const comps: ChartComparison[] = tables.map((t) => compareChart(chart, t));
  const ranked = comps
    .map((c, i) => ({ c, i }))
    .sort((a, b) => a.c.counts.mismatch - b.c.counts.mismatch || a.c.sumEvLoss - b.c.sumEvLoss);
  const best = ranked[0];
  const bestSet = ranked.filter((x) => x.c.counts.mismatch === best.c.counts.mismatch);
  md.push(`## ${chart.title}`);
  md.push('');
  md.push(`- **Herkunft:** ${chart.origin}`);
  md.push(`- **Angegebene Regeln:** ${chart.statedRules}`);
  md.push(`- **Lesbarkeit:** ${chart.confidence}; unlesbare Zellen: ${best.c.counts.unreadable}`);
  md.push(`- **Legende:** ${chart.legend.map((l) => `\`${l.symbol}\` = ${l.meaning}`).join('; ')}`);
  md.push('');
  md.push(`**Regel-Inferenz:** Beste Übereinstimmung mit ${best.c.counts.mismatch} abweichenden Zellen (von ${best.c.counts.match + best.c.counts['fallback-diff'] + best.c.counts.mismatch} vergleichbaren):`);
  md.push('');
  for (const x of bestSet.slice(0, 8)) md.push(`- ${short(grid[x.i])} — Trefferquote ${(x.c.matchRate * 100).toFixed(1)} %, Summe EV-Verlust ${(x.c.sumEvLoss * 100).toFixed(3)} %`);
  if (bestSet.length > 8) md.push(`- … sowie ${bestSet.length - 8} weitere gleich gute Konfigurationen`);
  md.push('');
  md.push('| Regelkonfiguration | Abweichungen | Trefferquote |');
  md.push('|---|---|---|');
  for (const x of ranked.slice(0, 12)) md.push(`| ${short(grid[x.i])} | ${x.c.counts.mismatch} | ${(x.c.matchRate * 100).toFixed(1)} % |`);
  md.push('');
  const b = best.c;
  const mism = b.cells.filter((c) => c.status === 'mismatch');
  if (mism.length) {
    md.push(`Abweichungen unter der bestpassenden Konfiguration (${short(grid[best.i])}):`);
    md.push('');
    md.push('| Hand | Dealer | Tabelle | Engine (optimal) | EV-Verlust |');
    md.push('|---|---|---|---|---|');
    for (const c of mism) md.push(`| ${c.kind} ${c.kind === 'pair' ? IDX_LABEL[c.key] + ',' + IDX_LABEL[c.key] : c.key} | ${upLabel(c.up)} | ${c.src} → ${actDe[c.srcAction!]} | ${c.engineCode} → ${actDe[c.engineBest!]} | ${(c.evLoss * 100).toFixed(3)} % |`);
    md.push('');
  }
  const fd = b.cells.filter((c) => c.status === 'fallback-diff');
  if (fd.length) {
    md.push(`Abweichende Ersatzaktion (gleiche Hauptaktion): ${fd.map((c) => `${c.kind} ${c.key} vs ${upLabel(c.up)} (Tabelle ${c.src}, Engine ${c.engineCode})`).join('; ')}`);
    md.push('');
  }
  const un = b.cells.filter((c) => c.status === 'unreadable');
  if (un.length) {
    md.push(`Unlesbare Zellen und was die Engine dort (unter ${short(grid[best.i])}) berechnet: ${un.map((c) => `${c.kind} ${c.kind === 'pair' ? IDX_LABEL[c.key] + ',' + IDX_LABEL[c.key] : c.key} vs ${upLabel(c.up)} → ${c.engineCode}`).join('; ')}`);
    md.push('');
  }
  md.push('Notizen zur Transkription:');
  md.push('');
  for (const n of chart.notes) md.push(`- ${n}`);
  md.push('');
  json[chart.id] = {
    best: ranked.slice(0, 6).map((x) => ({ rules: grid[x.i], mismatches: x.c.counts.mismatch, matchRate: x.c.matchRate, sumEvLoss: x.c.sumEvLoss })),
    unreadable: best.c.counts.unreadable,
  };
}

// cross-chart differences under one rule set
md.push('## Unterschiede zwischen den Tabellen');
md.push('');
md.push('Zellen, in denen sich die lesbaren Angaben der Tabellen widersprechen (nur Hard/Soft/Paare, die in mehreren Tabellen vorkommen):');
md.push('');
const ref = tables[grid.findIndex((r) => r.decks === 6 && !r.h17 && r.das && r.surrender === 'none' && r.holeCard === 'peek')];
const byCell = new Map<string, { chart: string; src: string }[]>();
for (const chart of SOURCE_CHARTS) {
  for (const row of chart.rows)
    for (const key of row.keys)
      row.cells.forEach((src, col) => {
        if (src === '?') return;
        const k = `${row.kind} ${row.kind === 'pair' ? IDX_LABEL[key] + ',' + IDX_LABEL[key] : key} vs ${IDX_LABEL[UP_ORDER[col]]}`;
        const norm = src === 'Dh' || src === 'Ds' ? 'D' : src === 'Rh' || src === 'R' ? 'R' : src;
        (byCell.get(k) ?? byCell.set(k, []).get(k)!).push({ chart: chart.id, src: norm });
      });
}
md.push('| Zelle | Angaben | Engine 6D S17 DAS | Engine 6D H17 DAS LS |');
md.push('|---|---|---|---|');
const h17ls = tables[grid.findIndex((r) => r.decks === 6 && r.h17 && r.das && r.surrender === 'late' && r.holeCard === 'peek')];
const get = (t: StrategyTable, label: string) => {
  const m = label.match(/^(hard|soft|pair) (\S+) vs (\S+)$/)!;
  const up = IDX_LABEL.indexOf(m[3] as never);
  const kind = m[1] as 'hard' | 'soft' | 'pair';
  const key = kind === 'pair' ? IDX_LABEL.indexOf(m[2].split(',')[0] as never) : Number(m[2]);
  const c = kind === 'hard' ? t.hard[key]?.[up] : kind === 'soft' ? t.soft[key]?.[up] : t.pairs[key]?.[up];
  return c?.code ?? '–';
};
let nDiff = 0;
for (const [k, v] of byCell) {
  const vals = new Set(v.map((x) => (x.src === 'Ph' ? 'P*' : x.src)));
  if (vals.size > 1) {
    nDiff++;
    md.push(`| ${k} | ${v.map((x) => `${x.chart}: ${x.src}`).join(', ')} | ${get(ref, k)} | ${get(h17ls, k)} |`);
  }
}
md.push('');
md.push(`${nDiff} Zellen mit unterschiedlichen Angaben. „Ph“ (Split nur mit DAS) wird als bedingte Angabe gewertet.`);
writeFileSync('docs/SOURCE_ANALYSIS.md', md.join('\n'));
writeFileSync('src/data/chartAnalysis.json', JSON.stringify(json, null, 1));
console.log('done', (Date.now() - t0) / 1000, 's');
