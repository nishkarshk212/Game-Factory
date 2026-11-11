import type { GameId } from '@gameverse/shared';

export interface MoveResult<S = unknown> {
  state: S;
  nextTurnIndex: 0 | 1;
  scores: [number, number];
  finished: boolean;
  winnerIndex: 0 | 1 | null;
  isDraw: boolean;
  eventText?: string;
}

export interface GameEngine<S = any> {
  id: GameId;
  createInitialState(): S;
  canPlayerAct?(state: S, playerIndex: 0 | 1, currentTurnIndex: 0 | 1): boolean;
  applyMove(state: S, playerIndex: 0 | 1, currentTurnIndex: 0 | 1, payload: unknown): MoveResult<S>;
  sanitizeForPlayer(state: S, playerIndex: 0 | 1): unknown;
}

export class InvalidMoveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidMoveError';
  }
}

export function asRecord(val: unknown): Record<string, unknown> {
  if (!val || typeof val !== 'object' || Array.isArray(val)) {
    throw new InvalidMoveError('Invalid move payload format');
  }
  return val as Record<string, unknown>;
}

export function asInt(val: unknown, name: string, min: number, max: number): number {
  if (typeof val !== 'number' || !Number.isInteger(val) || val < min || val > max) {
    throw new InvalidMoveError(`Invalid ${name}`);
  }
  return val;
}

export function asNum(val: unknown, name: string, min: number, max: number): number {
  if (typeof val !== 'number' || !Number.isFinite(val) || val < min || val > max) {
    throw new InvalidMoveError(`Invalid ${name}`);
  }
  return val;
}

