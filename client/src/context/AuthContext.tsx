import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type {
  GameDefinition,
  GameId,
  NotificationItem,
  PlatformSettings,
  UserProfile,
  UserSettings
} from '@gameverse/shared';
import { apiRequest, getStoredToken, setStoredToken } from '../lib/api';
import { initTelegramMiniApp, syncTelegramTheme, triggerHaptic } from '../lib/telegram';
import { soundFX } from '../lib/sound';

export interface CatalogGameItem extends GameDefinition {
  enabled: boolean;
  featured: boolean;
  xpMultiplier: number;
  turnSeconds: number;
  queueCount: number;
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant?: 'info' | 'success' | 'error';
}

interface AuthContextValue {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  isInsideTelegram: boolean;
  allowDevAuth: boolean;
  pendingRoomFromLink: string | null;
  clearPendingRoomFromLink: () => void;
  telegramBotUsername: string;
  telegramAppShortName: string;
  platform: PlatformSettings | null;
  games: CatalogGameItem[];
  notifications: NotificationItem[];
  unreadCount: number;
  toasts: ToastMessage[];
  pushToast: (title: string, description?: string, variant?: ToastMessage['variant']) => void;
  dismissToast: (id: string) => void;
  loginBrowserSession: (payload: { preset?: 'player1' | 'player2' | 'admin'; firstName?: string; username?: string; telegramId?: string }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  refreshGames: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  addIncomingNotification: (n: NotificationItem) => void;
  updateSettings: (patch: Partial<UserSettings>) => Promise<void>;
  toggleFavorite: (gameId: GameId) => Promise<void>;
  setPlatform: React.Dispatch<React.SetStateAction<PlatformSettings | null>>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [loading, setLoading] = useState(true);
  const [isInsideTelegram, setIsInsideTelegram] = useState(false);
  const [allowDevAuth, setAllowDevAuth] = useState(true);
  const [pendingRoomFromLink, setPendingRoomFromLink] = useState<string | null>(null);
  const [telegramBotUsername, setTelegramBotUsername] = useState('GameVerseSonicBot');
  const [telegramAppShortName, setTelegramAppShortName] = useState('gameverse');
  const [platform, setPlatform] = useState<PlatformSettings | null>(null);
  const [games, setGames] = useState<CatalogGameItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const pushToast = useCallback(
    (title: string, description?: string, variant: ToastMessage['variant'] = 'info') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { id, title, description, variant }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4200);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const applyThemeAndSound = useCallback((settings: UserSettings) => {
    const html = document.documentElement;
    if (settings.theme === 'dark') html.classList.add('dark');
    else html.classList.remove('dark');
    syncTelegramTheme(settings.theme);
    soundFX.enabled = settings.soundEnabled;
    soundFX.volume = settings.soundVolume;
  }, []);

  const refreshGames = useCallback(async () => {
    try {
      const res = await apiRequest<{ games: CatalogGameItem[]; platform: PlatformSettings }>('/api/games');
      setGames(res.games);
      if (res.platform) setPlatform(res.platform);
    } catch {
      // ignore initial offline error
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (!getStoredToken()) return;
    try {
      const res = await apiRequest<{ notifications: NotificationItem[] }>('/api/social/notifications');
      setNotifications(res.notifications);
    } catch {
      // ignore
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (!getStoredToken()) return;
    const me = await apiRequest<{
      user: UserProfile;
      platform: PlatformSettings;
      telegramBotUsername: string;
      telegramAppShortName: string;
      allowDevAuth: boolean;
    }>('/api/auth/me');
    setUser(me.user);
    setPlatform(me.platform);
    setTelegramBotUsername(me.telegramBotUsername);
    setTelegramAppShortName(me.telegramAppShortName);
    setAllowDevAuth(me.allowDevAuth);
    applyThemeAndSound(me.user.settings);
  }, [applyThemeAndSound]);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      const tgInfo = initTelegramMiniApp();
      setIsInsideTelegram(tgInfo.isInsideTelegram);
      if (tgInfo.startRoomCode) setPendingRoomFromLink(tgInfo.startRoomCode);

      await refreshGames();

      try {
        if (tgInfo.isInsideTelegram && tgInfo.initData) {
          const auth = await apiRequest<{ token: string; user: UserProfile; startParam?: string }>(
            '/api/auth/telegram',
            {
              method: 'POST',
              body: JSON.stringify({ initData: tgInfo.initData })
            }
          );
          if (cancelled) return;
          setStoredToken(auth.token, true);
          setToken(auth.token);
          setUser(auth.user);
          applyThemeAndSound(auth.user.settings);
          await refreshUser();
          await refreshNotifications();
        } else if (getStoredToken()) {
          await refreshUser();
          await refreshNotifications();
        } else {
          // Seamless CrazyGames-style instant entry in browser sandbox mode (per-tab sessionStorage isolation)
          try {
            const guest = await apiRequest<{ token: string; user: UserProfile }>(
              '/api/auth/browser-session',
              { method: 'POST', body: JSON.stringify({}) }
            );
            if (!cancelled) {
              setStoredToken(guest.token, false);
              setToken(guest.token);
              setUser(guest.user);
              applyThemeAndSound(guest.user.settings);
              await refreshUser();
              await refreshNotifications();
            }
          } catch {
            // Production browser mode where ALLOW_DEV_AUTH=false -> falls back cleanly to gate
          }
        }
      } catch (err) {
        setStoredToken(null);
        setToken(null);
        setUser(null);
        if (tgInfo.isInsideTelegram) {
          pushToast('Telegram Auth Error', (err as Error).message, 'error');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [applyThemeAndSound, pushToast, refreshGames, refreshNotifications, refreshUser]);

  const loginBrowserSession = useCallback(
    async (payload: { preset?: 'player1' | 'player2' | 'admin'; firstName?: string; username?: string; telegramId?: string }) => {
      const res = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/browser-session', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setStoredToken(res.token);
      setToken(res.token);
      setUser(res.user);
      applyThemeAndSound(res.user.settings);
      await refreshUser();
      await refreshNotifications();
    },
    [applyThemeAndSound, refreshNotifications, refreshUser]
  );

  const logout = useCallback(() => {
    setStoredToken(null);
    setToken(null);
    setUser(null);
    setNotifications([]);
  }, []);

  const updateSettings = useCallback(
    async (patch: Partial<UserSettings>) => {
      if (!user) return;
      const optimistic = { ...user.settings, ...patch };
      setUser({ ...user, settings: optimistic });
      applyThemeAndSound(optimistic);
      try {
        const res = await apiRequest<{ user: UserProfile }>('/api/users/settings', {
          method: 'PATCH',
          body: JSON.stringify(patch)
        });
        setUser(res.user);
      } catch (err) {
        pushToast('Settings sync failed', (err as Error).message, 'error');
      }
    },
    [applyThemeAndSound, pushToast, user]
  );

  const toggleFavorite = useCallback(
    async (gameId: GameId) => {
      if (!user) return;
      triggerHaptic(user.settings.hapticsEnabled, 'light');
      soundFX.play('click');
      const res = await apiRequest<{ favoriteGames: GameId[] }>(`/api/users/favorites/${gameId}`, {
        method: 'POST'
      });
      setUser((prev) => (prev ? { ...prev, favoriteGames: res.favoriteGames } : prev));
    },
    [user]
  );

  const markAllNotificationsRead = useCallback(async () => {
    await apiRequest('/api/social/notifications/read', { method: 'POST', body: JSON.stringify({}) });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }, []);

  const addIncomingNotification = useCallback(
    (n: NotificationItem) => {
      setNotifications((prev) => [n, ...prev.slice(0, 39)]);
      soundFX.play('notify');
      triggerHaptic(user?.settings.hapticsEnabled ?? true, 'light');
      pushToast(n.title, n.message, 'info');
    },
    [pushToast, user?.settings.hapticsEnabled]
  );

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isInsideTelegram,
        allowDevAuth,
        pendingRoomFromLink,
        clearPendingRoomFromLink: () => setPendingRoomFromLink(null),
        telegramBotUsername,
        telegramAppShortName,
        platform,
        games,
        notifications,
        unreadCount,
        toasts,
        pushToast,
        dismissToast,
        loginBrowserSession,
        logout,
        refreshUser,
        refreshGames,
        refreshNotifications,
        markAllNotificationsRead,
        addIncomingNotification,
        updateSettings,
        toggleFavorite,
        setPlatform
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

