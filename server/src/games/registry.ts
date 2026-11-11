import type { GameId } from '@gameverse/shared';
import type { GameEngine } from './engine.js';
import { ticTacToeEngine } from './ticTacToe.js';
import { connectFourEngine } from './connectFour.js';
import { fourInARowEngine } from './fourInARow.js';
import { rpsEngine } from './rps.js';
import { dotsAndBoxesEngine } from './dotsAndBoxes.js';
import { reversiEngine } from './reversi.js';
import { memoryClashEngine } from './memoryClash.js';
import { checkersEngine } from './checkers.js';
import { battleshipEngine } from './battleship.js';
import { sudokuEngine } from './sudoku.js';
import { ludoEngine } from './ludo.js';
import { chessEngine } from './chess.js';
import { carromEngine } from './carrom.js';
import { pool8BallEngine } from './pool8Ball.js';

export const ENGINE_REGISTRY: Record<GameId, GameEngine<any>> = {
  chess: chessEngine,
  ludo: ludoEngine,
  carrom: carromEngine,
  pool_8ball: pool8BallEngine,
  sudoku: sudokuEngine,
  checkers: checkersEngine,
  battleship: battleshipEngine,
  connect_four: connectFourEngine,
  four_in_a_row: fourInARowEngine,
  dots_and_boxes: dotsAndBoxesEngine,
  tic_tac_toe: ticTacToeEngine,
  rps: rpsEngine,
  reversi: reversiEngine,
  memory_clash: memoryClashEngine
};

export function getGameEngine(gameId: GameId): GameEngine<any> {
  const engine = ENGINE_REGISTRY[gameId];
  if (!engine) {
    throw new Error(`Unsupported game engine: ${gameId}`);
  }
  return engine;
}

