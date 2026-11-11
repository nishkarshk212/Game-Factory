import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type {
  ActiveMatchState,
  GameId,
  MatchResultSummary,
  NotificationItem,
  PlatformSettings
} from '@gameverse/shared';
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket';
import { useAuth } from './AuthContext';
import { soundFX } from '../lib/sound';
import { setTelegramClosingGuard, triggerHaptic } from '../lib/telegram';

interface MatchContextValue {
  socketConnected: boolean;
  onlineUserIds: Set<string>;
  queuedGame: GameId | null;
  queueSize: number;
  activeMatch: ActiveMatchState | null;
  matchResult: MatchResultSummary | null;
  selectedGameForLobby: GameId | null;
  incomingEmote: { fromPlayerIndex: 0 | 1; emote: string; at: number } | null;
  openLobbyForGame: (gameId: GameId) => void;
  closeLobbyModal: () => void;
  playOnline: (gameId: GameId) => void;
  leaveQueue: () => void;
  createPrivateRoom: (gameId: GameId) => void;
  joinPrivateRoom: (roomCode: string) => void;
  cancelRoom: (matchId?: string) => void;
  inviteFriendToRoom: (friendUserId: string, roomCode: string, gameId: GameId) => void;
  markReady: (matchId: string) => void;
  sendMove: (move: unknown) => void;
  resignMatch: () => void;
  offerDraw: () => void;
  respondDraw: (accept: boolean) => void;
  sendEmote: (emote: string) => void;
  requestRematch: () => void;
  leavePostgame: () => void;
}

const MatchContext = createContext<MatchContextValue | null>(null);

export const MatchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    user,
    token,
    pendingRoomFromLink,
    clearPendingRoomFromLink,
    pushToast,
    refreshUser,
    addIncomingNotification,
    setPlatform
  } = useAuth();

  const [socketConnected, setSocketConnected] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [queuedGame, setQueuedGame] = useState<GameId | null>(null);
  const [queueSize, setQueueSize] = useState(0);
  const [activeMatch, setActiveMatch] = useState<ActiveMatchState | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResultSummary | null>(null);
  const [selectedGameForLobby, setSelectedGameForLobby] = useState<GameId | null>(null);
  const [incomingEmote, setIncomingEmote] = useState<{
    fromPlayerIndex: 0 | 1;
    emote: string;
    at: number;
  } | null>(null);

  useEffect(() => {
    if (!token || !user) {
      disconnectSocket();
      setSocketConnected(false);
      setActiveMatch(null);
      setMatchResult(null);
      setQueuedGame(null);
      return;
    }

    const socket = connectSocket(token);

    const onConnect = () => {
      setSocketConnected(true);
      socket.emit('presence:list');
    };
    const onDisconnect = () => setSocketConnected(false);

    const onPresenceList = (data: { userIds: string[] }) => {
      setOnlineUserIds(new Set(data.userIds));
    };

    const onPresenceUpdate = (data: { userId: string; online: boolean }) => {
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        if (data.online) next.add(data.userId);
        else next.delete(data.userId);
        return next;
      });
    };

    const onQueueWaiting = (data: { gameId: GameId; queueSize: number }) => {
      setQueuedGame(data.gameId);
      setQueueSize(data.queueSize);
      setSelectedGameForLobby(null);
    };

    const onQueueLeft = () => {
      setQueuedGame(null);
      setQueueSize(0);
    };

    const onMatchFound = () => {
      setQueuedGame(null);
      setSelectedGameForLobby(null);
      soundFX.play('notify');
      triggerHaptic(user.settings.hapticsEnabled, 'success');
    };

    const onRoomCreated = () => {
      setSelectedGameForLobby(null);
      soundFX.play('click');
    };

    const onMatchState = (match: ActiveMatchState) => {
      setQueuedGame(null);
      setSelectedGameForLobby(null);
      setActiveMatch((prev) => {
        if (prev && prev.matchId === match.matchId && prev.moveSequence !== match.moveSequence) {
          soundFX.play('move');
          triggerHaptic(user.settings.hapticsEnabled, 'light');
        }
        return match;
      });
      if (match.status === 'active') {
        setMatchResult(null);
      }
      setTelegramClosingGuard(match.status === 'active' || match.status === 'ready_check');
    };

    const onMatchEnded = (summary: MatchResultSummary) => {
      setMatchResult(summary);
      setTelegramClosingGuard(false);
      const myIdx = activeMatch?.players[0]?.id === user.id ? 0 : 1;
      if (summary.isDraw) {
        soundFX.play('notify');
      } else if (summary.winnerIndex === myIdx) {
        soundFX.play('win');
        triggerHaptic(user.settings.hapticsEnabled, 'success');
      } else {
        soundFX.play('lose');
        triggerHaptic(user.settings.hapticsEnabled, 'heavy');
      }
      void refreshUser();
    };

    const onRematchStarted = () => {
      setMatchResult(null);
      soundFX.play('notify');
      pushToast('Rematch Started!', 'Sides swapped — your turn clock is running!', 'success');
    };

    const onMatchAbandoned = (data: { reason?: string }) => {
      setActiveMatch(null);
      setMatchResult(null);
      setTelegramClosingGuard(false);
      pushToast('Lobby Closed', data?.reason || 'Match was cancelled', 'info');
    };

    const onMatchError = (data: { error: string }) => {
      soundFX.play('error');
      triggerHaptic(user.settings.hapticsEnabled, 'error');
      pushToast('Action Rejected', data.error, 'error');
    };

    const onNotification = (n: NotificationItem) => {
      addIncomingNotification(n);
    };

    const onEmote = (data: { fromPlayerIndex: 0 | 1; emote: string }) => {
      setIncomingEmote({ ...data, at: Date.now() });
      soundFX.play('click');
    };

    const onPlatformSettings = (s: PlatformSettings) => {
      setPlatform(s);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('presence:list', onPresenceList);
    socket.on('presence:update', onPresenceUpdate);
    socket.on('queue:waiting', onQueueWaiting);
    socket.on('queue:left', onQueueLeft);
    socket.on('match:found', onMatchFound);
    socket.on('room:created', onRoomCreated);
    socket.on('match:state', onMatchState);
    socket.on('match:ended', onMatchEnded);
    socket.on('match:rematch_started', onRematchStarted);
    socket.on('match:abandoned', onMatchAbandoned);
    socket.on('match:error', onMatchError);
    socket.on('notification:new', onNotification);
    socket.on('match:emote', onEmote);
    socket.on('platform:settings', onPlatformSettings);

    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('presence:list', onPresenceList);
      socket.off('presence:update', onPresenceUpdate);
      socket.off('queue:waiting', onQueueWaiting);
      socket.off('queue:left', onQueueLeft);
      socket.off('match:found', onMatchFound);
      socket.off('room:created', onRoomCreated);
      socket.off('match:state', onMatchState);
      socket.off('match:ended', onMatchEnded);
      socket.off('match:rematch_started', onRematchStarted);
      socket.off('match:abandoned', onMatchAbandoned);
      socket.off('match:error', onMatchError);
      socket.off('notification:new', onNotification);
      socket.off('match:emote', onEmote);
      socket.off('platform:settings', onPlatformSettings);
    };
  }, [activeMatch?.players, addIncomingNotification, pushToast, refreshUser, setPlatform, token, user]);

  // Auto-join room from Telegram startapp or ?room=CODE invite link
  useEffect(() => {
    if (socketConnected && pendingRoomFromLink && user && !activeMatch) {
      getSocket()?.emit('room:join', { roomCode: pendingRoomFromLink });
      clearPendingRoomFromLink();
    }
  }, [activeMatch, clearPendingRoomFromLink, pendingRoomFromLink, socketConnected, user]);

  const playOnline = useCallback((gameId: GameId) => {
    soundFX.play('click');
    getSocket()?.emit('queue:join', { gameId });
  }, []);

  const leaveQueue = useCallback(() => {
    soundFX.play('click');
    getSocket()?.emit('queue:leave');
    setQueuedGame(null);
  }, []);

  const createPrivateRoom = useCallback((gameId: GameId) => {
    soundFX.play('click');
    getSocket()?.emit('room:create', { gameId });
  }, []);

  const joinPrivateRoom = useCallback((roomCode: string) => {
    soundFX.play('click');
    getSocket()?.emit('room:join', { roomCode: roomCode.trim().toUpperCase() });
  }, []);

  const cancelRoom = useCallback(
    (matchId?: string) => {
      getSocket()?.emit('room:cancel', { matchId: matchId || activeMatch?.matchId });
      setActiveMatch(null);
    },
    [activeMatch?.matchId]
  );

  const inviteFriendToRoom = useCallback((friendUserId: string, roomCode: string, gameId: GameId) => {
    getSocket()?.emit('room:invite_friend', { friendUserId, roomCode, gameId });
  }, []);

  const markReady = useCallback((matchId: string) => {
    soundFX.play('click');
    getSocket()?.emit('match:ready', { matchId });
  }, []);

  const sendMove = useCallback(
    (move: unknown) => {
      if (!activeMatch) return;
      getSocket()?.emit('match:move', {
        matchId: activeMatch.matchId,
        expectedSeq: activeMatch.moveSequence,
        move
      });
    },
    [activeMatch]
  );

  const resignMatch = useCallback(() => {
    if (!activeMatch) return;
    getSocket()?.emit('match:resign', { matchId: activeMatch.matchId });
  }, [activeMatch]);

  const offerDraw = useCallback(() => {
    if (!activeMatch) return;
    getSocket()?.emit('match:offer_draw', { matchId: activeMatch.matchId });
  }, [activeMatch]);

  const respondDraw = useCallback(
    (accept: boolean) => {
      if (!activeMatch) return;
      getSocket()?.emit('match:respond_draw', { matchId: activeMatch.matchId, accept });
    },
    [activeMatch]
  );

  const sendEmote = useCallback(
    (emote: string) => {
      if (!activeMatch) return;
      getSocket()?.emit('match:emote', { matchId: activeMatch.matchId, emote });
    },
    [activeMatch]
  );

  const requestRematch = useCallback(() => {
    if (!activeMatch) return;
    soundFX.play('click');
    getSocket()?.emit('match:rematch_request', { matchId: activeMatch.matchId });
  }, [activeMatch]);

  const leavePostgame = useCallback(() => {
    if (activeMatch) {
      getSocket()?.emit('match:leave_postgame', { matchId: activeMatch.matchId });
    }
    setActiveMatch(null);
    setMatchResult(null);
    setTelegramClosingGuard(false);
  }, [activeMatch]);

  return (
    <MatchContext.Provider
      value={{
        socketConnected,
        onlineUserIds,
        queuedGame,
        queueSize,
        activeMatch,
        matchResult,
        selectedGameForLobby,
        incomingEmote,
        openLobbyForGame: (gameId) => {
          soundFX.play('click');
          setSelectedGameForLobby(gameId);
        },
        closeLobbyModal: () => setSelectedGameForLobby(null),
        playOnline,
        leaveQueue,
        createPrivateRoom,
        joinPrivateRoom,
        cancelRoom,
        inviteFriendToRoom,
        markReady,
        sendMove,
        resignMatch,
        offerDraw,
        respondDraw,
        sendEmote,
        requestRematch,
        leavePostgame
      }}
    >
      {children}
    </MatchContext.Provider>
  );
};

export function useMatch() {
  const ctx = useContext(MatchContext);
  if (!ctx) throw new Error('useMatch must be used inside MatchProvider');
  return ctx;
}

