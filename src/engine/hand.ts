/**
 * Hand classification for the live assistant (works on exact rank labels).
 */
import { ACE, RankLabel, TEN, idxValue, rankToIndex } from './cards';
import type { Rules } from './rules';

export type HandType = 'pair' | 'soft' | 'hard' | 'blackjack' | 'bust' | 'empty' | 'single';

export interface HandInfo {
  type: HandType;
  total: number;
  hard: number;
  soft: boolean;
  /** value index of the pair (0 = aces) when type === 'pair' */
  pairValue: number | null;
  /** human readable label, e.g. "Paar Asse", "Soft 18", "Hard 16" */
  label: string;
  cards: number[];
}

const PAIR_NAMES = ['Asse', 'Zweien', 'Dreien', 'Vieren', 'Fünfen', 'Sechsen', 'Siebenen', 'Achten', 'Neunen', 'Zehnen'];

export function classifyHand(
  ranks: RankLabel[],
  opts: { rules?: Rules; isSplitHand?: boolean; canStillSplit?: boolean } = {},
): HandInfo {
  const cards = ranks.map(rankToIndex);
  let hard = 0;
  let ace = false;
  for (const c of cards) {
    hard += idxValue(c);
    if (c === ACE) ace = true;
  }
  const soft = ace && hard + 10 <= 21;
  const total = soft ? hard + 10 : hard;
  const base = { total, hard, soft, cards, pairValue: null as number | null };
  if (cards.length === 0) return { ...base, type: 'empty', label: '–' };
  if (cards.length === 1) return { ...base, type: 'single', label: soft ? `Ass (1/11)` : `${total}` };
  if (hard > 21) return { ...base, type: 'bust', label: `Bust (${hard})` };
  if (cards.length === 2 && total === 21 && !opts.isSplitHand) return { ...base, type: 'blackjack', label: 'Blackjack' };
  if (cards.length === 2 && cards[0] === cards[1]) {
    const sameRankRequired = opts.rules?.splitTensSameRankOnly && cards[0] === TEN;
    const splittable = !sameRankRequired || ranks[0] === ranks[1];
    if (splittable && opts.canStillSplit !== false && (opts.rules?.maxSplitHands ?? 4) > 1) {
      return { ...base, type: 'pair', pairValue: cards[0], label: `Paar ${PAIR_NAMES[cards[0]]} (${soft ? 'Soft' : 'Hard'} ${total})` };
    }
  }
  if (soft) return { ...base, type: 'soft', label: `Soft ${total}` };
  return { ...base, type: 'hard', label: `Hard ${total}` };
}
