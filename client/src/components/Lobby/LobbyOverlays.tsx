import React, { useEffect, useState } from 'react';
import { GAME_MAP, type FriendItem } from '@gameverse/shared';
import {
  Check,
  Copy,
  Globe,
  KeyRound,
  Lock,
  Send,
  Share2,
  Sparkles,
  Users,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useMatch } from '../../context/MatchContext';
import { GameIcon } from '../UI/GameIcon';
import { Avatar } from '../UI/Avatar';
import { apiRequest } from '../../lib/api';
import { buildInviteLinks, openTelegramShare } from '../../lib/telegram';

export const LobbyOverlays: React.FC = () => {
  const { user, telegramBotUsername, telegramAppShortName, pushToast } = useAuth();
  const {
    selectedGameForLobby,
    closeLobbyModal,
    playOnline,
    queuedGame,
    leaveQueue,
    createPrivateRoom,
    joinPrivateRoom,
    activeMatch,
    cancelRoom,
    markReady,
    inviteFriendToRoom
  } = useMatch();

  const [joinCode, setJoinCode] = useState('');
  const [searchSec, setSearchSec] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [friends, setFriends] = useState<FriendItem[]>([]);

  useEffect(() => {
    if (!queuedGame) {
      setSearchSec(0);
      return;
    }
    const iv = setInterval(() => setSearchSec((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, [queuedGame]);

  useEffect(() => {
    if (activeMatch?.status === 'waiting_opponent' && user) {
      apiRequest<{ friends: FriendItem[] }>('/api/social/friends')
        .then((res) => setFriends(res.friends.filter((f) => f.status === 'accepted')))
        .catch(() => {});
    }
  }, [activeMatch?.status, user]);

  // 1) Game Mode Selection Modal
  if (selectedGameForLobby && !activeMatch && !queuedGame) {
    const g = GAME_MAP[selectedGameForLobby];
    return (
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="gv-glass w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 border border-white/15 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${g.gradient} border border-white/15 flex items-center justify-center`}>
                <GameIcon gameId={g.id} className="text-3xl" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{g.name}</h2>
                <p className="text-xs opacity-75">{g.tagline}</p>
              </div>
            </div>
            <button onClick={closeLobbyModal} className="p-2 rounded-xl hover:bg-white/10">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-4 p-3.5 rounded-2xl gv-card space-y-1.5">
            <div className="text-xs font-bold uppercase tracking-wider text-cyan-400">Rules & Format</div>
            <ul className="text-xs opacity-80 space-y-1 list-disc pl-4">
              {g.rules.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
            <div className="pt-1 flex items-center gap-3 text-[11px] opacity-70">
              <span>👥 2 Players Only (No Bots)</span>
              <span>⏱️ {g.defaultTurnSeconds}s / turn</span>
              <span>🕒 {g.avgMinutes}</span>
            </div>
          </div>

          <div className="mt-5 space-y-2.5">
            <button
              onClick={() => playOnline(g.id)}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600 text-white font-bold text-sm shadow-neon flex items-center justify-center gap-2 hover:brightness-110 transition"
            >
              <Globe className="w-4 h-4" />
              Play Online (Find Opponent)
            </button>

            <button
              onClick={() => createPrivateRoom(g.id)}
              className="w-full py-3 px-4 rounded-2xl gv-card hover:border-violet-400/50 font-semibold text-sm flex items-center justify-center gap-2 transition"
            >
              <Lock className="w-4 h-4 text-violet-400" />
              Create Private Room & Invite Friend
            </button>

            <div className="flex gap-2 pt-1">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Enter Room Code (e.g. GV7K2P)"
                maxLength={10}
                className="flex-1 px-3.5 py-2.5 rounded-xl gv-card text-sm font-mono uppercase focus:outline-none focus:border-cyan-400"
              />
              <button
                onClick={() => joinCode.trim() && joinPrivateRoom(joinCode)}
                className="px-4 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-bold text-sm hover:bg-emerald-500/30 transition flex items-center gap-1.5"
              >
                <KeyRound className="w-4 h-4" />
                Join
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2) Public Queue Searching Overlay
  if (queuedGame) {
    const g = GAME_MAP[queuedGame];
    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
        <div className="gv-glass max-w-sm w-full rounded-3xl p-6 text-center border border-cyan-400/30 shadow-neon">
          <div className="relative w-32 h-32 mx-auto my-3 flex items-center justify-center">
            <span className="absolute inset-0 rounded-full border-2 border-cyan-400/50 animate-radar" />
            <span
              className="absolute inset-0 rounded-full border-2 border-violet-500/40 animate-radar"
              style={{ animationDelay: '0.7s' }}
            />
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500/30 to-violet-600/30 border border-cyan-400/50 flex items-center justify-center">
              <GameIcon gameId={g.id} className="text-4xl" />
            </div>
          </div>

          <h3 className="text-lg font-bold mt-2">Searching Opponent...</h3>
          <p className="text-xs opacity-75 mt-1">
            {g.name} • Live 1v1 Sonic Matchmaking
          </p>

          <div className="mt-4 inline-flex items-center gap-3 px-4 py-2 rounded-xl gv-card text-xs font-mono">
            <span className="text-cyan-400">{searchSec}s elapsed</span>
            <span className="opacity-40">|</span>
            <span>Real Players Only</span>
          </div>

          <button
            onClick={leaveQueue}
            className="mt-6 w-full py-3 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-300 font-bold text-sm hover:bg-rose-500/30 transition"
          >
            Cancel Search
          </button>
        </div>
      </div>
    );
  }

  // 3) Private Room Waiting for Friend
  if (activeMatch && activeMatch.status === 'waiting_opponent') {
    const g = GAME_MAP[activeMatch.gameId];
    const code = activeMatch.roomCode || '';
    const { webUrl, telegramShareUrl } = buildInviteLinks(
      code,
      g.name,
      telegramBotUsername,
      telegramAppShortName
    );

    const copyText = async (text: string, which: 'code' | 'link') => {
      try {
        await navigator.clipboard.writeText(text);
        if (which === 'code') {
          setCopiedCode(true);
          setTimeout(() => setCopiedCode(false), 1800);
        } else {
          setCopiedLink(true);
          setTimeout(() => setCopiedLink(false), 1800);
        }
        pushToast('Copied!', which === 'code' ? `Room code ${code} copied` : 'Invite link copied', 'success');
      } catch {
        pushToast('Copy manually', text, 'info');
      }
    };

    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
        <div className="gv-glass max-w-md w-full rounded-3xl p-6 border border-violet-400/30 shadow-neon-violet">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <GameIcon gameId={g.id} className="text-3xl" />
              <div>
                <h3 className="font-bold text-lg">{g.name} Private Room</h3>
                <p className="text-xs opacity-70">Share this code with 1 friend to duel</p>
              </div>
            </div>
            <button onClick={() => cancelRoom(activeMatch.matchId)} className="p-2 rounded-xl hover:bg-white/10">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-5 p-4 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-violet-600/15 border border-cyan-400/30 text-center">
            <div className="text-[11px] uppercase tracking-widest opacity-70">Room Code</div>
            <div className="text-3xl sm:text-4xl font-mono font-bold tracking-[0.22em] text-cyan-300 mt-1">
              {code}
            </div>
            <div className="mt-3 flex gap-2 justify-center">
              <button
                onClick={() => void copyText(code, 'code')}
                className="px-3.5 py-2 rounded-xl gv-card text-xs font-semibold flex items-center gap-1.5 hover:border-cyan-400/50"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedCode ? 'Copied' : 'Copy Code'}
              </button>
              <button
                onClick={() => void copyText(webUrl, 'link')}
                className="px-3.5 py-2 rounded-xl gv-card text-xs font-semibold flex items-center gap-1.5 hover:border-cyan-400/50"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                {copiedLink ? 'Copied Link' : 'Copy Link'}
              </button>
            </div>
          </div>

          <button
            onClick={() => openTelegramShare(telegramShareUrl)}
            className="mt-4 w-full py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-neon hover:brightness-110 transition"
          >
            <Send className="w-4 h-4" />
            Invite via Telegram
          </button>

          {friends.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-bold opacity-75 mb-2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                Quick-Invite Friends
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1.5">
                {friends.map((f) => (
                  <div key={f.friendshipId} className="flex items-center justify-between p-2 rounded-xl gv-card">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar name={f.user.displayName} photoUrl={f.user.photoUrl} online={f.user.online} size="sm" />
                      <span className="text-xs font-semibold truncate">{f.user.displayName}</span>
                    </div>
                    <button
                      onClick={() => {
                        inviteFriendToRoom(f.user.id, code, activeMatch.gameId);
                        pushToast('Invite Sent', `Notified ${f.user.displayName}`, 'success');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-violet-500/20 text-violet-300 text-xs font-semibold hover:bg-violet-500/35"
                    >
                      Invite
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => cancelRoom(activeMatch.matchId)}
            className="mt-4 w-full py-2.5 rounded-xl gv-card text-xs font-semibold text-rose-300 hover:bg-rose-500/15"
          >
            Close Room
          </button>
        </div>
      </div>
    );
  }

  // 4) Pre-Match Ready Check
  if (activeMatch && activeMatch.status === 'ready_check' && activeMatch.players[0] && activeMatch.players[1]) {
    const g = GAME_MAP[activeMatch.gameId];
    const p0 = activeMatch.players[0];
    const p1 = activeMatch.players[1];
    const myIdx = p0.id === user?.id ? 0 : 1;
    const amIReady = activeMatch.players[myIdx]?.ready;

    return (
      <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
        <div className="gv-glass max-w-md w-full rounded-3xl p-6 border border-cyan-400/40 shadow-neon text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/15 text-cyan-300 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            MATCH FOUND • {g.name.toUpperCase()}
          </div>

          <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            {[p0, p1].map((p, idx) => (
              <React.Fragment key={p.id}>
                <div className="p-3 rounded-2xl gv-card flex flex-col items-center">
                  <Avatar name={p.displayName} photoUrl={p.photoUrl} online={p.online} size="lg" />
                  <div className="mt-2 font-bold text-sm truncate max-w-[110px]">{p.displayName}</div>
                  <div className="text-[11px] opacity-65">
                    {p.rank.badgeIcon} Lv.{p.rank.level}
                  </div>
                  <div
                    className={`mt-2 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      p.ready
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                        : 'bg-amber-500/15 text-amber-300'
                    }`}
                  >
                    {p.ready ? 'READY ✓' : 'WAITING...'}
                  </div>
                </div>
                {idx === 0 && (
                  <div className="font-black text-xl sonic-gradient-text italic">VS</div>
                )}
              </React.Fragment>
            ))}
          </div>

          <button
            disabled={Boolean(amIReady)}
            onClick={() => markReady(activeMatch.matchId)}
            className={`mt-6 w-full py-3.5 rounded-2xl font-bold text-sm transition ${
              amIReady
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 cursor-default'
                : 'bg-gradient-to-r from-cyan-500 to-emerald-500 text-white shadow-neon hover:brightness-110'
            }`}
          >
            {amIReady ? 'Waiting for Opponent Ready...' : "I'm Ready — Start Match!"}
          </button>
        </div>
      </div>
    );
  }

  return null;
};

