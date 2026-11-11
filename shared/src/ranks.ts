import type { RankInfo } from './types.js';

export const RANK_TIERS = [
  { minXp: 0, tier: 'Bronze Spark', color: '#CD7F32', badgeIcon: '🥉' },
  { minXp: 300, tier: 'Silver Pulse', color: '#CBD5E1', badgeIcon: '🥈' },
  { minXp: 900, tier: 'Gold Surge', color: '#FACC15', badgeIcon: '🥇' },
  { minXp: 2000, tier: 'Platinum Volt', color: '#38BDF8', badgeIcon: '💎' },
  { minXp: 4000, tier: 'Diamond Nova', color: '#A855F7', badgeIcon: '👑' },
  { minXp: 7500, tier: 'Sonic Legend', color: '#00F0FF', badgeIcon: '⚡' }
];

export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(100 * Math.pow(level - 1, 1.45));
}

export function calculateRank(rawXp: number): RankInfo {
  const xp = Math.max(0, Math.floor(rawXp || 0));
  let level = 1;
  while (xpForLevel(level + 1) <= xp && level < 99) {
    level++;
  }
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const span = Math.max(1, nextLevelXp - currentLevelXp);
  const progressPct = Math.min(100, Math.max(0, Math.round(((xp - currentLevelXp) / span) * 100)));

  let chosen = RANK_TIERS[0];
  for (const t of RANK_TIERS) {
    if (xp >= t.minXp) chosen = t;
  }

  return {
    tier: chosen.tier,
    level,
    xp,
    currentLevelXp,
    nextLevelXp,
    progressPct,
    color: chosen.color,
    badgeIcon: chosen.badgeIcon
  };
}

