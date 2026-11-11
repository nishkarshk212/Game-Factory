import React from 'react';
import type { ActiveMatchState } from '@gameverse/shared';
import { ChessBoard } from './ChessBoard';
import { LudoBoard } from './LudoBoard';
import { CarromBoard } from './CarromBoard';
import { Pool8BallBoard } from './Pool8BallBoard';
import { SudokuBoard } from './SudokuBoard';
import { CheckersBoard } from './CheckersBoard';
import { BattleshipBoard } from './BattleshipBoard';
import { ConnectFourBoard } from './ConnectFourBoard';
import { FourInARowBoard } from './FourInARowBoard';
import { DotsAndBoxesBoard } from './DotsAndBoxesBoard';
import { TicTacToeBoard } from './TicTacToeBoard';
import { RpsBoard } from './RpsBoard';
import { ReversiBoard } from './ReversiBoard';
import { MemoryClashBoard } from './MemoryClashBoard';

interface Props {
  match: ActiveMatchState;
  myIndex: 0 | 1;
  isMyTurn: boolean;
}

export const GameBoardRouter: React.FC<Props> = ({ match, myIndex, isMyTurn }) => {
  const props = { state: match.gameState, myIndex, isMyTurn };

  switch (match.gameId) {
    case 'chess':
      return <ChessBoard {...props} />;
    case 'ludo':
      return <LudoBoard {...props} />;
    case 'carrom':
      return <CarromBoard {...props} />;
    case 'pool_8ball':
      return <Pool8BallBoard {...props} />;
    case 'sudoku':
      return <SudokuBoard {...props} />;
    case 'checkers':
      return <CheckersBoard {...props} />;
    case 'battleship':
      return <BattleshipBoard {...props} />;
    case 'connect_four':
      return <ConnectFourBoard {...props} />;
    case 'four_in_a_row':
      return <FourInARowBoard {...props} />;
    case 'dots_and_boxes':
      return <DotsAndBoxesBoard {...props} />;
    case 'tic_tac_toe':
      return <TicTacToeBoard {...props} />;
    case 'rps':
      return <RpsBoard {...props} />;
    case 'reversi':
      return <ReversiBoard {...props} />;
    case 'memory_clash':
      return <MemoryClashBoard {...props} />;
    default:
      return <div className="p-8 text-center">Unsupported game board</div>;
  }
};

