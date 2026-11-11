import React from 'react';
import type { GameId } from '@gameverse/shared';

const GAME_EMOJI: Record<GameId, string> = {
  chess: '♟️',
  ludo: '🎲',
  carrom: '🎯',
  pool_8ball: '🎱',
  sudoku: '🔢',
  checkers: '🔴',
  battleship: '🚢',
  connect_four: '🟡',
  four_in_a_row: '🌀',
  dots_and_boxes: '📐',
  tic_tac_toe: '❌',
  rps: '✊',
  reversi: '⚫',
  memory_clash: '🃏'
};

export const GameIcon: React.FC<{ gameId: GameId; className?: string }> = ({
  gameId,
  className = 'text-2xl'
}) => {
  return (
    <span className={`inline-flex items-center justify-center select-none ${className}`} aria-hidden="true">
      {GAME_EMOJI[gameId] || '🎮'}
    </span>
  );
};

