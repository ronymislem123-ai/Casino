/**
 * Hi-Lo card counting (optional extension, clearly separated from basic strategy).
 *
 * Index plays: "Illustrious 18" and "Fab 4" from Don Schlesinger, *Blackjack Attack*
 * (RGE Publishing), as republished with permission on
 * https://wizardofodds.com/games/blackjack/card-counting/high-low/ (page updated
 * Aug 03, 2026, retrieved 2026-11-07). Rule stated there: stand/double/split if the
 * true count is >= the index, otherwise hit; insurance at TC >= +3; surrender (Fab 4)
 * if TC >= index. They were derived for multi-deck shoe games; in this app they are
 * applied as published and their value is measured by simulation, not assumed.
 */
import { ACE, TEN, hiLoTag } from './cards';
import type { Action } from './ev';

export interface IndexPlay {
  id: string;
  label: string;
  kind: 'hard' | 'pair' | 'insurance';
  /** hard total, or pair value index */
  key: number;
  up: number;
  /** action when TC >= index */
  action: Action | 'insure';
  /** action below the index (documentation) */
  otherwise: Action | 'no-insurance';
  index: number;
  set: 'I18' | 'Fab4';
}

export const ILLUSTRIOUS_18: IndexPlay[] = [
  { id: 'ins', label: 'Insurance', kind: 'insurance', key: 0, up: ACE, action: 'insure', otherwise: 'no-insurance', index: 3, set: 'I18' },
  { id: '16v10', label: '16 vs 10', kind: 'hard', key: 16, up: TEN, action: 'stand', otherwise: 'hit', index: 0, set: 'I18' },
  { id: '15v10', label: '15 vs 10', kind: 'hard', key: 15, up: TEN, action: 'stand', otherwise: 'hit', index: 4, set: 'I18' },
  { id: 'TTv5', label: '10,10 vs 5', kind: 'pair', key: TEN, up: 4, action: 'split', otherwise: 'stand', index: 5, set: 'I18' },
  { id: 'TTv6', label: '10,10 vs 6', kind: 'pair', key: TEN, up: 5, action: 'split', otherwise: 'stand', index: 4, set: 'I18' },
  { id: '10v10', label: '10 vs 10', kind: 'hard', key: 10, up: TEN, action: 'double', otherwise: 'hit', index: 4, set: 'I18' },
  { id: '12v3', label: '12 vs 3', kind: 'hard', key: 12, up: 2, action: 'stand', otherwise: 'hit', index: 2, set: 'I18' },
  { id: '12v2', label: '12 vs 2', kind: 'hard', key: 12, up: 1, action: 'stand', otherwise: 'hit', index: 3, set: 'I18' },
  { id: '11vA', label: '11 vs A', kind: 'hard', key: 11, up: ACE, action: 'double', otherwise: 'hit', index: 1, set: 'I18' },
  { id: '9v2', label: '9 vs 2', kind: 'hard', key: 9, up: 1, action: 'double', otherwise: 'hit', index: 1, set: 'I18' },
  { id: '10vA', label: '10 vs A', kind: 'hard', key: 10, up: ACE, action: 'double', otherwise: 'hit', index: 4, set: 'I18' },
  { id: '9v7', label: '9 vs 7', kind: 'hard', key: 9, up: 6, action: 'double', otherwise: 'hit', index: 3, set: 'I18' },
  { id: '16v9', label: '16 vs 9', kind: 'hard', key: 16, up: 8, action: 'stand', otherwise: 'hit', index: 5, set: 'I18' },
  { id: '13v2', label: '13 vs 2', kind: 'hard', key: 13, up: 1, action: 'stand', otherwise: 'hit', index: -1, set: 'I18' },
  { id: '12v4', label: '12 vs 4', kind: 'hard', key: 12, up: 3, action: 'stand', otherwise: 'hit', index: 0, set: 'I18' },
  { id: '12v5', label: '12 vs 5', kind: 'hard', key: 12, up: 4, action: 'stand', otherwise: 'hit', index: -2, set: 'I18' },
  { id: '12v6', label: '12 vs 6', kind: 'hard', key: 12, up: 5, action: 'stand', otherwise: 'hit', index: -1, set: 'I18' },
  { id: '13v3', label: '13 vs 3', kind: 'hard', key: 13, up: 2, action: 'stand', otherwise: 'hit', index: -2, set: 'I18' },
];

export const FAB_4: IndexPlay[] = [
  { id: 's14v10', label: '14 vs 10 Surrender', kind: 'hard', key: 14, up: TEN, action: 'surrender', otherwise: 'hit', index: 3, set: 'Fab4' },
  { id: 's15v10', label: '15 vs 10 Surrender', kind: 'hard', key: 15, up: TEN, action: 'surrender', otherwise: 'hit', index: 0, set: 'Fab4' },
  { id: 's15v9', label: '15 vs 9 Surrender', kind: 'hard', key: 15, up: 8, action: 'surrender', otherwise: 'hit', index: 2, set: 'Fab4' },
  { id: 's15vA', label: '15 vs A Surrender', kind: 'hard', key: 15, up: ACE, action: 'surrender', otherwise: 'hit', index: 1, set: 'Fab4' },
];

export const INDEX_SOURCE =
  'Illustrious 18 / Fab 4: D. Schlesinger, „Blackjack Attack“ (RGE Publishing), wiedergegeben auf wizardofodds.com/games/blackjack/card-counting/high-low/ (aktualisiert 03.08.2026, abgerufen 07.11.2026). Für Mehrdeck-Schuhspiele hergeleitet.';

/** Running count of a list of value indices. */
export function runningCount(cards: Iterable<number>): number {
  let rc = 0;
  for (const c of cards) rc += hiLoTag(c);
  return rc;
}

/** True count = running count / decks remaining. */
export function trueCount(rc: number, cardsRemaining: number): number {
  const decks = cardsRemaining / 52;
  return decks > 0.25 ? rc / decks : rc / 0.25;
}

/**
 * Index play that applies to this situation (regardless of the count), or null.
 * `hardTotal` is the hard total of a hard hand (soft hands have no entries);
 * `pair` is the pair value index of a splittable two-card pair.
 * The caller applies `action` when TC >= index and `otherwise` below it.
 */
export function findIndexPlay(
  plays: IndexPlay[],
  up: number,
  hand: { hardTotal: number | null; pair: number | null; twoCards: boolean },
): IndexPlay | null {
  for (const p of plays) {
    if (p.kind === 'insurance' || p.up !== up) continue;
    if (p.kind === 'pair') {
      if (hand.pair === p.key && hand.twoCards) return p;
      continue;
    }
    if (hand.hardTotal !== p.key) continue;
    if ((p.action === 'double' || p.action === 'surrender') && !hand.twoCards) continue;
    return p;
  }
  return null;
}
