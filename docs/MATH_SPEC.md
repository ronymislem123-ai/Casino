# Phase B — Mathematische Spezifikation

## 1. Notation

- Kartenwerte als Indizes 0…9: 0 = Ass, 1…8 = 2…9, 9 = Zehnerwert (10, B, D, K).
- Schuh S = Anzahl je Wert; ein voller Schuh mit d Decks hat 4d je Wert und 16d Zehner.
- Spielerhand H (Multimenge), harte Summe h(H) (Ass = 1), weich, wenn ein Ass enthalten ist und h + 10 ≤ 21; Total t(H).
- Dealer-Upcard u, Hole Card x.

## 2. Dealer-Endverteilung (exakt)

Für einen Restschuh S und Upcard u ist D(S, u) die Verteilung des Dealer-Endstands über {17, 18, 19, 20, 21, Bust, Blackjack}, berechnet durch Rekursion über alle Ziehfolgen **ohne Zurücklegen**: P(nächste Karte = r) = S_r / |S| mit Entnahme nach jedem Zug. Der Dealer zieht bis Total ≥ 17; bei H17 zieht er auf Soft 17.

Implementierung: Die Menge der Zustände „Dealer zieht noch“ (Multimengen gezogener Karten) ist von S unabhängig. Sie wird je Upcard und H17/S17 einmal als topologisch sortierter Graph erzeugt (höchstens 364 Zustände). Für jeden Schuh wird die Wahrscheinlichkeitsmasse vorwärts propagiert; Ergebnis identisch zur Rekursion (Test gegen eine unabhängige Brute-Force-Aufzählung, Abweichung < 1e-12) und gegen Wizard of Odds (Abweichung < 1,5e-6).

## 3. Dealer-Blackjack und Bedingung

Sei B das Ereignis „Hole Card vervollständigt Dealer-BJ“ (u = A und x = 10 oder u = 10 und x = A).

Die Engine rechnet mit **unnormierten** Werten U(X) = E[Auszahlung · 1{nicht B} | Spielerkarten X], wobei die Hole Card *nach* den Spielerkarten gezogen gedacht wird. Wegen Austauschbarkeit der Kartenreihenfolge ist das exakt dieselbe gemeinsame Verteilung wie im realen Spiel. Folgen:

- Ziehen: U_hit(X) = Σ_r P(r | X) · U*(X + r), mit den unbedingten Ziehwahrscheinlichkeiten — exakt, ohne Renormierung in jedem Knoten.
- Bust: U(X) = −Einsatz · P(nicht B | X).
- Bedingter EV nach dem Peek: EV = U(X₀) / P(nicht B | X₀). Da P(nicht B | X) in einem Knoten für alle Aktionen gleich ist, sind die Entscheidungen auf U und auf dem bedingten EV identisch.

Spielformen:

| Form | Dealer-BJ in D enthalten? | EV-Basis |
|---|---|---|
| Peek (amerikanisch) | nein (ausgeschlossen) | bedingt („kein Dealer-BJ“), bei Early Surrender gegen A/10 unbedingt |
| ENHC, Verlust aller Einsätze | ja, verliert jeden Einsatz der Hand (inkl. Double/Split) | unbedingt |
| ENHC mit OBO | nein; konstanter Term −P(B) für den Originaleinsatz | unbedingt = U − P(B) |

## 4. Aktionen

- **Stand:** U = Σ_o D(S − X, u)_o · Auszahlung(t(X), o).
- **Hit:** U = Σ_r P(r) · max(Stand, Hit)(X + r) — die Folgeentscheidungen sind kompositionsabhängig optimal; Memoisierung über die Multimenge aller entfernten Karten (gemischtes Stellenwertsystem, kollisionsfrei bis 8 Decks).
- **Double:** U = 2 · Σ_r P(r) · Stand(X + r) (Bust → −2).
- **Surrender:** −0,5 · P(nicht B) (late, nach Peek) bzw. −0,5 unbedingt (early/ENHC).
- **Split** mit Resplits bis n Hände: dynamische Programmierung über (Hände h, offene Hände p, zusätzlich gezogene Paarkarten k):
  W(h, p, k) = A(k) + (1 − q_k) W(h, p − 1, k) + [h < n] q_k W(h + 1, p + 1, k + 1) + [h = n] (B(k) + q_k W(h, p − 1, k + 1)),
  mit q_k = P(nächste Karte = Paarkarte), A(k) = Σ_{c ≠ P} P(c) · V({P, c}), B(k) = q_k · V({P, P} ohne Split). V nutzt DAS, Double-Regel, Split-Asse (eine Karte / ziehen erlaubt) und „A+10 nach Split = 21“. Exakte Kartenentnahme der eigenen Hand und aller Paarkarten; **Näherung:** Nicht-Paar-Karten der jeweils anderen Teilhände werden nicht entnommen (Standardverfahren; Fehler im Hausvorteil < 0,002 %-Punkte, siehe Validierung). Zusätzlich gezogene Paarkarten werden ab k > 3 wie k = 3 behandelt (Einfluss < 1e-5 %).
- **Versicherung:** EV je versicherter Einheit = 3 · P(Zehn als Hole Card) − 1, aus der exakten Restzusammensetzung.

Verfügbarkeit (nicht erlaubte Aktionen werden nie bewertet): Double nur auf zwei Karten und nach Double-Regel (9–11/10–11 = harte Totals), nach Split nur mit DAS; Split nur bei gleichem Wert (optional gleicher Rang bei Zehnern), bis zum Hand-Limit, Asse nur mit RSA erneut; Surrender nur auf den ersten zwei Karten der Ausgangshand.

## 5. Total-abhängige Basic Strategy

Für jede Tabellenzelle (Hard t, Soft t, Paar p) × Upcard u werden alle Zweikarten-Zusammensetzungen K dieser Klasse mit ihrer Wahrscheinlichkeit P(K | u) gewichtet (für die bedingte Basis mit P(K) · P(nicht B | K)). Pro Aktion a: EV_a = Σ_K w_K · EV_a(K) / Σ_K w_K. Beste Aktion = argmax EV_a; der Code enthält zusätzlich die Ersatzaktion (Dh/Ds/Rh/Rs/Rp), die bei mehr als zwei Karten gilt. Hard 4/20 werden aus 2,2 bzw. 10,10 (ohne Split) gebildet, Soft 12 aus A,A ohne Split.

Gesamt-EV einer Runde: Σ_u Σ_K P(u) P(K | u) · EV_runde, mit Spieler-BJ = (1 − P(Dealer-BJ)) · Auszahlung; „Optimal“ wählt je K die beste Aktion, „Basic“ die Aktion der Tabelle.

## 6. Monte-Carlo-Simulation

- Schuhmodelle: (a) Kartenschuh mit Schnittkarte (Penetration), (b) Neumischen vor jeder Runde, (c) unendliches Deck. Ein bekannter Restschuh kann als Startzusammensetzung für (b) vorgegeben werden.
- Ziehen per „lazy Fisher-Yates“ (gleichverteilte Permutation, nur gezogene Karten werden gemischt). Bei Erschöpfung mitten in der Runde werden die Ablagekarten gemischt (Casinopraxis), danach wird neu gemischt.
- Gemeinsame Zufallsfolgen: Seed von Schuh k = f(Master-Seed, k) — alle Strategien sehen dieselbe Kartenfolge je Schuh.

## 7. Statistik

- EV je Grundeinsatz r = Σ Netto / Σ Anfangseinsatz; zusätzlich Netto je Runde und Netto je insgesamt riskiertem Einsatz (inkl. Double/Split/Versicherung).
- Standardfehler per Batch-Means (Batch = ein Schuh bzw. 1.000 Runden), Ratio-Schätzer: SE = √(Σ (y_k − r x_k)² / (K(K − 1))) / x̄. Dies berücksichtigt die Abhängigkeit der Hände innerhalb eines Schuhs.
- 95-%-Konfidenzintervall r ± 1,96 SE. Gepaarter Strategievergleich: Differenz der linearisierten Batch-Residuen je Schuh, z-Test, p-Wert; „nicht signifikant“ wird ausgewiesen, kein künstlicher Sieger.
- Konvergenz: laufender Mittelwert mit 95-%-Band an logarithmisch verteilten Checkpoints; Replikationen mit verschiedenen Seeds.

## 8. Betting & Risk

Eine Ergebnisfolge (Netto je Runde in Vielfachen des Einsatzes, riskierter Einsatz, True Count) wird einmal simuliert und auf alle Einsatzsysteme angewendet. Kennzahlen je System: Verteilung der End-Bankroll (Quantile), Ruinwahrscheinlichkeit (Bankroll < Tischminimum), Anteil Sitzungen im Plus, Ertrag je eingesetzter Einheit mit Standardfehler über Sitzungen, Drawdown, Verlustserien, Tischlimit-Treffer. Fractional Kelly nutzt einen aus den Daten geschätzten linearen Zusammenhang EV(TC) = a + b · TC.

## 9. Kennzeichnung

Jeder Wert in App und Bericht trägt seine Herkunft: exakt berechnet, Simulation (mit Konfidenzintervall), externe Quelle, abgeleitet.
