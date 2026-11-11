import React from 'react';
import { useMatch } from '../../context/MatchContext';

export const TicTacToeBoard: React.FC<{ state: any; myIndex: 0 | 1; isMyTurn: boolean }> = ({
  state,
  myIndex,
  isMyTurn
}) => {
  const { sendMove } = useMatch();
  const board: (0 | 1 | null)[] = state.board || Array(9).fill(null);
  const myMark = state.roundStarter === myIndex ? 'X' : 'O';

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <div className="flex items-center gap-3 text-xs font-semibold">
        <span className="px-3 py-1 rounded-full gv-card">Round {state.round} (Best of 3)</span>
        <span className="px-3 py-1 rounded-full bg-cyan-500/15 text-cyan-300">
          You play: <strong className="font-mono">{myMark}</strong>
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2.5 sm:gap-3 w-full max-w-[320px] aspect-square">
        {board.map((cell, idx) => {
          const isWin = Array.isArray(state.lastWinLine) && state.lastWinLine.includes(idx);
          const mark =
            cell === null
              ? ''
              : cell === state.roundStarter
                ? 'X'
                : 'O';
          return (
            <button
              key={idx}
              disabled={!isMyTurn || cell !== null}
              onClick={() => sendMove({ cell: idx })}
              className={`rounded-2xl gv-card border-2 flex items-center justify-center text-4xl sm:text-5xl font-black transition-all ${
                isWin
                  ? 'border-emerald-400 bg-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                  : cell !== null
                    ? 'border-white/15'
                    : isMyTurn
                      ? 'border-white/10 hover:border-cyan-400/60 hover:bg-cyan-500/10 active:scale-95'
                      : 'border-white/5 opacity-80'
              }`}
            >
              <span
                className={
                  cell === 0
                    ? 'text-cyan-400 drop-shadow-[0_0_10px_rgba(0,240,255,0.6)]'
                    : 'text-fuchsia-400 drop-shadow-[0_0_10px_rgba(236,72,153,0.6)]'
                }
              >
                {mark}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

