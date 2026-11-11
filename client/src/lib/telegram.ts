declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe?: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            photo_url?: string;
          };
          start_param?: string;
        };
        platform?: string;
        colorScheme?: 'light' | 'dark';
        ready: () => void;
        expand: () => void;
        enableClosingConfirmation?: () => void;
        disableClosingConfirmation?: () => void;
        setHeaderColor?: (color: string) => void;
        setBackgroundColor?: (color: string) => void;
        openTelegramLink?: (url: string) => void;
        HapticFeedback?: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
      };
    };
  }
}

export function getTelegramWebApp() {
  return window.Telegram?.WebApp;
}

export function initTelegramMiniApp(): {
  isInsideTelegram: boolean;
  initData: string;
  startRoomCode: string | null;
} {
  const tg = getTelegramWebApp();
  const urlParams = new URLSearchParams(window.location.search);
  const queryRoom = urlParams.get('room');

  if (tg && tg.initData) {
    try {
      tg.ready();
      tg.expand();
      tg.setHeaderColor?.('#070913');
      tg.setBackgroundColor?.('#070913');
    } catch {
      // ignore on unsupported desktop builds
    }
    const startParam = tg.initDataUnsafe?.start_param;
    const roomFromParam =
      startParam && startParam.toUpperCase().startsWith('ROOM_')
        ? startParam.slice(5).toUpperCase()
        : startParam && /^[A-Z0-9]{4,10}$/i.test(startParam)
          ? startParam.toUpperCase()
          : null;
    return {
      isInsideTelegram: true,
      initData: tg.initData,
      startRoomCode: roomFromParam || (queryRoom ? queryRoom.toUpperCase() : null)
    };
  }

  return {
    isInsideTelegram: false,
    initData: '',
    startRoomCode: queryRoom ? queryRoom.toUpperCase() : null
  };
}

export function syncTelegramTheme(theme: 'dark' | 'light') {
  const tg = getTelegramWebApp();
  const bg = theme === 'dark' ? '#070913' : '#f1f5f9';
  try {
    tg?.setHeaderColor?.(bg);
    tg?.setBackgroundColor?.(bg);
  } catch {
    // ignore
  }
}

export function setTelegramClosingGuard(active: boolean) {
  const tg = getTelegramWebApp();
  try {
    if (active) tg?.enableClosingConfirmation?.();
    else tg?.disableClosingConfirmation?.();
  } catch {
    // ignore
  }
}

export function triggerHaptic(
  enabled: boolean,
  kind: 'light' | 'medium' | 'heavy' | 'success' | 'error' = 'light'
) {
  if (!enabled) return;
  const tg = getTelegramWebApp();
  try {
    if (tg?.HapticFeedback) {
      if (kind === 'success' || kind === 'error') {
        tg.HapticFeedback.notificationOccurred(kind);
      } else {
        tg.HapticFeedback.impactOccurred(kind);
      }
      return;
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      const ms = kind === 'heavy' ? 35 : kind === 'error' ? [30, 30, 30] : kind === 'success' ? [20, 20] : 12;
      navigator.vibrate(ms);
    }
  } catch {
    // ignore
  }
}

export function buildInviteLinks(
  roomCode: string,
  gameName: string,
  botUsername: string,
  appShortName: string
) {
  const webUrl = `${window.location.origin}/?room=${encodeURIComponent(roomCode)}`;
  const tgMiniAppUrl = botUsername
    ? `https://t.me/${botUsername}/${appShortName || 'gameverse'}?startapp=${encodeURIComponent(roomCode)}`
    : webUrl;
  const shareText = `⚡ Challenge me in ${gameName} on GameVerse – Sonic Network! Room Code: ${roomCode}`;
  const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(
    botUsername ? tgMiniAppUrl : webUrl
  )}&text=${encodeURIComponent(shareText)}`;

  return { webUrl, tgMiniAppUrl, telegramShareUrl };
}

export function openTelegramShare(shareUrl: string) {
  const tg = getTelegramWebApp();
  if (tg?.openTelegramLink) {
    tg.openTelegramLink(shareUrl);
  } else {
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  }
}

