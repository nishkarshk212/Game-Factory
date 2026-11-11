export type GameId =
  | 'chess'
  | 'ludo'
  | 'carrom'
  | 'sudoku'
  | 'tic_tac_toe'
  | 'connect_four'
  | 'rps'
  | 'checkers'
  | 'pool_8ball'
  | 'battleship'
  | 'dots_and_boxes'
  | 'four_in_a_row'
  | 'reversi'
  | 'memory_clash';

export type GameCategory = 'strategy' | 'board' | 'arcade' | 'puzzle' | 'quick';

export interface GameDefinition {
  id: GameId;
  name: string;
  shortName: string;
  category: GameCategory;
  tagline: string;
  description: string;
  rules: string[];
  avgMinutes: string;
  defaultTurnSeconds: number;
  gradient: string;
  accentColor: string;
  badgeText: string;
  supportsDrawOffer: boolean;
  simultaneousTurns?: boolean;
}

export interface GameAdminConfig {
  gameId: GameId;
  enabled: boolean;
  featured: boolean;
  xpMultiplier: number;
  turnSeconds: number;
  updatedAt: string;
}

export interface UserSettings {
  soundEnabled: boolean;
  soundVolume: number;
  hapticsEnabled: boolean;
  theme: 'dark' | 'light';
  showMoveHints: boolean;
  compactBoard: boolean;
}

export type UserRole = 'user' | 'admin';

export interface RankInfo {
  tier: string;
  level: number;
  xp: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPct: number;
  color: string;
  badgeIcon: string;
}

export interface UserProfile {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  displayName: string;
  photoUrl: string | null;
  role: UserRole;
  isBanned: boolean;
  xp: number;
  wins: number;
  losses: number;
  draws: number;
  winStreak: number;
  bestStreak: number;
  favoriteGames: GameId[];
  settings: UserSettings;
  rank: RankInfo;
  createdAt: string;
  lastSeenAt: string;
}

export interface PlayerSummary {
  id: string;
  telegramId: string;
  username: string | null;
  displayName: string;
  photoUrl: string | null;
  xp: number;
  rank: RankInfo;
  wins: number;
  losses: number;
  draws: number;
  online: boolean;
  inMatch?: boolean;
  inQueue?: boolean;
  reconnecting?: boolean;
  disconnectDeadline?: number | null;
  ready?: boolean;
  score: number;
}

export type MatchMode = 'public' | 'private';

export type MatchStatus =
  | 'waiting_opponent'
  | 'ready_check'
  | 'active'
  | 'completed'
  | 'abandoned';

export type MatchEndReason =
  | 'normal_win'
  | 'draw'
  | 'resign'
  | 'timeout'
  | 'disconnect_forfeit'
  | 'draw_agreement'
  | 'admin_terminated';

export interface ActiveMatchState {
  matchId: string;
  gameId: GameId;
  mode: MatchMode;
  roomCode: string | null;
  status: MatchStatus;
  players: [PlayerSummary, PlayerSummary | null];
  currentTurnIndex: 0 | 1;
  turnSeconds: number;
  turnDeadline: number | null;
  startedAt: number | null;
  endedAt: number | null;
  winnerIndex: 0 | 1 | null;
  isDraw: boolean;
  endReason: MatchEndReason | null;
  moveSequence: number;
  drawOfferBy: 0 | 1 | null;
  rematchRequests: [boolean, boolean];
  gameState: unknown;
  lastEventText?: string;
}

export interface MatchResultSummary {
  matchId: string;
  gameId: GameId;
  winnerIndex: 0 | 1 | null;
  isDraw: boolean;
  endReason: MatchEndReason;
  scores: [number, number];
  xpAwarded: [number, number];
  durationMs: number;
  unlockedAchievements?: Record<string, AchievementItem[]>;
}

export interface MatchHistoryItem {
  id: string;
  gameId: GameId;
  mode: MatchMode;
  opponent: {
    id: string;
    displayName: string;
    username: string | null;
    photoUrl: string | null;
  };
  result: 'win' | 'loss' | 'draw';
  myScore: number;
  opponentScore: number;
  xpEarned: number;
  endReason: string;
  durationMs: number;
  createdAt: string;
}

export interface LeaderboardEntry {
  rankPosition: number;
  userId: string;
  displayName: string;
  username: string | null;
  photoUrl: string | null;
  xp: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  rank: RankInfo;
}

export interface AchievementItem {
  id: string;
  code: string;
  title: string;
  description: string;
  icon: string;
  xpReward: number;
  unlocked: boolean;
  unlockedAt: string | null;
}

export interface DailyChallengeItem {
  id: string;
  code: string;
  title: string;
  description: string;
  targetCount: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
  xpReward: number;
  gameId: GameId | null;
}

export interface FriendItem {
  friendshipId: string;
  user: PlayerSummary;
  status: 'pending_incoming' | 'pending_outgoing' | 'accepted';
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  type: 'match_invite' | 'friend_request' | 'friend_accepted' | 'achievement' | 'challenge' | 'system';
  title: string;
  message: string;
  payload: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

export interface ReportItem {
  id: string;
  reporterId: string;
  reporterName?: string;
  reportedUserId: string;
  reportedUserName?: string;
  matchId: string | null;
  reason: string;
  details: string;
  status: 'open' | 'reviewed' | 'resolved' | 'dismissed';
  createdAt: string;
}

export interface PlatformSettings {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  defaultTurnSeconds: number;
  reconnectGraceSeconds: number;
  globalAnnouncement: string;
  allowPrivateRooms: boolean;
  allowPublicMatchmaking: boolean;
}

