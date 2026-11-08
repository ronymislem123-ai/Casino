# Phase C — Architektur

## Technologieentscheidung

| Anforderung | Entscheidung | Begründung |
|---|---|---|
| Responsive App, mobil bedienbar, installierbar, offline | **React 18 + TypeScript + Vite**, eigene Service-Worker-Erzeugung, Web-App-Manifest | Leichtgewichtige SPA ohne Server; die gesamte Mathematik läuft im Browser, daher offline-fähig. Kein Backend nötig, da exakte Berechnung (≈ 0,5–2 s je Regelset) und Simulation (≈ 1 Mio. Runden/s) lokal schnell genug sind. |
| Rechenintensive Arbeit ohne UI-Blockade | **Web Workers** (Engine-Worker, Simulations-Worker, separater Betting-Worker) | Live-Entscheidung bleibt verzögerungsfrei, auch während Millionen-Simulationen laufen. |
| Korrektheit | **Vitest** (79 automatisierte Tests), Referenz-Fixtures aus externer Quelle, unabhängige Brute-Force-Implementierungen | Mathematische Korrektheit vor Design. |
| Persistenz | localStorage (Einstellungen, Trainer, Session) und **IndexedDB** (Strategietabellen-Cache, Simulationsergebnisse), jeweils mit Fallback | Größere Datenmengen lokal, kein Konto nötig. |
| Große Berichtsläufe | Node-Skripte mit `worker_threads` (alle CPU-Kerne) | Hunderte Millionen Runden in Minuten. |
| Diagramme | eigene SVG-Komponenten | keine Abhängigkeit, offline, validierte Farbpalette. |

## Schichten

```
src/
  engine/                 ← reine TypeScript-Logik, ohne DOM (läuft in Browser, Worker und Node)
    cards.ts              Kartenwerte, Schuh, Hi-Lo-Tags
    rules.ts              Blackjack Rules Engine: Regelmodell, Presets, Validierung, Regel-Schlüssel
    hand.ts               Handerkennung (Hard/Soft/Paar/Blackjack/Bust) auf Rang-Ebene
    dealer.ts             exakte Dealer-Verteilungen (Graph, Rekursion, Brute Force, unendliches Deck)
    ev.ts                 Strategy Engine: exakte EVs für Stand/Hit/Double/Split/Surrender/Versicherung
    strategy.ts           regelabhängige Basic Strategy + Gesamt-EV/Hausvorteil
    advisor.ts            Live-Entscheidungslogik (Basic / Komposition / Hi-Lo) mit Begründung
    counting.ts           Hi-Lo, True Count, Illustrious 18 / Fab 4 (externe Quelle)
    rng.ts                xoshiro128**, reproduzierbare Seeds
    simulator.ts          Simulation Engine: Kartenschuh, Splits, Doubles, ENHC/OBO, Statistik-Batches
    simStrategies.ts      Spielstrategien für die Simulation (Tabelle, CD, Hi-Lo, Heuristiken, Quelltabellen)
    strategyFactory.ts    serialisierbare Strategie-Spezifikationen → Strategien
    stats.ts              Statistics Engine: Batch-Means-SE, KI, gepaarte Vergleiche, Quantile
    betting.ts            Betting & Risk Engine (Einsatzsysteme auf gemeinsamer Ergebnisfolge)
    validation.ts         Validation Layer: Monte-Carlo-Gegenprobe einzelner Situationen
    chartCompare.ts       Vergleich Quelltabelle ↔ berechnete Strategie
  data/                   Data Layer: transkribierte Quelltabellen, Analyse, Preset-Codes
  workers/                Engine- und Simulations-Worker + Protokoll + Client
  state/                  Einstellungen, IndexedDB/localStorage, Session, Strategietabellen-Hook
  ui/                     Frontend: Seiten (Live, Lab, Referenz, Trainer, Analytics, Einstellungen) und Komponenten
scripts/                  Analyse-/Validierungs-/Berichtsskripte (Node)
tests/                    automatisierte Tests + Referenz-Fixtures
docs/                     Recherche, Spezifikation, Validierung, Bericht
```

## Datenfluss Live Assistant

1. Karteneingabe (Rang-genau) → `classifyHand` (Paar wird vor Soft/Hard erkannt).
2. Strategietabelle der aktuellen Regeln: Speicher → IndexedDB → (Presets: mitgelieferte Codes) → Engine-Worker (exakte Berechnung, Fortschritt).
3. Exakte Bewertung der konkreten Hand im Engine-Worker (Cache je Regelset; Komposition-Modus entfernt alle bekannten Karten).
4. `adviseHand` kombiniert Tabelle, exakte Bewertung und optional Hi-Lo-Index und benennt die Grundlage der Empfehlung.

Die Live-Funktion führt **keine** Monte-Carlo-Simulation aus; sie nutzt dieselbe exakte Mathematik, aus der auch die Tabellen und der Simulator-Referenzwert stammen.

## Datenmodell gespeicherter Simulationen (IndexedDB `sims`)

`id`, `timestamp`, `engineVersion`, `method`, `config` (Regeln, Kartenmodell, Runden, **Seed**, Strategie-Spezifikationen), `rulesText`, `strategies`, `results[]` (Kennzahlen inkl. Standardfehler und Konvergenz-Checkpoints), `comparisons[]` (gepaarte Differenzen, p-Werte), `roundsDone`, `elapsedMs`, `cancelled`, `exactReference`.

## Offline / PWA

Beim Build erzeugt ein Vite-Plugin `sw.js` mit der vollständigen Liste aller Bundle-Dateien (App, Worker, Daten, Icons). Der Service Worker cached sie bei der Installation; Navigationen fallen offline auf `index.html` zurück. Manifest mit Icons (192/512/maskable) ermöglicht die Installation auf dem Homescreen.
