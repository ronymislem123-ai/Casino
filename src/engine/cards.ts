/**
 * Card primitives.
 *
 * The engine works on *value indices* 0..9:
 *   0 = Ace, 1 = Two, 2 = Three, ..., 8 = Nine, 9 = any ten-value card (10, J, Q, K).
 * The UI keeps the exact rank label (e.g. "J") so that rank-sensitive rules
 * (splitting only identical ten-value ranks) and the card display stay exact.
 */

export const RANK_LABELS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;
export type RankLabel = (typeof RANK_LABELS)[number];

/** Short label of a value index, used in tables. */
export const IDX_LABEL = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const;

export const ACE = 0;
export const TEN = 9;

/** Value index of a rank label. */
export function rankToIndex(r: RankLabel): number {
  switch (r) {
    case 'A':
      return ACE;
    case '10':
    case 'J':
    case 'Q':
    case 'K':
      return TEN;
    default:
      return Number(r) - 1;
  }
}

/** Hard point value of a value index (ace counts 1). */
export function idxValue(i: number): number {
  return i === ACE ? 1 : i + 1;
}

/** Composition of `decks` full 52-card decks as counts per value index. */
export function fullShoe(decks: number): number[] {
  const c = new Array<number>(10).fill(4 * decks);
  c[TEN] = 16 * decks;
  return c;
}

/** Card probabilities of the infinite deck. */
export const INFINITE_PROBS: readonly number[] = [1, 1, 1, 1, 1, 1, 1, 1, 1, 4].map((x) => x / 13);

export function sum(a: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i];
  return s;
}

/** Hi-Lo tag of a value index: 2-6 = +1, 7-9 = 0, 10/A = -1. */
export function hiLoTag(i: number): number {
  if (i === ACE || i === TEN) return -1;
  if (i >= 1 && i <= 5) return 1;
  return 0;
}

/** Remove a list of value indices from a composition (returns a new array). Throws if impossible. */
export function removeCards(shoe: readonly number[], cards: readonly number[]): number[] {
  const c = shoe.slice();
  for (const x of cards) {
    if (c[x] <= 0) throw new Error(`Karte ${IDX_LABEL[x]} ist im Kartenschuh nicht mehr vorhanden`);
    c[x]--;
  }
  return c;
}
