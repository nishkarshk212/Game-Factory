import React from 'react';
import { GAME_MAP } from '@gameverse/shared';
import { Flame, LogOut, Moon, Sliders, Smartphone, Sun, Volume2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMatch } from '../context/MatchContext';
import { Avatar } from '../components/UI/Avatar';
import { GameIcon } from '../components/UI/GameIcon';

export const ProfilePage: React.FC = () => {
  const { user, isInsideTelegram, allowDevAuth, updateSettings, logout } = useAuth();
  const { openLobbyForGame, socketConnected } = useMatch();

  if (!user) return null;

  const totalMatches = user.wins + user.losses + user.draws;
  const winRate = totalMatches > 0 ? Math.round((user.wins / totalMatches) * 100) : 0;

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Player Hero Card */}
      <div className="gv-glass rounded-3xl p-5 sm:p-6 border border-cyan-400/25">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={user.displayName} photoUrl={user.photoUrl} online={socketConnected} size="lg" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black">{user.displayName}</h2>
                {user.role === 'admin' && (
                  <span className="px-2 py-0.5 rounded-full bg-violet-500/25 text-violet-300 text-[10px] font-bold">
                    ADMIN
                  </span>
                )}
              </div>
              <div className="text-xs opacity-70">
                {user.username ? `@${user.username}` : 'Telegram Gamer'} • TG ID: {user.telegramId}
              </div>
              <div className="mt-1.5 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/15 text-cyan-300 text-xs font-bold">
                <span>{user.rank.badgeIcon}</span>
                <span>{user.rank.tier}</span>
                <span>• Lv.{user.rank.level}</span>
              </div>
            </div>
          </div>

          {!isInsideTelegram && allowDevAuth && (
            <button
              onClick={logout}
              className="px-3.5 py-2 rounded-xl gv-card text-xs font-semibold text-rose-300 flex items-center gap-1.5 self-start sm:self-center"
            >
              <LogOut className="w-3.5 h-3.5" />
              Switch Profile
            </button>
          )}
        </div>

        {/* XP Bar */}
        <div className="mt-5 space-y-1.5">
          <div className="flex justify-between text-xs font-semibold">
            <span>Level {user.rank.level} Progress</span>
            <span className="font-mono text-cyan-300">
              {user.xp} / {user.rank.nextLevelXp} XP
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 via-violet-500 to-fuchsia-500 transition-all"
              style={{ width: `${user.rank.progressPct}%` }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {[
            { label: 'Wins', val: user.wins, cls: 'text-emerald-400' },
            { label: 'Losses', val: user.losses, cls: 'text-rose-400' },
            { label: 'Draws', val: user.draws, cls: 'text-amber-300' },
            { label: 'Win Rate', val: `${winRate}%`, cls: 'text-cyan-300' },
            { label: 'Best Streak', val: `🔥 ${user.bestStreak}`, cls: 'text-orange-400' }
          ].map((s) => (
            <div key={s.label} className="gv-card rounded-2xl p-3 text-center">
              <div className={`text-lg font-mono font-bold ${s.cls}`}>{s.val}</div>
              <div className="text-[11px] opacity-65">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Favorite Games */}
      <div className="gv-glass rounded-3xl p-5 space-y-3">
        <div className="font-bold text-sm flex items-center gap-2">
          <Flame className="w-4 h-4 text-pink-400" />
          Favorite Games ({user.favoriteGames.length})
        </div>
        {user.favoriteGames.length === 0 ? (
          <p className="text-xs opacity-65">Tap the heart icon on any game card to pin your favorites here.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {user.favoriteGames.map((gid) => {
              const g = GAME_MAP[gid];
              if (!g) return null;
              return (
                <button
                  key={gid}
                  onClick={() => openLobbyForGame(gid)}
                  className="px-3.5 py-2 rounded-2xl gv-card hover:border-cyan-400/50 flex items-center gap-2 text-xs font-bold transition"
                >
                  <GameIcon gameId={gid} className="text-lg" />
                  {g.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Adjustable Platform Settings */}
      <div className="gv-glass rounded-3xl p-5 space-y-4">
        <div className="font-bold text-sm flex items-center gap-2">
          <Sliders className="w-4 h-4 text-cyan-400" />
          Audio, Haptics & Gameplay Settings
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-2xl gv-card">
            <div className="flex items-center gap-2.5">
              <Volume2 className="w-4 h-4 text-cyan-400" />
              <div>
                <div className="text-sm font-semibold">Sound Effects</div>
                <div className="text-[11px] opacity-65">Synthesized Sonic cues for moves & wins</div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={user.settings.soundEnabled}
              onChange={(e) => void updateSettings({ soundEnabled: e.target.checked })}
              className="w-5 h-5 accent-cyan-400"
            />
          </div>

          {user.settings.soundEnabled && (
            <div className="flex items-center justify-between gap-4 p-3 rounded-2xl gv-card">
              <span className="text-xs font-semibold">Sound Volume</span>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.1}
                value={user.settings.soundVolume}
                onChange={(e) => void updateSettings({ soundVolume: Number(e.target.value) })}
                className="w-40 accent-cyan-400"
              />
            </div>
          )}

          <div className="flex items-center justify-between p-3 rounded-2xl gv-card">
            <div className="flex items-center gap-2.5">
              <Smartphone className="w-4 h-4 text-violet-400" />
              <div>
                <div className="text-sm font-semibold">Mobile Haptics / Vibration</div>
                <div className="text-[11px] opacity-65">Tactile feedback on Telegram Android & iOS</div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={user.settings.hapticsEnabled}
              onChange={(e) => void updateSettings({ hapticsEnabled: e.target.checked })}
              className="w-5 h-5 accent-violet-500"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-2xl gv-card">
            <div className="flex items-center gap-2.5">
              {user.settings.theme === 'dark' ? (
                <Moon className="w-4 h-4 text-cyan-400" />
              ) : (
                <Sun className="w-4 h-4 text-amber-400" />
              )}
              <div>
                <div className="text-sm font-semibold">Appearance Theme</div>
                <div className="text-[11px] opacity-65">Switch between Neon Dark and Clean Light</div>
              </div>
            </div>
            <button
              onClick={() =>
                void updateSettings({ theme: user.settings.theme === 'dark' ? 'light' : 'dark' })
              }
              className="px-3.5 py-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 text-xs font-bold uppercase"
            >
              {user.settings.theme}
            </button>
          </div>

          <div className="flex items-center justify-between p-3 rounded-2xl gv-card">
            <div>
              <div className="text-sm font-semibold">Legal Move Hints</div>
              <div className="text-[11px] opacity-65">Highlight valid targets in Chess, Checkers & Reversi</div>
            </div>
            <input
              type="checkbox"
              checked={user.settings.showMoveHints}
              onChange={(e) => void updateSettings({ showMoveHints: e.target.checked })}
              className="w-5 h-5 accent-cyan-400"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

