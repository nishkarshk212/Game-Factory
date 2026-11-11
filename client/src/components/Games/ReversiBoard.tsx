import React from 'react';
import { useMatch } from '../../context/MatchContext';
import { useAuth } from '../../context/AuthContext';

export const ReversiBoard: React.FC<{ state: any; myIndex: 0 | 1; isMyTurn: boolean }> = ({
  state,
  myIndex,
  isMyTurn
}) => {
  const { sendMove } = useMatch();
  const { user } = useAuth();
  const showHints = user?.settings.showMoveHints ?? true;
  const board: (0 | 1 | null)[][] = state.board || [];
  const validSet = new Set<string>(
    (state.validMoves || []).map(([r, c]: [number, number]) => `${r},${c}`)
  );

  return (
    <div className="flex flex-col items-center gap-3 py-1">
      <div className="flex items-center gap-4 text-xs font-semibold">
        <span className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-full bg-cyan-400" />
          {myIndex === 0 ? 'You' : 'Opponent'}: {state.scores?.[0] ?? 2}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-full bg-fuchsia-500" />
          {myIndex === 1 ? 'You' : 'Opponent'}: {state.scores?.[1] ?? 2}
        </span>
      </div>

      <div className="w-full max-w-[380px] aspect-square p-2 rounded-2xl bg-emerald-950/70 border border-emerald-400/30 grid grid-cols-8 gap-1">
        {board.map((row, r) =>
          row.map((cell, c) => {
            const isLegal = isMyTurn && validSet.has(`${r},${c}`);
            const isLast = state.lastMove?.[0] === r && state.lastMove?.[1] === c;
            return (
              <button
                key={`${r}-${c}`}
                disabled={!isLegal}
                onClick={() => sendMove({ r, c })}
                className={`rounded-lg bg-emerald-900/50 border border-emerald-500/20 flex items-center justify-center relative transition ${
                  isLegal ? 'hover:bg-emerald-700/50 cursor-pointer' : ''
                }`}
              >
                {cell !== null ? (
                  <div
                    className={`w-[78%] h-[78%] rounded-full transition-all duration-300 ${
                      cell === 0
                        ? 'bg-gradient-to-br from-cyan-300 to-cyan-600 shadow-[0_0_10px_rgba(34,211,238,0.6)]'
                        : 'bg-gradient-to-br from-fuchsia-400 to-pink-600 shadow-[0_0_10px_rgba(236,72,153,0.6)]'
                    } ${isLast ? 'ring-2 ring-white' : ''}`}
                  />
                ) : (
                  isLegal &&
                  showHints && <span className="w-2.5 h-2.5 rounded-full bg-cyan-300/60 animate-pulse" />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

