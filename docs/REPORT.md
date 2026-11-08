# OMEGA BLACKJACK INFINITY — Abschlussbericht

Erzeugt am 2026-11-08 00:24 UTC mit `npm run report` (4 CPU-Threads, Laufzeit 2,0 min). Alle Zahlen in diesem Bericht stammen aus genau diesem Lauf; nichts ist geschätzt oder von Hand eingetragen, außer wo ausdrücklich eine externe Quelle genannt ist.

**Tatsächlich simulierte Runden insgesamt: 459.000.000** (Strategievergleich: 10.000.000 Runden je Strategie und Szenario; Validierung: 20.000.000 je Konfiguration; 6 Replikationen à 5.000.000; Betting-Ergebnisfolgen 3 × 3.000.000).

Legende der Herkunft: **[exakt]** kombinatorisch berechnet · **[MC]** Monte-Carlo-Schätzung mit 95-%-Konfidenzintervall · **[Quelle]** externe Referenz · **[abgeleitet]** aus Ergebnissen gefolgert.

## 1. Untersuchte Tischregeln und Methoden

- Kartendecks 1, 2, 4, 6, 8; Dealer H17/S17; Blackjack 3:2, 6:5, 1:1; DAS ja/nein; Double beliebig / 9–11 / 10–11; Surrender keiner / late / early; Split bis 2/4 Hände; Resplit Asse; Ziehen auf Split-Asse; amerikanisches Peek vs. European No-Hole-Card (Verlust aller Einsätze bzw. OBO).
- **Exakte Methode** (Abschnitte 2, 6): Rekursion über alle Kartenfolgen ohne Zurücklegen; Dealer-Endverteilungen über einen vorkompilierten Zustandsgraphen; Spielerentscheidungen kompositionsabhängig optimal; Dealer-Blackjack-Konditionierung exakt (siehe docs/MATH_SPEC.md). Einzige Näherung: Split-EV ignoriert die Entnahme von Nicht-Paar-Karten durch die jeweils andere Teilhand.
- **Monte Carlo** (Abschnitte 3–5): echter Kartenschuh, Ziehen ohne Zurücklegen, Neumischen an der Schnittkarte, Splits/Resplits/Doubles/Surrender/Versicherung vollständig ausgespielt. **Gemeinsame Zufallsfolgen**: Schuh k wird für jede Strategie identisch gemischt (Seed aus Master-Seed und k). Standardfehler per **Batch-Means je Schuh** (berücksichtigt Abhängigkeiten im Schuh); Strategieunterschiede per **gepaartem Vergleich** über dieselben Schuhe.
- Zufallszahlen: xoshiro128** mit splitmix32-Seeding; alle Läufe sind über die angegebenen Seeds reproduzierbar.

## 2. Exakter Hausvorteil nach Regeln [exakt]

Hausvorteil in % des Grundeinsatzes, frischer Schuh je Runde. „Optimal“ = kompositionsabhängig beste Erstentscheidung je Zweikarten-Hand; „Basic“ = total-abhängige Basic-Strategy-Tabelle. Basis: Split bis 4 Hände, kein RSA, eine Karte auf Split-Asse, Double beliebig, DAS, Peek, 3:2, kein Surrender (sofern nicht anders angegeben). Spalte „Wizard“ = Referenzwert des Wizard-of-Odds-Rechners („optimal results“) **[Quelle]**, wo diese Regelkombination dort vorkommt.

| Regeln | Optimal | Basic-Tabelle | Wizard of Odds | Differenz zu Wizard |
|---|---|---|---|---|
| 1 Deck, S17 | -0,184 % | -0,171 % | -0,183 % | -0,0010 |
| 1 Deck, H17 | 0,007 % | 0,016 % | 0,008 % | -0,0005 |
| 2 Decks, S17 | 0,178 % | 0,181 % | 0,178 % | -0,0005 |
| 2 Decks, H17 | 0,380 % | 0,380 % | 0,380 % | -0,0003 |
| 4 Decks, S17 | 0,347 % | 0,348 % | 0,347 % | -0,0005 |
| 4 Decks, H17 | 0,557 % | 0,557 % | 0,557 % | -0,0005 |
| 6 Decks, S17 | 0,403 % | 0,403 % | 0,403 % | -0,0005 |
| 6 Decks, H17 | 0,615 % | 0,615 % | 0,616 % | -0,0005 |
| 8 Decks, S17 | 0,430 % | 0,430 % | 0,431 % | -0,0006 |
| 8 Decks, H17 | 0,644 % | 0,644 % | 0,645 % | -0,0006 |
| 6 Decks, S17, + Late Surrender | 0,330 % | 0,330 % | 0,331 % | -0,0005 |
| 6 Decks, S17, + Early Surrender | -0,224 % | -0,224 % | – | – |
| 6 Decks, S17, kein DAS | 0,544 % | 0,545 % | 0,545 % | -0,0005 |
| 6 Decks, S17, + Resplit Asse | 0,334 % | 0,334 % | 0,335 % | -0,0008 |
| 6 Decks, S17, + Ziehen auf Split-Asse | 0,215 % | 0,215 % | 0,216 % | -0,0005 |
| 6 Decks, S17, Split nur bis 2 Hände | 0,457 % | 0,457 % | 0,457 % | -0,0003 |
| 6 Decks, S17, Double nur 9–11 | 0,499 % | 0,499 % | 0,499 % | -0,0005 |
| 6 Decks, S17, Double nur 10–11 | 0,595 % | 0,595 % | 0,595 % | -0,0006 |
| 6 Decks, S17, European No-Hole-Card (alles verloren) | 0,514 % | 0,514 % | 0,514 % | -0,0004 |
| 6 Decks, S17, No-Hole-Card mit OBO | 0,403 % | 0,403 % | – | – |
| 6 Decks, S17, Blackjack 6:5 | 1,762 % | 1,763 % | – | – |
| 6 Decks, S17, Blackjack 1:1 | 2,669 % | 2,669 % | – | – |
| 6 Decks, H17, DAS, Late Surrender (Bild 4 / Wizard H17) | 0,527 % | 0,527 % | 0,527 % | -0,0005 |

Unendliches Deck (S17, DAS, Split bis 4 außer Asse): Spieler-EV -0,5117 % — Wizard of Odds, Anhang 1: −0,511734 % **[Quelle]**.

Breitere Validierung: `docs/validation-wizard.md` vergleicht 55 Regelkombinationen; mittlere absolute Abweichung 0,0005 %-Punkte, maximal 0,0016 %-Punkte (Resplit bis 3 Hände).

## 3. Validierung: Monte Carlo gegen exakte Rechnung [MC] vs. [exakt]

Basic Strategy, Neumischen vor jeder Runde (identisches Modell wie die exakte Rechnung) bzw. unendliches Deck. z = (MC − exakt) / Standardfehler.

| Konfiguration | Runden | Exakt (Basic) | Monte Carlo | Standardfehler | z | Urteil |
|---|---|---|---|---|---|---|
| 6D S17 DAS, frischer Schuh | 20.000.000 | -0,4028 % | -0,3731 % | 0,0258 %-Pkt. | 1,15 | konsistent |
| 6D H17 DAS LS, frischer Schuh | 20.000.000 | -0,5270 % | -0,5245 % | 0,0257 %-Pkt. | 0,10 | konsistent |
| 1D S17 kein DAS, frischer Schuh | 20.000.000 | +0,0296 % | +0,0010 % | 0,0258 %-Pkt. | -1,11 | konsistent |
| ENHC 6D S17, frischer Schuh | 20.000.000 | -0,5140 % | -0,5440 % | 0,0254 %-Pkt. | -1,18 | konsistent |
| 6D S17 DAS, unendliches Deck | 20.000.000 | -0,5117 % | -0,4843 % | 0,0258 %-Pkt. | 1,06 | konsistent |

Hinweis: Die exakte „Basic“-Zahl nutzt nach der ersten Entscheidung kompositionsabhängige Folgeentscheidungen, die Simulation durchgehend die Tabelle; der Unterschied liegt unter 0,01 %-Punkten und damit unterhalb der Auflösung dieser Läufe.

**Reproduzierbarkeit / Konvergenz:** 6 unabhängige Läufe (6D S17 DAS, Kartenschuh, je 5.000.000 Runden, verschiedene Seeds): EVs -0,489 %, -0,512 %, -0,454 %, -0,512 %, -0,421 %, -0,340 %. Streuung zwischen den Läufen 0,0665 %-Punkte vs. mittlerer geschätzter Standardfehler 0,0515 %-Punkte (Verhältnis 1,29; bei 6 Läufen ist jedes Verhältnis zwischen 0,41 und 1,60 mit einem korrekt geschätzten Standardfehler vereinbar — 95-%-Bereich von √(χ²₅/5)). Gleicher Seed ergibt bitgenau identische Ergebnisse (automatisierter Test).

## 4. Strategievergleich unter identischen Bedingungen [MC]

Jede Strategie spielt dieselben gemischten Schuhe. Δ = EV-Differenz zur regelangepassten Basic Strategy (gepaart) mit 95-%-Konfidenzintervall. „n.s.“ = statistisch nicht unterscheidbar (p ≥ 0,05) — dann wird kein Sieger erklärt. EV in % des Grundeinsatzes; bei Hi-Lo mit Spread ist der Grundeinsatz die Summe der Anfangseinsätze.

### Szenario A — 6 Decks, S17, DAS, kein Surrender, Peek, 3:2, Penetration 75 %

Seed 1001. 6 Decks · S17 · BJ 3:2 · Peek · Double beliebig · DAS · kein Surrender · Split bis 4 Hände · kein RSA · 1 Karte auf Split-Asse.

| Strategie | Runden | EV | 95-%-KI | Hausvorteil | Δ zur Basic Strategy (95-%-KI) | p | Gewinn/Push/Verlust (Runden) | SD/Runde |
|---|---|---|---|---|---|---|---|---|
| Basic Strategy (regelangepasst) | 10.000.000 | -0,399 % | -0,47 % … -0,33 % | 0,399 % | Referenz | – | 43,4 / 8,8 / 47,9 % | 1,154 |
| Basic Strategy für 6D H17 DAS LS | 10.000.000 | -0,415 % | -0,49 % … -0,34 % | 0,415 % | -0,016 % (-0,032 % … -0,001 %) | 0,0421 | 43,3 / 8,7 / 47,9 % | 1,160 |
| Basic Strategy für 1 Deck S17 kein DAS | 10.000.000 | -0,467 % | -0,54 % … -0,39 % | 0,467 % | -0,068 % (-0,094 % … -0,041 %) | <0,0001 | 43,3 / 8,7 / 48,0 % | 1,168 |
| Zusammensetzungsabhängig (2 Karten) | 10.000.000 | -0,396 % | -0,47 % … -0,32 % | 0,396 % | +0,004 % (-0,010 % … +0,017 %) | 0,593 n.s. | 43,4 / 8,8 / 47,9 % | 1,154 |
| Hi-Lo-Abweichungen (I18/Fab4), Flat Bet | 10.000.000 | -0,417 % | -0,49 % … -0,35 % | 0,417 % | -0,018 % (-0,059 % … +0,024 %) | 0,406 n.s. | 43,4 / 8,8 / 47,8 % | 1,150 |
| Hi-Lo + I18/Fab4, Spread 1-1-2-4-6-8 | 10.000.000 | +0,361 % | +0,26 % … +0,46 % | -0,361 % | +0,761 % (+0,676 % … +0,845 %) | <0,0001 | 43,4 / 8,8 / 47,8 % | 2,334 |
| Dealer imitieren | 10.000.000 | -5,712 % | -5,77 % … -5,65 % | 5,712 % | -5,313 % (-5,391 % … -5,235 %) | <0,0001 | 41,1 / 9,8 / 49,1 % | 0,978 |
| Nie überkaufen | 10.000.000 | -3,940 % | -4,01 % … -3,87 % | 3,940 % | -3,541 % (-3,628 % … -3,454 %) | <0,0001 | 42,7 / 6,7 / 50,7 % | 1,165 |
| Tabelle: Bild 1 (französisch) (5 unlesbare/fehlende Zellen durch Engine ergänzt) | 10.000.000 | -0,399 % | -0,47 % … -0,33 % | 0,399 % | +0,000 % (+0,000 % … +0,000 %) | 1,000 n.s. | 43,4 / 8,8 / 47,9 % | 1,154 |
| Tabelle: Bild 2 (H/S/D/P) (4 unlesbare/fehlende Zellen durch Engine ergänzt) | 10.000.000 | -0,399 % | -0,47 % … -0,33 % | 0,399 % | +0,000 % (+0,000 % … +0,000 %) | 1,000 n.s. | 43,4 / 8,8 / 47,9 % | 1,154 |
| Tabelle: Bild 3 (Strategy Card) (1 unlesbare/fehlende Zellen durch Engine ergänzt) | 10.000.000 | -0,399 % | -0,47 % … -0,33 % | 0,399 % | +0,000 % (+0,000 % … +0,000 %) | 1,000 n.s. | 43,4 / 8,8 / 47,9 % | 1,154 |
| Tabelle: Bild 5 (blaue Karte) (14 unlesbare/fehlende Zellen durch Engine ergänzt) | 10.000.000 | -0,399 % | -0,47 % … -0,33 % | 0,399 % | +0,000 % (+0,000 % … +0,000 %) | 1,000 n.s. | 43,4 / 8,8 / 47,9 % | 1,154 |
| Tabelle: Wizard 4–8 Decks S17 (0 unlesbare/fehlende Zellen durch Engine ergänzt) | 10.000.000 | -0,399 % | -0,47 % … -0,33 % | 0,399 % | +0,000 % (+0,000 % … +0,000 %) | 1,000 n.s. | 43,4 / 8,8 / 47,9 % | 1,154 |

Exakte Referenz für diese Regeln (frischer Schuh): Basic -0,4028 %, kompositionsabhängig optimal -0,4026 % **[exakt]**. Abweichungen der Schuh-Simulation davon enthalten den Schnittkarten-Effekt.

### Szenario B — 6 Decks, H17, DAS, Late Surrender, Peek, 3:2 (Regeln von Bild 4)

Seed 2002. 6 Decks · H17 · BJ 3:2 · Peek · Double beliebig · DAS · Late Surrender · Split bis 4 Hände · kein RSA · 1 Karte auf Split-Asse.

| Strategie | Runden | EV | 95-%-KI | Hausvorteil | Δ zur Basic Strategy (95-%-KI) | p | Gewinn/Push/Verlust (Runden) | SD/Runde |
|---|---|---|---|---|---|---|---|---|
| Basic Strategy (regelangepasst) | 10.000.000 | -0,484 % | -0,55 % … -0,41 % | 0,484 % | Referenz | – | 42,2 / 8,4 / 49,4 % | 1,145 |
| Basic Strategy für 6D S17 DAS ohne Surrender | 10.000.000 | -0,550 % | -0,62 % … -0,48 % | 0,550 % | -0,067 % (-0,122 % … -0,012 %) | 0,0177 | 43,3 / 8,7 / 48,0 % | 1,155 |
| Zusammensetzungsabhängig (2 Karten) | 10.000.000 | -0,493 % | -0,56 % … -0,42 % | 0,493 % | -0,009 % (-0,025 % … +0,006 %) | 0,230 n.s. | 42,3 / 8,4 / 49,3 % | 1,146 |
| Tabelle: Bild 4 (4/6/8 Decks H17) (0 unlesbare/fehlende Zellen durch Engine ergänzt) | 10.000.000 | -0,484 % | -0,55 % … -0,41 % | 0,484 % | +0,000 % (+0,000 % … +0,000 %) | 1,000 n.s. | 42,2 / 8,4 / 49,4 % | 1,145 |
| Tabelle: Wizard 4–8 Decks H17 (0 unlesbare/fehlende Zellen durch Engine ergänzt) | 10.000.000 | -0,484 % | -0,55 % … -0,41 % | 0,484 % | +0,000 % (+0,000 % … +0,000 %) | 1,000 n.s. | 42,2 / 8,4 / 49,4 % | 1,145 |
| Tabelle: Bild 2 (H/S/D/P) (4 unlesbare/fehlende Zellen durch Engine ergänzt) | 10.000.000 | -0,554 % | -0,63 % … -0,48 % | 0,554 % | -0,070 % (-0,125 % … -0,016 %) | 0,0110 | 43,3 / 8,7 / 48,0 % | 1,160 |
| Hi-Lo-Abweichungen (I18/Fab4), Flat Bet | 10.000.000 | -0,473 % | -0,54 % … -0,40 % | 0,473 % | +0,011 % (-0,035 % … +0,056 %) | 0,649 n.s. | 42,4 / 8,6 / 49,0 % | 1,143 |

Exakte Referenz für diese Regeln (frischer Schuh): Basic -0,5270 %, kompositionsabhängig optimal -0,5269 % **[exakt]**. Abweichungen der Schuh-Simulation davon enthalten den Schnittkarten-Effekt.

### Szenario C — 1 Deck, S17, kein DAS, Peek, 3:2, Penetration 65 %

Seed 3003. 1 Deck · S17 · BJ 3:2 · Peek · Double beliebig · kein DAS · kein Surrender · Split bis 4 Hände · kein RSA · 1 Karte auf Split-Asse.

| Strategie | Runden | EV | 95-%-KI | Hausvorteil | Δ zur Basic Strategy (95-%-KI) | p | Gewinn/Push/Verlust (Runden) | SD/Runde |
|---|---|---|---|---|---|---|---|---|
| Basic Strategy (regelangepasst) | 10.000.000 | -0,117 % | -0,19 % … -0,05 % | 0,117 % | Referenz | – | 43,5 / 8,5 / 47,9 % | 1,148 |
| Basic Strategy für 6D S17 DAS | 10.000.000 | -0,148 % | -0,22 % … -0,08 % | 0,148 % | -0,031 % (-0,047 % … -0,014 %) | 0,0003 | 43,5 / 8,6 / 47,9 % | 1,133 |
| Zusammensetzungsabhängig (2 Karten) | 10.000.000 | -0,085 % | -0,16 % … -0,01 % | 0,085 % | +0,033 % (+0,015 % … +0,050 %) | 0,0002 | 43,5 / 8,6 / 47,9 % | 1,146 |
| Tabelle: Bild 5 (blaue Karte) (14 unlesbare/fehlende Zellen durch Engine ergänzt) | 10.000.000 | -0,122 % | -0,19 % … -0,05 % | 0,122 % | -0,005 % (-0,012 % … +0,002 %) | 0,144 n.s. | 43,5 / 8,5 / 47,9 % | 1,140 |
| Dealer imitieren | 10.000.000 | -5,659 % | -5,72 % … -5,60 % | 5,659 % | -5,542 % (-5,609 % … -5,475 %) | <0,0001 | 41,3 / 9,5 / 49,2 % | 0,980 |

Exakte Referenz für diese Regeln (frischer Schuh): Basic +0,0296 %, kompositionsabhängig optimal +0,0425 % **[exakt]**. Abweichungen der Schuh-Simulation davon enthalten den Schnittkarten-Effekt.

### Szenario D — European No-Hole-Card, 6 Decks, S17, DAS, Verlust aller Einsätze bei Dealer-BJ

Seed 4004. 6 Decks · S17 · BJ 3:2 · ENHC · Double beliebig · DAS · kein Surrender · Split bis 4 Hände · kein RSA · 1 Karte auf Split-Asse.

| Strategie | Runden | EV | 95-%-KI | Hausvorteil | Δ zur Basic Strategy (95-%-KI) | p | Gewinn/Push/Verlust (Runden) | SD/Runde |
|---|---|---|---|---|---|---|---|---|
| Basic Strategy (regelangepasst) | 10.000.000 | -0,498 % | -0,57 % … -0,43 % | 0,498 % | Referenz | – | 43,4 / 8,8 / 47,9 % | 1,135 |
| Basic Strategy für amerikanische Peek-Regeln (6D S17 DAS) | 10.000.000 | -0,562 % | -0,63 % … -0,49 % | 0,562 % | -0,063 % (-0,088 % … -0,039 %) | <0,0001 | 43,4 / 8,8 / 47,9 % | 1,157 |
| Zusammensetzungsabhängig (2 Karten) | 10.000.000 | -0,498 % | -0,57 % … -0,43 % | 0,498 % | +0,001 % (-0,012 % … +0,013 %) | 0,913 n.s. | 43,3 / 8,8 / 47,9 % | 1,135 |
| Tabelle: Bild 1 (französisch) (5 unlesbare/fehlende Zellen durch Engine ergänzt) | 10.000.000 | -0,498 % | -0,57 % … -0,43 % | 0,498 % | +0,000 % (+0,000 % … +0,000 %) | 1,000 n.s. | 43,4 / 8,8 / 47,9 % | 1,135 |

Exakte Referenz für diese Regeln (frischer Schuh): Basic -0,5140 %, kompositionsabhängig optimal -0,5137 % **[exakt]**. Abweichungen der Schuh-Simulation davon enthalten den Schnittkarten-Effekt.

## 5. Betting & Risk [MC]

Ergebnisfolge 1: 3.000.000 Runden Basic Strategy (Szenario-A-Regeln, Seed 5005), aufgeteilt in 10.000 Sitzungen à 300 Händen; Start-Bankroll 1000, Grundeinsatz 10, Tischlimit 10–1000. Alle Systeme erhalten **dieselbe** Ergebnisfolge; zur Replikation wird alles auf einer zweiten, unabhängigen Folge (Seed 5007) wiederholt.

| System | Ø End-Bankroll | Median | P(Ruin) | P(im Plus) | Ø eingesetzt | EV je eingesetzter Einheit (±1,96 SE) | Δ zu Flat, gepaart (p) | Replikation: Δ zu Flat (p) | Ø max. Drawdown | Ø längste Verlustserie |
|---|---|---|---|---|---|---|---|---|---|---|
| Flat Betting | 985,3 | 985,0 | 0,0 % | 46,6 % | 3395 | -0,43 % ± 0,12 | Referenz | Referenz | 242,9 | 7,9 |
| Martingale | 1030,0 | 0,0 | 61,2 % | 37,3 % | 8128 | -0,10 % ± 0,34 | +0,33 % (0,044) | +0,17 % (0,292) | 1337,8 | 7,0 |
| Paroli (Reverse Martingale) | 973,5 | 965,0 | 0,7 % | 46,0 % | 5680 | -0,47 % ± 0,14 | -0,03 % (0,358) | -0,02 % (0,541) | 466,2 | 7,9 |
| Fibonacci | 1009,7 | 1375,0 | 44,9 % | 53,6 % | 7238 | -0,13 % ± 0,27 | +0,30 % (0,013) | +0,06 % (0,624) | 944,2 | 7,4 |
| D'Alembert | 981,1 | 0,0 | 64,6 % | 33,6 % | 16317 | -0,19 % ± 0,18 | +0,24 % (0,000) | -0,01 % (0,839) | 1469,4 | 7,1 |
| Prozentualer Einsatz | 971,5 | 898,3 | 0,0 % | 39,3 % | 6690 | -0,43 % ± 0,12 | +0,01 % (0,619) | -0,03 % (0,054) | 484,9 | 7,9 |
| Eigene Progression | 973,6 | 1020,0 | 14,2 % | 51,2 % | 7362 | -0,38 % ± 0,16 | +0,06 % (0,271) | +0,10 % (0,061) | 695,3 | 7,9 |

**Serienabhängigkeit im Schuh** — Voraussetzung dafür, dass ein Einsatzsystem ohne Zählen überhaupt etwas „wissen“ könnte: EV der Folgerunde nach einer verlorenen bzw. gewonnenen Runde (Basic Strategy, Szenario-A-Regeln, Kartenschuh).

| Datensatz | EV nach Verlust | EV nach Gewinn | Δ (Verlust − Gewinn) ± 1,96 SE | p |
|---|---|---|---|---|
| Ergebnisfolge 1 (Seed 5005, 3.000.000 Runden) | -0,334 % | -0,662 % | +0,327 % ± 0,274 | 0,019 |
| Ergebnisfolge 2 (Seed 5007, 3.000.000 Runden) | -0,426 % | -0,612 % | +0,187 % ± 0,274 | 0,182 |
| Zusatzlauf 1 (Seed 6001, 10.000.000 Runden) | -0,438 % | -0,329 % | -0,109 % ± 0,150 | 0,153 |
| Zusatzlauf 2 (Seed 6002, 10.000.000 Runden) | -0,445 % | -0,392 % | -0,053 % ± 0,150 | 0,490 |
| Zusatzlauf 3 (Seed 6003, 10.000.000 Runden) | -0,412 % | -0,449 % | +0,037 % ± 0,150 | 0,628 |
| **Zusatzläufe gepoolt (29.999.997 Runden)** | -0,431 % | -0,390 % | **-0,042 % ± 0,087** | 0,345 |

**Befund [abgeleitet]:** Systeme mit signifikanter Abweichung des Ertrags je Einheit vom Flat Betting in *beiden* unabhängigen Ergebnisfolgen (gleiche Richtung): **keines**. Nur in einer Folge auffällig (p < 0,05, nicht repliziert): Martingale, Fibonacci, D'Alembert. Alle nur einmal auffälligen Systeme erhöhen den Einsatz nach Verlusten; sie profitieren in Ergebnisfolge 1 von deren zufällig erhöhter EV nach Verlustrunden (Δ +0,327 %, p = 0,019). In den unabhängigen Zusatzläufen (29.999.997 Runden) beträgt dieser Unterschied -0,042 % ± 0,087 %-Punkte (p = 0,345) — es gibt also keinen belastbaren Zusammenhang, der Effekt in Folge 1 ist eine Zufallsschwankung. Ergebnis: Die Progressionen verändern Ruinwahrscheinlichkeit, Drawdowns und die Form der Ergebnisverteilung, aber nicht den Hausvorteil. Verlustverfolgende Systeme (Martingale, D'Alembert, Fibonacci) erzeugen häufig kleine Gewinne und selten sehr große Verluste — daher höhere „im Plus“-Anteile bei gleichzeitig hohem Ruinrisiko und stark schwankendem Ertrag je Einheit.

**Kelly mit Zählinformation:** Aus 3.000.000 Runden Hi-Lo-Spiel (I18/Fab4-Abweichungen, Flat Bet, Seed 5006) per linearer Regression geschätzt: EV ≈ -0,488 % + +0,577 % × True Count **[MC, abgeleitet]**. Halbes Kelly mit Start-Bankroll 10000 (Tischminimum bei negativem geschätzten Vorteil): EV je eingesetzter Einheit +0,65 % ± 0,18, Flat Betting auf derselben Folge -0,44 % ± 0,11; gepaarte Differenz +1,10 % (p = 0,0000). Ø End-Bankroll Kelly 10041,1 vs. Flat 9984,9, P(Ruin) 0,0 % vs. 0,0 %. Nur ein Einsatz, der an echte Information über den Restschuh (True Count) gekoppelt ist, kann den Ertrag je Einheit verändern.

## 6. Mathematisch bevorzugte Entscheidungen [exakt]

Ausgewählte Situationen (6 Decks, volle Schuhzusammensetzung, nur eigene Karten und Dealer-Karte entfernt). EV in % des Einsatzes, nach dem Peek. Die Differenz zeigt, wie knapp eine Entscheidung ist.

| Situation | Beste Aktion | EV beste | Zweitbeste | EV zweitbeste | Vorsprung |
|---|---|---|---|---|---|
| 16 (10,6) gegen 10, S17 | Hit | -53,47 % | Stand | -54,10 % | +0,63 % |
| 16 (10,6) gegen 10, H17 + LS | Surrender | -50,00 % | Hit | -53,47 % | +3,47 % |
| 16 (7,4,5) gegen 10, S17 – drei Karten | Stand | -53,92 % | Hit | -54,59 % | +0,68 % |
| 12 (10,2) gegen 4, S17 | Hit | -21,04 % | Stand | -21,11 % | +0,08 % |
| 11 (6,5) gegen A, S17 | Hit | +14,76 % | Double | +12,97 % | +1,79 % |
| 11 (6,5) gegen A, H17 | Double | +12,40 % | Hit | +10,87 % | +1,53 % |
| Soft 18 (A,7) gegen 2, S17 | Stand | +12,40 % | Double | +12,10 % | +0,30 % |
| Soft 18 (A,7) gegen 2, H17 | Double | +11,63 % | Stand | +11,31 % | +0,32 % |
| A,A gegen 10, S17 | Split | +18,22 % | Hit | -6,63 % | +24,85 % |
| 8,8 gegen 10, S17 Peek | Split | -47,49 % | Hit | -53,54 % | +6,05 % |
| 8,8 gegen 10, European No-Hole-Card | Hit | -57,14 % | Stand | -57,28 % | +0,14 % |
| 11 gegen 10, European No-Hole-Card | Hit | +3,17 % | Double | +0,93 % | +2,25 % |
| 10,10 gegen 6, S17 | Stand | +70,28 % | Split | +44,54 % | +25,75 % |
| 5,5 gegen 9, S17 | Double | +14,92 % | Hit | +11,67 % | +3,25 % |

Versicherung (6 Decks, Spieler 5,6, Dealer A): P(Zehn) = 31,07 %, EV -6,80 % je versicherter Einheit → ohne Zählinformation nie versichern **[exakt]**.

### Regelabhängige Strategieunterschiede [exakt]

- **6D S17 → 6D H17** (3 Zellen): Hard 11 vs A: H→Dh; Soft 18 vs 2: S→Ds; Soft 19 vs 6: S→Ds
- **6D S17 → 1D S17** (15 Zellen): Hard 8 vs 5: H→Dh; Hard 8 vs 6: H→Dh; Hard 9 vs 2: H→Dh; Hard 11 vs A: H→Dh; Soft 12 vs 5: H→Dh; Soft 13 vs 4: H→Dh; Soft 14 vs 4: H→Dh; Soft 17 vs 2: H→Dh; Soft 18 vs A: H→S; Soft 19 vs 6: S→Ds; 3,3 vs 8: H→P; 4,4 vs 4: H→P; 6,6 vs 7: H→P; 7,7 vs 8: H→P; 7,7 vs 10: H→S
- **6D S17 Peek → 6D S17 European No-Hole-Card** (4 Zellen): Hard 11 vs 10: Dh→H; A,A vs A: P→H; 8,8 vs 10: P→H; 8,8 vs A: P→H
- **6D S17 DAS → 6D S17 kein DAS** (7 Zellen): 2,2 vs 2: P→H; 2,2 vs 3: P→H; 3,3 vs 2: P→H; 3,3 vs 3: P→H; 4,4 vs 5: P→H; 4,4 vs 6: P→H; 6,6 vs 2: P→H

## 7. Die bereitgestellten Strategietabellen

Vollständige Zell-für-Zell-Analyse: `docs/SOURCE_ANALYSIS.md`. Zusammenfassung (Vergleich unter der jeweils bestpassenden Regelkonfiguration; unlesbare Zellen nicht bewertet):

| Tabelle | Lesbarkeit | unlesbare Zellen | Abweichungen von der exakten Strategie | Konsistente Regeln |
|---|---|---|---|---|
| Bild 1 (französisch) | mittel | 5 | 0 | 6D S17 DAS kein Surr. Peek; 6D S17 DAS kein Surr. ENHC |
| Bild 2 (H/S/D/P) | mittel | 4 | 0 | 6D S17 DAS kein Surr. Peek; 6D H17 DAS kein Surr. Peek |
| Bild 3 (Strategy Card) | mittel | 1 | 0 | 6D S17 DAS kein Surr. Peek |
| Bild 4 (4/6/8 Decks H17) | hoch | 0 | 0 | 6D H17 kein DAS kein Surr. Peek; 6D H17 kein DAS LS Peek; 6D H17 DAS kein Surr. Peek; 6D H17 DAS LS Peek |
| Bild 5 (blaue Karte) | niedrig | 14 | 0 | 6D S17 kein DAS kein Surr. Peek; 6D S17 DAS kein Surr. Peek |
| Wizard 4–8 Decks S17 | hoch | 0 | 0 | 6D S17 kein DAS kein Surr. Peek; 6D S17 kein DAS LS Peek; 6D S17 DAS kein Surr. Peek; 6D S17 DAS LS Peek |
| Wizard 4–8 Decks H17 | hoch | 0 | 0 | 6D H17 kein DAS kein Surr. Peek; 6D H17 kein DAS LS Peek; 6D H17 DAS kein Surr. Peek; 6D H17 DAS LS Peek |

Die Simulationen in Abschnitt 4 spielen jede Tabelle wörtlich (unlesbare Zellen durch die Engine ergänzt). Wo eine Tabelle unter den Spielregeln zellgenau mit der berechneten Strategie übereinstimmt, trifft sie auf identischen Schuhen identische Entscheidungen (Δ = 0). Wird eine Tabelle unter Regeln gespielt, für die sie nicht gemacht ist, wird das messbar: Bild 2 (ohne Surrender- und H17-Anpassungen) kostet im H17/Late-Surrender-Spiel (Szenario B) -0,070 % (95-%-KI -0,125 % … -0,016 %, p = 0,0110).

## 8. Zuverlässigkeit, Grenzen und Unsicherheiten

- **Exakte Werte** sind bis auf die Split-Näherung exakt (Validierung gegen 55 Wizard-of-Odds-Werte: mittlere Abweichung 0,0005 %-Punkte; Monte-Carlo-Gegenproben von Split-EVs mit 1,5 Mio. Versuchen: |z| < 2).
- **Monte-Carlo-Werte** haben bei 10.000.000 Runden einen Standardfehler von etwa 0,036 %-Punkten je Strategie; gepaarte Differenzen sind deutlich genauer (gemeinsame Zufallsfolgen). Unterschiede unterhalb dieser Auflösung werden als „nicht signifikant“ ausgewiesen.
- Der Hausvorteil im Kartenschuh mit Schnittkarte weicht leicht vom frischen Schuh ab (Schnittkarten-Effekt); beide Modelle werden getrennt ausgewiesen und nie vermischt.
- Die Hi-Lo-Indexzahlen (Illustrious 18/Fab 4) stammen aus einer externen Quelle (Schlesinger, via Wizard of Odds) und sind für Mehrdeck-S17-Spiele hergeleitet; ihr Nutzen wird hier gemessen, nicht vorausgesetzt. True Count wird exakt (ohne Rundung auf halbe Decks) berechnet.
- Die fünf Nutzerbilder lagen nur in niedriger Auflösung vor; unsicher lesbare Zellen sind markiert und wurden weder erraten noch bewertet. Bild 4 enthält keine Paar-Tabelle (laut Aufdruck auf der Rückseite).
- Einsatzsysteme: Annahme, dass Geld für Doubles/Splits verfügbar ist, solange die Bankroll den Einsatz deckt; die Bankroll fällt nie unter 0.
- **Keine Gewinngarantie:** Mit Ausnahme sehr günstiger Regeln (z. B. 1 Deck, S17, 3:2) bleibt der Hausvorteil auch bei perfekter Basic Strategy positiv.
