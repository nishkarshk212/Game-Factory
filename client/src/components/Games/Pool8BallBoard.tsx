import React, { useEffect, useRef, useState } from 'react';
import { useMatch } from '../../context/MatchContext';

const BALL_COLORS: Record<number, string> = {
  0: '#f8fafc',
  1: '#facc15', 2: '#2563eb', 3: '#dc2626', 4: '#7c3aed', 5: '#f97316', 6: '#16a34a', 7: '#881337',
  8: '#09090b',
  9: '#facc15', 10: '#2563eb', 11: '#dc2626', 12: '#7c3aed', 13: '#f97316', 14: '#16a34a', 15: '#881337'
};

export const Pool8BallBoard: React.FC<{ state: any; myIndex: 0 | 1; isMyTurn: boolean }> = ({
  state,
  myIndex,
  isMyTurn
}) => {
  const { sendMove } = useMatch();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [cueOverride, setCueOverride] = useState<{ x: number; y: number } | null>(null);
  const [placingCue, setPlacingCue] = useState(false);
  const [draggingAim, setDraggingAim] = useState(false);
  const [aim, setAim] = useState<{ angle: number; power: number } | null>(null);
  const [animFrame, setAnimFrame] = useState<any | null>(null);

  useEffect(() => {
    setCueOverride(null);
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
    }, 24);
    return () => clearInterval(iv);
  }, [state.lastShot]);

  const rawBalls: any[] = animFrame?.balls || state.balls || [];
  const cueBall = rawBalls.find((b) => b.num === 0) || { x: 250, y: 250 };
  const cueX = cueOverride?.x ?? cueBall.x;
  const cueY = cueOverride?.y ?? cueBall.y;
  const hasBallInHand = isMyTurn && state.ballInHand === myIndex;

  const toTableCoords = (clientX: number, clientY: number): [number, number] => {
    const rect = svgRef.current!.getBoundingClientRect();
    return [((clientX - rect.left) / rect.width) * 1000, ((clientY - rect.top) / rect.height) * 500];
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isMyTurn) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const [tx, ty] = toTableCoords(e.clientX, e.clientY);

    if (hasBallInHand && placingCue) {
      const maxX = !state.breakShotDone ? 280 : 925;
      setCueOverride({
        x: Math.max(70, Math.min(maxX, tx)),
        y: Math.max(70, Math.min(430, ty))
      });
      return;
    }

    setDraggingAim(true);
    const dx = cueX - tx;
    const dy = cueY - ty;
    const dist = Math.hypot(dx, dy);
    if (dist > 8) {
      setAim({ angle: Math.atan2(dy, dx), power: Math.min(1, Math.max(0.12, dist / 240)) });
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingAim || !isMyTurn) return;
    const [tx, ty] = toTableCoords(e.clientX, e.clientY);
    const dx = cueX - tx;
    const dy = cueY - ty;
    const dist = Math.hypot(dx, dy);
    if (dist > 8) {
      setAim({ angle: Math.atan2(dy, dx), power: Math.min(1, Math.max(0.12, dist / 240)) });
    }
  };

  const handlePointerUp = () => {
    if (!draggingAim) return;
    setDraggingAim(false);
    if (aim && isMyTurn) {
      sendMove({ angle: aim.angle, power: aim.power, cueX, cueY });
    }
    setAim(null);
  };

  const myGroup = state.playerGroups?.[myIndex];

  return (
    <div className="flex flex-col items-center gap-3 py-1">
      <div className="flex flex-wrap items-center justify-between w-full max-w-[640px] gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg gv-card font-semibold">
            Your Group: <strong className="text-cyan-300 uppercase">{myGroup || 'Open Table'}</strong>
          </span>
          {hasBallInHand && (
            <button
              onClick={() => setPlacingCue((p) => !p)}
              className={`px-2.5 py-1 rounded-lg font-bold ${
                placingCue ? 'bg-amber-400 text-slate-950' : 'bg-amber-500/20 text-amber-300'
              }`}
            >
              {placingCue ? 'Tap Table to Place Cue (Done)' : 'Move Cue Ball'}
            </button>
          )}
        </div>
        <span className="opacity-70">Pull back from cue ball & release to shoot</span>
      </div>

      <svg
        ref={svgRef}
        viewBox="0 0 1000 500"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="w-full max-w-[640px] aspect-[2/1] rounded-2xl border-4 border-amber-950 bg-[#0d4d3b] shadow-2xl touch-none select-none"
      >
        {/* Cushion rails */}
        <rect x={42} y={42} width={916} height={416} rx={16} fill="#0e664d" stroke="#5c2d16" strokeWidth={18} />
        {/* Head string */}
        <line x1={280} y1={55} x2={280} y2={445} stroke="rgba(255,255,255,0.16)" strokeDasharray="6 6" />

        {/* 6 Pockets */}
        {[
          [58, 58], [500, 44], [942, 58],
          [58, 442], [500, 456], [942, 442]
        ].map(([px, py], i) => (
          <circle key={i} cx={px} cy={py} r={24} fill="#030712" stroke="#1f2937" strokeWidth={3} />
        ))}

        {/* Aiming guide & cue stick */}
        {isMyTurn && aim && !animFrame && (
          <g>
            <line
              x1={cueX}
              y1={cueY}
              x2={cueX + Math.cos(aim.angle) * 320}
              y2={cueY + Math.sin(aim.angle) * 320}
              stroke="rgba(255,255,255,0.55)"
              strokeWidth={2}
              strokeDasharray="6 6"
            />
            <line
              x1={cueX - Math.cos(aim.angle) * (24 + aim.power * 60)}
              y1={cueY - Math.sin(aim.angle) * (24 + aim.power * 60)}
              x2={cueX - Math.cos(aim.angle) * (160 + aim.power * 60)}
              y2={cueY - Math.sin(aim.angle) * (160 + aim.power * 60)}
              stroke="#d97706"
              strokeWidth={6}
              strokeLinecap="round"
            />
          </g>
        )}

        {/* Balls */}
        {rawBalls.map((b) => {
          if (b.pocketed) return null;
          const bx = b.num === 0 && !animFrame ? cueX : b.x;
          const by = b.num === 0 && !animFrame ? cueY : b.y;
          const isStripe = b.num > 8;
          return (
            <g key={b.num}>
              <circle
                cx={bx}
                cy={by}
                r={13}
                fill={isStripe ? '#f8fafc' : BALL_COLORS[b.num]}
                stroke="#0f172a"
                strokeWidth={1.5}
              />
              {isStripe && (
                <rect
                  x={bx - 11}
                  y={by - 5}
                  width={22}
                  height={10}
                  rx={4}
                  fill={BALL_COLORS[b.num]}
                />
              )}
              {b.num !== 0 && (
                <>
                  <circle cx={bx} cy={by} r={5.5} fill="#ffffff" />
                  <text
                    x={bx}
                    y={by + 3}
                    textAnchor="middle"
                    fill="#0f172a"
                    fontSize="8"
                    fontWeight="bold"
                  >
                    {b.num}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

