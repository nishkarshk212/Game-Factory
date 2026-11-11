import React, { useState } from 'react';
import { ShieldAlert, Sparkles, UserCheck, Zap } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MatchProvider, useMatch } from './context/MatchContext';
import { AppShell, type CatalogFilter, type NavTab } from './components/Layout/AppShell';
import { ToastStack } from './components/UI/ToastStack';
import { LobbyOverlays } from './components/Lobby/LobbyOverlays';
import { MatchArena } from './components/Match/MatchArena';
import { DashboardPage } from './pages/DashboardPage';
import { SocialPage } from './pages/SocialPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { ProfilePage } from './pages/ProfilePage';
import { AdminPage } from './pages/AdminPage';

const BrowserAuthGate: React.FC = () => {
  const { loginBrowserSession, allowDevAuth, pushToast } = useAuth();
  const [customName, setCustomName] = useState('');
  const [busy, setBusy] = useState(false);

  const handleLogin = async (payload: { preset?: 'player1' | 'player2' | 'admin'; firstName?: string }) => {
    setBusy(true);
    try {
      await loginBrowserSession(payload);
    } catch (err) {
      pushToast('Login Failed', (err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh sonic-bg-grid flex items-center justify-center p-4">
      <div className="gv-glass max-w-md w-full rounded-3xl p-6 sm:p-8 border border-cyan-400/30 shadow-neon text-center space-y-5">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#6842FF] via-violet-600 to-cyan-400 flex items-center justify-center shadow-neon">
          <Zap className="w-8 h-8 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black sonic-gradient-text">GameVerse – Sonic Network</h1>
          <p className="text-xs opacity-75 mt-1">
            Telegram Mini Web App • Real-Time 2-Player Multiplayer Platform
          </p>
        </div>

        {allowDevAuth ? (
          <>
            <div className="space-y-2.5">
              <button
                disabled={busy}
                onClick={() => void handleLogin({ preset: 'player1' })}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#6842FF] to-cyan-500 text-white font-bold text-sm shadow-neon flex items-center justify-center gap-2 hover:brightness-110 transition"
              >
                <Sparkles className="w-4 h-4" />
                Enter as Nova (Player 1 • Admin)
              </button>
              <button
                disabled={busy}
                onClick={() => void handleLogin({ preset: 'player2' })}
                className="w-full py-3 rounded-2xl gv-card hover:border-cyan-400/50 font-bold text-sm flex items-center justify-center gap-2 transition"
              >
                <UserCheck className="w-4 h-4 text-emerald-400" />
                Enter as Aria (Player 2)
              </button>
            </div>
            <div className="flex gap-2 pt-1">
              <input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Or enter custom gamer name..."
                className="flex-1 px-3.5 py-2.5 rounded-xl gv-card text-xs focus:outline-none focus:border-cyan-400"
              />
              <button
                disabled={busy || !customName.trim()}
                onClick={() => void handleLogin({ firstName: customName.trim() })}
                className="px-4 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs disabled:opacity-40"
              >
                Go
              </button>
            </div>
          </>
        ) : (
          <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-400/35 text-xs text-amber-200">
            Please launch this app directly inside Telegram to authenticate automatically with your Telegram profile.
          </div>
        )}

        <div className="text-[11px] opacity-55">GameVerse | Powered by Sonic Network</div>
      </div>
    </div>
  );
};

const MainRouter: React.FC = () => {
  const { user, loading, platform } = useAuth();
  const { activeMatch } = useMatch();
  const [tab, setTab] = useState<NavTab>('home');
  const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  if (loading) {
    return (
      <div className="min-h-dvh sonic-bg-grid flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6842FF] to-cyan-400 flex items-center justify-center shadow-neon animate-pulse">
          <Zap className="w-8 h-8 text-white" />
        </div>
        <div className="font-bold text-lg sonic-gradient-text">Loading GameVerse Arcade...</div>
      </div>
    );
  }

  if (!user) {
    return <BrowserAuthGate />;
  }

  if (platform?.maintenanceMode && user.role !== 'admin') {
    return (
      <div className="min-h-dvh sonic-bg-grid flex items-center justify-center p-4">
        <div className="gv-glass max-w-md w-full rounded-3xl p-6 text-center space-y-3 border border-amber-400/35">
          <ShieldAlert className="w-10 h-10 text-amber-400 mx-auto" />
          <h2 className="text-xl font-black">Scheduled Maintenance</h2>
          <p className="text-xs opacity-80">{platform.maintenanceMessage}</p>
        </div>
      </div>
    );
  }

  const inLiveMatch =
    activeMatch &&
    (activeMatch.status === 'active' || activeMatch.status === 'completed');

  return (
    <AppShell
      activeTab={tab}
      onSelectTab={setTab}
      catalogFilter={catalogFilter}
      onSelectFilter={setCatalogFilter}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
    >
      {inLiveMatch ? (
        <MatchArena />
      ) : (
        <>
          {tab === 'home' && (
            <DashboardPage
              filter={catalogFilter}
              onSelectFilter={setCatalogFilter}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
          )}
          {tab === 'social' && <SocialPage />}
          {tab === 'ranks' && <LeaderboardPage />}
          {tab === 'profile' && <ProfilePage />}
          {tab === 'admin' && user.role === 'admin' && <AdminPage />}
        </>
      )}
      <LobbyOverlays />
    </AppShell>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MatchProvider>
        <ToastStack />
        <MainRouter />
      </MatchProvider>
    </AuthProvider>
  );
};

export default App;
