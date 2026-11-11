import React from 'react';
import type { GameId } from '@gameverse/shared';

export const GameThumbnail: React.FC<{ gameId: GameId; className?: string }> = ({
  gameId,
  className = 'w-full h-full'
}) => {
  return (
    <svg viewBox="0 0 320 200" className={`${className} select-none`} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={`bg-${gameId}`} x1="0" y1="0" x2="1" y2="1">
          {gameId === 'chess' && (
            <>
              <stop offset="0%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#1e1b4b" />
            </>
          )}
          {gameId === 'ludo' && (
            <>
              <stop offset="0%" stopColor="#2e1065" />
              <stop offset="100%" stopColor="#7c2d12" />
            </>
          )}
          {gameId === 'carrom' && (
            <>
              <stop offset="0%" stopColor="#451a03" />
              <stop offset="100%" stopColor="#0f172a" />
            </>
          )}
          {gameId === 'pool_8ball' && (
            <>
              <stop offset="0%" stopColor="#064e3b" />
              <stop offset="100%" stopColor="#022c22" />
            </>
          )}
          {gameId === 'sudoku' && (
            <>
              <stop offset="0%" stopColor="#1e1b4b" />
              <stop offset="100%" stopColor="#4c1d95" />
            </>
          )}
          {gameId === 'checkers' && (
            <>
              <stop offset="0%" stopColor="#3b0764" />
              <stop offset="100%" stopColor="#881337" />
            </>
          )}
          {gameId === 'battleship' && (
            <>
              <stop offset="0%" stopColor="#082f49" />
              <stop offset="100%" stopColor="#0f172a" />
            </>
          )}
          {gameId === 'connect_four' && (
            <>
              <stop offset="0%" stopColor="#172554" />
              <stop offset="100%" stopColor="#4c0519" />
            </>
          )}
          {gameId === 'four_in_a_row' && (
            <>
              <stop offset="0%" stopColor="#1e1b4b" />
              <stop offset="100%" stopColor="#0f766e" />
            </>
          )}
          {gameId === 'dots_and_boxes' && (
            <>
              <stop offset="0%" stopColor="#042f2e" />
              <stop offset="100%" stopColor="#1e293b" />
            </>
          )}
          {gameId === 'tic_tac_toe' && (
            <>
              <stop offset="0%" stopColor="#083344" />
              <stop offset="100%" stopColor="#3b0764" />
            </>
          )}
          {gameId === 'rps' && (
            <>
              <stop offset="0%" stopColor="#701a75" />
              <stop offset="100%" stopColor="#881337" />
            </>
          )}
          {gameId === 'reversi' && (
            <>
              <stop offset="0%" stopColor="#052e16" />
              <stop offset="100%" stopColor="#0f172a" />
            </>
          )}
          {gameId === 'memory_clash' && (
            <>
              <stop offset="0%" stopColor="#312e81" />
              <stop offset="100%" stopColor="#0f172a" />
            </>
          )}
        </linearGradient>
      </defs>

      <rect width="320" height="200" fill={`url(#bg-${gameId})`} />

      {gameId === 'chess' && (
        <g>
          <g transform="translate(80,32) skewX(-12)">
            {[0, 1, 2, 3].map((r) =>
              [0, 1, 2, 3, 4].map((c) => (
                <rect
                  key={`${r}-${c}`}
                  x={c * 34}
                  y={r * 34}
                  width={34}
                  height={34}
                  fill={(r + c) % 2 === 0 ? 'rgba(0,240,255,0.22)' : 'rgba(15,23,42,0.75)'}
                />
              ))
            )}
          </g>
          <circle cx="160" cy="96" r="55" fill="rgba(0,240,255,0.12)" />
          <text x="128" y="124" textAnchor="middle" fontSize="72" fill="#f8fafc">♔</text>
          <text x="195" y="114" textAnchor="middle" fontSize="66" fill="#22d3ee">♞</text>
        </g>
      )}

      {gameId === 'ludo' && (
        <g>
          <rect x="85" y="25" width="150" height="150" rx="18" fill="#0f172a" stroke="#fff" strokeOpacity="0.2" strokeWidth="2" />
          <rect x="92" y="32" width="54" height="54" rx="10" fill="#ef4444" opacity="0.85" />
          <rect x="174" y="32" width="54" height="54" rx="10" fill="#22c55e" opacity="0.85" />
          <rect x="92" y="114" width="54" height="54" rx="10" fill="#3b82f6" opacity="0.85" />
          <rect x="174" y="114" width="54" height="54" rx="10" fill="#f59e0b" opacity="0.85" />
          <polygon points="160,100 142,84 178,84" fill="#22c55e" />
          <polygon points="160,100 142,116 178,116" fill="#3b82f6" />
          <rect x="214" y="124" width="44" height="44" rx="10" fill="#ffffff" transform="rotate(-12 236 146)" />
          <circle cx="228" cy="138" r="3.5" fill="#0f172a" />
          <circle cx="244" cy="154" r="3.5" fill="#0f172a" />
          <circle cx="236" cy="146" r="3.5" fill="#0f172a" />
        </g>
      )}

      {gameId === 'carrom' && (
        <g>
          <rect x="82" y="22" width="156" height="156" rx="18" fill="#f3dcb6" stroke="#78350f" strokeWidth="8" />
          <circle cx="96" cy="36" r="9" fill="#09090b" />
          <circle cx="224" cy="36" r="9" fill="#09090b" />
          <circle cx="96" cy="164" r="9" fill="#09090b" />
          <circle cx="224" cy="164" r="9" fill="#09090b" />
          <circle cx="160" cy="100" r="28" fill="none" stroke="#b45309" strokeWidth="2" opacity="0.5" />
          <circle cx="160" cy="100" r="10" fill="#e11d48" />
          <circle cx="144" cy="92" r="9" fill="#f8fafc" stroke="#64748b" />
          <circle cx="176" cy="92" r="9" fill="#1e293b" />
          <circle cx="160" cy="118" r="9" fill="#f8fafc" stroke="#64748b" />
          <circle cx="148" cy="148" r="13" fill="#00f0ff" stroke="#0f172a" strokeWidth="2.5" />
          <line x1="148" y1="148" x2="160" y2="108" stroke="#00f0ff" strokeWidth="2.5" strokeDasharray="4 4" />
        </g>
      )}

      {gameId === 'pool_8ball' && (
        <g>
          <rect x="28" y="34" width="264" height="132" rx="18" fill="#0d694f" stroke="#5c2d16" strokeWidth="10" />
          <circle cx="42" cy="48" r="10" fill="#020617" />
          <circle cx="160" cy="42" r="10" fill="#020617" />
          <circle cx="278" cy="48" r="10" fill="#020617" />
          <circle cx="42" cy="152" r="10" fill="#020617" />
          <circle cx="160" cy="158" r="10" fill="#020617" />
          <circle cx="278" cy="152" r="10" fill="#020617" />
          <circle cx="95" cy="100" r="12" fill="#f8fafc" />
          <circle cx="195" cy="100" r="13" fill="#facc15" />
          <circle cx="216" cy="88" r="13" fill="#ef4444" />
          <circle cx="216" cy="112" r="13" fill="#09090b" stroke="#fff" strokeWidth="1.5" />
          <text x="216" y="116" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="bold">8</text>
          <circle cx="238" cy="76" r="13" fill="#3b82f6" />
          <circle cx="238" cy="100" r="13" fill="#a855f7" />
          <circle cx="238" cy="124" r="13" fill="#f97316" />
          <line x1="35" y1="125" x2="88" y2="103" stroke="#d97706" strokeWidth="5" strokeLinecap="round" />
        </g>
      )}

      {gameId === 'sudoku' && (
        <g>
          <rect x="92" y="28" width="136" height="136" rx="14" fill="rgba(15,23,42,0.85)" stroke="#a855f7" strokeWidth="2.5" />
          <line x1="137" y1="28" x2="137" y2="164" stroke="#a855f7" strokeWidth="2" />
          <line x1="183" y1="28" x2="183" y2="164" stroke="#a855f7" strokeWidth="2" />
          <line x1="92" y1="73" x2="228" y2="73" stroke="#a855f7" strokeWidth="2" />
          <line x1="92" y1="119" x2="228" y2="119" stroke="#a855f7" strokeWidth="2" />
          <text x="115" y="58" textAnchor="middle" fill="#22d3ee" fontSize="22" fontWeight="bold" fontFamily="monospace">5</text>
          <text x="160" y="104" textAnchor="middle" fill="#f472b6" fontSize="22" fontWeight="bold" fontFamily="monospace">9</text>
          <text x="206" y="150" textAnchor="middle" fill="#34d399" fontSize="22" fontWeight="bold" fontFamily="monospace">7</text>
          <text x="160" y="58" textAnchor="middle" fill="#e2e8f0" fontSize="20" fontWeight="bold" fontFamily="monospace">3</text>
          <text x="115" y="150" textAnchor="middle" fill="#e2e8f0" fontSize="20" fontWeight="bold" fontFamily="monospace">8</text>
        </g>
      )}

      {gameId === 'checkers' && (
        <g>
          <g transform="translate(86,26)">
            {[0, 1, 2, 3].map((r) =>
              [0, 1, 2, 3].map((c) => (
                <rect
                  key={`${r}-${c}`}
                  x={c * 37}
                  y={r * 37}
                  width={37}
                  height={37}
                  fill={(r + c) % 2 === 1 ? '#1e293b' : '#475569'}
                />
              ))
            )}
          </g>
          <circle cx="141" cy="81" r="14" fill="#f43f5e" stroke="#fecdd3" strokeWidth="2.5" />
          <circle cx="178" cy="118" r="14" fill="#22d3ee" stroke="#cffafe" strokeWidth="2.5" />
          <text x="178" y="123" textAnchor="middle" fontSize="14">👑</text>
          <circle cx="215" cy="81" r="14" fill="#22d3ee" stroke="#cffafe" strokeWidth="2.5" />
        </g>
      )}

      {gameId === 'battleship' && (
        <g>
          <circle cx="160" cy="100" r="76" fill="rgba(14,165,233,0.12)" stroke="#0ea5e9" strokeOpacity="0.45" strokeWidth="2" />
          <circle cx="160" cy="100" r="48" fill="none" stroke="#38bdf8" strokeOpacity="0.35" strokeDasharray="5 5" />
          <line x1="80" y1="100" x2="240" y2="100" stroke="#38bdf8" strokeOpacity="0.3" />
          <line x1="160" y1="20" x2="160" y2="180" stroke="#38bdf8" strokeOpacity="0.3" />
          <path d="M90 112 L230 112 L212 132 L106 132 Z" fill="#38bdf8" opacity="0.85" />
          <rect x="132" y="88" width="44" height="24" rx="4" fill="#0284c7" />
          <circle cx="195" cy="76" r="14" fill="rgba(244,63,94,0.35)" stroke="#f43f5e" strokeWidth="2" />
          <text x="195" y="82" textAnchor="middle" fontSize="16">💥</text>
        </g>
      )}

      {gameId === 'connect_four' && (
        <g>
          <rect x="76" y="28" width="168" height="144" rx="16" fill="#1d4ed8" stroke="#60a5fa" strokeWidth="3" />
          {[0, 1, 2, 3].map((r) =>
            [0, 1, 2, 3, 4].map((c) => {
              const color =
                (r === 3 && c < 4)
                  ? '#22d3ee'
                  : (r === 2 && c === 1) || (r === 2 && c === 3) || (r === 1 && c === 2)
                    ? '#f43f5e'
                    : '#090d16';
              return <circle key={`${r}-${c}`} cx={100 + c * 30} cy={52 + r * 30} r="11" fill={color} />;
            })
          )}
        </g>
      )}

      {gameId === 'four_in_a_row' && (
        <g>
          <rect x="72" y="24" width="176" height="148" rx="16" fill="#312e81" stroke="#818cf8" strokeWidth="3" />
          {[0, 1, 2, 3].map((r) =>
            [0, 1, 2, 3, 4].map((c) => {
              const color =
                r === 3 && c === 2
                  ? '#f59e0b'
                  : r === 2 && c > 0 && c < 4
                    ? '#6366f1'
                    : r === 3 && (c === 1 || c === 3)
                      ? '#22d3ee'
                      : '#090d16';
              return <circle key={`${r}-${c}`} cx={98 + c * 31} cy={50 + r * 30} r="11" fill={color} />;
            })
          )}
          <path d="M160 176 L150 162 L170 162 Z" fill="#f59e0b" />
        </g>
      )}

      {gameId === 'dots_and_boxes' && (
        <g>
          <rect x="106" y="46" width="54" height="54" rx="8" fill="rgba(0,240,255,0.28)" stroke="#00f0ff" strokeWidth="4" />
          <rect x="160" y="100" width="54" height="54" rx="8" fill="rgba(236,72,153,0.28)" stroke="#ec4899" strokeWidth="4" />
          <line x1="160" y1="46" x2="214" y2="46" stroke="#a855f7" strokeWidth="4" strokeLinecap="round" />
          <line x1="106" y1="100" x2="106" y2="154" stroke="#00f0ff" strokeWidth="4" strokeLinecap="round" />
          {[46, 100, 154].map((y) =>
            [106, 160, 214].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="6" fill="#ffffff" />)
          )}
        </g>
      )}

      {gameId === 'tic_tac_toe' && (
        <g>
          <line x1="130" y1="30" x2="130" y2="170" stroke="rgba(255,255,255,0.22)" strokeWidth="4" strokeLinecap="round" />
          <line x1="190" y1="30" x2="190" y2="170" stroke="rgba(255,255,255,0.22)" strokeWidth="4" strokeLinecap="round" />
          <line x1="85" y1="75" x2="235" y2="75" stroke="rgba(255,255,255,0.22)" strokeWidth="4" strokeLinecap="round" />
          <line x1="85" y1="125" x2="235" y2="125" stroke="rgba(255,255,255,0.22)" strokeWidth="4" strokeLinecap="round" />
          <path d="M95 40 L118 63 M118 40 L95 63" stroke="#22d3ee" strokeWidth="6" strokeLinecap="round" />
          <path d="M148 88 L172 112 M172 88 L148 112" stroke="#22d3ee" strokeWidth="6" strokeLinecap="round" />
          <path d="M202 138 L226 162 M226 138 L202 162" stroke="#22d3ee" strokeWidth="6" strokeLinecap="round" />
          <circle cx="214" cy="52" r="14" fill="none" stroke="#ec4899" strokeWidth="6" />
          <circle cx="106" cy="150" r="14" fill="none" stroke="#ec4899" strokeWidth="6" />
          <line x1="92" y1="36" x2="228" y2="164" stroke="#34d399" strokeWidth="3.5" strokeDasharray="6 4" />
        </g>
      )}

      {gameId === 'rps' && (
        <g>
          <circle cx="92" cy="100" r="36" fill="rgba(34,211,238,0.2)" stroke="#22d3ee" strokeWidth="3" />
          <circle cx="160" cy="86" r="38" fill="rgba(168,85,247,0.25)" stroke="#a855f7" strokeWidth="3" />
          <circle cx="228" cy="100" r="36" fill="rgba(236,72,153,0.2)" stroke="#ec4899" strokeWidth="3" />
          <text x="92" y="114" textAnchor="middle" fontSize="38">✊</text>
          <text x="160" y="100" textAnchor="middle" fontSize="40">✋</text>
          <text x="228" y="114" textAnchor="middle" fontSize="38">✌️</text>
        </g>
      )}

      {gameId === 'reversi' && (
        <g>
          <rect x="88" y="28" width="144" height="144" rx="16" fill="#065f46" stroke="#34d399" strokeWidth="2.5" />
          {[0, 1, 2, 3].map((r) =>
            [0, 1, 2, 3].map((c) => (
              <rect
                key={`${r}-${c}`}
                x={92 + c * 34}
                y={32 + r * 34}
                width="32"
                height="32"
                rx="4"
                fill="#047857"
              />
            ))
          )}
          <circle cx="142" cy="82" r="12" fill="#22d3ee" />
          <circle cx="176" cy="82" r="12" fill="#ec4899" />
          <circle cx="142" cy="116" r="12" fill="#ec4899" />
          <circle cx="176" cy="116" r="12" fill="#22d3ee" />
          <circle cx="108" cy="82" r="5" fill="#34d399" opacity="0.7" />
        </g>
      )}

      {gameId === 'memory_clash' && (
        <g>
          <rect x="74" y="44" width="56" height="80" rx="10" fill="#1e1b4b" stroke="#818cf8" strokeWidth="2.5" transform="rotate(-10 102 84)" />
          <rect x="132" y="34" width="56" height="80" rx="10" fill="#312e81" stroke="#22d3ee" strokeWidth="3" />
          <rect x="190" y="44" width="56" height="80" rx="10" fill="#1e1b4b" stroke="#ec4899" strokeWidth="2.5" transform="rotate(10 218 84)" />
          <text x="160" y="84" textAnchor="middle" fontSize="30">💎</text>
          <text x="218" y="96" textAnchor="middle" fontSize="26">⚡</text>
        </g>
      )}
    </svg>
  );
};

