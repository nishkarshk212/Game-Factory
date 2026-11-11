import React, { useState } from 'react';
import { useMatch } from '../../context/MatchContext';
import { useAuth } from '../../context/AuthContext';

const PIECE_GLYPH: Record<string, string> = {
  wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙',
  bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟'
};

export const ChessBoard: React.FC<{ state: any; myIndex: 0 | 1; isMyTurn: boolean }> = ({
  state,
  myIndex,
  isMyTurn
}) => {
  const { sendMove } = useMatch();
  const { user } = useAuth();
  const showHints = user?.settings.showMoveHints ?? true;
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [pendingPromo, setPendingPromo] = useState<{ from: [number, number]; to: [number, number] } | null>(null);

  const board: ({ color: 'w' | 'b'; type: string } | null)[][] = state.board || [];
  const legalMoves: { from: [number, number]; to: [number, number]; isPromotion?: boolean }[] =
    state.legalMoves || [];
  const myColor = myIndex === 0 ? 'w' : 'b';

  const rowOrder = myIndex === 1 ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const colOrder = myIndex === 1 ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

  const movesFromSel = selected
    ? legalMoves.filter((m) => m.from[0] === selected[0] && m.from[1] === selected[1])
    : [];

  const handleSquareClick = (r: number, c: number) => {
    if (!isMyTurn) return;
    const chosen = movesFromSel.find((m) => m.to[0] === r && m.to[1] === c);
    if (chosen) {
      if (chosen.isPromotion) {
        setPendingPromo({ from: chosen.from, to: chosen.to });
      } else {
        sendMove({ from: chosen.from, to: chosen.to });
        setSelected(null);
      }
      return;
    }

    const piece = board[r]?.[c];
    if (piece && piece.color === myColor) {
      setSelected([r, c]);
    } else {
      setSelected(null);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 py-1">
      <div className="flex items-center justify-between w-full max-w-[420px] text-xs px-1">
        <div className="flex items-center gap-1 min-h-[20px]">
          <span className="opacity-60">Captured:</span>
          {(myIndex === 0 ? state.capturedByWhite : state.capturedByBlack)?.map((t: string, i: number) => (
            <span key={i} className="text-base leading-none">
              {PIECE_GLYPH[`${myIndex === 0 ? 'b' : 'w'}${t}`]}
            </span>
          ))}
        </div>
        {state.inCheck && (
          <span className="px-2.5 py-0.5 rounded-full bg-rose-500/25 text-rose-300 font-bold animate-pulse">
            CHECK!
          </span>
        )}
      </div>

      <div className="w-full max-w-[420px] aspect-square rounded-2xl overflow-hidden border-2 border-cyan-400/25 grid grid-cols-8 shadow-2xl">
        {rowOrder.map((r) =>
          colOrder.map((c) => {
            const dark = (r + c) % 2 === 1;
            const piece = board[r]?.[c];
            const isSel = selected?.[0] === r && selected?.[1] === c;
            const isTarget = movesFromSel.some((m) => m.to[0] === r && m.to[1] === c);
            const isLast =
              (state.lastMove?.from?.[0] === r && state.lastMove?.from?.[1] === c) ||
              (state.lastMove?.to?.[0] === r && state.lastMove?.to?.[1] === c);
            const isCheckKing =
              state.inCheck && piece?.type === 'k' && piece?.color === state.turn;

            return (
              <button
                key={`${r}-${c}`}
                onClick={() => handleSquareClick(r, c)}
                className={`aspect-square flex items-center justify-center relative select-none transition ${
                  isCheckKing
                    ? 'bg-rose-600/70'
                    : isSel
                      ? 'bg-cyan-500/45'
                      : isLast
                        ? dark
                          ? 'bg-amber-500/25'
                          : 'bg-amber-400/25'
                        : dark
                          ? 'bg-slate-800/95'
                          : 'bg-slate-300/20'
                }`}
              >
                {piece && (
                  <span
                    className={`text-2xl sm:text-4xl leading-none drop-shadow ${
                      piece.color === 'w'
                        ? 'text-slate-50 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]'
                        : 'text-cyan-300 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]'
                    }`}
                  >
                    {PIECE_GLYPH[`${piece.color}${piece.type}`]}
                  </span>
                )}

                {isTarget && showHints && (
                  <span
                    className={`absolute pointer-events-none ${
                      piece
                        ? 'inset-1 rounded-full border-2 border-emerald-400'
                        : 'w-3 h-3 rounded-full bg-emerald-400/80'
                    }`}
                  />
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Algebraic Move Log */}
      {Array.isArray(state.moveHistory) && state.moveHistory.length > 0 && (
        <div className="w-full max-w-[420px] px-3 py-2 rounded-xl gv-card text-[11px] font-mono opacity-80 overflow-x-auto whitespace-nowrap">
          {state.moveHistory.slice(-12).join('  ')}
        </div>
      )}

      {/* Pawn Promotion Picker */}
      {pendingPromo && (
        <div className="fixed inset-0 z-[70] bg-black/75 flex items-center justify-center p-4">
          <div className="gv-glass rounded-2xl p-5 text-center border border-cyan-400/40">
            <div className="font-bold text-sm mb-3">Promote Pawn To:</div>
            <div className="flex gap-3">
              {(['q', 'r', 'b', 'n'] as const).map((promo) => (
                <button
                  key={promo}
                  onClick={() => {
                    sendMove({ ...pendingPromo, promotion: promo });
                    setPendingPromo(null);
                    setSelected(null);
                  }}
                  className="w-14 h-14 rounded-2xl gv-card text-3xl flex items-center justify-center hover:border-cyan-400 hover:bg-cyan-500/20"
                >
                  {PIECE_GLYPH[`${myColor}${promo}`]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

