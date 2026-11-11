import React from 'react';
import { useMatch } from '../../context/MatchContext';

export const ConnectFourBoard: React.FC<{ state: any; myIndex: 0 | 1; isMyTurn: boolean }> = ({
  state,
  myIndex,
  isMyTurn
}) => {
  const { sendMove } = useMatch();
  const board: (0 | 1 | null)[][] = state.board || [];
  const winSet = new Set<string>(
    (state.winCells || []).map(([r, c]: [number, number]) => `${r},${c}`)
  );

  return (
    <div className="flex flex-col items-center gap-3 py-1">
      <div className="flex items-center gap-3 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
          {myIndex === 0 ? 'You (Cyan)' : 'Opponent (Cyan)'}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
          {myIndex === 1 ? 'You (Crimson)' : 'Opponent (Crimson)'}
        </span>
      </div>

      <div className="w-full max-w-[420px] p-2.5 sm:p-3.5 rounded-3xl bg-gradient-to-b from-blue-900/50 to-indigo-950/80 border border-cyan-400/25 shadow-2xl">
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {Array.from({ length: 7 }, (_, col) => {
            const colFull = board[0]?.[col] !== null;
            return (
              <button
                key={`drop-${col}`}
                disabled={!isMyTurn || colFull}
                onClick={() => sendMove({ col })}
                className="h-6 rounded-lg text-[11px] font-bold flex items-center justify-center bg-white/5 hover:bg-cyan-400/25 text-cyan-300 disabled:opacity-20 transition"
              >
                ▼
              </button>
            );
          })}
          {board.map((row, r) =>
            row.map((cell, c) => {
              const isWin = winSet.has(`${r},${c}`);
              const isLast = state.lastMove?.row === r && state.lastMove?.col === c;
              const colFull = board[0]?.[c] !== null;
              return (
                <button
                  key={`${r}-${c}`}
                  disabled={!isMyTurn || colFull}
                  onClick={() => sendMove({ col: c })}
                  className={`aspect-square rounded-full p-1 transition ${
                    isWin ? 'ring-2 ring-amber-300 bg-amber-300/20' : 'bg-[#070913]/85'
                  }`}
                >
                  {cell !== null && (
                    <div
                      className={`w-full h-full rounded-full animate-disc-drop ${
                        cell === 0
                          ? 'bg-gradient-to-br from-cyan-300 to-cyan-600 shadow-[0_0_12px_rgba(34,211,238,0.65)]'
                          : 'bg-gradient-to-br from-rose-400 to-pink-600 shadow-[0_0_12px_rgba(244,63,94,0.65)]'
                      } ${isLast ? 'ring-2 ring-white' : ''}`}
                    />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

