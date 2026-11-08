import type { RankLabel } from '../../engine/cards';

const SUITS = ['♠', '♥', '♦', '♣'];
export function PlayingCard({ rank, idx = 0, small, onClick, title }: { rank: RankLabel | null; idx?: number; small?: boolean; onClick?: () => void; title?: string }) {
  if (!rank) return <div className={`pcard ghost ${small ? 'sm' : ''}`}><span className="r">?</span></div>;
  const suit = SUITS[idx % 4];
  const red = suit === '♥' || suit === '♦';
  return (
    <div
      className={`pcard ${small ? 'sm' : ''} ${red ? 'red' : ''} ${onClick ? 'removable' : ''}`}
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation();
              onClick();
            }
          : undefined
      }
      title={title ?? (onClick ? 'Karte entfernen' : rank)}
      role={onClick ? 'button' : undefined}
      aria-label={`Karte ${rank}`}
    >
      <span className="s">{suit}</span>
      <span className="r">{rank}</span>
      <span className="s2">{suit}</span>
    </div>
  );
}
