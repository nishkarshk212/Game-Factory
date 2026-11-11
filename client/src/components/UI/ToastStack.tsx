import React from 'react';
import { Bell, CheckCheck, Swords, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useMatch } from '../../context/MatchContext';

export const ToastStack: React.FC = () => {
  const { toasts, dismissToast } = useAuth();
  if (!toasts.length) return null;

  return (
    <div className="fixed top-4 right-4 z-[90] flex flex-col gap-2 max-w-xs w-full pointer-events-none px-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto gv-glass rounded-xl px-4 py-3 shadow-2xl border flex items-start gap-3 transition-all ${
            t.variant === 'error'
              ? 'border-rose-500/50 bg-rose-950/80 text-rose-100'
              : t.variant === 'success'
                ? 'border-emerald-400/50 bg-emerald-950/80 text-emerald-50'
                : 'border-cyan-400/40'
          }`}
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{t.title}</div>
            {t.description && <div className="text-xs opacity-80 mt-0.5 line-clamp-2">{t.description}</div>}
          </div>
          <button
            onClick={() => dismissToast(t.id)}
            className="opacity-60 hover:opacity-100 p-0.5"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

export const NotificationDrawer: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose
}) => {
  const { notifications, markAllNotificationsRead } = useAuth();
  const { joinPrivateRoom } = useMatch();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-md gv-glass h-full flex flex-col border-l border-white/10">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-lg">
            <Bell className="w-5 h-5 text-cyan-400" />
            Notifications
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void markAllNotificationsRead()}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 flex items-center gap-1"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark read
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {notifications.length === 0 ? (
            <div className="text-center py-16 opacity-60 text-sm">
              No notifications yet. Challenge friends or complete daily quests!
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`p-3.5 rounded-xl border transition ${
                  n.isRead
                    ? 'gv-card opacity-75'
                    : 'bg-cyan-500/10 border-cyan-400/35 shadow-neon'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-sm">{n.title}</div>
                  <span className="text-[10px] opacity-60 shrink-0">
                    {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs opacity-80 mt-1">{n.message}</p>
                {n.type === 'match_invite' && typeof n.payload?.roomCode === 'string' && (
                  <button
                    onClick={() => {
                      joinPrivateRoom(String(n.payload.roomCode));
                      onClose();
                    }}
                    className="mt-2.5 w-full py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <Swords className="w-3.5 h-3.5" />
                    Accept & Join Room {String(n.payload.roomCode)}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

