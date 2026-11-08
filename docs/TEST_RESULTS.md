# Testergebnisse

Protokoll des Laufs `npx vitest run --reporter=verbose` am 2026-11-08 00:24 UTC (Node v22.23.4, Linux).

```
Test Files  6 passed (6)
Tests  79 passed (79)
Duration  11.65s (transform 352ms, setup 0ms, collect 9.02s, tests 13.67s, environment 1ms, prepare 463ms)
```

Zusätzlich ausgeführt und bestanden: `npx tsc --noEmit` (Typprüfung ohne Fehler) und `npx vite build` (Produktions-Build inkl. Service Worker).

## Einzelne Tests

| Datei | Test | Ergebnis |
|---|---|---|
| tests/simulation.test.ts | Zufallszahlen > reproduzierbar mit gleichem Seed, verschieden mit anderem Seed | bestanden |
| tests/simulation.test.ts | Zufallszahlen > gleichverteilte Ganzzahlen (Chi-Quadrat, 13 Ränge) | bestanden |
| tests/simulation.test.ts | Monte-Carlo-Simulator > reproduzierbar: gleicher Seed → identische Ergebnisse | bestanden |
| tests/simulation.test.ts | Monte-Carlo-Simulator > Kartenschuh wird nach der Schnittkarte neu gemischt (Anzahl Schuhe plausibel) | bestanden |
| tests/advisor.test.ts | Live-Advisor > A,A gegen 6 → SPLIT (als Paar erkannt) | bestanden |
| tests/advisor.test.ts | Live-Advisor > 10,10 gegen 5 → STAND, 5,5 gegen 6 → DOUBLE | bestanden |
| tests/advisor.test.ts | Live-Advisor > bedingte Entscheidung: Soft 18 gegen 2 (H17) = Double, Ersatz Stand | bestanden |
| tests/advisor.test.ts | Live-Advisor > Soft 18 gegen 2 mit drei Karten → Stand (Double nicht mehr erlaubt) | bestanden |
| tests/advisor.test.ts | Live-Advisor > 16 gegen 10: Surrender, mit drei Karten Hit | bestanden |
| tests/advisor.test.ts | Live-Advisor > 8,8 gegen A (H17, LS): Surrender, ohne Surrender-Möglichkeit (Split-Hand) Split | bestanden |
| tests/advisor.test.ts | Live-Advisor > 8,8 bei erreichtem Split-Limit wird als Hard 16 gespielt | bestanden |
| tests/advisor.test.ts | Live-Advisor > kein Double nach Split ohne DAS | bestanden |
| tests/simulation.test.ts | Monte-Carlo-Simulator > frischer Schuh: Monte-Carlo-EV stimmt mit exakter Rechnung überein (/z/ < 4) | bestanden |
| tests/simulation.test.ts | Monte-Carlo-Simulator > Splits, Doubles und mehrere Hände treten auf und werden korrekt gezählt | bestanden |
| tests/strategy.test.ts | Basic-Strategy-Generierung > reproduziert das Wizard-of-Odds-Chart 4–8 Decks S17 zellgenau | bestanden |
| tests/strategy.test.ts | Basic-Strategy-Generierung > reproduziert das Wizard-of-Odds-Chart 4–8 Decks H17 zellgenau | bestanden |
| tests/strategy.test.ts | Basic-Strategy-Generierung > bedingte Codes: Rp, Rs, Ds, Dh unter 6D H17 LS | bestanden |
| tests/strategy.test.ts | Basic-Strategy-Generierung > Auflösung bedingter Codes je nach erlaubten Aktionen | bestanden |
| tests/strategy.test.ts | Basic-Strategy-Generierung > unendliches Deck: Spieler-EV −0,5117 % (Wizard of Odds, Anhang 1: S17, DAS, Split bis 4 Hände außer Asse) | bestanden |
| tests/strategy.test.ts | Basic-Strategy-Generierung > Blackjack-Wahrscheinlichkeit des Spielers (6 Decks) = 2·24/312·96/311 | bestanden |
| tests/strategy.test.ts | Basic-Strategy-Generierung > Regression: Hard 21 und Soft 21 (Mehrkartenhände) sind gegen jede Upcard Stand | bestanden |
| tests/strategy.test.ts | Basic-Strategy-Generierung > Wahrscheinlichkeiten aller Startsituationen summieren zu 1 | bestanden |
| tests/strategy.test.ts | Hausvorteil vs. Wizard-of-Odds-Rechner (Referenz-Fixture) > 1D S17 noDAS none peek: /Abweichung/ < 0,003 %-Punkte | bestanden |
| tests/simulation.test.ts | Monte-Carlo-Simulator > „Dealer imitieren“ ist deutlich schlechter als Basic Strategy (gepaarter Vergleich) | bestanden |
| tests/simulation.test.ts | Monte-Carlo-Simulator > Hi-Lo: Einsätze steigen bei hohem True Count | bestanden |
| tests/simulation.test.ts | Statistik > Normalverteilungsfunktion | bestanden |
| tests/simulation.test.ts | Statistik > Batch-Standardfehler ≈ naiver SE bei unabhängigen Batches | bestanden |
| tests/simulation.test.ts | Betting & Risk > Einsatzsysteme ändern den Ertrag pro eingesetzter Einheit nicht (nur Varianz/Risiko) | bestanden |
| tests/simulation.test.ts | Methode C: Exakt vs. Monte Carlo für eine Situation > 16 gegen 10 (Stand/Hit) stimmt innerhalb von 4 Standardfehlern | bestanden |
| tests/strategy.test.ts | Hausvorteil vs. Wizard-of-Odds-Rechner (Referenz-Fixture) > 1D S17 noDAS late peek: /Abweichung/ < 0,003 %-Punkte | bestanden |
| tests/dealer.test.ts | Dealer-Verteilungen > schnelle Graph-Methode == Rekursion == unabhängige Brute-Force-Aufzählung | bestanden |
| tests/dealer.test.ts | Dealer-Verteilungen > Wahrscheinlichkeiten summieren zu 1 bzw. P(kein Dealer-BJ) | bestanden |
| tests/dealer.test.ts | Dealer-Verteilungen > stimmt mit Wizard-of-Odds-Tabelle (1 Deck, S17, nach Peek) auf 6 Stellen überein | bestanden |
| tests/dealer.test.ts | Dealer-Verteilungen > unendliches Deck: Dealer 6 bustet häufiger als Dealer 10 | bestanden |
| tests/dealer.test.ts | Dealer-Verteilungen > H17 vs. S17: Dealer 6 hat bei H17 weniger finale 17 und mehr Busts | bestanden |
| tests/ev.test.ts | EV-Engine: Aktionen und Regeln > Paar Asse gegen 6: Split ist beste Aktion | bestanden |
| tests/ev.test.ts | EV-Engine: Aktionen und Regeln > Paar Zehnen gegen 6: Stand, kein Split | bestanden |
| tests/ev.test.ts | EV-Engine: Aktionen und Regeln > Paar Fünfen gegen 6: Double (als Hard 10), Split ist schlechter | bestanden |
| tests/ev.test.ts | EV-Engine: Aktionen und Regeln > Paar Achten gegen 6: Split | bestanden |
| tests/ev.test.ts | EV-Engine: Aktionen und Regeln > Hard 16 gegen 10 ohne Surrender: Hit knapp vor Stand (6 Decks) | bestanden |
| tests/ev.test.ts | EV-Engine: Aktionen und Regeln > Soft 18 gegen 9: Hit; Soft 17 gegen 6: Double | bestanden |
| tests/ev.test.ts | EV-Engine: Aktionen und Regeln > Hard 11 gegen Ass (6D S17): Hit; bei H17: Double | bestanden |
| tests/ev.test.ts | EV-Engine: Aktionen und Regeln > Hard 8 gegen 6, Hard 9 gegen 3–6 verdoppeln nur, wenn mathematisch besser | bestanden |
| tests/ev.test.ts | EV-Engine: Aktionen und Regeln > Double nur auf erlaubte Totals (Double 9–11) | bestanden |
| tests/ev.test.ts | EV-Engine: Aktionen und Regeln > Kein Double nach Split ohne DAS | bestanden |
| tests/ev.test.ts | EV-Engine: Aktionen und Regeln > Split-Limit: bei maximaler Handzahl kein weiterer Split | bestanden |
| tests/ev.test.ts | EV-Engine: Aktionen und Regeln > Resplit Asse nur mit RSA; Split-Asse erhalten nur eine Karte | bestanden |
| tests/ev.test.ts | EV-Engine: Aktionen und Regeln > Surrender nur bei erlaubter Regel, nur auf den ersten zwei Karten der Ausgangshand | bestanden |
| tests/ev.test.ts | EV-Engine: Aktionen und Regeln > Early Surrender gegen Ass wird vor dem Peek (unbedingt) bewertet | bestanden |
| tests/ev.test.ts | EV-Engine: Aktionen und Regeln > Peek-Spiel: EVs gegen Ass/10 sind bedingt auf „kein Dealer-Blackjack“ | bestanden |
| tests/ev.test.ts | EV-Engine: Aktionen und Regeln > European No-Hole-Card: 11 gegen 10 Hit, 8,8 gegen 10 Hit (Verlust aller Einsätze) | bestanden |
| tests/ev.test.ts | EV-Engine: Aktionen und Regeln > ENHC mit OBO entspricht in der Entscheidung dem Peek-Spiel | bestanden |
| tests/ev.test.ts | EV-Engine: Aktionen und Regeln > Versicherung: EV = 3·P(Zehn) − 1 aus der exakten Zusammensetzung | bestanden |
| tests/ev.test.ts | EV-Engine: Aktionen und Regeln > Gewinn-, Push-, Verlustwahrscheinlichkeiten summieren sich zu 1 | bestanden |
| tests/ev.test.ts | EV-Engine: Aktionen und Regeln > Höhere Gewinnwahrscheinlichkeit ≠ besserer EV (Double vs. Hit bei 11 gegen 6) | bestanden |
| tests/ev.test.ts | EV-Engine: Aktionen und Regeln > Zusammensetzung wirkt: 16 gegen 10 mit vielen fehlenden kleinen Karten → Stand | bestanden |
| tests/ev.test.ts | EV-Engine: Aktionen und Regeln > Unmögliche Karten werden abgelehnt | bestanden |
| tests/advisor.test.ts | Live-Advisor > Split-Asse: nach einer Karte abgeschlossen | bestanden |
| tests/advisor.test.ts | Live-Advisor > Blackjack, Bust und 21 werden erkannt | bestanden |
| tests/advisor.test.ts | Live-Advisor > Hi-Lo-Modus: 16 gegen 10 ohne Surrender bei TC ≥ 0 → Stand, bei TC < 0 → Hit | bestanden |
| tests/advisor.test.ts | Live-Advisor > Quelltabellen-Strategie ergänzt unlesbare Zellen durch die Engine | bestanden |
| tests/strategy.test.ts | Hausvorteil vs. Wizard-of-Odds-Rechner (Referenz-Fixture) > 1D S17 DAS none peek: /Abweichung/ < 0,003 %-Punkte | bestanden |
| tests/hand.test.ts | Handerkennung (Live Assistant) > A + A ist ein Paar Asse, nicht nur Soft 12 | bestanden |
| tests/hand.test.ts | Handerkennung (Live Assistant) > 8 + 8 ist ein Paar Achten | bestanden |
| tests/hand.test.ts | Handerkennung (Live Assistant) > 10 + 10 und K + Q sind Paare mit Hard 20 (Split nur als Option) | bestanden |
| tests/hand.test.ts | Handerkennung (Live Assistant) > K + Q ist kein Paar, wenn nur gleiche Ränge geteilt werden dürfen | bestanden |
| tests/hand.test.ts | Handerkennung (Live Assistant) > A + 7 = Soft 18, A + 6 = Soft 17 | bestanden |
| tests/hand.test.ts | Handerkennung (Live Assistant) > A + 5 + 10 ist Hard 16 (Ass zählt 1) | bestanden |
| tests/hand.test.ts | Handerkennung (Live Assistant) > Mehrkartenhände: 5 + 4 + 7 = Hard 16, A + A + 9 = Soft 21 | bestanden |
| tests/hand.test.ts | Handerkennung (Live Assistant) > A + K ist Blackjack, nach Split aber nur 21 | bestanden |
| tests/hand.test.ts | Handerkennung (Live Assistant) > Bust wird erkannt | bestanden |
| tests/hand.test.ts | Handerkennung (Live Assistant) > Paar ohne Split-Möglichkeit (Maximum erreicht) wird als Total gespielt | bestanden |
| tests/strategy.test.ts | Hausvorteil vs. Wizard-of-Odds-Rechner (Referenz-Fixture) > 1D S17 DAS late peek: /Abweichung/ < 0,003 %-Punkte | bestanden |
| tests/strategy.test.ts | Hausvorteil vs. Wizard-of-Odds-Rechner (Referenz-Fixture) > 1D H17 noDAS none peek: /Abweichung/ < 0,003 %-Punkte | bestanden |
| tests/strategy.test.ts | Hausvorteil vs. Wizard-of-Odds-Rechner (Referenz-Fixture) > 1D H17 noDAS late peek: /Abweichung/ < 0,003 %-Punkte | bestanden |
| tests/strategy.test.ts | Hausvorteil vs. Wizard-of-Odds-Rechner (Referenz-Fixture) > 1D H17 DAS none peek: /Abweichung/ < 0,003 %-Punkte | bestanden |
| tests/strategy.test.ts | Hausvorteil vs. Wizard-of-Odds-Rechner (Referenz-Fixture) > 1D H17 DAS late peek: /Abweichung/ < 0,003 %-Punkte | bestanden |
| tests/strategy.test.ts | Hausvorteil vs. Wizard-of-Odds-Rechner (Referenz-Fixture) > 2D S17 noDAS none peek: /Abweichung/ < 0,003 %-Punkte | bestanden |
| tests/strategy.test.ts | Hausvorteil vs. Wizard-of-Odds-Rechner (Referenz-Fixture) > 2D S17 noDAS late peek: /Abweichung/ < 0,003 %-Punkte | bestanden |

## Abdeckung der geforderten Prüfungen

| Anforderung | Abgedeckt durch |
|---|---|
| Zwei Asse / zwei Achter als Paar, 10+10 kein Auto-Split, 5+5 als Hard 10, Hard/Soft, Mehrkartenhände | tests/hand.test.ts, tests/ev.test.ts, tests/advisor.test.ts |
| Dealer-Ass, Dealer-10, Peek-Bedingung, Versicherung | tests/ev.test.ts |
| Double nur wo erlaubt (9–11, DAS), Split-Limits, Resplit Asse, Split-Asse eine Karte, Surrender (late/early) | tests/ev.test.ts, tests/advisor.test.ts |
| Bedingte Entscheidungen (Dh/Ds/Rh/Rs/Rp) | tests/strategy.test.ts, tests/advisor.test.ts |
| Mehrere Spielerhände (Split-Verwaltung) | tests/advisor.test.ts, tests/simulation.test.ts (Splits/Hände im Simulator) |
| Deckzahlen, H17/S17, American vs. European (ENHC), OBO | tests/ev.test.ts, tests/strategy.test.ts (Wizard-Fixture 1/2 Decks), docs/validation-wizard.md (1–8 Decks, ENHC) |
| Dealer-Verteilungen gegen unabhängige Brute-Force-Implementierung und veröffentlichte Werte | tests/dealer.test.ts |
| Blackjack-Wahrscheinlichkeit, Summe aller Startwahrscheinlichkeiten = 1, unendliches Deck −0,511734 % | tests/strategy.test.ts |
| Hausvorteil gegen externe Referenz | tests/strategy.test.ts (10 Regelsets), docs/validation-wizard.md (55 Regelsets) |
| Monte Carlo vs. exakt, Reproduzierbarkeit, Zufallsverteilung, Schuhwechsel | tests/simulation.test.ts, docs/REPORT.md Abschnitt 3 |
| Methode C (Situations-Gegenprobe) | tests/simulation.test.ts, docs/REPORT.md |
| Einsatzsysteme ändern den Ertrag je Einheit nicht | tests/simulation.test.ts, docs/REPORT.md Abschnitt 5 |
| Regression: Basic-Strategy-Charts zellgenau, Hard/Soft 21 | tests/strategy.test.ts |

Browser-Ende-zu-Ende-Prüfung (Playwright, manuell ausgeführt, nicht Teil von `npm test`): Live-Eingabe A,A gegen 6 → SPLIT; Split-Verwaltung mit zwei Händen und Split-Assen; 16 gegen 10 → HIT; Simulation Lab (100.000 Runden × 4 Strategien), Situations-Gegenprobe, Betting Lab, Strategy Reference mobil — jeweils ohne Konsolenfehler.
