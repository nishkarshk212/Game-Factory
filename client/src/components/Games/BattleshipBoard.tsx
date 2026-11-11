import React, { useState } from 'react';
import { RotateCw, Shuffle, Crosshair, ShieldCheck } from 'lucide-react';
import { useMatch } from '../../context/MatchContext';

const SHIPS_SPEC = [
  { id: 'carrier', name: 'Carrier', size: 5 },
  { id: 'battleship', name: 'Battleship', size: 4 },
  { id: 'cruiser', name: 'Cruiser', size: 3 },
  { id: 'submarine', name: 'Submarine', size: 3 },
  { id: 'destroyer', name: 'Destroyer', size: 2 }
];

function createDefaultShips(): { id: string; name: string; size: number; cells: [number, number][] }[] {
  return SHIPS_SPEC.map((s, idx) => ({
    ...s,
    cells: Array.from({ length: s.size }, (_, c) => [idx * 2, c] as [number, number])
  }));
}

export const BattleshipBoard: React.FC<{ state: any; myIndex: 0 | 1; isMyTurn: boolean }> = ({
  state,
  isMyTurn
}) => {
  const { sendMove } = useMatch();
  const [draftShips, setDraftShips] = useState(createDefaultShips);
  const [selectedShipIdx, setSelectedShipIdx] = useState(0);
  const [horizontal, setHorizontal] = useState(true);
  const [viewTab, setViewTab] = useState<'attack' | 'fleet'>('attack');

  if (state.phase === 'setup') {
    const myReady = state.myBoard?.ready;
    const occupied = new Map<string, number>();
    draftShips.forEach((s, idx) => s.cells.forEach(([r, c]) => occupied.set(`${r},${c}`, idx)));

    const placeDraftShip = (r: number, c: number) => {
      if (myReady) return;
      const spec = SHIPS_SPEC[selectedShipIdx];
      const nextCells: [number, number][] = [];
      for (let i = 0; i < spec.size; i++) {
        const nr = horizontal ? r : r + i;
        const nc = horizontal ? c + i : c;
        if (nr >= 10 || nc >= 10) return;
        const owner = occupied.get(`${nr},${nc}`);
        if (owner !== undefined && owner !== selectedShipIdx) return;
        nextCells.push([nr, nc]);
      }
      setDraftShips((prev) =>
        prev.map((s, idx) => (idx === selectedShipIdx ? { ...s, cells: nextCells } : s))
      );
      if (selectedShipIdx < SHIPS_SPEC.length - 1) setSelectedShipIdx(selectedShipIdx + 1);
    };

    return (
      <div className="flex flex-col items-center gap-3 py-1">
        <div className="text-center">
          <div className="text-sm font-bold text-cyan-300">
            {myReady ? 'Fleet Locked — Waiting for Opponent...' : 'Phase 1: Deploy Your Secret Fleet'}
          </div>
          <p className="text-[11px] opacity-70">
            Select a ship below and tap the grid to position it, or randomize.
          </p>
        </div>

        {!myReady && (
          <div className="flex flex-wrap justify-center gap-1.5">
            {SHIPS_SPEC.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => setSelectedShipIdx(idx)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border ${
                  selectedShipIdx === idx
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                    : 'gv-card opacity-75'
                }`}
              >
                {s.name} ({s.size})
              </button>
            ))}
          </div>
        )}

        <div className="w-full max-w-[340px] aspect-square grid grid-cols-10 gap-1 p-2 rounded-2xl bg-sky-950/60 border border-cyan-400/25">
          {Array.from({ length: 100 }, (_, i) => {
            const r = Math.floor(i / 10);
            const c = i % 10;
            const shipIdx = occupied.get(`${r},${c}`);
            const isSelected = shipIdx === selectedShipIdx;
            return (
              <button
                key={i}
                disabled={myReady}
                onClick={() => placeDraftShip(r, c)}
                className={`rounded text-[10px] font-bold transition ${
                  shipIdx !== undefined
                    ? isSelected
                      ? 'bg-cyan-400 text-slate-950 shadow-neon'
                      : 'bg-sky-500/80 text-white'
                    : 'bg-slate-900/80 hover:bg-cyan-500/25'
                }`}
              />
            );
          })}
        </div>

        {!myReady && (
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              onClick={() => setHorizontal((h) => !h)}
              className="px-3.5 py-2 rounded-xl gv-card text-xs font-semibold flex items-center gap-1.5"
            >
              <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
              {horizontal ? 'Horizontal' : 'Vertical'}
            </button>
            <button
              onClick={() => sendMove({ action: 'randomFleet' })}
              className="px-3.5 py-2 rounded-xl gv-card text-xs font-semibold flex items-center gap-1.5"
            >
              <Shuffle className="w-3.5 h-3.5 text-violet-400" />
              Auto-Randomize & Lock
            </button>
            <button
              onClick={() => sendMove({ action: 'placeFleet', ships: draftShips })}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-neon"
            >
              <ShieldCheck className="w-4 h-4" />
              Lock Fleet
            </button>
          </div>
        )}
      </div>
    );
  }

  // Battle phase
  const enemyShots: { r: number; c: number; hit: boolean }[] = state.enemyBoard?.shotsFired || [];
  const enemyShotMap = new Map(enemyShots.map((s) => [`${s.r},${s.c}`, s.hit]));
  const sunkEnemyCells = new Set<string>(
    (state.enemyBoard?.sunkShips || []).flatMap((s: any) =>
      s.cells.map(([r, c]: [number, number]) => `${r},${c}`)
    )
  );

  const myShips = state.myBoard?.ships || [];
  const myShipCells = new Set<string>(
    myShips.flatMap((s: any) => s.cells.map(([r, c]: [number, number]) => `${r},${c}`))
  );
  const incomingMap = new Map<string, boolean>(
    (state.myBoard?.incomingShots || []).map((s: any) => [`${s.r},${s.c}`, s.hit])
  );

  return (
    <div className="flex flex-col items-center gap-3 py-1">
      <div className="flex gap-2">
        <button
          onClick={() => setViewTab('attack')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
            viewTab === 'attack' ? 'bg-rose-500 text-white' : 'gv-card opacity-75'
          }`}
        >
          <Crosshair className="w-3.5 h-3.5" />
          Enemy Radar ({state.enemyBoard?.sunkShips?.length || 0}/5 Sunk)
        </button>
        <button
          onClick={() => setViewTab('fleet')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold ${
            viewTab === 'fleet' ? 'bg-cyan-500 text-slate-950' : 'gv-card opacity-75'
          }`}
        >
          My Fleet
        </button>
      </div>

      {viewTab === 'attack' ? (
        <div className="w-full max-w-[350px] aspect-square grid grid-cols-10 gap-1 p-2 rounded-2xl bg-sky-950/70 border border-rose-400/25">
          {Array.from({ length: 100 }, (_, i) => {
            const r = Math.floor(i / 10);
            const c = i % 10;
            const key = `${r},${c}`;
            const hit = enemyShotMap.get(key);
            const sunk = sunkEnemyCells.has(key);
            return (
              <button
                key={key}
                disabled={!isMyTurn || hit !== undefined}
                onClick={() => sendMove({ action: 'fire', row: r, col: c })}
                className={`rounded flex items-center justify-center text-xs font-bold transition ${
                  sunk
                    ? 'bg-rose-600 text-white ring-1 ring-amber-300'
                    : hit === true
                      ? 'bg-orange-500 text-white'
                      : hit === false
                        ? 'bg-slate-600/50 text-sky-300'
                        : isMyTurn
                          ? 'bg-slate-900/90 hover:bg-rose-500/35 cursor-crosshair'
                          : 'bg-slate-900/60'
                }`}
              >
                {hit === true ? '💥' : hit === false ? '•' : ''}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="w-full max-w-[350px] aspect-square grid grid-cols-10 gap-1 p-2 rounded-2xl bg-slate-950 border border-cyan-400/25">
          {Array.from({ length: 100 }, (_, i) => {
            const r = Math.floor(i / 10);
            const c = i % 10;
            const key = `${r},${c}`;
            const hasShip = myShipCells.has(key);
            const shot = incomingMap.get(key);
            return (
              <div
                key={key}
                className={`rounded flex items-center justify-center text-xs font-bold ${
                  shot === true
                    ? 'bg-rose-600 text-white'
                    : hasShip
                      ? 'bg-cyan-500/75'
                      : shot === false
                        ? 'bg-slate-700/60 text-sky-300'
                        : 'bg-slate-900/80'
                }`}
              >
                {shot === true ? '🔥' : shot === false ? '•' : ''}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

