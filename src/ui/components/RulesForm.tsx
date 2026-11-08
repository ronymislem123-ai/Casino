import { RULE_PRESETS, Rules, describeRules, rulesKey } from '../../engine/rules';

export function RulesForm({ rules, onChange, showPenetration = true }: { rules: Rules; onChange: (r: Rules) => void; showPenetration?: boolean }) {
  const set = <K extends keyof Rules>(k: K, v: Rules[K]) => onChange({ ...rules, [k]: v });
  const preset = RULE_PRESETS.find((p) => rulesKey(p.rules) === rulesKey(rules));
  return (
    <div className="stack">
      <label className="field">
        Vorlage
        <select
          value={preset?.id ?? ''}
          onChange={(e) => {
            const p = RULE_PRESETS.find((x) => x.id === e.target.value);
            if (p) onChange({ ...p.rules, penetration: rules.penetration });
          }}
        >
          <option value="">— Eigene Regeln —</option>
          {RULE_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <div className="form-grid">
        <label className="field">
          Kartendecks
          <select value={rules.decks} onChange={(e) => set('decks', Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Dealer Soft 17
          <select value={rules.h17 ? 'h' : 's'} onChange={(e) => set('h17', e.target.value === 'h')}>
            <option value="s">Steht (S17)</option>
            <option value="h">Zieht (H17)</option>
          </select>
        </label>
        <label className="field">
          Blackjack-Auszahlung
          <select value={rules.bjPayout} onChange={(e) => set('bjPayout', Number(e.target.value))}>
            <option value={1.5}>3:2</option>
            <option value={1.2}>6:5</option>
            <option value={1.4}>7:5</option>
            <option value={1}>1:1</option>
            <option value={2}>2:1</option>
          </select>
        </label>
        <label className="field">
          Hole Card
          <select value={rules.holeCard} onChange={(e) => onChange({ ...rules, holeCard: e.target.value as Rules['holeCard'], obo: e.target.value === 'peek' ? true : rules.obo })}>
            <option value="peek">Amerikanisch (Peek bei A/10)</option>
            <option value="enhc">Europäisch (No Hole Card)</option>
          </select>
        </label>
        {rules.holeCard === 'enhc' && (
          <label className="field">
            Bei Dealer-Blackjack
            <select value={rules.obo ? 'obo' : 'all'} onChange={(e) => set('obo', e.target.value === 'obo')}>
              <option value="all">Alle Einsätze verloren</option>
              <option value="obo">Nur Originaleinsatz (OBO)</option>
            </select>
          </label>
        )}
        <label className="field">
          Double Down
          <select value={rules.doubleOn} onChange={(e) => set('doubleOn', e.target.value as Rules['doubleOn'])}>
            <option value="any2">Alle ersten zwei Karten</option>
            <option value="9-11">Nur Hard 9–11</option>
            <option value="10-11">Nur Hard 10–11</option>
          </select>
        </label>
        <label className="field">
          Surrender
          <select value={rules.surrender} onChange={(e) => set('surrender', e.target.value as Rules['surrender'])}>
            <option value="none">Kein Surrender</option>
            <option value="late">Late Surrender</option>
            <option value="early">Early Surrender</option>
          </select>
        </label>
        <label className="field">
          Max. Hände durch Split
          <select value={rules.maxSplitHands} onChange={(e) => set('maxSplitHands', Number(e.target.value))}>
            <option value={1}>Kein Split</option>
            {[2, 3, 4, 5, 6, 8].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        {showPenetration && (
          <label className="field">
            Penetration (Schnittkarte)
            <select value={rules.penetration} onChange={(e) => set('penetration', Number(e.target.value))}>
              {[0.5, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9].map((p) => (
                <option key={p} value={p}>
                  {Math.round(p * 100)} %
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="row" style={{ gap: '4px 18px' }}>
        <label className="check">
          <input type="checkbox" checked={rules.das} onChange={(e) => set('das', e.target.checked)} /> Double nach Split (DAS)
        </label>
        <label className="check">
          <input type="checkbox" checked={rules.rsa} onChange={(e) => set('rsa', e.target.checked)} /> Asse erneut splitten (RSA)
        </label>
        <label className="check">
          <input type="checkbox" checked={rules.hsa} onChange={(e) => set('hsa', e.target.checked)} /> Auf Split-Asse ziehen
        </label>
        <label className="check">
          <input type="checkbox" checked={rules.bjAfterSplit} onChange={(e) => set('bjAfterSplit', e.target.checked)} /> A+10 nach Split = Blackjack
        </label>
        <label className="check">
          <input type="checkbox" checked={rules.splitTensSameRankOnly} onChange={(e) => set('splitTensSameRankOnly', e.target.checked)} /> Zehner nur gleichen Rang splitten
        </label>
      </div>
      <div className="note">{describeRules(rules)}</div>
      {rules.holeCard === 'enhc' && rules.surrender !== 'none' && (
        <div className="note warn">Ohne Hole Card wird Surrender vor Kenntnis eines Dealer-Blackjacks entschieden und daher wie Early Surrender bewertet.</div>
      )}
    </div>
  );
}
