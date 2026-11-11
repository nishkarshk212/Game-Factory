import React, { useState } from 'react';
import { type GameCategory } from '@gameverse/shared';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Compass,
  Dices,
  Flame,
  Gamepad2,
  Heart,
  KeyRound,
  Menu,
  Moon,
  Puzzle,
  Search,
  Shield,
  Sparkles,
  Sun,
  Swords,
  Trophy,
  User,
  Users,
  Volume2,
  VolumeX,
  Zap
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useMatch } from '../../context/MatchContext';
import { Avatar } from '../UI/Avatar';
import { NotificationDrawer } from '../UI/ToastStack';

export type NavTab = 'home' | 'social' | 'ranks' | 'profile' | 'admin';
export type CatalogFilter = 'all' | 'featured' | 'favorites' | GameCategory;

interface AppShellProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  catalogFilter: CatalogFilter;
  onSelectFilter: (f: CatalogFilter) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  activeTab,
  onSelectTab,
  catalogFilter,
  onSelectFilter,
  searchQuery,
  onSearchChange,
  children
}) => {
  const {
    user,
    platform,
    unreadCount,
    updateSettings,
    isInsideTelegram,
    allowDevAuth,
    loginBrowserSession,
    pushToast
  } = useAuth();
  const { socketConnected, joinPrivateRoom, onlineUserIds } = useMatch();

  const [notifOpen, setNotifOpen] = useState(false);
  const [railExpanded, setRailExpanded] = useState(true);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const pickCategory = (f: CatalogFilter) => {
    onSelectFilter(f);
    onSelectTab('home');
  };

  const categoryItems: { id: CatalogFilter; label: string; icon: React.ReactNode }[] = [
    { id: 'all', label: 'Home', icon: <Compass className="w-5 h-5" /> },
    { id: 'featured', label: 'Popular', icon: <Flame className="w-5 h-5 text-orange-400" /> },
    { id: 'favorites', label: 'Favorites', icon: <Heart className="w-5 h-5 text-pink-400" /> },
    { id: 'strategy', label: 'Strategy', icon: <Swords className="w-5 h-5 text-cyan-400" /> },
    { id: 'board', label: 'Board', icon: <Dices className="w-5 h-5 text-amber-400" /> },
    { id: 'arcade', label: 'Arcade', icon: <Gamepad2 className="w-5 h-5 text-emerald-400" /> },
    { id: 'puzzle', label: 'Puzzle', icon: <Puzzle className="w-5 h-5 text-violet-400" /> },
    { id: 'quick', label: 'Blitz 1v1', icon: <Zap className="w-5 h-5 text-fuchsia-400" /> }
  ];

  const navItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Games', icon: <Gamepad2 className="w-5 h-5" /> },
    { id: 'social', label: 'Friends', icon: <Users className="w-5 h-5" /> },
    { id: 'ranks', label: 'Ranks', icon: <Trophy className="w-5 h-5" /> },
    { id: 'profile', label: 'Profile', icon: <User className="w-5 h-5" /> }
  ];
  if (user?.role === 'admin') {
    navItems.push({ id: 'admin', label: 'Admin', icon: <Shield className="w-5 h-5" /> });
  }

  const handleSwitchProfile = async (preset: 'player1' | 'player2') => {
    setProfileMenuOpen(false);
    try {
      await loginBrowserSession({ preset });
      pushToast(
        'Profile Switched',
        preset === 'player1' ? 'Signed in as Nova (Player 1 • Admin)' : 'Signed in as Aria (Player 2)',
        'success'
      );
    } catch (err) {
      pushToast('Switch failed', (err as Error).message, 'error');
    }
  };

  return (
    <div className="min-h-dvh sonic-bg-grid flex flex-col">
      {/* CrazyGames-style Top Header Bar */}
      <header className="sticky top-0 z-40 gv-glass border-b border-white/10 pt-safe">
        <div className="px-3 sm:px-5 h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Rail toggle + Logo */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={() => setRailExpanded((v) => !v)}
              className="hidden md:flex p-2 rounded-xl hover:bg-white/10 transition"
              title="Toggle sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button
              onClick={() => pickCategory('all')}
              className="flex items-center gap-2.5 text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#6842FF] via-violet-500 to-cyan-400 flex items-center justify-center shadow-[0_0_18px_rgba(104,66,255,0.45)]">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div className="leading-none">
                <div className="font-black text-base sm:text-lg tracking-tight flex items-center gap-1.5">
                  <span>GameVerse</span>
                  <span className="hidden lg:inline-block text-[10px] px-1.5 py-0.5 rounded bg-[#6842FF]/25 text-cyan-300 font-bold tracking-wider">
                    SONIC
                  </span>
                </div>
                <div className="text-[10px] opacity-65 flex items-center gap-1 mt-0.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      socketConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
                    }`}
                  />
                  <span>{onlineUserIds.size} online</span>
                </div>
              </div>
            </button>
          </div>

          {/* Center: Prominent CrazyGames Search Pill */}
          <div className="flex-1 max-w-xl hidden sm:block">
            <div className="relative">
              <Search className="w-4 h-4 opacity-55 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                value={searchQuery}
                onChange={(e) => {
                  onSearchChange(e.target.value);
                  if (activeTab !== 'home') onSelectTab('home');
                }}
                placeholder="Search 14 live 2-player games (Chess, 8 Ball Pool, Carrom...)"
                className="w-full pl-11 pr-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-[#6842FF] focus:bg-white/10 transition"
              />
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Quick Join Room Code Button */}
            <button
              onClick={() => setJoinOpen((v) => !v)}
              className="px-3 py-1.5 rounded-full bg-[#6842FF]/15 dark:bg-[#6842FF]/25 border border-[#6842FF]/50 hover:bg-[#6842FF]/35 text-xs font-bold text-[#5230db] dark:text-cyan-200 flex items-center gap-1.5 transition"
            >
              <KeyRound className="w-3.5 h-3.5 text-[#6842FF] dark:text-cyan-300" />
              <span className="hidden sm:inline">Join Code</span>
            </button>

            <button
              onClick={() => user && void updateSettings({ soundEnabled: !user.settings.soundEnabled })}
              className="p-2 rounded-full gv-card hover:border-white/25 transition"
              title="Toggle Sound"
            >
              {user?.settings.soundEnabled !== false ? (
                <Volume2 className="w-4 h-4 text-cyan-400" />
              ) : (
                <VolumeX className="w-4 h-4 opacity-50" />
              )}
            </button>

            <button
              onClick={() =>
                user &&
                void updateSettings({ theme: user.settings.theme === 'dark' ? 'light' : 'dark' })
              }
              className="p-2 rounded-full gv-card hover:border-white/25 transition"
              title="Dark / Light Mode"
            >
              {user?.settings.theme === 'light' ? (
                <Sun className="w-4 h-4 text-amber-500" />
              ) : (
                <Moon className="w-4 h-4 text-violet-400" />
              )}
            </button>

            <button
              onClick={() => setNotifOpen(true)}
              className="relative p-2 rounded-full gv-card hover:border-white/25 transition"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full bg-fuchsia-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {user && (
              <div className="relative">
                <button
                  onClick={() =>
                    !isInsideTelegram && allowDevAuth
                      ? setProfileMenuOpen((v) => !v)
                      : onSelectTab('profile')
                  }
                  className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full gv-card hover:border-[#6842FF]/60 transition"
                >
                  <Avatar name={user.displayName} photoUrl={user.photoUrl} online={socketConnected} size="sm" />
                  <div className="hidden md:block text-left leading-tight">
                    <div className="text-xs font-bold max-w-[90px] truncate">{user.displayName}</div>
                    <div className="text-[10px] text-[#6842FF] dark:text-cyan-300 font-mono">{user.xp} XP</div>
                  </div>
                </button>

                {profileMenuOpen && !isInsideTelegram && allowDevAuth && (
                  <div className="absolute right-0 mt-2 w-60 gv-glass rounded-2xl p-2 shadow-2xl border border-white/15 z-50 space-y-1 text-xs">
                    <div className="px-2.5 py-1.5 opacity-60 font-semibold">
                      Switch Browser Test Profile
                    </div>
                    <button
                      onClick={() => void handleSwitchProfile('player1')}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/10 flex items-center justify-between font-semibold"
                    >
                      <span>⚡ Nova (Player 1 • Admin)</span>
                      {user.telegramId === '100001' && <span className="text-emerald-400">✓</span>}
                    </button>
                    <button
                      onClick={() => void handleSwitchProfile('player2')}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/10 flex items-center justify-between font-semibold"
                    >
                      <span>🎮 Aria (Player 2)</span>
                      {user.telegramId === '100002' && <span className="text-emerald-400">✓</span>}
                    </button>
                    <div className="border-t border-white/10 my-1" />
                    <button
                      onClick={() => {
                        setProfileMenuOpen(false);
                        onSelectTab('profile');
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/10 font-semibold"
                    >
                      👤 View Profile & Settings
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quick Join Dropdown Bar */}
        {joinOpen && (
          <div className="px-4 py-2.5 border-t border-white/10 gv-glass flex items-center justify-center gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Enter 6-char room code (e.g. GV7K2P)"
              className="w-60 px-3.5 py-1.5 rounded-full gv-card text-xs font-mono uppercase focus:outline-none focus:border-cyan-400"
            />
            <button
              onClick={() => {
                if (joinCode.trim()) {
                  joinPrivateRoom(joinCode);
                  setJoinOpen(false);
                  setJoinCode('');
                }
              }}
              className="px-4 py-1.5 rounded-full bg-gradient-to-r from-[#6842FF] to-cyan-500 text-white text-xs font-bold"
            >
              Join Match
            </button>
          </div>
        )}

        {/* Announcement Ticker */}
        {platform?.globalAnnouncement && (
          <div className="bg-gradient-to-r from-[#6842FF]/20 via-cyan-500/15 to-fuchsia-500/20 border-t border-white/5 px-3 py-1 text-center text-[11px] font-medium truncate">
            ⚡ {platform.globalAnnouncement}
          </div>
        )}
      </header>

      {/* Body: Left CrazyGames Icon Rail + Main Viewport */}
      <div className="flex-1 flex">
        {/* Desktop Collapsible Left Sidebar */}
        <aside
          className={`hidden md:flex flex-col shrink-0 border-r border-black/10 dark:border-white/10 gv-glass transition-all duration-200 ${
            railExpanded ? 'w-52' : 'w-[70px]'
          }`}
        >
          <div className="sticky top-16 p-2.5 space-y-1 max-h-[calc(100dvh-4rem)] overflow-y-auto no-scrollbar">
            {categoryItems.map((c) => {
              const active = activeTab === 'home' && catalogFilter === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => pickCategory(c.id)}
                  title={c.label}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition ${
                    active
                      ? 'bg-[#6842FF] text-white shadow-[0_0_16px_rgba(104,66,255,0.3)]'
                      : 'opacity-75 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <span className="shrink-0">{c.icon}</span>
                  {railExpanded && <span className="truncate">{c.label}</span>}
                </button>
              );
            })}

            <div className="my-2 border-t border-white/10" />

            {[
              { id: 'social' as NavTab, label: 'Friends & Online', icon: <Users className="w-5 h-5 text-sky-400" /> },
              { id: 'ranks' as NavTab, label: 'Ranks & Quests', icon: <Trophy className="w-5 h-5 text-amber-400" /> },
              { id: 'profile' as NavTab, label: 'My Profile', icon: <User className="w-5 h-5 text-cyan-400" /> }
            ].map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  title={item.label}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition ${
                    active
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
                      : 'opacity-75 hover:opacity-100 hover:bg-white/5'
                  }`}
                >
                  <span className="shrink-0">{item.icon}</span>
                  {railExpanded && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}

            {user?.role === 'admin' && (
              <button
                onClick={() => onSelectTab('admin')}
                title="Admin Console"
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition ${
                  activeTab === 'admin'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
                    : 'opacity-75 hover:opacity-100 hover:bg-white/5'
                }`}
              >
                <Shield className="w-5 h-5 text-rose-400 shrink-0" />
                {railExpanded && <span className="truncate">Admin Console</span>}
              </button>
            )}

            <div className="pt-3">
              <button
                onClick={() => setRailExpanded((v) => !v)}
                className="w-full flex items-center justify-center py-2 rounded-xl gv-card opacity-65 hover:opacity-100 text-xs"
              >
                {railExpanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </div>

            {railExpanded && (
              <div className="pt-3 px-2 text-[10px] opacity-55">
                <div className="font-bold flex items-center gap-1 text-cyan-300">
                  <Sparkles className="w-3 h-3" /> GameVerse
                </div>
                <div>Powered by Sonic Network</div>
              </div>
            )}
          </div>
        </aside>

        {/* Main Scrollable Content */}
        <main className="flex-1 min-w-0 px-3 sm:px-6 py-4 pb-24 md:pb-8 max-w-[1440px] mx-auto w-full">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 gv-glass border-t border-white/10 pb-safe">
        <div className="flex items-center justify-around h-14 px-2">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-xl transition ${
                  active ? 'text-[#8b75ff]' : 'opacity-65'
                }`}
              >
                {item.icon}
                <span className="text-[10px] font-semibold">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <NotificationDrawer open={notifOpen} onClose={() => setNotifOpen(false)} />
    </div>
  );
};
