# Phase A — Recherche und Quellenanalyse

Stand: 07./08.11.2026. Alle Abrufe erfolgten über den Proxy dieser Entwicklungsumgebung mit `curl`; die Rohdaten wurden lokal in Text umgewandelt und ausgewertet. Es wurden keine Zahlen aus dem Gedächtnis ergänzt.

## 1. Quellenverzeichnis

| # | Quelle | Veröffentlicht / aktualisiert | Abgerufen | Untersuchte Regelkonfiguration | Übernommene Information | Verwendung |
|---|---|---|---|---|---|---|
| Q1 | Wizard of Odds — *4-Deck to 8-Deck Blackjack Strategy*, https://wizardofodds.com/games/blackjack/strategy/4-decks/ | „Last updated: Aug 03, 2026“ | 07.11.2026 | 4–8 Decks, S17 bzw. H17, Peek; DAS und Surrender als bedingte Codes (Ph, Rh, Rs, Rp) | Beide Chart-Bilder (`bj_4d_s17.gif`, `bj_4d_h17.gif`) Zelle für Zelle transkribiert; Textstrategie und H17-Modifikationen gelesen | Referenz-Charts `wizard-48-s17`, `wizard-48-h17` in `src/data/sourceCharts.ts`; Testfall „reproduziert zellgenau“ |
| Q2 | Wizard of Odds — *Blackjack Strategy Calculator*, https://wizardofodds.com/games/blackjack/strategy/calculator/ | 03.08.2026 | 07.11.2026 | Optionen: Decks 1/2/4+, S17/H17, DAS, Surrender (keiner / beliebig / gegen 2–10), Peek/ENHC | Nur die Liste der Regeloptionen (interaktives JavaScript, keine Tabellen) | Abgleich, welche Regeln strategierelevant sind |
| Q3 | Wizard of Odds — *Blackjack House Edge Calculator*, https://wizardofodds.com/games/blackjack/calculator/ | datePublished/dateModified 03.08.2026 | 07.11.2026 | 6 Deckanzahlen × S17/H17 × DAS × Double-Regel × Split-Limit × RSA × HSA × OBO × Surrender = 3.456 Kombinationen | Eingebettete JavaScript-Tabelle `edgeTable` („optimal results“ = perfekte CD-Strategie, Mischen nach jeder Hand) sowie die dokumentierten Zuschläge für 6:5, Cut Card und CSM | 55 Kombinationen als Fixture `tests/fixtures/wizard-house-edge.json`; Validierung `docs/validation-wizard.md` |
| Q4 | Wizard of Odds — *Dealer Odds in Blackjack under U.S. Rules* (Anhang 2a), https://wizardofodds.com/games/blackjack/appendix/2a/ | 03.08.2026 | 07.11.2026 | 1–8 Decks, S17/H17, Dealer hat bereits gepeekt (kein BJ) | Tabelle 1 Deck S17 (Endstände 17–21/Bust je Upcard) | Testfall „Dealer-Wahrscheinlichkeiten auf 6 Stellen“ |
| Q5 | Wizard of Odds — *Expected Returns in Infinite-Deck Blackjack* (Anhang 1), https://wizardofodds.com/games/blackjack/appendix/1/ | 03.08.2026 | 07.11.2026 | Unendliches Deck, S17, DAS, Split bis 3× außer Asse, eine Karte auf Split-Asse | Gesamt-EV −0,511734 % und Beispielwerte (8,8 vs 10) | Testfall unendliches Deck |
| Q6 | Wizard of Odds — *Blackjack* (Grundlagen, Regelvarianten), https://wizardofodds.com/games/blackjack/basics/ | 03.08.2026 | 07.11.2026 | Basis „8 Decks, S17, DAS“ | Regelbeschreibung; Tabelle der Regel-Effekte (z. B. H17 −0,22 %, 6:5 −1,39 %, ENHC −0,11 %); Hausvorteile schlechter Strategien (Never Bust 3,91 %, Mimic 5,48 % unter AC-Regeln) | Plausibilitätsprüfung der eigenen Regelanalyse und Heuristik-Simulationen |
| Q7 | Wizard of Odds — *High-Low Card Counting*, https://wizardofodds.com/games/blackjack/card-counting/high-low/ | 03.08.2026 | 07.11.2026 | Mehrdeck-Schuh (Statistiktabelle: 6D, S17, LS, DAS, RSA) | Illustrious 18 und Fab 4 (aus D. Schlesinger, *Blackjack Attack*, mit Erlaubnis wiedergegeben) inkl. Anwendungsregel | `src/engine/counting.ts` (als externe Quelle gekennzeichnet) |
| Q8 | Wizard of Odds — Anhänge 9 und 15 | 03.08.2026 | 07.11.2026 | CD-Erwartungswerte; TD- vs. CD-Hausvorteil (32 Regelsets, ohne Surrender/RSA) | Methodische Definitionen (TD vs. CD) | Begriffsdefinition in der App und im Bericht |
| Q9 | BlackjackInfo — *Basic Strategy Engine*, https://www.blackjackinfo.com/blackjack-basic-strategy-engine/ | k. A. | 07.11.2026 | interaktiv | keine Zahlen übernommen (interaktives Werkzeug) | gesichtet |
| Q10 | Wikipedia — *Blackjack* und *Card counting* | k. A. | 07.11.2026 | – | Hintergrund True Count, Kelly-Prinzip; keine Zahlen übernommen | gesichtet |

Nicht erreichbar bzw. nicht genutzt: Hosts außerhalb der Netzwerk-Freigabe (z. B. blackjackapprenticeship.com, qfit.com) wurden nicht abgerufen.

## 2. Analyse der bereitgestellten Strategietabellen

Der Auftrag nannte drei Bilder; im Chat wurden **fünf** Bilder bereitgestellt (geringe Auflösung, ca. 230 × 340 Pixel). Jedes Bild wurde separat transkribiert (`src/data/sourceCharts.ts`). Nicht sicher lesbare Felder sind als `?` gespeichert — sie wurden **nicht erraten** und werden in keinem Vergleich bewertet; die Simulation ergänzt sie aus der Engine und weist das aus.

| Bild | Inhalt / Legende | Angegebene Regeln | Unlesbare Felder (gedruckt) | Regel-Inferenz (bestpassend, 0 Abweichungen) |
|---|---|---|---|---|
| 1 | Französisch: Joueur/Groupier; T = Tirer (Hit), R = Rester (Stand), D = Doubler, P = Partager; Hard 5–17+, Paare, Soft A-2…A-10 | keine | 5 (11 vs 10/A, 8-8 vs 10/A, A-A vs A) | 6D S17 DAS, Peek **oder** ENHC — die unterscheidenden Zellen sind genau die unlesbaren |
| 2 | H/S/D/P farbig; Hard 4–8…17+, Soft 13–19+, Paare | keine | 3 (11 vs A, Soft 18 vs 2, Soft 19+ vs 6) | 6D S17/H17 DAS ohne Surrender |
| 3 | „Basic Strategy Card“ ST/H/D/SP | keine | 1 (11 vs A) | 6D S17 DAS ohne Surrender |
| 4 | „4/6/8 Decks, Dealer Hits Soft 17“ (K. R. Smith, Bayview Strategies) mit D, DS, R, RS | 4/6/8 Decks, H17; Surrender-Codes vorhanden; Paare auf der Rückseite (fehlen) | 0 | 6D H17 (DAS/LS beliebig — die Paartabelle fehlt) |
| 5 | Blaue Karte H/S/DD/SP | keine | 14 (sehr kleine Schrift) | 6D S17 mit/ohne DAS; keine Single-Deck-Signatur sicher lesbar |

Ergebnisse der automatisierten Analyse über 36 exakt berechnete Regelkonfigurationen: `docs/SOURCE_ANALYSIS.md`.

**Unterschiede zwischen den Tabellen** (17 Zellen) sind vollständig durch Regelunterschiede erklärbar:

- Surrender-Zellen (15/16 gegen 9/10/A, 17 gegen A, 8,8 gegen A) erscheinen nur in Tabellen, die Surrender voraussetzen (Bild 4, Wizard).
- 11 gegen A (Double), Soft 18 gegen 2 und Soft 19 gegen 6 (Double/Stand) sind H17-Abweichungen (Bild 4, Wizard H17).
- 2,2/3,3 gegen 2–3, 4,4 gegen 5–6 und 6,6 gegen 2 sind Splits, die Double After Split voraussetzen (bei Wizard als bedingter Code „Ph“).
- Kein Widerspruch blieb übrig, der auf einen Fehler in einer Tabelle hindeutet.

**Mehrdeutige Symbole:** „D“ ohne Ersatzaktion (Bilder 1, 2, 3, 5) legt nicht fest, ob bei verbotenem Double gezogen oder gestanden wird (relevant bei Soft 18). Bild 4 unterscheidet D/DS und R/RS, Wizard Dh/Ds/Rh/Rs/Rp. Die Engine liefert für jede Zelle die Ersatzaktion mit.

**Datenbasis:** Jede Tabelle ist mit ihren angenommenen Regeln (`assumedRules`) gespeichert; die App vergleicht sie zur Laufzeit gegen die exakt berechnete Strategie der aktuell eingestellten Regeln (Strategy Reference → Quelltabellen).

## 3. Fachliche Grundlagen (für die Implementierung geprüft)

- Basic Strategy ist regelabhängig (Decks, H17/S17, DAS, Surrender, Peek/ENHC, Split-Regeln); deshalb wird sie nicht aus einer Tabelle übernommen, sondern für jede Regelkombination aus Erwartungswerten berechnet.
- Total-abhängige (TD) vs. kompositionsabhängige (CD) Strategie (Q8): Die App zeigt beide; der Live-Modus „Basic“ empfiehlt TD und meldet CD-Ausnahmen.
- Dealer-Peek: Entscheidungen gegen A/10 fallen im Peek-Spiel nach Kenntnis „kein Dealer-BJ“; die EVs sind entsprechend bedingt. Early Surrender und ENHC werden vor dieser Kenntnis bewertet.
- Einsatzsysteme ändern den Erwartungswert je eingesetzter Einheit nicht; dies wird im Betting Lab und im Bericht gemessen, nicht nur behauptet.
- Card Counting (Hi-Lo): Tags +1 (2–6), 0 (7–9), −1 (10, A); True Count = Running Count / verbleibende Decks; Index-Plays aus Q7.

## 4. Verbleibende Unsicherheiten

- Die Bilder liegen nur in niedriger Auflösung vor (23 gedruckte Felder über alle Bilder unlesbar, 24 nach Aufteilung zusammengefasster Zeilen wie „Soft 19+“). Höher aufgelöste Originale können die Analyse ohne Codeänderung präzisieren (Zellen in `sourceCharts.ts` ersetzen, `npx tsx scripts/analyzeCharts.ts` erneut ausführen).
- Herkunft und Regelannahmen der Bilder 1, 2, 3 und 5 sind nicht angegeben; die Inferenz zeigt nur, mit welchen Regeln sie konsistent sind.
- Die I18/Fab-4-Indexzahlen sind für Mehrdeck-S17-Spiele hergeleitet; für H17 wurde nur der eindeutig widersprüchliche Eintrag (11 gegen A) ausgelassen.
