import React, { useCallback, useEffect, useState } from 'react';
import { type FriendItem, type GameId, type PlayerSummary } from '@gameverse/shared';
import { Check, RefreshCw, Search, Swords, UserPlus, Users, X } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useMatch } from '../context/MatchContext';
import { Avatar } from '../components/UI/Avatar';

export const SocialPage: React.FC = () => {
  const { user, games, pushToast } = useAuth();
  const { createPrivateRoom, activeMatch, inviteFriendToRoom } = useMatch();

  const [tab, setTab] = useState<'online' | 'friends' | 'search'>('online');
  const [onlinePlayers, setOnlinePlayers] = useState<PlayerSummary[]>([]);
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<PlayerSummary[]>([]);
  const [challengeTarget, setChallengeTarget] = useState<PlayerSummary | null>(null);
  const [selectedChallengeGame, setSelectedChallengeGame] = useState<GameId>('chess');
  const [pendingInviteUserId, setPendingInviteUserId] = useState<string | null>(null);

  const loadSocial = useCallback(async () => {
    try {
      const [onRes, frRes] = await Promise.all([
        apiRequest<{ players: PlayerSummary[] }>('/api/users/online'),
        apiRequest<{ friends: FriendItem[] }>('/api/social/friends')
      ]);
      setOnlinePlayers(onRes.players);
      setFriends(frRes.friends);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void loadSocial();
  }, [loadSocial]);

  // If user clicked Challenge Friend -> creates room -> once waiting room ready, pushes invite!
  useEffect(() => {
    if (
      pendingInviteUserId &&
      activeMatch &&
      activeMatch.status === 'waiting_opponent' &&
      activeMatch.roomCode
    ) {
      inviteFriendToRoom(pendingInviteUserId, activeMatch.roomCode, activeMatch.gameId);
      pushToast('Challenge Sent!', `Invited friend to room ${activeMatch.roomCode}`, 'success');
      setPendingInviteUserId(null);
    }
  }, [activeMatch, inviteFriendToRoom, pendingInviteUserId, pushToast]);

  const handleSearch = async (q: string) => {
    setSearchQ(q);
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const res = await apiRequest<{ users: PlayerSummary[] }>(
      `/api/users/search?q=${encodeURIComponent(q)}`
    );
    setSearchResults(res.users);
  };

  const addFriend = async (targetUserId: string) => {
    try {
      const res = await apiRequest<{ status: string }>('/api/social/friends/request', {
        method: 'POST',
        body: JSON.stringify({ targetUserId })
      });
      pushToast(
        res.status === 'accepted' ? 'Friend Added!' : 'Request Sent',
        res.status === 'already_friends' ? 'You are already friends' : 'Friend request updated',
        'success'
      );
      void loadSocial();
    } catch (err) {
      pushToast('Error', (err as Error).message, 'error');
    }
  };

  const respondFriend = async (friendshipId: string, action: 'accept' | 'decline') => {
    await apiRequest('/api/social/friends/respond', {
      method: 'POST',
      body: JSON.stringify({ friendshipId, action })
    });
    void loadSocial();
  };

  const launchChallenge = () => {
    if (!challengeTarget) return;
    setPendingInviteUserId(challengeTarget.id);
    createPrivateRoom(selectedChallengeGame);
    setChallengeTarget(null);
  };

  const acceptedFriends = friends.filter((f) => f.status === 'accepted');
  const incomingRequests = friends.filter((f) => f.status === 'pending_incoming');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-black flex items-center gap-2">
          <Users className="w-5 h-5 text-cyan-400" />
          Sonic Network Players
        </h2>
        <button
          onClick={() => void loadSocial()}
          className="p-2 rounded-xl gv-glass hover:border-cyan-400/50"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-2">
        {[
          { id: 'online', label: `Online (${onlinePlayers.length})` },
          { id: 'friends', label: `Friends (${acceptedFriends.length})` },
          { id: 'search', label: 'Find Players' }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              tab === t.id
                ? 'bg-gradient-to-r from-cyan-500 to-violet-600 text-white shadow-neon'
                : 'gv-glass opacity-75'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'online' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {onlinePlayers.map((p) => (
            <div key={p.id} className="gv-glass rounded-2xl p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar name={p.displayName} photoUrl={p.photoUrl} online={true} />
                <div className="min-w-0">
                  <div className="font-bold text-sm truncate">
                    {p.displayName} {p.id === user?.id && <span className="text-xs text-cyan-400">(You)</span>}
                  </div>
                  <div className="text-[11px] opacity-65">
                    {p.rank.badgeIcon} Lv.{p.rank.level} •{' '}
                    <span className={p.inMatch ? 'text-amber-300' : 'text-emerald-400'}>
                      {p.inMatch ? 'In Match' : p.inQueue ? 'Searching' : 'Available'}
                    </span>
                  </div>
                </div>
              </div>
              {p.id !== user?.id && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setChallengeTarget(p)}
                    className="px-2.5 py-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 text-xs font-bold flex items-center gap-1 hover:bg-cyan-500/30"
                  >
                    <Swords className="w-3.5 h-3.5" />
                    Duel
                  </button>
                  <button
                    onClick={() => void addFriend(p.id)}
                    className="p-2 rounded-xl gv-card hover:border-violet-400/50"
                    title="Add Friend"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-violet-400" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'friends' && (
        <div className="space-y-4">
          {incomingRequests.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase text-amber-300">Pending Friend Requests</div>
              {incomingRequests.map((req) => (
                <div key={req.friendshipId} className="gv-glass rounded-2xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={req.user.displayName} photoUrl={req.user.photoUrl} online={req.user.online} size="sm" />
                    <span className="text-sm font-semibold">{req.user.displayName}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => void respondFriend(req.friendshipId, 'accept')}
                      className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => void respondFriend(req.friendshipId, 'decline')}
                      className="p-2 rounded-xl bg-rose-500/20 text-rose-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {acceptedFriends.length === 0 ? (
            <div className="gv-glass rounded-2xl p-8 text-center text-sm opacity-70">
              No friends yet. Add online players or search by Telegram username!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {acceptedFriends.map((f) => (
                <div key={f.friendshipId} className="gv-glass rounded-2xl p-3.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={f.user.displayName} photoUrl={f.user.photoUrl} online={f.user.online} />
                    <div className="min-w-0">
                      <div className="font-bold text-sm truncate">{f.user.displayName}</div>
                      <div className="text-[11px] opacity-65">
                        {f.user.online ? '🟢 Online' : '⚫ Offline'} • {f.user.wins}W / {f.user.losses}L
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setChallengeTarget(f.user)}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 text-white text-xs font-bold flex items-center gap-1"
                  >
                    <Swords className="w-3.5 h-3.5" />
                    Invite
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'search' && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 opacity-50 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              value={searchQ}
              onChange={(e) => void handleSearch(e.target.value)}
              placeholder="Search player name, @username, or Telegram ID..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl gv-glass text-sm focus:outline-none focus:border-cyan-400"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {searchResults.map((u) => (
              <div key={u.id} className="gv-glass rounded-2xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar name={u.displayName} photoUrl={u.photoUrl} online={u.online} size="sm" />
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate">{u.displayName}</div>
                    <div className="text-[11px] opacity-60">@{u.username || u.telegramId}</div>
                  </div>
                </div>
                <button
                  onClick={() => void addFriend(u.id)}
                  className="px-3 py-1.5 rounded-xl bg-violet-500/20 text-violet-300 text-xs font-bold flex items-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Challenge Modal */}
      {challengeTarget && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="gv-glass max-w-sm w-full rounded-3xl p-5 border border-cyan-400/35">
            <h3 className="font-bold text-base">Challenge {challengeTarget.displayName}</h3>
            <p className="text-xs opacity-70 mt-0.5">Pick a game to launch a private room & send an invite:</p>
            <select
              value={selectedChallengeGame}
              onChange={(e) => setSelectedChallengeGame(e.target.value as GameId)}
              className="w-full mt-3 p-2.5 rounded-xl gv-card text-sm"
            >
              {games.filter((g) => g.enabled).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setChallengeTarget(null)}
                className="flex-1 py-2.5 rounded-xl gv-card text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={launchChallenge}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 text-white text-xs font-bold"
              >
                Send Challenge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

