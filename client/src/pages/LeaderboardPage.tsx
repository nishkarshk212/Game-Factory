import React, { useCallback, useEffect, useState } from 'react';
import {
  GAME_CATALOG,
  GAME_MAP,
  type AchievementItem,
  type DailyChallengeItem,
  type GameId,
  type LeaderboardEntry,
  type MatchHistoryItem
} from '@gameverse/shared';
import { Award, CheckCircle2, History, Target, Trophy } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Avatar } from '../components/UI/Avatar';
import { GameIcon } from '../components/UI/GameIcon';

export const LeaderboardPage: React.FC = () => {
  const { user, refreshUser, pushToast } = useAuth();
  const [subTab, setSubTab] = useState<'leaders' | 'challenges' | 'achievements' | 'history'>('leaders');
  const [selectedGame, setSelectedGame] = useState<GameId | ''>('');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [challenges, setChallenges] = useState<DailyChallengeItem[]>([]);
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);
  const [history, setHistory] = useState<MatchHistoryItem[]>([]);

  const loadLeaders = useCallback(async () => {
    const q = selectedGame ? `?gameId=${selectedGame}` : '';
    const res = await apiRequest<{ entries: LeaderboardEntry[] }>(`/api/users/leaderboard${q}`);
    setEntries(res.entries);
  }, [selectedGame]);

  const loadProgression = useCallback(async () => {
    const [chRes, achRes, histRes] = await Promise.all([
      apiRequest<{ challenges: DailyChallengeItem[] }>('/api/users/challenges'),
      apiRequest<{ achievements: AchievementItem[] }>('/api/users/achievements'),
      apiRequest<{ history: MatchHistoryItem[] }>('/api/users/history')
    ]);
    setChallenges(chRes.challenges);
    setAchievements(achRes.achievements);
    setHistory(histRes.history);
  }, []);

  useEffect(() => {
    void loadLeaders();
    void loadProgression();
  }, [loadLeaders, loadProgression]);

  const handleClaim = async (id: string) => {
    try {
      const res = await apiRequest<{ xpEarned: number }>(`/api/users/challenges/${id}/claim`, {
        method: 'POST'
      });
      pushToast('Reward Claimed!', `+${res.xpEarned} XP added to your Sonic Rank`, 'success');
      await Promise.all([loadProgression(), refreshUser()]);
    } catch (err) {
      pushToast('Cannot claim', (err as Error).message, 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-black flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-400" />
          Ranks, Quests & History
        </h2>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { id: 'leaders', label: 'Leaderboard', icon: <Trophy className="w-3.5 h-3.5" /> },
          { id: 'challenges', label: 'Daily Quests', icon: <Target className="w-3.5 h-3.5" /> },
          { id: 'achievements', label: 'Achievements', icon: <Award className="w-3.5 h-3.5" /> },
          { id: 'history', label: 'Match History', icon: <History className="w-3.5 h-3.5" /> }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id as any)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition ${
              subTab === t.id
                ? 'bg-gradient-to-r from-cyan-500 to-violet-600 text-white shadow-neon'
                : 'gv-glass opacity-75'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'leaders' && (
        <div className="space-y-3">
          <select
            value={selectedGame}
            onChange={(e) => setSelectedGame(e.target.value as GameId | '')}
            className="w-full sm:w-64 p-2.5 rounded-xl gv-glass text-xs font-semibold"
          >
            <option value="">🌐 Global Overall XP</option>
            {GAME_CATALOG.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} Rankings
              </option>
            ))}
          </select>

          <div className="gv-glass rounded-3xl overflow-hidden border border-white/10">
            {entries.length === 0 ? (
              <div className="p-8 text-center text-sm opacity-65">No ranked matches recorded yet.</div>
            ) : (
              entries.map((row) => (
                <div
                  key={row.userId}
                  className={`flex items-center justify-between gap-3 px-4 py-3 border-b border-white/5 last:border-b-0 ${
                    row.userId === user?.id ? 'bg-cyan-500/10' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-7 text-center font-black text-sm ${
                        row.rankPosition === 1
                          ? 'text-amber-300'
                          : row.rankPosition === 2
                            ? 'text-slate-300'
                            : row.rankPosition === 3
                              ? 'text-orange-400'
                              : 'opacity-55'
                      }`}
                    >
                      #{row.rankPosition}
                    </div>
                    <Avatar name={row.displayName} photoUrl={row.photoUrl} size="sm" />
                    <div className="min-w-0">
                      <div className="font-bold text-sm truncate">{row.displayName}</div>
                      <div className="text-[11px] opacity-65">
                        {row.rank.badgeIcon} {row.rank.tier} • {row.wins}W-{row.losses}L ({row.winRate}%)
                      </div>
                    </div>
                  </div>
                  <div className="font-mono font-bold text-sm text-cyan-300 shrink-0">
                    {row.xp} XP
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {subTab === 'challenges' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {challenges.map((ch) => {
            const pct = Math.min(100, Math.round((ch.progress / ch.targetCount) * 100));
            return (
              <div key={ch.id} className="gv-glass rounded-2xl p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-sm">{ch.title}</div>
                    <div className="text-xs opacity-70">{ch.description}</div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-cyan-500/15 text-cyan-300 font-mono text-xs font-bold shrink-0">
                    +{ch.xpReward} XP
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 to-violet-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="opacity-70">
                    Progress: {ch.progress} / {ch.targetCount}
                  </span>
                  {ch.claimed ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Claimed
                    </span>
                  ) : ch.completed ? (
                    <button
                      onClick={() => void handleClaim(ch.id)}
                      className="px-3 py-1 rounded-lg bg-emerald-500 text-white font-bold"
                    >
                      Claim +{ch.xpReward} XP
                    </button>
                  ) : (
                    <span className="opacity-50">In Progress</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {subTab === 'achievements' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {achievements.map((a) => (
            <div
              key={a.id}
              className={`gv-glass rounded-2xl p-4 flex items-center gap-3.5 border ${
                a.unlocked ? 'border-amber-400/40 bg-amber-500/5' : 'opacity-60 border-white/10'
              }`}
            >
              <div className="text-3xl">{a.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm flex items-center gap-2">
                  {a.title}
                  {a.unlocked && <span className="text-[10px] text-emerald-400">UNLOCKED</span>}
                </div>
                <div className="text-xs opacity-75">{a.description}</div>
              </div>
              <div className="text-xs font-mono font-bold text-cyan-300 shrink-0">+{a.xpReward} XP</div>
            </div>
          ))}
        </div>
      )}

      {subTab === 'history' && (
        <div className="space-y-2.5">
          {history.length === 0 ? (
            <div className="gv-glass rounded-2xl p-8 text-center text-sm opacity-65">
              No completed matches yet. Jump into a game from the Dashboard!
            </div>
          ) : (
            history.map((h) => {
              const g = GAME_MAP[h.gameId];
              return (
                <div key={h.id} className="gv-glass rounded-2xl p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <GameIcon gameId={h.gameId} className="text-2xl" />
                    <div className="min-w-0">
                      <div className="font-bold text-sm truncate">
                        {g?.name || h.gameId} vs {h.opponent.displayName}
                      </div>
                      <div className="text-[11px] opacity-65">
                        Score {h.myScore}–{h.opponentScore} • {h.mode} •{' '}
                        {new Date(h.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                        h.result === 'win'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : h.result === 'draw'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      {h.result}
                    </span>
                    <div className="text-[11px] font-mono text-cyan-300 mt-0.5">+{h.xpEarned} XP</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

