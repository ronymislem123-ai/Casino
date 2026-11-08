# Analyse der bereitgestellten Strategietabellen (Phase A)

Erzeugt mit `npx tsx scripts/analyzeCharts.ts` am 2026-11-07. 36 Regelkonfigurationen wurden exakt berechnet (Laufzeit 40 s).

Methode: Jede lesbare Zelle wird in die konkrete Aktion für eine Zweikarten-Hand unter der jeweiligen Regelkonfiguration übersetzt (z. B. „Ph“ = Split nur mit DAS) und mit der Aktion mit dem höchsten exakt berechneten Erwartungswert verglichen. Unlesbare Zellen („?“) werden nicht bewertet. „EV-Verlust“ = Erwartungswert der besten Aktion minus Erwartungswert der Tabellenaktion, in Prozent des Einsatzes, für genau diese Zweikarten-Hand.

## Bild 1 – Französische Tabelle („Joueur / Groupier“)

- **Herkunft:** Vom Nutzer bereitgestelltes Bild 1 (Chat, 2026-11-07), niedrige Auflösung.
- **Angegebene Regeln:** Keine Regelangaben auf dem Bild (keine Deckzahl, kein H17/S17, keine Surrender-Spalte).
- **Lesbarkeit:** mittel; unlesbare Zellen: 5
- **Legende:** `T` = Tirer = Hit (grün); `R` = Rester = Stand (rot); `D` = Doubler = Double (blau), Ersatzaktion nicht angegeben; `P` = Partager = Split (orange)

**Regel-Inferenz:** Beste Übereinstimmung mit 0 abweichenden Zellen (von 345 vergleichbaren):

- 6D S17 DAS noSurr Peek — Trefferquote 100.0 %, Summe EV-Verlust 0.000 %
- 6D S17 DAS noSurr ENHC — Trefferquote 100.0 %, Summe EV-Verlust 0.000 %

| Regelkonfiguration | Abweichungen | Trefferquote |
|---|---|---|
| 6D S17 DAS noSurr Peek | 0 | 100.0 % |
| 6D S17 DAS noSurr ENHC | 0 | 100.0 % |
| 6D H17 DAS noSurr Peek | 2 | 99.4 % |
| 6D H17 DAS noSurr ENHC | 2 | 99.4 % |
| 2D S17 DAS noSurr Peek | 3 | 99.1 % |
| 2D S17 DAS noSurr ENHC | 3 | 99.1 % |
| 6D S17 DAS LS Peek | 4 | 98.8 % |
| 2D H17 DAS noSurr Peek | 6 | 98.3 % |
| 2D H17 DAS noSurr ENHC | 6 | 98.3 % |
| 2D S17 DAS LS Peek | 6 | 98.3 % |
| 2D S17 noDAS noSurr Peek | 7 | 98.0 % |
| 2D S17 noDAS noSurr ENHC | 7 | 98.0 % |

Unlesbare Zellen und was die Engine dort (unter 6D S17 DAS noSurr Peek) berechnet: hard 11 vs 10 → Dh; hard 11 vs A → H; pair A,A vs A → P; pair 8,8 vs 10 → P; pair 8,8 vs A → P

Notizen zur Transkription:

- Hard 11 gegen 10 und gegen A: Farbe bei der vorliegenden Auflösung nicht eindeutig (blau = Double oder grün = Tirer). Nicht übernommen.
- Paar 8-8 gegen 10 und A: nicht eindeutig (orange = Split oder grün). Bei European No-Hole-Card mit Verlust aller Einsätze wäre Hit optimal, mit Peek Split.
- Paar A-A gegen A: nicht eindeutig. Ebenfalls regelabhängig (ENHC vs. Peek).
- Zeile A-10 (Blackjack) wird nicht verglichen – keine Entscheidung; die A-Spalte erscheint in abweichender Farbe.
- „D“ gibt keine Ersatzaktion an, wenn Verdoppeln nicht erlaubt ist (z. B. Soft 18 mit drei Karten).
- Die Beschriftung lautet „Groupier“ (vermutlich Tippfehler für „Croupier“).

## Bild 2 – Farbtabelle H/S/D/P (Hard · Soft · Pairs)

- **Herkunft:** Vom Nutzer bereitgestelltes Bild 2 (Chat, 2026-11-07), niedrige Auflösung.
- **Angegebene Regeln:** Keine Regelangaben (keine Deckzahl, kein H17/S17, keine Surrender-Codes).
- **Lesbarkeit:** mittel; unlesbare Zellen: 4
- **Legende:** `H` = Hit; `S` = Stand; `D` = Double Down (Ersatzaktion nicht angegeben); `P` = Split

**Regel-Inferenz:** Beste Übereinstimmung mit 0 abweichenden Zellen (von 356 vergleichbaren):

- 6D S17 DAS noSurr Peek — Trefferquote 100.0 %, Summe EV-Verlust 0.000 %
- 6D H17 DAS noSurr Peek — Trefferquote 100.0 %, Summe EV-Verlust 0.000 %

| Regelkonfiguration | Abweichungen | Trefferquote |
|---|---|---|
| 6D S17 DAS noSurr Peek | 0 | 100.0 % |
| 6D H17 DAS noSurr Peek | 0 | 100.0 % |
| 2D S17 DAS noSurr Peek | 3 | 99.2 % |
| 2D H17 DAS noSurr Peek | 4 | 98.9 % |
| 6D S17 DAS LS Peek | 4 | 98.9 % |
| 6D S17 DAS noSurr ENHC | 4 | 98.9 % |
| 6D H17 DAS noSurr ENHC | 4 | 98.9 % |
| 2D S17 DAS LS Peek | 6 | 98.3 % |
| 6D H17 DAS LS Peek | 7 | 98.0 % |
| 2D S17 noDAS noSurr Peek | 7 | 98.0 % |
| 6D H17 noDAS noSurr Peek | 7 | 98.0 % |
| 6D S17 noDAS noSurr Peek | 7 | 98.0 % |

Unlesbare Zellen und was die Engine dort (unter 6D S17 DAS noSurr Peek) berechnet: hard 11 vs A → H; soft 18 vs 2 → S; soft 19 vs 6 → S; soft 20 vs 6 → S

Notizen zur Transkription:

- Hard 11 gegen A: nicht eindeutig lesbar (D bei H17, H bei S17 in Mehrdeck-Spielen).
- Soft 18 gegen 2 und Soft 19 gegen 6: Grenzzellen, Farbe nicht sicher (bei H17 jeweils Double/Stand).
- Die Tabelle unterscheidet nicht zwischen „Double sonst Hit“ und „Double sonst Stand“ (Soft 18).
- Split von 2,2/3,3 gegen 2–3 und 6,6 gegen 2 deutet auf Double After Split (DAS) hin.

## Bild 3 – „Blackjack Basic Strategy Card“ (ST/H/D/SP)

- **Herkunft:** Vom Nutzer bereitgestelltes Bild 3 (Chat, 2026-11-07), niedrige Auflösung.
- **Angegebene Regeln:** Keine Regelangaben.
- **Lesbarkeit:** mittel; unlesbare Zellen: 1
- **Legende:** `ST` = Stand; `H` = Hit; `D` = Double (Ersatzaktion nicht angegeben); `SP` = Split

**Regel-Inferenz:** Beste Übereinstimmung mit 0 abweichenden Zellen (von 349 vergleichbaren):

- 6D S17 DAS noSurr Peek — Trefferquote 100.0 %, Summe EV-Verlust 0.000 %

| Regelkonfiguration | Abweichungen | Trefferquote |
|---|---|---|
| 6D S17 DAS noSurr Peek | 0 | 100.0 % |
| 6D H17 DAS noSurr Peek | 2 | 99.4 % |
| 2D S17 DAS noSurr Peek | 3 | 99.1 % |
| 6D S17 DAS LS Peek | 4 | 98.9 % |
| 6D S17 DAS noSurr ENHC | 4 | 98.9 % |
| 2D H17 DAS noSurr Peek | 6 | 98.3 % |
| 2D S17 DAS LS Peek | 6 | 98.3 % |
| 6D H17 DAS noSurr ENHC | 6 | 98.3 % |
| 2D S17 noDAS noSurr Peek | 7 | 98.0 % |
| 6D S17 noDAS noSurr Peek | 7 | 98.0 % |
| 2D S17 DAS noSurr ENHC | 7 | 98.0 % |
| 6D H17 DAS LS Peek | 9 | 97.4 % |

Unlesbare Zellen und was die Engine dort (unter 6D S17 DAS noSurr Peek) berechnet: hard 11 vs A → H

Notizen zur Transkription:

- Hard 11 gegen A: nicht eindeutig lesbar.
- Zeile „A8-10“ umfasst A,10 = Blackjack (keine Entscheidung); verglichen werden nur Soft 19 und 20.
- A,7 = D gegen 3–6 ohne Ersatzaktion; bei verbotenem Double wäre Stand richtig (nicht angegeben).
- Split 2,2/3,3 gegen 2–3, 4,4 gegen 5–6 und 6,6 gegen 2 setzt Double After Split voraus.

## Bild 4 – „Blackjack Basic Strategy Chart, 4/6/8 Decks, Dealer Hits Soft 17“ (Kenneth R Smith, Bayview Strategies)

- **Herkunft:** Vom Nutzer bereitgestelltes Bild 4 (Chat, 2026-11-07). Aufdruck: © 2008-2017 Bayview Strategies, LLC. Paare laut Karte auf der Rückseite – nicht enthalten.
- **Angegebene Regeln:** 4/6/8 Decks, Dealer zieht auf Soft 17 (Überschrift). Surrender-Codes vorhanden → Late Surrender angenommen. DAS nicht angegeben (Paarteil fehlt).
- **Lesbarkeit:** hoch; unlesbare Zellen: 0
- **Legende:** `H` = Hit; `S` = Stand; `D` = Double (sonst Hit – implizit, da DS separat existiert); `DS` = Double, sonst Stand; `R` = Surrender (sonst Hit – implizit, da RS separat existiert); `RS` = Surrender, sonst Stand

**Regel-Inferenz:** Beste Übereinstimmung mit 0 abweichenden Zellen (von 210 vergleichbaren):

- 6D H17 noDAS noSurr Peek — Trefferquote 100.0 %, Summe EV-Verlust 0.000 %
- 6D H17 noDAS LS Peek — Trefferquote 100.0 %, Summe EV-Verlust 0.000 %
- 6D H17 DAS noSurr Peek — Trefferquote 100.0 %, Summe EV-Verlust 0.000 %
- 6D H17 DAS LS Peek — Trefferquote 100.0 %, Summe EV-Verlust 0.000 %

| Regelkonfiguration | Abweichungen | Trefferquote |
|---|---|---|
| 6D H17 noDAS noSurr Peek | 0 | 100.0 % |
| 6D H17 noDAS LS Peek | 0 | 100.0 % |
| 6D H17 DAS noSurr Peek | 0 | 100.0 % |
| 6D H17 DAS LS Peek | 0 | 100.0 % |
| 2D H17 noDAS noSurr Peek | 2 | 99.0 % |
| 2D H17 DAS noSurr Peek | 2 | 99.0 % |
| 6D H17 noDAS noSurr ENHC | 2 | 99.0 % |
| 6D H17 DAS noSurr ENHC | 2 | 99.0 % |
| 2D H17 noDAS LS Peek | 3 | 98.6 % |
| 2D H17 DAS LS Peek | 3 | 98.6 % |
| 2D S17 noDAS noSurr Peek | 3 | 98.6 % |
| 2D S17 DAS noSurr Peek | 3 | 98.6 % |

Notizen zur Transkription:

- Die Karte ist trotz geringer Auflösung gut lesbar (Text in jeder Zelle).
- Hard 18+ ist auf der Karte nicht als eigene Zeile vorhanden (implizit Stand).
- Paare stehen laut Aufdruck auf der Rückseite und liegen nicht vor.

## Bild 5 – Blaue Karte „H=HIT S=STAND DD=DOUBLE SP=SPLIT“

- **Herkunft:** Vom Nutzer bereitgestelltes Bild 5 (Chat, 2026-11-07), niedrige Auflösung, kleine Schrift.
- **Angegebene Regeln:** Keine Regelangaben.
- **Lesbarkeit:** niedrig; unlesbare Zellen: 14
- **Legende:** `H` = Hit; `S` = Stand; `DD` = Double (Ersatzaktion nicht angegeben); `SP` = Split

**Regel-Inferenz:** Beste Übereinstimmung mit 0 abweichenden Zellen (von 296 vergleichbaren):

- 6D S17 noDAS noSurr Peek — Trefferquote 100.0 %, Summe EV-Verlust 0.000 %
- 6D S17 DAS noSurr Peek — Trefferquote 100.0 %, Summe EV-Verlust 0.000 %

| Regelkonfiguration | Abweichungen | Trefferquote |
|---|---|---|
| 6D S17 noDAS noSurr Peek | 0 | 100.0 % |
| 6D S17 DAS noSurr Peek | 0 | 100.0 % |
| 6D H17 noDAS noSurr Peek | 1 | 99.7 % |
| 6D H17 DAS noSurr Peek | 1 | 99.7 % |
| 2D S17 noDAS noSurr Peek | 1 | 99.7 % |
| 2D H17 noDAS noSurr Peek | 2 | 99.3 % |
| 2D S17 DAS noSurr Peek | 3 | 99.0 % |
| 1D S17 noDAS noSurr Peek | 3 | 99.0 % |
| 1D H17 noDAS noSurr Peek | 3 | 99.0 % |
| 2D H17 DAS noSurr Peek | 4 | 98.6 % |
| 2D S17 noDAS LS Peek | 4 | 98.6 % |
| 6D S17 noDAS LS Peek | 4 | 98.6 % |

Unlesbare Zellen und was die Engine dort (unter 6D S17 noDAS noSurr Peek) berechnet: hard 11 vs A → H; soft 13 vs 4 → H; soft 14 vs 4 → H; soft 17 vs 2 → H; soft 18 vs A → H; soft 19 vs 6 → S; pair 2,2 vs 2 → H; pair 2,2 vs 3 → H; pair 3,3 vs 2 → H; pair 3,3 vs 3 → H; pair 4,4 vs 5 → H; pair 4,4 vs 6 → H; pair 6,6 vs 2 → H; pair 7,7 vs 10 → H

Notizen zur Transkription:

- Schrift sehr klein; alle Grenzzellen der Double- und Split-Bereiche sind als unsicher markiert.
- Die Zeile ist mit „8-3“ beschriftet; Hard 3/4 entstehen nur aus Paaren – verglichen werden Hard 5–8.
- Mehrere Muster (A,7 gegen A, 7,7 gegen 10) wären typische Single-Deck-Abweichungen, sind aber nicht sicher lesbar.

## Wizard of Odds – 4–8 Decks, Dealer Stands on Soft 17

- **Herkunft:** https://wizardofodds.com/blackjack/images/bj_4d_s17.gif (Seite „4-Deck to 8-Deck Blackjack Strategy“, aktualisiert 03.08.2026, abgerufen 07.11.2026).
- **Angegebene Regeln:** 4–8 Decks, S17, Peek; DAS/Surrender als bedingte Codes.
- **Lesbarkeit:** hoch; unlesbare Zellen: 0
- **Legende:** `Dh` = Double if allowed, otherwise hit; `Ds` = Double if allowed, otherwise stand; `Ph` = Split if double after split is allowed, otherwise hit; `Rh` = Surrender if allowed, otherwise hit

**Regel-Inferenz:** Beste Übereinstimmung mit 0 abweichenden Zellen (von 340 vergleichbaren):

- 6D S17 noDAS noSurr Peek — Trefferquote 100.0 %, Summe EV-Verlust 0.000 %
- 6D S17 noDAS LS Peek — Trefferquote 100.0 %, Summe EV-Verlust 0.000 %
- 6D S17 DAS noSurr Peek — Trefferquote 100.0 %, Summe EV-Verlust 0.000 %
- 6D S17 DAS LS Peek — Trefferquote 100.0 %, Summe EV-Verlust 0.000 %

| Regelkonfiguration | Abweichungen | Trefferquote |
|---|---|---|
| 6D S17 noDAS noSurr Peek | 0 | 100.0 % |
| 6D S17 noDAS LS Peek | 0 | 100.0 % |
| 6D S17 DAS noSurr Peek | 0 | 100.0 % |
| 6D S17 DAS LS Peek | 0 | 100.0 % |
| 2D S17 noDAS noSurr Peek | 3 | 99.1 % |
| 6D H17 noDAS noSurr Peek | 3 | 99.1 % |
| 6D H17 DAS noSurr Peek | 3 | 99.1 % |
| 2D S17 noDAS LS Peek | 4 | 98.8 % |
| 2D S17 DAS noSurr Peek | 4 | 98.8 % |
| 6D S17 noDAS noSurr ENHC | 4 | 98.8 % |
| 6D S17 DAS noSurr ENHC | 4 | 98.8 % |
| 2D S17 DAS LS Peek | 5 | 98.5 % |

Notizen zur Transkription:

- Fünfen und Zehnen werden laut Seite als Hard 10/20 gespielt (keine Split-Zeile).

## Wizard of Odds – 4–8 Decks, Dealer Hits on Soft 17

- **Herkunft:** https://wizardofodds.com/blackjack/images/bj_4d_h17.gif (Seite „4-Deck to 8-Deck Blackjack Strategy“, aktualisiert 03.08.2026, abgerufen 07.11.2026).
- **Angegebene Regeln:** 4–8 Decks, H17, Peek; DAS/Surrender als bedingte Codes.
- **Lesbarkeit:** hoch; unlesbare Zellen: 0
- **Legende:** `Dh` = Double if allowed, otherwise hit; `Ds` = Double if allowed, otherwise stand; `Ph` = Split if double after split is allowed, otherwise hit; `Rh` = Surrender if allowed, otherwise hit; `Rs` = Surrender if allowed, otherwise stand; `Rp` = Surrender if allowed, otherwise split

**Regel-Inferenz:** Beste Übereinstimmung mit 0 abweichenden Zellen (von 340 vergleichbaren):

- 6D H17 noDAS noSurr Peek — Trefferquote 100.0 %, Summe EV-Verlust 0.000 %
- 6D H17 noDAS LS Peek — Trefferquote 100.0 %, Summe EV-Verlust 0.000 %
- 6D H17 DAS noSurr Peek — Trefferquote 100.0 %, Summe EV-Verlust 0.000 %
- 6D H17 DAS LS Peek — Trefferquote 100.0 %, Summe EV-Verlust 0.000 %

| Regelkonfiguration | Abweichungen | Trefferquote |
|---|---|---|
| 6D H17 noDAS noSurr Peek | 0 | 100.0 % |
| 6D H17 noDAS LS Peek | 0 | 100.0 % |
| 6D H17 DAS noSurr Peek | 0 | 100.0 % |
| 6D H17 DAS LS Peek | 0 | 100.0 % |
| 2D H17 noDAS noSurr Peek | 3 | 99.1 % |
| 6D S17 noDAS noSurr Peek | 3 | 99.1 % |
| 6D S17 DAS noSurr Peek | 3 | 99.1 % |
| 2D H17 DAS noSurr Peek | 4 | 98.8 % |
| 2D S17 noDAS noSurr Peek | 4 | 98.8 % |
| 2D H17 noDAS LS Peek | 5 | 98.5 % |
| 2D S17 DAS noSurr Peek | 5 | 98.5 % |
| 6D H17 noDAS noSurr ENHC | 5 | 98.5 % |

Notizen zur Transkription:

- Fünfen und Zehnen werden laut Seite als Hard 10/20 gespielt (keine Split-Zeile).

## Unterschiede zwischen den Tabellen

Zellen, in denen sich die lesbaren Angaben der Tabellen widersprechen (nur Hard/Soft/Paare, die in mehreren Tabellen vorkommen):

| Zelle | Angaben | Engine 6D S17 DAS | Engine 6D H17 DAS LS |
|---|---|---|---|
| hard 17 vs A | img1-fr: S, img2-hsdp: S, img3-card: S, img4-468-h17: Rs, img5-blue: S, wizard-48-s17: S, wizard-48-h17: Rs | S | Rs |
| hard 16 vs 9 | img1-fr: H, img2-hsdp: H, img3-card: H, img4-468-h17: R, img5-blue: H, wizard-48-s17: R, wizard-48-h17: R | H | Rh |
| hard 16 vs 10 | img1-fr: H, img2-hsdp: H, img3-card: H, img4-468-h17: R, img5-blue: H, wizard-48-s17: R, wizard-48-h17: R | H | Rh |
| hard 16 vs A | img1-fr: H, img2-hsdp: H, img3-card: H, img4-468-h17: R, img5-blue: H, wizard-48-s17: R, wizard-48-h17: R | H | Rh |
| hard 15 vs 10 | img1-fr: H, img2-hsdp: H, img3-card: H, img4-468-h17: R, img5-blue: H, wizard-48-s17: R, wizard-48-h17: R | H | Rh |
| hard 15 vs A | img1-fr: H, img2-hsdp: H, img3-card: H, img4-468-h17: R, img5-blue: H, wizard-48-s17: H, wizard-48-h17: R | H | Rh |
| pair 6,6 vs 2 | img1-fr: P, img2-hsdp: P, img3-card: P, wizard-48-s17: Ph, wizard-48-h17: Ph | P | P |
| pair 4,4 vs 5 | img1-fr: P, img2-hsdp: P, img3-card: P, wizard-48-s17: Ph, wizard-48-h17: Ph | P | P |
| pair 4,4 vs 6 | img1-fr: P, img2-hsdp: P, img3-card: P, wizard-48-s17: Ph, wizard-48-h17: Ph | P | P |
| pair 3,3 vs 2 | img1-fr: P, img2-hsdp: P, img3-card: P, wizard-48-s17: Ph, wizard-48-h17: Ph | P | P |
| pair 3,3 vs 3 | img1-fr: P, img2-hsdp: P, img3-card: P, wizard-48-s17: Ph, wizard-48-h17: Ph | P | P |
| pair 2,2 vs 2 | img1-fr: P, img2-hsdp: P, img3-card: P, wizard-48-s17: Ph, wizard-48-h17: Ph | P | P |
| pair 2,2 vs 3 | img1-fr: P, img2-hsdp: P, img3-card: P, wizard-48-s17: Ph, wizard-48-h17: Ph | P | P |
| soft 19 vs 6 | img1-fr: S, img3-card: S, img4-468-h17: D, wizard-48-s17: S, wizard-48-h17: D | S | Ds |
| soft 18 vs 2 | img1-fr: S, img3-card: S, img4-468-h17: D, img5-blue: S, wizard-48-s17: S, wizard-48-h17: D | S | Ds |
| pair 8,8 vs A | img2-hsdp: P, img3-card: P, img5-blue: P, wizard-48-s17: P, wizard-48-h17: Rp | P | Rp |
| hard 11 vs A | img4-468-h17: D, wizard-48-s17: H, wizard-48-h17: D | H | Dh |

17 Zellen mit unterschiedlichen Angaben. „Ph“ (Split nur mit DAS) wird als bedingte Angabe gewertet.