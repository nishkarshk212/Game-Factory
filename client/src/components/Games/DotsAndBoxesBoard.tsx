import React from 'react';
import { useMatch } from '../../context/MatchContext';

export const DotsAndBoxesBoard: React.FC<{ state: any; myIndex: 0 | 1; isMyTurn: boolean }> = ({
  state,
  myIndex,
  isMyTurn
}) => {
  const { sendMove } = useMatch();
  const dots: number = state.dots || 5;
  const hLines: boolean[][] = state.hLines || [];
  const vLines: boolean[][] = state.vLines || [];
  const boxes: (0 | 1 | null)[][] = state.boxes || [];

  const spacing = 72;
  const pad = 28;
  const size = pad * 2 + (dots - 1) * spacing;

  return (
    <div className="flex flex-col items-center gap-3 py-1">
      <div className="flex items-center gap-4 text-xs font-semibold">
        <span className="text-cyan-400">P1: {state.scores?.[0] ?? 0} boxes</span>
        <span className="opacity-40">|</span>
        <span className="text-fuchsia-400">P2: {state.scores?.[1] ?? 0} boxes</span>
      </div>

      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-full max-w-[360px] select-none touch-manipulation"
      >
        {/* Claimed Boxes */}
        {boxes.map((row, br) =>
          row.map((owner, bc) => {
            if (owner === null) return null;
            const x = pad + bc * spacing + 6;
            const y = pad + br * spacing + 6;
            return (
              <g key={`box-${br}-${bc}`}>
                <rect
                  x={x}
                  y={y}
                  width={spacing - 12}
                  height={spacing - 12}
                  rx={10}
                  fill={owner === 0 ? 'rgba(0,240,255,0.22)' : 'rgba(236,72,153,0.22)'}
                  stroke={owner === 0 ? '#00F0FF' : '#EC4899'}
                  strokeWidth={1.5}
                />
                <text
                  x={pad + bc * spacing + spacing / 2}
                  y={pad + br * spacing + spacing / 2 + 5}
                  textAnchor="middle"
                  fill={owner === 0 ? '#67E8F9' : '#F472B6'}
                  fontSize="16"
                  fontWeight="bold"
                >
                  {owner === myIndex ? 'ME' : `P${owner + 1}`}
                </text>
              </g>
            );
          })
        )}

        {/* Horizontal Lines */}
        {hLines.map((row, r) =>
          row.map((drawn, c) => {
            const x1 = pad + c * spacing;
            const y1 = pad + r * spacing;
            const isLast =
              state.lastLine?.type === 'h' && state.lastLine?.r === r && state.lastLine?.c === c;
            return (
              <g
                key={`h-${r}-${c}`}
                onClick={() => isMyTurn && !drawn && sendMove({ type: 'h', r, c })}
                className={isMyTurn && !drawn ? 'cursor-pointer' : ''}
              >
                <line x1={x1} y1={y1} x2={x1 + spacing} y2={y1} stroke="transparent" strokeWidth={24} />
                <line
                  x1={x1 + 7}
                  y1={y1}
                  x2={x1 + spacing - 7}
                  y2={y1}
                  stroke={
                    drawn
                      ? isLast
                        ? '#FACC15'
                        : '#00F0FF'
                      : isMyTurn
                        ? 'rgba(148,163,184,0.28)'
                        : 'rgba(148,163,184,0.12)'
                  }
                  strokeWidth={drawn ? 6 : 4}
                  strokeLinecap="round"
                />
              </g>
            );
          })
        )}

        {/* Vertical Lines */}
        {vLines.map((row, r) =>
          row.map((drawn, c) => {
            const x1 = pad + c * spacing;
            const y1 = pad + r * spacing;
            const isLast =
              state.lastLine?.type === 'v' && state.lastLine?.r === r && state.lastLine?.c === c;
            return (
              <g
                key={`v-${r}-${c}`}
                onClick={() => isMyTurn && !drawn && sendMove({ type: 'v', r, c })}
                className={isMyTurn && !drawn ? 'cursor-pointer' : ''}
              >
                <line x1={x1} y1={y1} x2={x1} y2={y1 + spacing} stroke="transparent" strokeWidth={24} />
                <line
                  x1={x1}
                  y1={y1 + 7}
                  x2={x1}
                  y2={y1 + spacing - 7}
                  stroke={
                    drawn
                      ? isLast
                        ? '#FACC15'
                        : '#A855F7'
                      : isMyTurn
                        ? 'rgba(148,163,184,0.28)'
                        : 'rgba(148,163,184,0.12)'
                  }
                  strokeWidth={drawn ? 6 : 4}
                  strokeLinecap="round"
                />
              </g>
            );
          })
        )}

        {/* Dots */}
        {Array.from({ length: dots }, (_, r) =>
          Array.from({ length: dots }, (_, c) => (
            <circle
              key={`dot-${r}-${c}`}
              cx={pad + c * spacing}
              cy={pad + r * spacing}
              r={5.5}
              fill="#F8FAFC"
            />
          ))
        )}
      </svg>
    </div>
  );
};

