import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { DEFAULT_RULES, Rules, clampRules } from '../engine/rules';
import { lsGet, lsSet } from './db';

export type LiveMode = 'basic' | 'composition' | 'count';

export interface Settings {
  rules: Rules;
  liveMode: LiveMode;
  showDetails: boolean;
  autoAdvance: boolean;
}

const DEFAULTS: Settings = { rules: DEFAULT_RULES, liveMode: 'basic', showDetails: true, autoAdvance: true };

interface Ctx extends Settings {
  setRules: (r: Rules) => void;
  update: (p: Partial<Settings>) => void;
}
const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<Settings>(() => {
    const stored = lsGet<Partial<Settings>>('omega.settings', {});
    return { ...DEFAULTS, ...stored, rules: clampRules({ ...DEFAULT_RULES, ...(stored.rules ?? {}) }) };
  });
  useEffect(() => lsSet('omega.settings', s), [s]);
  const value = useMemo<Ctx>(
    () => ({
      ...s,
      setRules: (r) => setS((p) => ({ ...p, rules: clampRules(r) })),
      update: (p) => setS((q) => ({ ...q, ...p })),
    }),
    [s],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Ctx {
  const c = useContext(SettingsContext);
  if (!c) throw new Error('SettingsProvider fehlt');
  return c;
}
