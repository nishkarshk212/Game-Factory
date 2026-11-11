import React, { useState } from 'react';
import { useMatch } from '../../context/MatchContext';
import { useAuth } from '../../context/AuthContext';

export const CheckersBoard: React.FC<{ state: any; myIndex: 0 | 1; isMyTurn: boolean }> = ({
  state,
  myIndex,
  isMyTurn
}) => {
  const { sendMove } = useMatch();
  const { user } = useAuth();
  const showHints = user?.settings.showMoveHints ?? true;
  const [selected, setSelected] = useState<[number, number] | null>(null);

  const board: ({ player: 0 | 1; king: boolean } | null)[][] = state.board || [];
  const legalMoves: { from: [number, number]; to: [number, number]; captured: [number, number] | null }[] =
    state.legalMoves || [];

  const activeSelection = state.mustContinueFrom || selected;
  const targetsForSelected = activeSelection
    ? legalMoves.filter((m) => m.from[0] === activeSelection[0] && m.from[1] === activeSelection[1])
    : [];

  // Flip board for Player 1 so their pieces start at the bottom
  const rowOrder = myIndex === 1 ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const colOrder = myIndex === 1 ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

  const handleCellClick = (r: number, c: number) => {
    if (!isMyTurn) return;

    const matchingTarget = targetsForSelected.find((m) => m.to[0] === r && m.to[1] === c);
    if (matchingTarget) {
      sendMove({ from: matchingTarget.from, to: matchingTarget.to });
      setSelected(null);
      return;
    }

    const piece = board[r]?.[c];
    if (piece && piece.player === myIndex && !state.mustContinueFrom) {
      const hasMoves = legalMoves.some((m) => m.from[0] === r && m.from[1] === c);
      if (hasMoves) setSelected([r, c]);
    } else if (!state.mustContinueFrom) {
      setSelected(null);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 py-1">
      {state.mustContinueFrom && isMyTurn && (
        <div className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold animate-pulse">
          Multi-jump chain active! Select next landing square.
        </div>
      )}

      <div className="w-full max-w-[400px] aspect-square rounded-2xl overflow-hidden border-2 border-white/15 grid grid-cols-8">
        {rowOrder.map((r) =>
          colOrder.map((c) => {
            const dark = (r + c) % 2 === 1;
            const piece = board[r]?.[c];
            const isSel = activeSelection?.[0] === r && activeSelection?.[1] === c;
            const isTarget = targetsForSelected.some((m) => m.to[0] === r && m.to[1] === c);
            const isMovable =
              isMyTurn && !activeSelection && legalMoves.some((m) => m.from[0] === r && m.from[1] === c);

            return (
              <button
                key={`${r}-${c}`}
                onClick={() => handleCellClick(r, c)}
                className={`aspect-square flex items-center justify-center relative ${
                  dark ? 'bg-slate-800/95' : 'bg-slate-200/15'
                } ${isSel ? 'ring-2 ring-inset ring-cyan-400 bg-cyan-500/20' : ''}`}
              >
                {piece && (
                  <div
                    className={`w-[74%] h-[74%] rounded-full border-2 flex items-center justify-center text-xs font-black transition ${
                      piece.player === 0
                        ? 'bg-gradient-to-br from-rose-400 to-rose-700 border-rose-200/70 text-white'
                        : 'bg-gradient-to-br from-cyan-300 to-cyan-600 border-cyan-100/70 text-slate-950'
                    } ${isMovable ? 'ring-2 ring-amber-300/70' : ''}`}
                  >
                    {piece.king ? '👑' : ''}
                  </div>
                )}

                {isTarget && showHints && (
                  <span className="w-3.5 h-3.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399] animate-pulse" />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

