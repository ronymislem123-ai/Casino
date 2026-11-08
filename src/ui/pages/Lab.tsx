import { useState } from 'react';
import { Tabs } from '../components/common';
import { SimLab } from './lab/SimLab';
import { BettingLab } from './lab/BettingLab';
import { HouseEdgeLab } from './lab/HouseEdgeLab';
import { SituationLab } from './lab/SituationLab';

type Tab = 'sim' | 'situation' | 'rules' | 'betting';
export function LabPage() {
  const [tab, setTab] = useState<Tab>('sim');
  return (
    <div>
      <div className="page-head">
        <h1>Simulation Lab</h1>
      </div>
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { v: 'sim', l: 'Strategievergleich (Monte Carlo)' },
          { v: 'situation', l: 'Situationsanalyse (EV)' },
          { v: 'rules', l: 'Regeln & House Edge' },
          { v: 'betting', l: 'Betting & Risk' },
        ]}
      />
      <div style={{ display: tab === 'sim' ? 'block' : 'none' }}><SimLab /></div>
      {tab === 'situation' && <SituationLab />}
      <div style={{ display: tab === 'rules' ? 'block' : 'none' }}><HouseEdgeLab /></div>
      <div style={{ display: tab === 'betting' ? 'block' : 'none' }}><BettingLab /></div>
    </div>
  );
}
