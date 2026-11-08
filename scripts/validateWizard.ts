/**
 * Validates the exact EV engine against the Wizard of Odds house-edge table.
 * Writes docs/validation-wizard.md. Run: npm run validate:wizard
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { generateStrategy } from '../src/engine/strategy';
import { DEFAULT_RULES, Rules } from '../src/engine/rules';

interface Row {
  decks: number; h17: boolean; das: boolean; doubleOn: Rules['doubleOn']; maxSplitHands: number;
  rsa: boolean; hsa: boolean; obo: boolean; surrender: Rules['surrender']; houseEdgePct: number;
}
const fx = JSON.parse(readFileSync('tests/fixtures/wizard-house-edge.json', 'utf8'));
const rows: Row[] = fx.rows;
const lines: string[] = [];
let maxAbs = 0;
let sumAbs = 0;
const t0 = Date.now();
for (const r of rows) {
  const rules: Rules = {
    ...DEFAULT_RULES,
    decks: r.decks, h17: r.h17, das: r.das, doubleOn: r.doubleOn, maxSplitHands: r.maxSplitHands,
    rsa: r.rsa, hsa: r.hsa, holeCard: r.obo ? 'peek' : 'enhc', obo: r.obo, surrender: r.surrender,
  };
  const t = generateStrategy(rules);
  const mine = t.houseEdge.cdOptimal;
  const diff = mine - r.houseEdgePct;
  maxAbs = Math.max(maxAbs, Math.abs(diff));
  sumAbs += Math.abs(diff);
  const desc = `${r.decks}D ${r.h17 ? 'H17' : 'S17'} ${r.das ? 'DAS' : 'noDAS'} dbl:${r.doubleOn} SP${r.maxSplitHands} ${r.rsa ? 'RSA' : '-'} ${r.hsa ? 'HSA' : '-'} ${r.obo ? 'peek/OBO' : 'ENHC'} ${r.surrender === 'late' ? 'LS' : '-'}`;
  lines.push(`| ${desc} | ${r.houseEdgePct.toFixed(4)} % | ${mine.toFixed(4)} % | ${diff >= 0 ? '+' : ''}${diff.toFixed(4)} | ${t.houseEdge.tdBasic.toFixed(4)} % |`);
  console.log(desc, r.houseEdgePct.toFixed(4), mine.toFixed(4), diff.toFixed(4));
}
const md = `# Validierung: Exakte Engine vs. Wizard of Odds House-Edge-Tabelle

Erzeugt mit \`npm run validate:wizard\` am ${new Date().toISOString().slice(0, 10)} (Laufzeit ${((Date.now() - t0) / 1000).toFixed(0)} s).

**Referenz:** ${fx.source} — Seite veröffentlicht/aktualisiert ${fx.published}, abgerufen ${fx.retrieved}.
Referenzspalte = „Optimal results“: perfekte kompositionsabhängige Strategie, Mischen nach jeder Hand.
Eigene Spalte = \`generateStrategy(rules).houseEdge.cdOptimal\` (kompositionsabhängig optimale Entscheidung je Zweikarten-Hand, frischer Schuh je Hand).
Die TD-Spalte zeigt zusätzlich den Hausvorteil der eigenen total-abhängigen Basic Strategy (Folgeentscheidungen nach dem ersten Zug kompositionsabhängig).

| Regeln | Wizard (optimal) | Engine (CD) | Differenz (%-Punkte) | Engine (TD-Basic) |
|---|---|---|---|---|
${lines.join('\n')}

**Ergebnis:** ${rows.length} Regelkonfigurationen, mittlere absolute Abweichung ${(sumAbs / rows.length).toFixed(4)} %-Punkte, maximale absolute Abweichung ${maxAbs.toFixed(4)} %-Punkte.
`;
writeFileSync('docs/validation-wizard.md', md);
console.log('mean abs diff', (sumAbs / rows.length).toFixed(5), 'max', maxAbs.toFixed(5));
