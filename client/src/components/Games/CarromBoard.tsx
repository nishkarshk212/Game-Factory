import React, { useEffect, useRef, useState } from 'react';
import { useMatch } from '../../context/MatchContext';

export const CarromBoard: React.FC<{ state: any; myIndex: 0 | 1; isMyTurn: boolean }> = ({
  state,
  myIndex,
  isMyTurn
}) => {
  const { sendMove } = useMatch();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [strikerX, setStrikerX] = useState(400);
  const [aim, setAim] = useState<{ angle: number; power: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [animFrame, setAnimFrame] = useState<any | null>(null);

  useEffect(() => {
    const frames = state.lastShot?.frames;
    if (!Array.isArray(frames) || frames.length === 0) {
      setAnimFrame(null);
      return;
    }
    let idx = 0;
    const iv = setInterval(() => {
      if (idx >= frames.length) {
        clearInterval(iv);
        setAnimFrame(null);
      } else {
        setAnimFrame(frames[idx++]);
      }
    }, 26);
    return () => clearInterval(iv);
  }, [state.lastShot]);

  const myBaselineY = myIndex === 0 ? 665 : 135;

  const getBoardCoords = (clientX: number, clientY: number): [number, number] => {
    const rect = svgRef.current!.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 800;
    const y = ((clientY - rect.top) / rect.height) * 800;
    return [x, y];
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isMyTurn) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDragging(true);
    const [bx, by] = getBoardCoords(e.clientX, e.clientY);
    const dx = strikerX - bx;
    const dy = myBaselineY - by;
    const dist = Math.hypot(dx, dy);
    if (dist > 10) {
      setAim({ angle: Math.atan2(dy, dx), power: Math.min(1, Math.max(0.15, dist / 200)) });
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging || !isMyTurn) return;
    const [bx, by] = getBoardCoords(e.clientX, e.clientY);
    const dx = strikerX - bx;
    const dy = myBaselineY - by;
    const dist = Math.hypot(dx, dy);
    if (dist > 10) {
      setAim({ angle: Math.atan2(dy, dx), power: Math.min(1, Math.max(0.15, dist / 200)) });
    }
  };

  const handlePointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    if (aim && isMyTurn) {
      sendMove({ strikerX, angle: aim.angle, power: aim.power });
    }
    setAim(null);
  };

  const displayedCoins = (state.coins || []).map((c: any) => {
    const frameCoin = animFrame?.coins?.find((fc: any) => fc.id === c.id);
    return frameCoin ? { ...c, x: frameCoin.x, y: frameCoin.y, pocketed: frameCoin.pocketed } : c;
  });

  return (
    <div className="flex flex-col items-center gap-3 py-1">
      <div className="flex items-center justify-between w-full max-w-[420px] text-xs">
        <span>
          You: <strong className="text-cyan-300">{myIndex === 0 ? 'White Coins' : 'Black Coins'}</strong>
        </span>
        {state.queenOwner !== null ? (
          <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold">
            Queen: P{state.queenOwner + 1} (+3)
          </span>
        ) : state.pendingQueenBy !== null ? (
          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">
            Cover Queen Next Shot!
          </span>
        ) : (
          <span className="opacity-70">Drag back from striker to shoot</span>
        )}
      </div>

      <svg
        ref={svgRef}
        viewBox="0 0 800 800"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="w-full max-w-[420px] aspect-square rounded-3xl border-4 border-amber-900/70 bg-[#e7cfa3] shadow-2xl touch-none select-none"
      >
        <rect x={40} y={40} width={720} height={720} rx={24} fill="#f4dfc0" stroke="#78350f" strokeWidth={8} />
        <circle cx={400} cy={400} r={96} fill="none" stroke="#b45309" strokeWidth={2.5} opacity={0.5} />
        <circle cx={400} cy={400} r={22} fill="rgba(225,29,72,0.2)" stroke="#e11d48" strokeWidth={2} />

        {/* Baselines */}
        <line x1={180} y1={665} x2={620} y2={665} stroke="#92400e" strokeWidth={3} opacity={0.6} />
        <line x1={180} y1={135} x2={620} y2={135} stroke="#92400e" strokeWidth={3} opacity={0.6} />

        {/* 4 Pockets */}
        {[
          [86, 86], [714, 86], [86, 714], [714, 714]
        ].map(([px, py], idx) => (
          <circle key={idx} cx={px} cy={py} r={28} fill="#0f172a" stroke="#451a03" strokeWidth={4} />
        ))}

        {/* Coins */}
        {displayedCoins.map(
          (c: any) =>
            !c.pocketed && (
              <circle
                key={c.id}
                cx={c.x}
                cy={c.y}
                r={16}
                fill={c.type === 'queen' ? '#e11d48' : c.type === 'white' ? '#f8fafc' : '#1e293b'}
                stroke={c.type === 'white' ? '#94a3b8' : '#020617'}
                strokeWidth={2.5}
              />
            )
        )}

        {/* Striker */}
        {animFrame?.striker?.visible ? (
          <circle cx={animFrame.striker.x} cy={animFrame.striker.y} r={22} fill="#00F0FF" stroke="#0f172a" strokeWidth={3} />
        ) : (
          isMyTurn && (
            <g>
              {aim && (
                <line
                  x1={strikerX}
                  y1={myBaselineY}
                  x2={strikerX + Math.cos(aim.angle) * (80 + aim.power * 200)}
                  y2={myBaselineY + Math.sin(aim.angle) * (80 + aim.power * 200)}
                  stroke="#0284c7"
                  strokeWidth={4}
                  strokeDasharray="8 6"
                />
              )}
              <circle
                cx={strikerX}
                cy={myBaselineY}
                r={22}
                fill="#00F0FF"
                stroke="#0f172a"
                strokeWidth={3}
              />
            </g>
          )
        )}
      </svg>

      {isMyTurn && (
        <div className="w-full max-w-[420px] flex items-center gap-3 px-2">
          <span className="text-xs font-semibold shrink-0">Striker Pos</span>
          <input
            type="range"
            min={180}
            max={620}
            value={strikerX}
            onChange={(e) => setStrikerX(Number(e.target.value))}
            className="flex-1 accent-cyan-400"
          />
        </div>
      )}
    </div>
  );
};

