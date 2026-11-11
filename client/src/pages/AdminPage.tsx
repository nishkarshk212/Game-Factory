import React, { useCallback, useEffect, useState } from 'react';
import {
  GAME_MAP,
  type GameAdminConfig,
  type PlatformSettings,
  type ReportItem,
  type UserProfile
} from '@gameverse/shared';
import { Activity, Ban, Megaphone, RefreshCw, Shield, Sliders, Users } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export const AdminPage: React.FC = () => {
  const { pushToast, refreshGames } = useAuth();
  const [tab, setTab] = useState<'overview' | 'games' | 'users' | 'reports' | 'settings'>('overview');
  const [overview, setOverview] = useState<any>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [gameConfigs, setGameConfigs] = useState<GameAdminConfig[]>([]);
  const [announceTitle, setAnnounceTitle] = useState('');
  const [announceMsg, setAnnounceMsg] = useState('');

  const loadAll = useCallback(async () => {
    try {
      const [ov, us, rp] = await Promise.all([
        apiRequest('/api/admin/overview'),
        apiRequest<{ users: UserProfile[] }>('/api/admin/users'),
        apiRequest<{ reports: ReportItem[] }>('/api/admin/reports')
      ]);
      setOverview(ov);
      setSettings(ov.settings);
      setGameConfigs(ov.gameConfigs || []);
      setUsers(us.users);
      setReports(rp.reports);
    } catch (err) {
      pushToast('Admin load failed', (err as Error).message, 'error');
    }
  }, [pushToast]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const updateGame = async (gameId: string, patch: Partial<GameAdminConfig>) => {
    await apiRequest(`/api/admin/games/${gameId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch)
    });
    await Promise.all([loadAll(), refreshGames()]);
    pushToast('Game Updated', `${gameId} config saved`, 'success');
  };

  const toggleBan = async (u: UserProfile) => {
    await apiRequest(`/api/admin/users/${u.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isBanned: !u.isBanned })
    });
    await loadAll();
    pushToast('User Updated', `${u.displayName} ${!u.isBanned ? 'banned' : 'unbanned'}`, 'info');
  };

  const toggleAdmin = async (u: UserProfile) => {
    const nextRole = u.role === 'admin' ? 'user' : 'admin';
    await apiRequest(`/api/admin/users/${u.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ role: nextRole })
    });
    await loadAll();
    pushToast('Role Updated', `${u.displayName} is now ${nextRole}`, 'info');
  };

  const terminateMatch = async (matchId: string) => {
    await apiRequest(`/api/admin/matches/${matchId}/terminate`, { method: 'POST' });
    await loadAll();
    pushToast('Match Terminated', 'Live match ended by admin', 'info');
  };

  const resolveReport = async (id: string, status: ReportItem['status']) => {
    await apiRequest(`/api/admin/reports/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    await loadAll();
  };

  const saveSettings = async (patch: Partial<PlatformSettings>) => {
    const res = await apiRequest<{ settings: PlatformSettings }>('/api/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify(patch)
    });
    setSettings(res.settings);
    pushToast('Platform Settings Saved', 'Synced across Sonic Network', 'success');
  };

  const sendAnnouncement = async () => {
    if (!announceTitle.trim() || !announceMsg.trim()) return;
    await apiRequest('/api/admin/announce', {
      method: 'POST',
      body: JSON.stringify({ title: announceTitle, message: announceMsg })
    });
    setAnnounceTitle('');
    setAnnounceMsg('');
    pushToast('Broadcast Sent!', 'Delivered to all online players', 'success');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black flex items-center gap-2">
          <Shield className="w-5 h-5 text-violet-400" />
          Sonic Network Admin Console
        </h2>
        <button onClick={() => void loadAll()} className="p-2 rounded-xl gv-glass">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* KPIs */}
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {[
            { label: 'Total Users', val: overview.totalUsers },
            { label: 'Online Now', val: overview.onlineCount },
            { label: 'Live Matches', val: overview.liveMatches?.length || 0 },
            { label: 'Completed', val: overview.completedMatches },
            { label: 'Open Reports', val: overview.openReports }
          ].map((k) => (
            <div key={k.label} className="gv-glass rounded-2xl p-3.5 text-center">
              <div className="text-2xl font-mono font-bold text-cyan-300">{k.val}</div>
              <div className="text-[11px] opacity-65">{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { id: 'overview', label: 'Live Matches', icon: <Activity className="w-3.5 h-3.5" /> },
          { id: 'games', label: 'Games', icon: <Sliders className="w-3.5 h-3.5" /> },
          { id: 'users', label: 'Users', icon: <Users className="w-3.5 h-3.5" /> },
          { id: 'reports', label: `Reports (${overview?.openReports || 0})`, icon: <Ban className="w-3.5 h-3.5" /> },
          { id: 'settings', label: 'Platform', icon: <Megaphone className="w-3.5 h-3.5" /> }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap ${
              tab === t.id
                ? 'bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white'
                : 'gv-glass opacity-75'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && overview && (
        <div className="space-y-4">
          <div className="gv-glass rounded-2xl p-4 space-y-2.5">
            <div className="text-sm font-bold">Active Matches in Redis ({overview.liveMatches?.length || 0})</div>
            {overview.liveMatches?.length === 0 ? (
              <p className="text-xs opacity-65">No matches currently active.</p>
            ) : (
              overview.liveMatches.map((m: any) => (
                <div key={m.matchId} className="gv-card rounded-xl p-3 flex items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="font-bold">
                      {GAME_MAP[m.gameId as keyof typeof GAME_MAP]?.name || m.gameId} • {m.status}
                    </div>
                    <div className="opacity-70">
                      {m.player1} vs {m.player2} • Moves: {m.moveSequence}
                    </div>
                  </div>
                  <button
                    onClick={() => void terminateMatch(m.matchId)}
                    className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 font-bold"
                  >
                    Force Stop
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === 'games' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {gameConfigs.map((cfg) => {
            const g = GAME_MAP[cfg.gameId];
            return (
              <div key={cfg.gameId} className="gv-glass rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm">{g?.name || cfg.gameId}</div>
                  <div className="flex items-center gap-2 text-xs">
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={cfg.featured}
                        onChange={(e) => void updateGame(cfg.gameId, { featured: e.target.checked })}
                      />
                      Featured
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={cfg.enabled}
                        onChange={(e) => void updateGame(cfg.gameId, { enabled: e.target.checked })}
                      />
                      Enabled
                    </label>
                  </div>
                </div>
                <div className="flex gap-2 text-xs">
                  <label className="flex-1 gv-card p-2 rounded-xl flex items-center justify-between">
                    <span>Turn (s)</span>
                    <input
                      type="number"
                      min={10}
                      max={300}
                      defaultValue={cfg.turnSeconds}
                      onBlur={(e) => void updateGame(cfg.gameId, { turnSeconds: Number(e.target.value) })}
                      className="w-16 bg-transparent text-right font-mono"
                    />
                  </label>
                  <label className="flex-1 gv-card p-2 rounded-xl flex items-center justify-between">
                    <span>XP x</span>
                    <input
                      type="number"
                      min={0.5}
                      max={5}
                      step={0.5}
                      defaultValue={cfg.xpMultiplier}
                      onBlur={(e) => void updateGame(cfg.gameId, { xpMultiplier: Number(e.target.value) })}
                      className="w-14 bg-transparent text-right font-mono"
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'users' && (
        <div className="gv-glass rounded-2xl overflow-hidden">
          {users.map((u) => (
            <div key={u.id} className="p-3.5 border-b border-white/5 flex items-center justify-between gap-2 text-xs">
              <div>
                <div className="font-bold">
                  {u.displayName} ({u.role.toUpperCase()}) {u.isBanned && <span className="text-rose-400">• BANNED</span>}
                </div>
                <div className="opacity-65">
                  TG: {u.telegramId} • {u.xp} XP • {u.wins}W/{u.losses}L
                </div>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => void toggleAdmin(u)}
                  className="px-2.5 py-1 rounded-lg gv-card font-semibold"
                >
                  {u.role === 'admin' ? 'Revoke Admin' : 'Make Admin'}
                </button>
                <button
                  onClick={() => void toggleBan(u)}
                  className={`px-2.5 py-1 rounded-lg font-bold ${
                    u.isBanned ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                  }`}
                >
                  {u.isBanned ? 'Unban' : 'Ban'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'reports' && (
        <div className="space-y-2.5">
          {reports.length === 0 ? (
            <div className="gv-glass rounded-2xl p-8 text-center text-xs opacity-65">No reports submitted.</div>
          ) : (
            reports.map((r) => (
              <div key={r.id} className="gv-glass rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold">
                    {r.reporterName} reported {r.reportedUserName}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 uppercase font-bold">
                    {r.status}
                  </span>
                </div>
                <div className="opacity-80">
                  Reason: <strong>{r.reason}</strong> — {r.details || 'No extra notes'}
                </div>
                {r.status === 'open' && (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => void resolveReport(r.id, 'resolved')}
                      className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold"
                    >
                      Mark Resolved
                    </button>
                    <button
                      onClick={() => void resolveReport(r.id, 'dismissed')}
                      className="px-3 py-1 rounded-lg gv-card font-semibold"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'settings' && settings && (
        <div className="space-y-4 max-w-xl">
          <div className="gv-glass rounded-2xl p-4 space-y-3 text-xs">
            <div className="font-bold text-sm">Platform Controls</div>
            <label className="flex items-center justify-between p-2.5 rounded-xl gv-card">
              <span>Maintenance Mode</span>
              <input
                type="checkbox"
                checked={settings.maintenanceMode}
                onChange={(e) => void saveSettings({ maintenanceMode: e.target.checked })}
              />
            </label>
            <label className="flex items-center justify-between p-2.5 rounded-xl gv-card">
              <span>Allow Public Matchmaking</span>
              <input
                type="checkbox"
                checked={settings.allowPublicMatchmaking}
                onChange={(e) => void saveSettings({ allowPublicMatchmaking: e.target.checked })}
              />
            </label>
            <label className="flex items-center justify-between p-2.5 rounded-xl gv-card">
              <span>Allow Private Rooms</span>
              <input
                type="checkbox"
                checked={settings.allowPrivateRooms}
                onChange={(e) => void saveSettings({ allowPrivateRooms: e.target.checked })}
              />
            </label>
            <div className="space-y-1">
              <div className="opacity-70">Global Banner Announcement</div>
              <div className="flex gap-2">
                <input
                  value={settings.globalAnnouncement}
                  onChange={(e) => setSettings({ ...settings, globalAnnouncement: e.target.value })}
                  className="flex-1 p-2 rounded-xl gv-card"
                />
                <button
                  onClick={() => void saveSettings({ globalAnnouncement: settings.globalAnnouncement })}
                  className="px-3 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold"
                >
                  Save
                </button>
              </div>
            </div>
          </div>

          <div className="gv-glass rounded-2xl p-4 space-y-2.5 text-xs">
            <div className="font-bold text-sm">Broadcast Real-Time Notification</div>
            <input
              value={announceTitle}
              onChange={(e) => setAnnounceTitle(e.target.value)}
              placeholder="Announcement Title"
              className="w-full p-2.5 rounded-xl gv-card"
            />
            <textarea
              value={announceMsg}
              onChange={(e) => setAnnounceMsg(e.target.value)}
              placeholder="Message to all players..."
              rows={2}
              className="w-full p-2.5 rounded-xl gv-card"
            />
            <button
              onClick={() => void sendAnnouncement()}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-bold"
            >
              Broadcast Notification
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

