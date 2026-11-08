import { useState } from 'react';
import { useSettings } from '../../state/settings';
import { dbClear } from '../../state/db';
import { RulesForm } from '../components/RulesForm';
import { INDEX_SOURCE } from '../../engine/counting';

export const SOURCES = [
  {
    name: 'Wizard of Odds – 4-Deck to 8-Deck Blackjack Strategy (Charts S17/H17, Textstrategie)',
    url: 'https://wizardofodds.com/games/blackjack/strategy/4-decks/',
    date: 'Seite aktualisiert 03.08.2026 · abgerufen 07.11.2026',
    use: 'Referenz-Charts (zellgenau von der Engine reproduziert).',
  },
  {
    name: 'Wizard of Odds – Blackjack Strategy Calculator',
    url: 'https://wizardofodds.com/games/blackjack/strategy/calculator/',
    date: 'aktualisiert 03.08.2026 · abgerufen 07.11.2026',
    use: 'Regeloptionen als Plausibilitätsprüfung (interaktiver Rechner, keine Daten übernommen).',
  },
  {
    name: 'Wizard of Odds – Blackjack House Edge Calculator',
    url: 'https://wizardofodds.com/games/blackjack/calculator/',
    date: 'veröffentlicht/aktualisiert 03.08.2026 · abgerufen 07.11.2026',
    use: 'Hausvorteil-Referenzwerte (3.456 Regelkombinationen); 55 davon als Test-Fixture.',
  },
  {
    name: 'Wizard of Odds – Dealer Odds under U.S. Rules (Anhang 2a)',
    url: 'https://wizardofodds.com/games/blackjack/appendix/2a/',
    date: 'aktualisiert 03.08.2026 · abgerufen 07.11.2026',
    use: 'Dealer-Endwahrscheinlichkeiten zur Validierung.',
  },
  {
    name: 'Wizard of Odds – Expected Returns in Infinite-Deck Blackjack (Anhang 1)',
    url: 'https://wizardofodds.com/games/blackjack/appendix/1/',
    date: 'aktualisiert 03.08.2026 · abgerufen 07.11.2026',
    use: 'Referenz-EV −0,511734 % für das unendliche Deck.',
  },
  {
    name: 'Wizard of Odds – Blackjack (Regeln, Effekt von Regelvarianten)',
    url: 'https://wizardofodds.com/games/blackjack/basics/',
    date: 'aktualisiert 03.08.2026 · abgerufen 07.11.2026',
    use: 'Regelbeschreibung und Größenordnung von Regeleffekten (Gegenprüfung).',
  },
  {
    name: 'Wizard of Odds – High-Low Card Counting (Illustrious 18 / Fab 4)',
    url: 'https://wizardofodds.com/games/blackjack/card-counting/high-low/',
    date: 'aktualisiert 03.08.2026 · abgerufen 07.11.2026',
    use: INDEX_SOURCE,
  },
  {
    name: 'BlackjackInfo – Basic Strategy Engine',
    url: 'https://www.blackjackinfo.com/blackjack-basic-strategy-engine/',
    date: 'abgerufen 07.11.2026',
    use: 'Gesichtet; interaktives Werkzeug, keine Zahlen übernommen.',
  },
  {
    name: 'Wikipedia – Card counting',
    url: 'https://en.wikipedia.org/wiki/Card_counting',
    date: 'abgerufen 07.11.2026',
    use: 'Hintergrund True Count / Kelly-Prinzip; keine Zahlen übernommen.',
  },
];

export function SettingsPage() {
  const s = useSettings();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="stack">
      <div className="page-head"><h1>Einstellungen</h1></div>
      <div className="panel stack">
        <h2>Tischregeln</h2>
        <p className="muted">Diese Regeln gelten für Live Assistant, Strategietabellen, Trainer und als Vorgabe im Simulation Lab. Jede Änderung löst eine exakte Neuberechnung der Strategie aus.</p>
        <RulesForm rules={s.rules} onChange={s.setRules} />
      </div>
      <div className="panel stack">
        <h2>Live Assistant</h2>
        <label className="check"><input type="checkbox" checked={s.showDetails} onChange={(e) => s.update({ showDetails: e.target.checked })} /> Erwartungswerte und Details anzeigen</label>
        <div className="note">
          <b>Basic</b>: Tabelle für die eingestellten Regeln (EV-Tabelle exakt für die eigenen Karten). <b>Komposition</b>: exakte Entscheidung mit allen bekannten Karten des Schuhs. <b>Hi-Lo</b>: Basic Strategy plus Index-Plays nach True Count (optionale Erweiterung).
        </div>
      </div>
      <div className="panel stack">
        <h2>Daten</h2>
        <div className="row">
          <button className="btn small" onClick={() => dbClear('tables').then(() => setMsg('Strategie-Cache gelöscht.'))}>Strategie-Cache löschen</button>
          <button className="btn small danger" onClick={() => dbClear('sims').then(() => setMsg('Gespeicherte Simulationen gelöscht.'))}>Simulationen löschen</button>
        </div>
        {msg && <div className="note info">{msg}</div>}
        <div className="note">Alle Daten bleiben lokal auf diesem Gerät (IndexedDB/localStorage). Nach dem ersten Laden funktioniert die App offline.</div>
      </div>
      <div className="panel stack">
        <h2>Quellen</h2>
        {SOURCES.map((x) => (
          <div key={x.url} className="list-item" style={{ alignItems: 'flex-start' }}>
            <div>
              <div><a href={x.url} target="_blank" rel="noreferrer">{x.name}</a></div>
              <div className="muted" style={{ fontSize: 12 }}>{x.date}</div>
              <div style={{ fontSize: 13 }}>{x.use}</div>
            </div>
          </div>
        ))}
        <div className="note">Die fünf vom Nutzer bereitgestellten Strategietabellen sind in „Strategy Reference → Quelltabellen“ transkribiert; unlesbare Felder sind markiert und werden nicht verwendet.</div>
      </div>
      <div className="panel stack">
        <h2>Methoden & Kennzeichnung</h2>
        <div className="row">
          <span className="badge exact">Exakt berechnet</span> <span className="muted">kombinatorische Rekursion ohne Zurücklegen</span>
        </div>
        <div className="row">
          <span className="badge sim">Simulation</span> <span className="muted">Monte-Carlo-Schätzung mit Konfidenzintervall</span>
        </div>
        <div className="row">
          <span className="badge src">Externe Quelle</span> <span className="muted">aus dokumentierter Quelle übernommen</span>
        </div>
        <div className="note">
          Einzige Näherung der exakten Engine: Beim Split wird die Entnahme von Nicht-Paar-Karten durch die jeweils andere Teilhand nicht berücksichtigt (Standardverfahren). Validierung: mittlere Abweichung des Hausvorteils 0,0006 %-Punkte über 55 Regelsets gegenüber Wizard of Odds; Monte-Carlo-Gegenproben innerhalb der Zufallsschwankung.
        </div>
        <div className="callout">Keine Gewinnversprechen: Auch perfekte Basic Strategy lässt dem Casino in fast allen Regelvarianten einen Vorteil. Bitte verantwortungsvoll spielen.</div>
      </div>
    </div>
  );
}
