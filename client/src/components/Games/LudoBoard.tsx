import React from 'react';
import { Dices } from 'lucide-react';
import { useMatch } from '../../context/MatchContext';

const GLOBAL_PATH: [number, number][] = [
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  [7, 0],
  [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7],
  [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  [7, 14],
  [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  [14, 7], [14, 6]
];

const SAFE_GLOBAL = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
const YARD_SLOTS: [[number, number][], [number, number][]] = [
  [[10.5, 1.5], [10.5, 3.5], [12.5, 1.5], [12.5, 3.5]],
  [[1.5, 10.5], [1.5, 12.5], [3.5, 10.5], [3.5, 12.5]]
];

function getTokenBoardCoords(player: 0 | 1, step: number, tokenIdx: number): [number, number] {
  if (step === -1) return YARD_SLOTS[player][tokenIdx];
  if (step <= 50) {
    const startOffset = player === 0 ? 0 : 26;
    const gIdx = (startOffset + step) % 52;
    return GLOBAL_PATH[gIdx];
  }
  if (step <= 55) {
    const offset = step - 51;
    return player === 0 ? [13 - offset, 7] : [1 + offset, 7];
  }
  return player === 0 ? [8.1, 7] : [5.9, 7];
}

export const LudoBoard: React.FC<{ state: any; myIndex: 0 | 1; isMyTurn: boolean }> = ({
  state,
  myIndex,
  isMyTurn
}) => {
  const { sendMove } = useMatch();
  const tokens: [number[], number[]] = state.tokens || [[-1, -1, -1, -1], [-1, -1, -1, -1]];
  const legalIndices: number[] = state.legalTokenIndices || [];

  const cellSize = 32;
  const boardPx = 15 * cellSize;

  return (
    <div className="flex flex-col items-center gap-3 py-1">
      <div className="flex items-center justify-between w-full max-w-[440px] gap-2">
        <div className="text-xs font-semibold">
          {myIndex === 0 ? 'You: Crimson (Bottom-Left)' : 'You: Amber (Top-Right)'}
        </div>
        <button
          disabled={!isMyTurn || state.phase !== 'roll'}
          onClick={() => sendMove({ action: 'roll' })}
          className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition ${
            isMyTurn && state.phase === 'roll'
              ? 'bg-gradient-to-r from-cyan-500 to-violet-600 text-white shadow-neon animate-pulse'
              : 'gv-card opacity-60'
          }`}
        >
          <Dices className="w-4 h-4" />
          {state.diceValue ? `Rolled: ${state.diceValue}` : 'Roll Dice'}
          {isMyTurn && state.phase === 'roll' && ' (Tap)'}
        </button>
      </div>

      <svg
        viewBox={`0 0 ${boardPx} ${boardPx}`}
        className="w-full max-w-[440px] aspect-square rounded-2xl border-2 border-white/15 bg-[#0a1024] shadow-2xl"
      >
        {/* 4 Corner Yards */}
        <rect x={0} y={9 * cellSize} width={6 * cellSize} height={6 * cellSize} fill="rgba(244,63,94,0.28)" stroke="rgba(255,255,255,0.12)" />
        <rect x={0} y={0} width={6 * cellSize} height={6 * cellSize} fill="rgba(34,197,94,0.18)" stroke="rgba(255,255,255,0.12)" />
        <rect x={9 * cellSize} y={0} width={6 * cellSize} height={6 * cellSize} fill="rgba(245,158,11,0.28)" stroke="rgba(255,255,255,0.12)" />
        <rect x={9 * cellSize} y={9 * cellSize} width={6 * cellSize} height={6 * cellSize} fill="rgba(56,189,248,0.18)" stroke="rgba(255,255,255,0.12)" />

        {/* Track Grid Cells */}
        {GLOBAL_PATH.map(([r, c], gIdx) => {
          const isRedStart = gIdx === 0;
          const isYellowStart = gIdx === 26;
          const isSafe = SAFE_GLOBAL.has(gIdx);
          return (
            <g key={`track-${gIdx}`}>
              <rect
                x={c * cellSize}
                y={r * cellSize}
                width={cellSize}
                height={cellSize}
                fill={
                  isRedStart
                    ? 'rgba(244,63,94,0.55)'
                    : isYellowStart
                      ? 'rgba(245,158,11,0.55)'
                      : isSafe
                        ? 'rgba(255,255,255,0.12)'
                        : 'rgba(255,255,255,0.04)'
                }
                stroke="rgba(255,255,255,0.14)"
              />
              {isSafe && (
                <text
                  x={c * cellSize + cellSize / 2}
                  y={r * cellSize + cellSize / 2 + 4}
                  textAnchor="middle"
                  fontSize="12"
                  fill="rgba(255,255,255,0.65)"
                >
                  ★
                </text>
              )}
            </g>
          );
        })}

        {/* Home Stretches */}
        {[13, 12, 11, 10, 9].map((r) => (
          <rect
            key={`rh-${r}`}
            x={7 * cellSize}
            y={r * cellSize}
            width={cellSize}
            height={cellSize}
            fill="rgba(244,63,94,0.35)"
            stroke="rgba(255,255,255,0.15)"
          />
        ))}
        {[1, 2, 3, 4, 5].map((r) => (
          <rect
            key={`yh-${r}`}
            x={7 * cellSize}
            y={r * cellSize}
            width={cellSize}
            height={cellSize}
            fill="rgba(245,158,11,0.35)"
            stroke="rgba(255,255,255,0.15)"
          />
        ))}

        {/* Center Home Goal */}
        <rect
          x={6 * cellSize}
          y={6 * cellSize}
          width={3 * cellSize}
          height={3 * cellSize}
          fill="rgba(124,58,237,0.28)"
          stroke="rgba(0,240,255,0.4)"
          strokeWidth={2}
        />
        <text
          x={7.5 * cellSize}
          y={7.5 * cellSize + 5}
          textAnchor="middle"
          fill="#E2E8F0"
          fontSize="14"
          fontWeight="bold"
        >
          HOME
        </text>

        {/* Render Tokens */}
        {([0, 1] as const).map((pIdx) =>
          tokens[pIdx].map((step, tIdx) => {
            const [r, c] = getTokenBoardCoords(pIdx, step, tIdx);
            const cx = c * cellSize + cellSize / 2 + (tIdx % 2 === 0 ? -3 : 3) * (step >= 0 && step < 56 ? 0.8 : 0);
            const cy = r * cellSize + cellSize / 2 + (tIdx < 2 ? -3 : 3) * (step >= 0 && step < 56 ? 0.8 : 0);
            const canClick =
              isMyTurn && pIdx === myIndex && state.phase === 'move' && legalIndices.includes(tIdx);

            return (
              <g
                key={`tok-${pIdx}-${tIdx}`}
                onClick={() => canClick && sendMove({ action: 'move', tokenIndex: tIdx })}
                className={canClick ? 'cursor-pointer' : ''}
              >
                {canClick && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={16}
                    fill="none"
                    stroke="#00F0FF"
                    strokeWidth={2.5}
                    strokeDasharray="4 2"
                  />
                )}
                <circle
                  cx={cx}
                  cy={cy}
                  r={11.5}
                  fill={pIdx === 0 ? '#F43F5E' : '#F59E0B'}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                />
                <text
                  x={cx}
                  y={cy + 3.5}
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="10"
                  fontWeight="bold"
                >
                  {tIdx + 1}
                </text>
              </g>
            );
          })
        )}
      </svg>
    </div>
  );
};

