import { useEffect, useState } from 'react';
import { SettingsProvider } from './state/settings';
import { IconChart, IconLab, IconLive, IconSettings, IconTable, IconTrainer } from './ui/components/Icons';
import { LivePage } from './ui/pages/Live';
import { LabPage } from './ui/pages/Lab';
import { ReferencePage } from './ui/pages/Reference';
import { TrainerPage } from './ui/pages/Trainer';
import { AnalyticsPage } from './ui/pages/Analytics';
import { SettingsPage } from './ui/pages/Settings';

type Page = 'live' | 'lab' | 'reference' | 'trainer' | 'analytics' | 'settings';
const NAV: { id: Page; label: string; icon: (p: { 'aria-hidden': boolean }) => JSX.Element }[] = [
  { id: 'live', label: 'Live', icon: IconLive },
  { id: 'lab', label: 'Simulation', icon: IconLab },
  { id: 'reference', label: 'Strategie', icon: IconTable },
  { id: 'trainer', label: 'Trainer', icon: IconTrainer },
  { id: 'analytics', label: 'Analytics', icon: IconChart },
  { id: 'settings', label: 'Einstellungen', icon: IconSettings },
];

function readHash(): Page {
  const h = window.location.hash.replace('#', '') as Page;
  return NAV.some((n) => n.id === h) ? h : 'live';
}

export function App() {
  const [page, setPage] = useState<Page>(readHash);
  useEffect(() => {
    const on = () => setPage(readHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = (p: Page) => {
    window.location.hash = p;
    setPage(p);
    window.scrollTo({ top: 0 });
  };
  return (
    <SettingsProvider>
      <div className="app">
        <nav className="nav" aria-label="Hauptnavigation">
          <div className="brand">
            <div className="brand-title">OMEGA BLACKJACK</div>
            <div className="brand-sub">INFINITY · Strategy Engine</div>
          </div>
          {NAV.map((n) => (
            <button key={n.id} className={page === n.id ? 'active' : ''} onClick={() => go(n.id)} aria-current={page === n.id ? 'page' : undefined}>
              <n.icon aria-hidden />
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
        <main className="main">
          <div style={{ display: page === 'live' ? 'block' : 'none' }}>
            <LivePage goSettings={() => go('settings')} />
          </div>
          <div style={{ display: page === 'lab' ? 'block' : 'none' }}>
            <LabPage />
          </div>
          {page === 'reference' && <ReferencePage />}
          {page === 'trainer' && <TrainerPage />}
          {page === 'analytics' && <AnalyticsPage />}
          {page === 'settings' && <SettingsPage />}
        </main>
      </div>
    </SettingsProvider>
  );
}
