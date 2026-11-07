/**
 * Blackjack rules model. Every rule here is consumed by the exact EV engine,
 * the strategy generator and the Monte Carlo simulator — none of them is cosmetic.
 */

export type HoleCardRule = 'peek' | 'enhc';
export type SurrenderRule = 'none' | 'late' | 'early';
export type DoubleRule = 'any2' | '9-11' | '10-11';

export interface Rules {
  /** Number of 52-card decks (1..8). */
  decks: number;
  /** Dealer hits soft 17 (H17) — otherwise stands on all 17s (S17). */
  h17: boolean;
  /** Blackjack payout as a multiple of the bet: 1.5 (3:2), 1.2 (6:5), 1 (1:1). */
  bjPayout: number;
  /** 'peek' = American hole card, dealer checks A/10 for blackjack.
   *  'enhc' = European no-hole-card, dealer blackjack is revealed only at the end. */
  holeCard: HoleCardRule;
  /** ENHC only: player loses only the original bet against a dealer blackjack (OBO). */
  obo: boolean;
  /** Which first-two-card totals may be doubled. 9-11 / 10-11 refer to hard totals. */
  doubleOn: DoubleRule;
  /** Double after split allowed. */
  das: boolean;
  /** Surrender rule. Late = after the peek. Early = before the peek (vs A and 10).
   *  In ENHC games surrender is necessarily decided before the hole card is known,
   *  so any surrender there is valued like early surrender. */
  surrender: SurrenderRule;
  /** Maximum number of hands a player may hold through splitting (1 = no splitting). */
  maxSplitHands: number;
  /** Resplit aces allowed. */
  rsa: boolean;
  /** Player may draw more than one card to split aces. */
  hsa: boolean;
  /** Ace + ten after a split counts as a blackjack (rare; normally just 21). */
  bjAfterSplit: boolean;
  /** Only identical ten-value ranks (e.g. K+K, not K+Q) may be split. */
  splitTensSameRankOnly: boolean;
  /** Fraction of the shoe dealt before the reshuffle (cut card). Simulation only. */
  penetration: number;
}

export const DEFAULT_RULES: Rules = {
  decks: 6,
  h17: false,
  bjPayout: 1.5,
  holeCard: 'peek',
  obo: true,
  doubleOn: 'any2',
  das: true,
  surrender: 'none',
  maxSplitHands: 4,
  rsa: false,
  hsa: false,
  bjAfterSplit: false,
  splitTensSameRankOnly: false,
  penetration: 0.75,
};

export interface RulePreset {
  id: string;
  name: string;
  description: string;
  rules: Rules;
}

export const RULE_PRESETS: RulePreset[] = [
  {
    id: '6d-s17-das',
    name: '6 Decks · S17 · DAS',
    description: 'Klassischer Mehrdeck-Schuh, Dealer steht auf Soft 17, Double nach Split, Peek.',
    rules: { ...DEFAULT_RULES },
  },
  {
    id: '6d-h17-das-ls',
    name: '6 Decks · H17 · DAS · LS',
    description: 'Typischer Las-Vegas-Schuh: Dealer zieht auf Soft 17, Late Surrender.',
    rules: { ...DEFAULT_RULES, h17: true, surrender: 'late' },
  },
  {
    id: '468d-h17',
    name: '4/6/8 Decks · H17 (Tabelle 4)',
    description: 'Regelannahme der Tabelle „4/6/8 Decks, Dealer Hits Soft 17“ (hier 6 Decks, DAS, LS).',
    rules: { ...DEFAULT_RULES, decks: 6, h17: true, surrender: 'late' },
  },
  {
    id: '8d-s17-das-ls',
    name: '8 Decks · S17 · DAS · LS',
    description: 'Atlantic-City-ähnliche Regeln.',
    rules: { ...DEFAULT_RULES, decks: 8, surrender: 'late' },
  },
  {
    id: '4d-s17-das',
    name: '4 Decks · S17 · DAS',
    description: 'Vier Decks, Dealer steht auf Soft 17.',
    rules: { ...DEFAULT_RULES, decks: 4 },
  },
  {
    id: '2d-h17-das',
    name: '2 Decks · H17 · DAS',
    description: 'Double Deck, Dealer zieht auf Soft 17.',
    rules: { ...DEFAULT_RULES, decks: 2, h17: true },
  },
  {
    id: '1d-s17-nodas',
    name: '1 Deck · S17 · kein DAS',
    description: 'Single Deck, 3:2, kein Double nach Split.',
    rules: { ...DEFAULT_RULES, decks: 1, das: false },
  },
  {
    id: '1d-h17-65',
    name: '1 Deck · H17 · 6:5',
    description: 'Single Deck mit verkürzter Blackjack-Auszahlung 6:5.',
    rules: { ...DEFAULT_RULES, decks: 1, h17: true, das: false, bjPayout: 1.2 },
  },
  {
    id: '6d-enhc-s17',
    name: 'European 6 Decks · ENHC · S17',
    description: 'Europäisches No-Hole-Card: Verlust aller Einsätze bei Dealer-Blackjack, kein Surrender.',
    rules: { ...DEFAULT_RULES, holeCard: 'enhc', obo: false, maxSplitHands: 4, doubleOn: 'any2' },
  },
  {
    id: '6d-enhc-911',
    name: 'European 6 Decks · ENHC · Double 9–11',
    description: 'Europäisch: Double nur auf 9–11, kein Resplit-Asse, Verlust aller Einsätze.',
    rules: { ...DEFAULT_RULES, holeCard: 'enhc', obo: false, doubleOn: '9-11', maxSplitHands: 2 },
  },
];

export function clampRules(r: Rules): Rules {
  const decks = Math.min(8, Math.max(1, Math.round(r.decks)));
  return {
    ...r,
    decks,
    maxSplitHands: Math.min(8, Math.max(1, Math.round(r.maxSplitHands))),
    penetration: Math.min(0.98, Math.max(0.3, r.penetration)),
    bjPayout: r.bjPayout > 0 ? r.bjPayout : 1.5,
    obo: r.holeCard === 'enhc' ? r.obo : true,
  };
}

/** Stable key of all rules that influence *strategy/EV* (penetration excluded). */
export function rulesKey(r: Rules): string {
  return [
    `d${r.decks}`,
    r.h17 ? 'H17' : 'S17',
    `bj${r.bjPayout}`,
    r.holeCard,
    r.holeCard === 'enhc' ? (r.obo ? 'obo' : 'all') : '',
    `dbl${r.doubleOn}`,
    r.das ? 'DAS' : 'noDAS',
    `sur${r.surrender}`,
    `sp${r.maxSplitHands}`,
    r.rsa ? 'RSA' : 'noRSA',
    r.hsa ? 'HSA' : 'noHSA',
    r.bjAfterSplit ? 'bjas' : '',
  ].join('|');
}

export function payoutLabel(p: number): string {
  if (Math.abs(p - 1.5) < 1e-9) return '3:2';
  if (Math.abs(p - 1.2) < 1e-9) return '6:5';
  if (Math.abs(p - 1) < 1e-9) return '1:1';
  if (Math.abs(p - 1.4) < 1e-9) return '7:5';
  if (Math.abs(p - 2) < 1e-9) return '2:1';
  return `${p}:1`;
}

/** Compact human readable description (German). */
export function describeRules(r: Rules): string {
  const parts = [
    `${r.decks} Deck${r.decks > 1 ? 's' : ''}`,
    r.h17 ? 'H17' : 'S17',
    `BJ ${payoutLabel(r.bjPayout)}`,
    r.holeCard === 'peek' ? 'Peek' : r.obo ? 'ENHC (OBO)' : 'ENHC',
    r.doubleOn === 'any2' ? 'Double beliebig' : `Double ${r.doubleOn}`,
    r.das ? 'DAS' : 'kein DAS',
    r.surrender === 'none' ? 'kein Surrender' : r.surrender === 'late' ? 'Late Surrender' : 'Early Surrender',
    r.maxSplitHands <= 1 ? 'kein Split' : `Split bis ${r.maxSplitHands} Hände`,
    r.rsa ? 'RSA' : 'kein RSA',
    r.hsa ? 'Ziehen auf Split-Asse' : '1 Karte auf Split-Asse',
  ];
  return parts.join(' · ');
}

/** Is a double allowed for a two-card hand with this hard sum / softness? */
export function doubleAllowedFor(rules: Rules, total: number, soft: boolean): boolean {
  switch (rules.doubleOn) {
    case 'any2':
      return true;
    case '9-11':
      return !soft && total >= 9 && total <= 11;
    case '10-11':
      return !soft && total >= 10 && total <= 11;
  }
}

/** Dealer blackjack is excluded from decision EVs (peek) or settled as original bet only (OBO). */
export function dealerBJExcluded(rules: Rules): boolean {
  return rules.holeCard === 'peek' || rules.obo;
}
