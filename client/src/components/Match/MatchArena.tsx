import React, { useEffect, useState } from 'react';
import { GAME_MAP } from '@gameverse/shared';
import {
  AlertTriangle,
  Clock,
  Flag,
  Handshake,
  HelpCircle,
  Home,
  Maximize2,
  Minimize2,
  RotateCcw,
  Trophy,
  WifiOff,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useMatch } from '../../context/MatchContext';
import { Avatar } from '../UI/Avatar';
import { GameIcon } from '../UI/GameIcon';
import { GameBoardRouter } from '../Games/GameBoardRouter';
import { apiRequest } from '../../lib/api';

const EMOTES = ['⚡', '🔥', '👏', '😎', 'GG!', '😅'];

export const MatchArena: React.FC = () => {
  const { user, pushToast } = useAuth();
  const {
    activeMatch,
    matchResult,
    incomingEmote,
    resignMatch,
    offerDraw,
    respondDraw,
    sendEmote,
    requestRematch,
    leavePostgame
  } = useMatch();

  const [nowMs, setNowMs] = useState(Date.now());
  const [theaterMode, setTheaterMode] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [confirmResign, setConfirmResign] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('Unsportsmanlike behavior');
  const [reportDetails, setReportDetails] = useState('');

  useEffect(() => {
    const iv = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(iv);
  }, []);

  if (
    !activeMatch ||
    activeMatch.status === 'waiting_opponent' ||
    activeMatch.status === 'ready_check' ||
    !activeMatch.players[0] ||
    !activeMatch.players[1]
  ) {
    return null;
  }

  const g = GAME_MAP[activeMatch.gameId];
  const p0 = activeMatch.players[0];
  const p1 = activeMatch.players[1];
  const myIdx: 0 | 1 = p0.id === user?.id ? 0 : 1;
  const oppIdx: 0 | 1 = myIdx === 0 ? 1 : 0;
  const opponent = activeMatch.players[oppIdx]!;

  const isMyTurn = activeMatch.status === 'active' && activeMatch.currentTurnIndex === myIdx;
  const turnLeftSec = activeMatch.turnDeadline
    ? Math.max(0, Math.ceil((activeMatch.turnDeadline - nowMs) / 1000))
    : 0;

  const elapsedSec = activeMatch.startedAt
    ? Math.max(
        0,
        Math.floor(((activeMatch.endedAt || nowMs) - activeMatch.startedAt) / 1000)
      )
    : 0;
  const elapsedStr = `${String(Math.floor(elapsedSec / 60)).padStart(2, '0')}:${String(
    elapsedSec % 60
  ).padStart(2, '0')}`;

  const oppDisconnectLeft =
    opponent.reconnecting && opponent.disconnectDeadline
      ? Math.max(0, Math.ceil((opponent.disconnectDeadline - nowMs) / 1000))
      : null;

  const recentEmote =
    incomingEmote && nowMs - incomingEmote.at < 2600 ? incomingEmote : null;

  const submitReport = async () => {
    try {
      await apiRequest('/api/social/reports', {
        method: 'POST',
        body: JSON.stringify({
          reportedUserId: opponent.id,
          matchId: activeMatch.matchId,
          reason: reportReason,
          details: reportDetails
        })
      });
      setReportOpen(false);
      setReportDetails('');
      pushToast('Report Submitted', 'Sonic Network moderation will review this match.', 'success');
    } catch (err) {
      pushToast('Failed to submit report', (err as Error).message, 'error');
    }
  };

  return (
    <div className="space-y-3 pb-6">
      {/* Match Top Bar */}
      <div className="gv-glass rounded-2xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <GameIcon gameId={g.id} className="text-2xl" />
          <div>
            <div className="font-bold text-sm flex items-center gap-2">
              {g.name}
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 font-mono">
                {elapsedStr}
              </span>
            </div>
            <div className="text-[11px] opacity-70 truncate max-w-[220px] sm:max-w-md">
              {activeMatch.lastEventText || 'Live 2-Player Match'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setTheaterMode((v) => !v)}
            className="p-2 rounded-xl gv-card hover:border-[#6842FF]/60"
            title={theaterMode ? 'Exit Theater Mode' : 'Theater Mode'}
          >
            {theaterMode ? <Minimize2 className="w-4 h-4 text-cyan-300" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setShowRules((v) => !v)}
            className="p-2 rounded-xl gv-card hover:border-cyan-400/50"
            title="Rules"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
          {g.supportsDrawOffer && activeMatch.status === 'active' && (
            <button
              onClick={offerDraw}
              disabled={activeMatch.drawOfferBy === myIdx}
              className="px-2.5 py-1.5 rounded-xl gv-card text-xs font-semibold flex items-center gap-1 hover:border-amber-400/50 disabled:opacity-40"
            >
              <Handshake className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Draw</span>
            </button>
          )}
          {activeMatch.status === 'active' && (
            <button
              onClick={() => setConfirmResign(true)}
              className="px-2.5 py-1.5 rounded-xl bg-rose-500/15 border border-rose-400/30 text-rose-300 text-xs font-semibold flex items-center gap-1 hover:bg-rose-500/25"
            >
              <Flag className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Resign</span>
            </button>
          )}
          <button
            onClick={() => setReportOpen(true)}
            className="p-2 rounded-xl gv-card text-amber-400 hover:border-amber-400/40"
            title="Report Opponent"
          >
            <AlertTriangle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Rules Collapsible */}
      {showRules && (
        <div className="gv-glass rounded-2xl p-3.5 text-xs space-y-1 border border-cyan-400/30">
          <div className="font-bold text-cyan-300">{g.name} Rules</div>
          <ul className="list-disc pl-4 space-y-0.5 opacity-85">
            {g.rules.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Opponent Reconnecting Alert */}
      {oppDisconnectLeft !== null && activeMatch.status === 'active' && (
        <div className="rounded-2xl bg-amber-500/15 border border-amber-400/40 px-4 py-2.5 flex items-center justify-between text-xs text-amber-200">
          <div className="flex items-center gap-2 font-semibold">
            <WifiOff className="w-4 h-4 animate-pulse" />
            {opponent.displayName} disconnected — waiting for reconnection...
          </div>
          <span className="font-mono font-bold">{oppDisconnectLeft}s</span>
        </div>
      )}

      {/* Incoming Draw Offer Banner */}
      {activeMatch.drawOfferBy === oppIdx && activeMatch.status === 'active' && (
        <div className="rounded-2xl bg-violet-500/20 border border-violet-400/50 px-4 py-2.5 flex items-center justify-between gap-2 text-xs">
          <span className="font-semibold">{opponent.displayName} offered a Draw. Accept?</span>
          <div className="flex gap-2">
            <button
              onClick={() => respondDraw(true)}
              className="px-3 py-1 rounded-lg bg-emerald-500 text-white font-bold"
            >
              Accept
            </button>
            <button
              onClick={() => respondDraw(false)}
              className="px-3 py-1 rounded-lg bg-white/10 font-semibold"
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {/* Two-Player HUD Cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
        {[p0, p1].map((player, idx) => {
          const isTurn = activeMatch.status === 'active' && activeMatch.currentTurnIndex === idx;
          const isMe = idx === myIdx;
          return (
            <div
              key={player.id}
              className={`relative gv-glass rounded-2xl p-3 transition-all ${
                isTurn ? 'active-turn-ring border-cyan-400/70' : 'border-white/10'
              }`}
            >
              {recentEmote && recentEmote.fromPlayerIndex === idx && (
                <div className="absolute -top-3 right-3 px-2.5 py-1 rounded-full bg-gradient-to-r from-cyan-500 to-violet-600 text-white text-xs font-bold shadow-lg animate-bounce">
                  {recentEmote.emote}
                </div>
              )}
              <div className="flex items-center gap-2.5">
                <Avatar
                  name={player.displayName}
                  photoUrl={player.photoUrl}
                  online={player.online}
                  reconnecting={player.reconnecting}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs sm:text-sm truncate">
                      {player.displayName}
                    </span>
                    {isMe && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-semibold">
                        YOU
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] opacity-65 truncate">
                    {player.rank.badgeIcon} {player.rank.tier}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg sm:text-xl font-mono font-bold text-cyan-300">
                    {player.score}
                  </div>
                  <div className="text-[10px] opacity-60 uppercase">Score</div>
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
                <span className={isTurn ? 'text-cyan-300 font-bold' : 'opacity-55'}>
                  {activeMatch.status === 'completed'
                    ? activeMatch.winnerIndex === idx
                      ? '🏆 WINNER'
                      : activeMatch.isDraw
                        ? '🤝 DRAW'
                        : 'FINISHED'
                    : isTurn
                      ? isMe
                        ? '⚡ YOUR TURN'
                        : '⏳ OPPONENT TURN'
                      : 'Standby'}
                </span>
                {isTurn && (
                  <span
                    className={`font-mono font-bold flex items-center gap-1 ${
                      turnLeftSec <= 7 ? 'text-rose-400 animate-pulse' : 'text-cyan-300'
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    {turnLeftSec}s
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* CrazyGames-Style Theater Game Stage */}
      <div
        className={`rounded-3xl border border-white/10 shadow-2xl transition-all ${
          theaterMode
            ? 'fixed inset-0 z-50 rounded-none bg-[#090a10] p-4 sm:p-6 overflow-y-auto flex flex-col justify-center'
            : 'gv-glass p-2.5 sm:p-5 bg-[#0f101a]/90'
        }`}
      >
        {theaterMode && (
          <div className="max-w-3xl w-full mx-auto mb-3 flex items-center justify-between text-xs">
            <span className="font-bold text-cyan-300">
              {g.name} • {isMyTurn ? 'Your Turn' : `${opponent.displayName}'s Turn`}
            </span>
            <button
              onClick={() => setTheaterMode(false)}
              className="px-3 py-1.5 rounded-full gv-card flex items-center gap-1.5 font-semibold"
            >
              <Minimize2 className="w-3.5 h-3.5" /> Exit Theater
            </button>
          </div>
        )}
        <GameBoardRouter
          match={activeMatch}
          myIndex={myIdx}
          isMyTurn={isMyTurn}
        />
      </div>

      {/* Quick Emote Bar */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {EMOTES.map((e) => (
          <button
            key={e}
            onClick={() => sendEmote(e)}
            className="px-3 py-1.5 rounded-full gv-card text-xs font-semibold hover:scale-105 hover:border-cyan-400/50 transition"
          >
            {e}
          </button>
        ))}
      </div>

      {/* Game Result & Rematch Modal */}
      {(activeMatch.status === 'completed' || matchResult) && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="gv-glass max-w-md w-full rounded-3xl p-6 border border-cyan-400/40 shadow-2xl text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-cyan-400/25 to-violet-600/30 border border-cyan-400/40 flex items-center justify-center">
              <Trophy
                className={`w-8 h-8 ${
                  activeMatch.isDraw
                    ? 'text-amber-300'
                    : activeMatch.winnerIndex === myIdx
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                }`}
              />
            </div>

            <h2 className="text-2xl font-black mt-3 sonic-gradient-text">
              {activeMatch.isDraw
                ? 'MATCH DRAW!'
                : activeMatch.winnerIndex === myIdx
                  ? 'VICTORY!'
                  : 'DEFEAT'}
            </h2>
            <p className="text-xs opacity-75 mt-1">
              {activeMatch.lastEventText || g.name} • {elapsedStr}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 p-3.5 rounded-2xl gv-card">
              <div>
                <div className="text-[11px] opacity-65">Your Score</div>
                <div className="text-2xl font-mono font-bold text-cyan-300">
                  {activeMatch.players[myIdx]?.score ?? 0}
                </div>
              </div>
              <div>
                <div className="text-[11px] opacity-65">Opponent Score</div>
                <div className="text-2xl font-mono font-bold text-violet-300">
                  {activeMatch.players[oppIdx]?.score ?? 0}
                </div>
              </div>
            </div>

            {matchResult && (
              <div className="mt-3 p-3 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-sm font-bold">
                +{matchResult.xpAwarded[myIdx]} XP Earned on Sonic Network!
                {matchResult.unlockedAchievements?.[user?.id || '']?.map((a) => (
                  <div key={a.id} className="text-xs text-amber-300 mt-1">
                    {a.icon} Unlocked: {a.title} (+{a.xpReward} XP)
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 space-y-2.5">
              <button
                onClick={requestRematch}
                disabled={activeMatch.rematchRequests[myIdx]}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-bold text-sm shadow-neon flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-60 transition"
              >
                <RotateCcw className="w-4 h-4" />
                {activeMatch.rematchRequests[myIdx]
                  ? 'Waiting for Opponent Rematch...'
                  : activeMatch.rematchRequests[oppIdx]
                    ? 'Opponent Wants Rematch — Accept!'
                    : 'Request Rematch'}
              </button>

              <button
                onClick={leavePostgame}
                className="w-full py-3 rounded-2xl gv-card font-semibold text-sm flex items-center justify-center gap-2 hover:border-white/25 transition"
              >
                <Home className="w-4 h-4" />
                Back to GameVerse Lobby
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resign Confirmation */}
      {confirmResign && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="gv-glass max-w-xs w-full rounded-2xl p-5 border border-rose-400/30 text-center">
            <h3 className="font-bold text-base">Surrender Match?</h3>
            <p className="text-xs opacity-75 mt-1">Resigning awards victory to your opponent.</p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setConfirmResign(false)}
                className="flex-1 py-2 rounded-xl gv-card text-xs font-semibold"
              >
                Keep Playing
              </button>
              <button
                onClick={() => {
                  setConfirmResign(false);
                  resignMatch();
                }}
                className="flex-1 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold"
              >
                Confirm Resign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {reportOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="gv-glass max-w-sm w-full rounded-2xl p-5 border border-amber-400/30">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-base">Report {opponent.displayName}</h3>
              <button onClick={() => setReportOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full p-2.5 rounded-xl gv-card text-xs mb-2.5"
            >
              <option>Unsportsmanlike behavior</option>
              <option>Intentional stalling / AFK</option>
              <option>Suspected exploit or cheating</option>
              <option>Offensive username / profile</option>
            </select>
            <textarea
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              placeholder="Optional details..."
              rows={3}
              className="w-full p-2.5 rounded-xl gv-card text-xs mb-3"
            />
            <button
              onClick={() => void submitReport()}
              className="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
            >
              Submit Report
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

