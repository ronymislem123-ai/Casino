# OMEGA BLACKJACK INFINITY

Blackjack-Strategie-Engine mit exakter Erwartungswertberechnung, Monte-Carlo-Simulationslabor und Live-Entscheidungsassistent — als installierbare, offline-fähige Web-App (PWA).

> **Keine Gewinngarantie.** Auch mathematisch optimale Entscheidungen beseitigen den Hausvorteil des Casinos in fast allen Regelvarianten nicht. Die App dient Analyse, Training und Verständnis.

## Funktionen

| Bereich | Was er tut |
|---|---|
| **Live Assistant** | Große Kartentasten (2–10, B, D, K, A), Karten als Spielkarten, automatische Erkennung von Paar/Soft/Hard (A+A = Paar Asse, nicht nur Soft 12), sofortige Empfehlung mit bedingten Codes („DOUBLE (sonst STAND)“), exakte EV-Tabelle aller erlaubten Aktionen inkl. Gewinn/Push/Verlust, Split-Verwaltung mit mehreren nummerierten Händen, Undo, Karte entfernen, neue Runde. Drei Modi: **Basic** (regelangepasste Tabelle), **Komposition** (exakt mit allen gesehenen Karten), **Hi-Lo** (Index-Plays nach True Count). Versicherungs-EV aus der exakten Zusammensetzung. |
| **Strategy Engine** | Exakte kombinatorische Rekursion ohne Zurücklegen für Stand, Hit, Double, Split (Resplits), Surrender, Versicherung; Dealer-Blackjack-Konditionierung (Peek, ENHC, OBO). |
| **Simulation Lab** | Monte-Carlo-Strategievergleich mit gemeinsamen Zufallsfolgen (identische Schuhe), Batch-Means-Konfidenzintervallen, gepaarten Signifikanztests, Konvergenzdiagramm, Pause/Fortsetzen/Abbrechen/Speichern; drei getrennte Kartenmodelle (Schuh mit Schnittkarte, Neumischen je Runde, unendliches Deck). |
| **Situationsanalyse** | Exakte EVs und Dealer-Verteilung einer beliebigen Hand plus unabhängige Monte-Carlo-Gegenprobe mit z-Werten (Methode C). |
| **Regeln & House Edge** | Exakter Hausvorteil für Basis-Regeln und jede Einzeländerung, inkl. Anzahl geänderter Strategiezellen. |
| **Betting & Risk** | Flat, Martingale, Paroli, Fibonacci, D'Alembert, Prozent, eigene Progression, Fractional Kelly (nur mit Zählinformation) auf derselben Ergebnisfolge: Ruinrisiko, Drawdown, Verlustserien, Ertrag je eingesetzter Einheit mit Standardfehler. |
| **Strategy Reference** | Vollständige Basic-Strategy-Tabellen (Hard/Soft/Paare) für die eingestellten Regeln mit „Warum?“-EV-Erklärung je Zelle; Vergleich der fünf bereitgestellten Tabellen und der Wizard-of-Odds-Charts mit der berechneten Strategie. |
| **Trainer** | Zufällige Situationen in vier Schwierigkeitsstufen, sofortige Bewertung mit EV-Kosten des Fehlers, Genauigkeit je Kategorie, häufigste Fehler. |
| **Analytics** | Gespeicherte Simulationen vergleichen/exportieren, Session- und Bankroll-Dashboard mit persönlichen Limits und Strategietreue, exakte Dealer-Wahrscheinlichkeiten. |

## Schnellstart

```bash
npm install
npm run dev        # Entwicklungsserver
npm run build      # Produktions-Build nach dist/ (inkl. Service Worker)
npm run preview    # Build lokal ansehen
npm test           # 79 automatisierte Tests
```

Analyse- und Berichtsskripte (Node):

```bash
npm run report            # Abschlussbericht docs/REPORT.md (Millionen Runden je Strategie, alle CPU-Kerne)
npm run validate:wizard   # Validierung gegen 55 Wizard-of-Odds-Hausvorteile → docs/validation-wizard.md
npx tsx scripts/analyzeCharts.ts   # Regel-Inferenz der Quelltabellen → docs/SOURCE_ANALYSIS.md
npm run precompute        # Preset-Strategiecodes für sofortige Offline-Empfehlungen
```

Die App ist nach dem ersten Laden offline nutzbar und lässt sich über „Zum Startbildschirm hinzufügen“ installieren. Der Build verwendet relative Pfade und läuft daher auf jedem statischen Hosting.

## Validierung (Kurzfassung)

- **Exakter Hausvorteil vs. Wizard of Odds** (55 Regelkombinationen, 1–8 Decks, S17/H17, DAS, Surrender, RSA, HSA, Double-Einschränkungen, ENHC): mittlere absolute Abweichung **0,0005 %-Punkte**, maximal 0,0016 → `docs/validation-wizard.md`.
- **Basic-Strategy-Charts** von Wizard of Odds (4–8 Decks S17 und H17) werden **zellgenau** reproduziert (automatisierter Test).
- **Dealer-Wahrscheinlichkeiten** stimmen auf 6 Nachkommastellen mit der veröffentlichten Tabelle überein; unendliches Deck: −0,511734 % exakt reproduziert.
- **Monte Carlo vs. exakt**: konsistent innerhalb der Zufallsschwankung (siehe `docs/REPORT.md`, Abschnitt 3).
- Testergebnisse: `docs/TEST_RESULTS.md`.

## Dokumentation

- `docs/RESEARCH.md` — Quellen (mit Datum), Analyse der bereitgestellten Tabellen, Unsicherheiten
- `docs/SOURCE_ANALYSIS.md` — Zell-für-Zell-Vergleich und Regel-Inferenz der Quelltabellen
- `docs/MATH_SPEC.md` — mathematische Spezifikation (exakt vs. Monte Carlo, Statistik)
- `docs/ARCHITECTURE.md` — Technologieentscheidung, Schichten, Datenfluss, PWA
- `docs/REPORT.md` — Abschlussbericht der tatsächlich durchgeführten Berechnungen und Simulationen
- `docs/TEST_RESULTS.md` — protokollierte Testläufe

## Hinweis zu den bereitgestellten Strategietabellen

Die fünf Bilder lagen nur in geringer Auflösung vor. Felder, die nicht eindeutig lesbar waren, sind als unlesbar markiert und werden weder erraten noch bewertet (`src/data/sourceCharts.ts`). Mit schärferen Originalen lassen sich die Felder direkt ergänzen; Vergleich und Regel-Inferenz aktualisieren sich automatisch.
