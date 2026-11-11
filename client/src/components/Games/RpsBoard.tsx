import React from 'react';
import { useMatch } from '../../context/MatchContext';

const OPTIONS = [
  { id: 'rock', label: 'Rock', emoji: '✊', grad: 'from-cyan-500/25 to-blue-600/30 border-cyan-400/50' },
  { id: 'paper', label: 'Paper', emoji: '✋', grad: 'from-violet-500/25 to-purple-600/30 border-violet-400/50' },
  { id: 'scissors', label: 'Scissors', emoji: '✌️', grad: 'from-pink-500/25 to-rose-600/30 border-pink-400/50' }
];

const ICON_MAP: Record<string, string> = { rock: '✊', paper: '✋', scissors: '✌️' };

export const RpsBoard: React.FC<{ state: any; myIndex: 0 | 1; isMyTurn: boolean }> = ({
  state,
  myIndex
}) => {
  const { sendMove } = useMatch();
  const myCommitted = Boolean(state.myCommitted);
  const opponentCommitted = Boolean(state.opponentCommitted);
  const history: any[] = state.history || [];

  return (
    <div className="flex flex-col items-center gap-5 py-3">
      <div className="text-center">
        <div className="text-xs uppercase tracking-widest text-cyan-400 font-bold">
          Round {state.round} • First to {state.targetWins}
        </div>
        <div className="text-xs opacity-75 mt-1">
          {myCommitted
            ? opponentCommitted
              ? 'Revealing...'
              : `Locked ${ICON_MAP[state.myChoice] || ''} — Waiting for opponent!`
            : opponentCommitted
              ? 'Opponent locked their pick! Make your choice!'
              : 'Both players pick secretly — zero peeking.'}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 w-full max-w-md">
        {OPTIONS.map((opt) => {
          const picked = state.myChoice === opt.id;
          return (
            <button
              key={opt.id}
              disabled={myCommitted}
              onClick={() => sendMove({ choice: opt.id })}
              className={`rounded-3xl p-4 sm:p-6 border bg-gradient-to-br ${opt.grad} flex flex-col items-center gap-2 transition-all ${
                picked
                  ? 'ring-2 ring-white scale-105 shadow-neon'
                  : myCommitted
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:scale-105 active:scale-95'
              }`}
            >
              <span className="text-4xl sm:text-5xl">{opt.emoji}</span>
              <span className="text-xs sm:text-sm font-bold">{opt.label}</span>
            </button>
          );
        })}
      </div>

      {history.length > 0 && (
        <div className="w-full max-w-md space-y-1.5">
          <div className="text-[11px] font-bold uppercase opacity-60">Round History</div>
          <div className="flex flex-wrap gap-2">
            {history.map((h) => {
              const myPick = h.choices[myIndex];
              const oppPick = h.choices[myIndex === 0 ? 1 : 0];
              const won = h.winner === myIndex;
              const tie = h.winner === 'draw';
              return (
                <div
                  key={h.round}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${
                    tie
                      ? 'gv-card border-white/10'
                      : won
                        ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                        : 'bg-rose-500/15 border-rose-400/40 text-rose-300'
                  }`}
                >
                  R{h.round}: {ICON_MAP[myPick]} vs {ICON_MAP[oppPick]}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

