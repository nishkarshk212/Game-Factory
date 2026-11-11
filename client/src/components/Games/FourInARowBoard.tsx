import React, { useState } from 'react';
import { useMatch } from '../../context/MatchContext';

export const FourInARowBoard: React.FC<{ state: any; myIndex: 0 | 1; isMyTurn: boolean }> = ({
  state,
  myIndex,
  isMyTurn
}) => {
  const { sendMove } = useMatch();
  const [mode, setMode] = useState<'drop' | 'pop'>('drop');
  const board: (0 | 1 | null)[][] = state.board || [];
  const rows = state.rows || 7;
  const cols = state.cols || 8;
  const winSet = new Set<string>(
    (state.winCells || []).map(([r, c]: [number, number]) => `${r},${c}`)
  );

  return (
    <div className="flex flex-col items-center gap-3 py-1">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setMode('drop')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
            mode === 'drop'
              ? 'bg-cyan-500 text-slate-950 shadow-neon'
              : 'gv-card opacity-75'
          }`}
        >
          ▼ Drop Top
        </button>
        <button
          onClick={() => setMode('pop')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
            mode === 'pop'
              ? 'bg-violet-500 text-white shadow-neon-violet'
              : 'gv-card opacity-75'
          }`}
        >
          ▲ Pop Bottom Own Disc
        </button>
      </div>

      <div className="w-full max-w-[460px] p-2.5 sm:p-3.5 rounded-3xl bg-gradient-to-b from-indigo-950/90 to-slate-950 border border-violet-400/30 shadow-2xl">
        <div className="grid grid-cols-8 gap-1.5">
          {board.map((row, r) =>
            row.map((cell, c) => {
              const isWin = winSet.has(`${r},${c}`);
              const canPop = mode === 'pop' && r === rows - 1 && cell === myIndex && isMyTurn;
              const canDrop = mode === 'drop' && board[0]?.[c] === null && isMyTurn;

              return (
                <button
                  key={`${r}-${c}`}
                  disabled={mode === 'drop' ? !canDrop : !canPop}
                  onClick={() => sendMove({ action: mode, col: c })}
                  className={`aspect-square rounded-full p-1 transition relative ${
                    isWin
                      ? 'ring-2 ring-amber-300 bg-amber-300/20'
                      : canPop
                        ? 'ring-2 ring-violet-400 bg-violet-500/20 animate-pulse'
                        : 'bg-[#070913]/90'
                  }`}
                >
                  {cell !== null && (
                    <div
                      className={`w-full h-full rounded-full ${
                        cell === 0
                          ? 'bg-gradient-to-br from-indigo-300 to-cyan-500 shadow-[0_0_10px_rgba(99,102,241,0.65)]'
                          : 'bg-gradient-to-br from-amber-300 to-orange-500 shadow-[0_0_10px_rgba(245,158,11,0.65)]'
                      }`}
                    />
                  )}
                </button>
              );
            })
          )}
        </div>
        <div className="grid grid-cols-8 gap-1.5 mt-1.5">
          {Array.from({ length: cols }, (_, c) => {
            const bottomOwn = board[rows - 1]?.[c] === myIndex;
            return (
              <button
                key={`pop-${c}`}
                disabled={!isMyTurn || !bottomOwn}
                onClick={() => sendMove({ action: 'pop', col: c })}
                className="h-5 rounded-md text-[10px] font-bold bg-violet-500/20 text-violet-300 disabled:opacity-15 hover:bg-violet-500/40"
              >
                POP
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

