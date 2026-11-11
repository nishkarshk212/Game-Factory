import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  Globe,
  Heart,
  Lock,
  Play,
  Search,
  Sparkles,
  Users,
  Zap
} from 'lucide-react';
import { useAuth, type CatalogGameItem } from '../context/AuthContext';
import { useMatch } from '../context/MatchContext';
import { GameThumbnail } from '../components/UI/GameThumbnail';
import type { CatalogFilter } from '../components/Layout/AppShell';

interface DashboardPageProps {
  filter: CatalogFilter;
  onSelectFilter: (f: CatalogFilter) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

const GamePortalCard: React.FC<{
  game: CatalogGameItem;
  isFav: boolean;
  onToggleFav: () => void;
  onOpenModal: () => void;
  onPlayOnline: () => void;
  onPrivateRoom: () => void;
  compact?: boolean;
}> = ({ game, isFav, onToggleFav, onOpenModal, onPlayOnline, onPrivateRoom, compact }) => {
  return (
    <div
      className={`group relative rounded-2xl overflow-hidden gv-card border border-white/10 hover:border-[#6842FF]/70 hover:shadow-[0_10px_30px_rgba(104,66,255,0.22)] transition-all duration-200 flex flex-col ${
        compact ? 'w-[220px] sm:w-[245px] shrink-0 snap-start' : 'w-full'
      }`}
    >
      {/* 16:10 Full-Bleed Artwork Thumbnail */}
      <div
        onClick={onOpenModal}
        className="relative aspect-[16/10] w-full overflow-hidden cursor-pointer bg-[#11131f]"
      >
        <div className="w-full h-full transition-transform duration-300 group-hover:scale-105">
          <GameThumbnail gameId={game.id} />
        </div>

        {/* Bottom gradient fade */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c0d14] via-transparent to-black/25 pointer-events-none" />

        {/* Top Left Badges */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          {game.queueCount > 0 ? (
            <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black shadow animate-pulse">
              {game.queueCount} LIVE
            </span>
          ) : game.featured ? (
            <span className="px-2 py-0.5 rounded-full bg-[#6842FF] text-white text-[10px] font-bold flex items-center gap-0.5 shadow">
              <Flame className="w-2.5 h-2.5" /> HOT
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full bg-black/55 backdrop-blur-sm text-white/85 text-[10px] font-semibold uppercase">
              {game.badgeText}
            </span>
          )}
          {game.xpMultiplier > 1 && (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black">
              {game.xpMultiplier}x XP
            </span>
          )}
        </div>

        {/* Top Right Favorite Heart */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFav();
          }}
          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 backdrop-blur-sm hover:bg-black/75 transition"
          title={isFav ? 'Remove favorite' : 'Favorite'}
        >
          <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-pink-500 text-pink-500' : 'text-white/80'}`} />
        </button>

        {/* Desktop Hover Overlay CTA */}
        <div className="hidden sm:flex absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity items-center justify-center gap-2 p-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlayOnline();
            }}
            className="px-3.5 py-2 rounded-full bg-[#6842FF] hover:bg-[#7b59ff] text-white text-xs font-bold flex items-center gap-1.5 shadow-lg transition transform hover:scale-105"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            Play Now
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPrivateRoom();
            }}
            className="px-3 py-2 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md text-white text-xs font-bold flex items-center gap-1 transition"
            title="Create Private Room"
          >
            <Lock className="w-3 h-3" />
            Invite
          </button>
        </div>
      </div>

      {/* Card Footer */}
      <div className="p-2.5 sm:p-3 flex flex-col gap-2 bg-[var(--gv-card)] flex-1 justify-between">
        <div onClick={onOpenModal} className="cursor-pointer">
          <div className="font-bold text-xs sm:text-sm truncate group-hover:text-[#6842FF] dark:group-hover:text-cyan-300 transition">
            {game.name}
          </div>
          <div className="text-[11px] opacity-65 truncate">{game.tagline}</div>
        </div>

        {/* Mobile quick-action buttons */}
        <div className="grid grid-cols-2 gap-1.5 sm:hidden">
          <button
            onClick={onPlayOnline}
            className="py-1.5 rounded-lg bg-[#6842FF] text-white text-[11px] font-bold flex items-center justify-center gap-1"
          >
            <Globe className="w-3 h-3" /> Play
          </button>
          <button
            onClick={onPrivateRoom}
            className="py-1.5 rounded-lg bg-white/10 text-[11px] font-semibold flex items-center justify-center gap-1"
          >
            <Lock className="w-3 h-3" /> Room
          </button>
        </div>
      </div>
    </div>
  );
};

export const DashboardPage: React.FC<DashboardPageProps> = ({
  filter,
  onSelectFilter,
  searchQuery,
  onSearchChange
}) => {
  const { user, games, toggleFavorite } = useAuth();
  const { openLobbyForGame, playOnline, createPrivateRoom, onlineUserIds } = useMatch();
  const [heroIdx, setHeroIdx] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);
  const featuredRowRef = useRef<HTMLDivElement | null>(null);
  const strategyRowRef = useRef<HTMLDivElement | null>(null);
  const arcadeRowRef = useRef<HTMLDivElement | null>(null);

  const favSet = useMemo(() => new Set(user?.favoriteGames || []), [user?.favoriteGames]);
  const enabledGames = useMemo(
    () => games.filter((g) => g.enabled || user?.role === 'admin'),
    [games, user?.role]
  );

  const featuredGames = useMemo(() => enabledGames.filter((g) => g.featured), [enabledGames]);
  const favoriteGamesList = useMemo(
    () => enabledGames.filter((g) => favSet.has(g.id)),
    [enabledGames, favSet]
  );

  const heroPool = featuredGames.length > 0 ? featuredGames : enabledGames;
  const heroGame = heroPool[heroIdx % Math.max(1, heroPool.length)];

  useEffect(() => {
    if (heroPaused || heroPool.length <= 1) return;
    const t = setInterval(() => setHeroIdx((i) => (i + 1) % heroPool.length), 6000);
    return () => clearInterval(t);
  }, [heroPaused, heroPool.length]);

  const strategyBoardGames = useMemo(
    () => enabledGames.filter((g) => g.category === 'strategy' || g.category === 'board'),
    [enabledGames]
  );
  const arcadeQuickGames = useMemo(
    () => enabledGames.filter((g) => g.category === 'arcade' || g.category === 'puzzle' || g.category === 'quick'),
    [enabledGames]
  );

  const filteredGames = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enabledGames.filter((g) => {
      if (filter === 'featured' && !g.featured) return false;
      if (filter === 'favorites' && !favSet.has(g.id)) return false;
      if (
        filter !== 'all' &&
        filter !== 'featured' &&
        filter !== 'favorites' &&
        g.category !== filter
      ) {
        return false;
      }
      if (q && !g.name.toLowerCase().includes(q) && !g.tagline.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [enabledGames, favSet, filter, searchQuery]);

  const scrollShelf = (dir: -1 | 1) => {
    featuredRowRef.current?.scrollBy({ left: dir * 320, behavior: 'smooth' });
  };

  const chips: { id: CatalogFilter; label: string }[] = [
    { id: 'all', label: 'All Games' },
    { id: 'featured', label: '🔥 Popular' },
    { id: 'favorites', label: `⭐ Favorites (${favSet.size})` },
    { id: 'strategy', label: '♟️ Strategy' },
    { id: 'board', label: '🎲 Board' },
    { id: 'arcade', label: '🎱 Arcade' },
    { id: 'puzzle', label: '🧩 Puzzle' },
    { id: 'quick', label: '⚡ Quick 1v1' }
  ];

  const showHomeShelves = filter === 'all' && !searchQuery.trim();

  return (
    <div className="space-y-6">
      {/* Mobile Search Bar */}
      <div className="sm:hidden relative">
        <Search className="w-4 h-4 opacity-50 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search 14 real-time 2-player games..."
          className="w-full pl-10 pr-4 py-2.5 rounded-2xl gv-glass text-sm focus:outline-none focus:border-[#6842FF]"
        />
      </div>

      {/* Category Chips Strip */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {chips.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelectFilter(c.id)}
            className={`px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition ${
              filter === c.id
                ? 'bg-[#6842FF] text-white shadow-[0_0_16px_rgba(104,66,255,0.45)]'
                : 'gv-glass opacity-80 hover:opacity-100'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* CrazyGames Spotlight Hero Banner */}
      {showHomeShelves && heroGame && (
        <section
          onMouseEnter={() => setHeroPaused(true)}
          onMouseLeave={() => setHeroPaused(false)}
          className="relative rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br from-[#171829] via-[#131422] to-[#0f101a] text-white shadow-2xl"
        >
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] items-center">
            <div className="p-5 sm:p-8 space-y-3.5 relative z-10">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-[#6842FF]/35 border border-[#6842FF]/60 text-cyan-300 text-[11px] font-bold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  SPOTLIGHT 1v1 DUEL
                </span>
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> {onlineUserIds.size} Players Online
                </span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
                {heroGame.name}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-lg">
                {heroGame.description} Real players only on <strong>GameVerse – Sonic Network</strong>.
              </p>

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  onClick={() => playOnline(heroGame.id)}
                  className="px-5 py-3 rounded-full bg-[#6842FF] hover:bg-[#7c5aff] text-white font-bold text-sm flex items-center gap-2 shadow-[0_0_24px_rgba(104,66,255,0.5)] transition"
                >
                  <Play className="w-4 h-4 fill-white" />
                  Play Online Now
                </button>
                <button
                  onClick={() => createPrivateRoom(heroGame.id)}
                  className="px-5 py-3 rounded-full bg-white/10 border border-white/15 hover:border-cyan-400/60 text-white font-bold text-sm flex items-center gap-2 transition"
                >
                  <Lock className="w-4 h-4 text-cyan-300" />
                  Challenge Friend
                </button>
              </div>

              {/* Hero Switcher Dots */}
              <div className="flex items-center gap-1.5 pt-2">
                {heroPool.map((hg, idx) => (
                  <button
                    key={hg.id}
                    onClick={() => setHeroIdx(idx)}
                    className={`h-2 rounded-full transition-all ${
                      idx === heroIdx % heroPool.length
                        ? 'w-7 bg-cyan-400'
                        : 'w-2 bg-white/25 hover:bg-white/50'
                    }`}
                    title={hg.name}
                  />
                ))}
              </div>
            </div>

            <div
              onClick={() => openLobbyForGame(heroGame.id)}
              className="relative aspect-[16/10] lg:h-full w-full cursor-pointer overflow-hidden group"
            >
              <div className="w-full h-full group-hover:scale-105 transition-transform duration-500">
                <GameThumbnail gameId={heroGame.id} />
              </div>
              <div className="hidden lg:block absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#131422] to-transparent pointer-events-none" />
            </div>
          </div>
        </section>
      )}

      {/* Horizontal Carousel: Popular & Featured */}
      {showHomeShelves && featuredGames.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-black flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-400" />
              Featured 2-Player Arena
            </h2>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => scrollShelf(-1)}
                className="p-1.5 rounded-full gv-card hover:border-white/30"
                aria-label="Scroll left"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => scrollShelf(1)}
                className="p-1.5 rounded-full gv-card hover:border-white/30"
                aria-label="Scroll right"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div
            ref={featuredRowRef}
            className="flex gap-3.5 overflow-x-auto pb-2 snap-x no-scrollbar"
          >
            {featuredGames.map((g) => (
              <GamePortalCard
                key={`feat-${g.id}`}
                game={g}
                isFav={favSet.has(g.id)}
                onToggleFav={() => void toggleFavorite(g.id)}
                onOpenModal={() => openLobbyForGame(g.id)}
                onPlayOnline={() => playOnline(g.id)}
                onPrivateRoom={() => createPrivateRoom(g.id)}
                compact
              />
            ))}
          </div>
        </section>
      )}

      {/* Favorites Row */}
      {showHomeShelves && favoriteGamesList.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-black flex items-center gap-2">
            <Heart className="w-5 h-5 text-pink-500 fill-pink-500" />
            Your Favorites
          </h2>
          <div className="flex gap-3.5 overflow-x-auto pb-2 snap-x no-scrollbar">
            {favoriteGamesList.map((g) => (
              <GamePortalCard
                key={`fav-${g.id}`}
                game={g}
                isFav={true}
                onToggleFav={() => void toggleFavorite(g.id)}
                onOpenModal={() => openLobbyForGame(g.id)}
                onPlayOnline={() => playOnline(g.id)}
                onPrivateRoom={() => createPrivateRoom(g.id)}
                compact
              />
            ))}
          </div>
        </section>
      )}

      {/* Strategy & Board Carousel */}
      {showHomeShelves && strategyBoardGames.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-black flex items-center gap-2">
              ♟️ Strategy &amp; Board Classics
            </h2>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => strategyRowRef.current?.scrollBy({ left: -320, behavior: 'smooth' })}
                className="p-1.5 rounded-full gv-card hover:border-white/30"
                aria-label="Scroll left"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => strategyRowRef.current?.scrollBy({ left: 320, behavior: 'smooth' })}
                className="p-1.5 rounded-full gv-card hover:border-white/30"
                aria-label="Scroll right"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div ref={strategyRowRef} className="flex gap-3.5 overflow-x-auto pb-2 snap-x no-scrollbar">
            {strategyBoardGames.map((g) => (
              <GamePortalCard
                key={`sb-${g.id}`}
                game={g}
                isFav={favSet.has(g.id)}
                onToggleFav={() => void toggleFavorite(g.id)}
                onOpenModal={() => openLobbyForGame(g.id)}
                onPlayOnline={() => playOnline(g.id)}
                onPrivateRoom={() => createPrivateRoom(g.id)}
                compact
              />
            ))}
          </div>
        </section>
      )}

      {/* Arcade, Puzzle & Blitz Carousel */}
      {showHomeShelves && arcadeQuickGames.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-black flex items-center gap-2">
              🎱 Arcade, Puzzle &amp; Blitz Duels
            </h2>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => arcadeRowRef.current?.scrollBy({ left: -320, behavior: 'smooth' })}
                className="p-1.5 rounded-full gv-card hover:border-white/30"
                aria-label="Scroll left"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => arcadeRowRef.current?.scrollBy({ left: 320, behavior: 'smooth' })}
                className="p-1.5 rounded-full gv-card hover:border-white/30"
                aria-label="Scroll right"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div ref={arcadeRowRef} className="flex gap-3.5 overflow-x-auto pb-2 snap-x no-scrollbar">
            {arcadeQuickGames.map((g) => (
              <GamePortalCard
                key={`aq-${g.id}`}
                game={g}
                isFav={favSet.has(g.id)}
                onToggleFav={() => void toggleFavorite(g.id)}
                onOpenModal={() => openLobbyForGame(g.id)}
                onPlayOnline={() => playOnline(g.id)}
                onPrivateRoom={() => createPrivateRoom(g.id)}
                compact
              />
            ))}
          </div>
        </section>
      )}

      {/* Main Dense CrazyGames-Style Grid */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-black flex items-center gap-2">
            <Zap className="w-5 h-5 text-cyan-400" />
            {filter === 'all' ? 'All 2-Player Games' : chips.find((c) => c.id === filter)?.label || 'Games'}
            <span className="text-xs font-mono opacity-60">({filteredGames.length})</span>
          </h2>
        </div>

        {filteredGames.length === 0 ? (
          <div className="gv-glass rounded-3xl p-12 text-center opacity-70 text-sm">
            No games match your search or filter.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {filteredGames.map((g) => (
              <GamePortalCard
                key={g.id}
                game={g}
                isFav={favSet.has(g.id)}
                onToggleFav={() => void toggleFavorite(g.id)}
                onOpenModal={() => openLobbyForGame(g.id)}
                onPlayOnline={() => playOnline(g.id)}
                onPrivateRoom={() => createPrivateRoom(g.id)}
              />
            ))}
          </div>
        )}
      </section>

      <footer className="text-center pt-6 pb-2 text-xs opacity-50">
        GameVerse | Powered by Sonic Network • 14 Live 2-Player Telegram Mini Games
      </footer>
    </div>
  );
};
