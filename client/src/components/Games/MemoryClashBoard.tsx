import React, { useEffect, useState } from 'react';
import { useMatch } from '../../context/MatchContext';

export const MemoryClashBoard: React.FC<{ state: any; myIndex: 0 | 1; isMyTurn: boolean }> = ({
  state,
  myIndex,
  isMyTurn
}) => {
  const { sendMove } = useMatch();
  const [peekMismatch, setPeekMismatch] = useState<{ indices: number[]; symbols: string[] } | null>(
    null
  );

  useEffect(() => {
    const lr = state.lastReveal;
    if (lr && !lr.matched) {
      setPeekMismatch({ indices: lr.indices, symbols: lr.symbols });
      const t = setTimeout(() => setPeekMismatch(null), 1100);
      return () => clearTimeout(t);
    }
    setPeekMismatch(null);
  }, [state.lastReveal]);

  const cards: { index: number; matchedBy: 0 | 1 | null; symbol: string | null }[] =
    state.cards || [];
  const revealed: number[] = state.revealedIndices || [];

  return (
    <div className="flex flex-col items-center gap-3 py-1">
      <div className="text-xs opacity-75">
        {isMyTurn
          ? revealed.length === 1
            ? 'Flip your second card!'
            : 'Your turn — flip a hidden card'
          : 'Opponent is flipping cards...'}
      </div>

      <div className="grid grid-cols-6 gap-1.5 sm:gap-2.5 w-full max-w-[440px]">
        {cards.map((card) => {
          const mismatchIdx = peekMismatch?.indices.indexOf(card.index) ?? -1;
          const displaySymbol =
            card.symbol || (mismatchIdx !== -1 ? peekMismatch!.symbols[mismatchIdx] : null);
          const isOpen = displaySymbol !== null;
          const matchedMine = card.matchedBy === myIndex;
          const matchedOpp = card.matchedBy !== null && card.matchedBy !== myIndex;

          return (
            <button
              key={card.index}
              disabled={!isMyTurn || card.matchedBy !== null || revealed.includes(card.index)}
              onClick={() => sendMove({ index: card.index })}
              className={`aspect-[3/4] rounded-xl border font-bold text-xl sm:text-2xl flex items-center justify-center transition-all duration-200 ${
                matchedMine
                  ? 'bg-cyan-500/20 border-cyan-400/60 shadow-neon'
                  : matchedOpp
                    ? 'bg-fuchsia-500/20 border-fuchsia-400/60'
                    : isOpen
                      ? 'bg-indigo-500/25 border-white/40 scale-[1.03]'
                      : isMyTurn
                        ? 'gv-card hover:border-cyan-400/50 active:scale-95'
                        : 'gv-card opacity-70'
              }`}
            >
              {isOpen ? displaySymbol : <span className="text-sm opacity-30">⚡</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};

