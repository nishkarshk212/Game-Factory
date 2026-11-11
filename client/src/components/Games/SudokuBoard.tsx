import React, { useState } from 'react';
import { useMatch } from '../../context/MatchContext';

export const SudokuBoard: React.FC<{ state: any; myIndex: 0 | 1; isMyTurn: boolean }> = ({
  state,
  myIndex,
  isMyTurn
}) => {
  const { sendMove } = useMatch();
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const puzzle: number[][] = state.puzzle || [];
  const givens: boolean[][] = state.givens || [];
  const owners: (0 | 1 | null)[][] = state.owners || [];
  const strikes: [number, number] = state.strikes || [0, 0];

  const handleDigit = (d: number) => {
    if (!isMyTurn || !selectedCell) return;
    const [r, c] = selectedCell;
    if (puzzle[r]?.[c] !== 0) return;
    sendMove({ r, c, value: d });
    setSelectedCell(null);
  };

  return (
    <div className="flex flex-col items-center gap-3 py-1">
      <div className="flex items-center gap-4 text-xs font-semibold">
        <span className="px-2.5 py-1 rounded-lg gv-card">
          Your Strikes: <strong className="text-rose-400">{strikes[myIndex]}/3</strong>
        </span>
        <span className="px-2.5 py-1 rounded-lg gv-card">
          Opp Strikes: <strong className="text-amber-300">{strikes[myIndex === 0 ? 1 : 0]}/3</strong>
        </span>
      </div>

      <div className="w-full max-w-[370px] aspect-square grid grid-cols-9 bg-slate-900/90 border-2 border-cyan-400/40 rounded-xl overflow-hidden">
        {puzzle.map((row, r) =>
          row.map((val, c) => {
            const isGiven = givens[r]?.[c];
            const owner = owners[r]?.[c];
            const isSel = selectedCell?.[0] === r && selectedCell?.[1] === c;
            const thickRight = c === 2 || c === 5 ? 'border-r-2 border-r-cyan-400/50' : 'border-r border-r-white/10';
            const thickBottom = r === 2 || r === 5 ? 'border-b-2 border-b-cyan-400/50' : 'border-b border-b-white/10';

            return (
              <button
                key={`${r}-${c}`}
                onClick={() => val === 0 && setSelectedCell([r, c])}
                className={`flex items-center justify-center text-sm sm:text-base font-mono font-bold ${thickRight} ${thickBottom} ${
                  isSel
                    ? 'bg-cyan-500/35 ring-2 ring-inset ring-cyan-300'
                    : isGiven
                      ? 'bg-white/5 text-slate-200'
                      : owner === myIndex
                        ? 'bg-cyan-500/15 text-cyan-300'
                        : owner !== null
                          ? 'bg-fuchsia-500/15 text-fuchsia-300'
                          : 'hover:bg-white/10'
                }`}
              >
                {val !== 0 ? val : ''}
              </button>
            );
          })
        )}
      </div>

      {/* Number Keypad */}
      <div className="grid grid-cols-9 gap-1.5 w-full max-w-[370px]">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <button
            key={d}
            disabled={!isMyTurn || !selectedCell}
            onClick={() => handleDigit(d)}
            className="py-2.5 rounded-xl gv-card font-mono font-bold text-sm hover:border-cyan-400/60 hover:bg-cyan-500/20 disabled:opacity-35 transition"
          >
            {d}
          </button>
        ))}
      </div>
    </div>
  );
};

